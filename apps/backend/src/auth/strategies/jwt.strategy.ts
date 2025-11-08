import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../types/jwt-payload';
import { UsersService } from '../../users/users.service';
import { UserStatus } from '../../users/schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly usersService: UsersService) {
    // Validate JWT_SECRET before initializing strategy
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error(
        'JWT_SECRET environment variable is not set. ' +
        'Please configure JWT_SECRET in your .env file. ' +
        'Generate a secure secret: openssl rand -base64 32'
      );
    }

    if (secret.length < 32) {
      throw new Error(
        `JWT_SECRET must be at least 32 characters long. ` +
        `Current length: ${secret.length}. ` +
        `Generate a secure secret: openssl rand -base64 32`
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    // Validate that the user still exists and is active
    let user;
    try {
      user = await this.usersService.findById(payload.sub);
    } catch (error) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // Attach validated payload to request.user
    return payload;
  }
}

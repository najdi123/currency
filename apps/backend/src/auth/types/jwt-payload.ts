import { UserRole } from '../../users/schemas/user.schema';

export interface JwtPayload {
  sub: string;          // user id
  email: string;
  role: UserRole;
}

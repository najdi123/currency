import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as bcrypt from "bcrypt";
import {
  User,
  UserDocument,
  UserRole,
  UserStatus,
} from "./schemas/user.schema";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { WalletsService } from "../wallets/wallets.service";

// 12 rounds provides strong security (2^12 iterations). Adjust based on your performance requirements.
const SALT_ROUNDS = 12;

// A lean type with known _id type
export type UserLean = Omit<User, "passwordHash"> & {
  _id: Types.ObjectId;
  passwordHash?: string;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private walletsService: WalletsService,
  ) {}

  private sanitize(user: UserDocument | UserLean) {
    const obj = (user as any).toObject ? (user as any).toObject() : user;
    delete obj.passwordHash;
    return obj;
  }

  async findById(
    id: string | Types.ObjectId,
    withPassword = false,
  ): Promise<UserLean> {
    try {
      const uid = typeof id === "string" ? new Types.ObjectId(id) : id;
      const q = this.userModel
        .findOne({ _id: uid, deletedAt: null })
        .lean<UserLean>();
      if (withPassword) (q as any).select("+passwordHash");
      const user = await q.exec();
      if (!user) throw new NotFoundException("User not found");
      return withPassword ? user : (this.sanitize(user) as UserLean);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      // Handle invalid ObjectId format
      if (
        error.name === "BSONError" ||
        error.message?.includes("24 character hex")
      ) {
        throw new BadRequestException("Invalid user ID format");
      }

      this.logger.error(
        `Failed to find user by ID ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException("Failed to retrieve user");
    }
  }

  async findByEmail(
    email: string,
    withPassword = false,
  ): Promise<UserLean | null> {
    try {
      const q = this.userModel
        .findOne({ email: email.toLowerCase().trim(), deletedAt: null })
        .lean<UserLean>();
      if (withPassword) (q as any).select("+passwordHash");
      const user = await q.exec();
      return user || null;
    } catch (error: any) {
      this.logger.error(
        `Failed to find user by email ${email}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException("Failed to retrieve user");
    }
  }

  async create(dto: CreateUserDto): Promise<UserLean> {
    try {
      const existing = await this.findByEmail(dto.email);
      if (existing) throw new ConflictException("Email already in use");

      const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

      // Create user without transaction (MongoDB instance doesn't support transactions)
      const created = await this.userModel.create({
        email: dto.email.toLowerCase().trim(),
        passwordHash,
        role: dto.role ?? UserRole.USER,
        status: UserStatus.ACTIVE,
        firstName: dto.firstName,
        lastName: dto.lastName,
      });

      this.logger.log(
        `User created successfully: ${created.email} (ID: ${created._id})`,
      );

      // Create default wallets for the new user
      // This runs after user creation to ensure the user exists
      // Wallet creation errors are logged but don't fail user creation
      try {
        await this.walletsService.createDefaultWallets(
          created._id as Types.ObjectId,
        );
      } catch (walletError: any) {
        // Log wallet creation errors but don't fail the entire user creation
        // Wallets can be created later manually or via migration script if needed
        this.logger.error(
          `Failed to create default wallets for user ${created._id}: ${walletError.message}`,
          walletError.stack,
        );
      }

      return this.sanitize(created) as UserLean;
    } catch (error: any) {
      // Handle MongoDB duplicate key error
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0] || "field";
        throw new ConflictException(`${field} already in use`);
      }

      // Re-throw known exceptions
      if (error instanceof ConflictException) {
        throw error;
      }

      // Log and wrap unexpected errors
      this.logger.error(`Failed to create user: ${error.message}`, error.stack);
      throw new InternalServerErrorException("Failed to create user");
    }
  }

  async update(
    userId: string,
    dto: UpdateUserDto,
    performedBy?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserLean> {
    try {
      // Validate that at least one field is being updated
      const updateFields = Object.keys(dto).filter(
        (key) => dto[key as keyof UpdateUserDto] !== undefined,
      );
      if (updateFields.length === 0) {
        throw new BadRequestException(
          "At least one field must be provided for update",
        );
      }

      // Whitelist fields that can be updated
      const allowedFields: (keyof UpdateUserDto)[] = [
        "firstName",
        "lastName",
        "status",
        "role",
      ];
      const sanitizedDto: Partial<UpdateUserDto> = {};

      for (const field of allowedFields) {
        if (dto[field] !== undefined) {
          (sanitizedDto as any)[field] = dto[field];
        }
      }

      // Prevent direct passwordHash updates (should only happen through updatePassword)
      if ("passwordHash" in dto) {
        this.logger.warn(
          `Attempted to update passwordHash directly for user ${userId}`,
        );
        throw new BadRequestException(
          "Cannot update password directly. Use change password endpoint.",
        );
      }

      const updated = await this.userModel
        .findByIdAndUpdate(
          userId,
          { $set: sanitizedDto },
          { new: true, runValidators: true },
        )
        .lean<UserLean>()
        .exec();

      if (!updated) throw new NotFoundException("User not found");

      this.logger.log(
        `User updated successfully: ${updated.email} (ID: ${userId})`,
      );
      return this.sanitize(updated) as UserLean;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Handle MongoDB validation errors
      if (error.name === "ValidationError") {
        throw new BadRequestException(error.message);
      }

      // Handle MongoDB cast errors (invalid ObjectId)
      if (error.name === "CastError") {
        throw new BadRequestException("Invalid user ID format");
      }

      this.logger.error(
        `Failed to update user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException("Failed to update user");
    }
  }

  async setLastLogin(userId: string) {
    try {
      await this.userModel
        .updateOne({ _id: userId }, { $set: { lastLogin: new Date() } })
        .exec();
    } catch (error: any) {
      // Log but don't throw - lastLogin update failure shouldn't block login
      this.logger.warn(
        `Failed to update lastLogin for user ${userId}: ${error.message}`,
      );
    }
  }

  async list(page = 1, pageSize = 20) {
    try {
      // Validate pagination parameters
      if (page < 1) {
        throw new BadRequestException("Page must be greater than 0");
      }
      if (pageSize < 1 || pageSize > 100) {
        throw new BadRequestException("Page size must be between 1 and 100");
      }

      const skip = (page - 1) * pageSize;
      const [items, total] = await Promise.all([
        this.userModel
          .find({ deletedAt: null })
          .select("-passwordHash") // Explicitly exclude passwordHash from query
          .skip(skip)
          .limit(pageSize)
          .sort({ createdAt: -1 })
          .lean<UserLean[]>()
          .exec(),
        this.userModel.countDocuments({ deletedAt: null }).exec(),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return {
        users: items.map((u) => this.sanitize(u)),
        pagination: {
          total,
          page,
          pageSize,
          totalPages,
        },
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to list users: ${error.message}`, error.stack);
      throw new InternalServerErrorException("Failed to retrieve users");
    }
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    try {
      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      const result = await this.userModel
        .findByIdAndUpdate(userId, { $set: { passwordHash } })
        .exec();

      if (!result) {
        throw new NotFoundException("User not found");
      }

      this.logger.log(`Password updated successfully for user ID: ${userId}`);
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to update password for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException("Failed to update password");
    }
  }

  /**
   * Update failed login attempts and optionally lock the account
   * This is used for brute force protection
   */
  async updateLoginAttempts(
    userId: string,
    attempts: number,
    lockedUntil: Date | null = null,
  ): Promise<void> {
    try {
      await this.userModel.findByIdAndUpdate(userId, {
        $set: {
          failedLoginAttempts: attempts,
          lockedUntil: lockedUntil,
        },
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to update login attempts for user ${userId}: ${error.message}`,
        error.stack,
      );
      // Don't throw - this is a background operation that shouldn't block login flow
    }
  }

  /**
   * Soft delete a user by setting deletedAt timestamp
   * This preserves the user data for potential recovery and audit purposes
   */
  async softDelete(userId: string): Promise<{ message: string }> {
    try {
      const result = await this.userModel
        .findOneAndUpdate(
          { _id: userId, deletedAt: null },
          { $set: { deletedAt: new Date() } },
          { new: true },
        )
        .exec();

      if (!result) {
        throw new NotFoundException("User not found or already deleted");
      }

      this.logger.log(
        `User soft deleted successfully: ${result.email} (ID: ${userId})`,
      );
      return { message: "User deleted successfully" };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      // Handle invalid ObjectId format
      if (error.name === "CastError") {
        throw new BadRequestException("Invalid user ID format");
      }

      this.logger.error(
        `Failed to soft delete user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException("Failed to delete user");
    }
  }

  /**
   * Restore a soft-deleted user
   */
  async restore(userId: string): Promise<UserLean> {
    try {
      const result = await this.userModel
        .findOneAndUpdate(
          { _id: userId, deletedAt: { $ne: null } },
          { $unset: { deletedAt: "" } },
          { new: true },
        )
        .lean<UserLean>()
        .exec();

      if (!result) {
        throw new NotFoundException("Deleted user not found");
      }

      this.logger.log(
        `User restored successfully: ${result.email} (ID: ${userId})`,
      );
      return this.sanitize(result) as UserLean;
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      // Handle invalid ObjectId format
      if (error.name === "CastError") {
        throw new BadRequestException("Invalid user ID format");
      }

      this.logger.error(
        `Failed to restore user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException("Failed to restore user");
    }
  }

  /**
   * Permanently delete a user from the database
   * Should only be used after retention period or by explicit admin action
   */
  async hardDelete(userId: string): Promise<{ message: string }> {
    try {
      const result = await this.userModel
        .findOneAndDelete({ _id: userId })
        .exec();

      if (!result) {
        throw new NotFoundException("User not found");
      }

      this.logger.log(
        `User permanently deleted: ${result.email} (ID: ${userId})`,
      );
      return { message: "User permanently deleted" };
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      // Handle invalid ObjectId format
      if (error.name === "CastError") {
        throw new BadRequestException("Invalid user ID format");
      }

      this.logger.error(
        `Failed to permanently delete user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        "Failed to permanently delete user",
      );
    }
  }
}

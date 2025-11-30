import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type UserDocument = User & Document;

export enum UserStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  PENDING = "pending",
}

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

@Schema({ timestamps: true, collection: "users" })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: false, unique: true, sparse: true, trim: true })
  phoneNumber?: string;

  // Store only the hash (never plain text)
  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ default: UserStatus.ACTIVE, enum: UserStatus })
  status!: UserStatus;

  @Prop({ default: UserRole.USER, enum: UserRole })
  role!: UserRole;

  @Prop({ trim: true, maxlength: 100 })
  firstName?: string;

  @Prop({ trim: true, maxlength: 100 })
  lastName?: string;

  @Prop()
  lastLogin?: Date;

  // Soft delete support
  @Prop({ type: Date, index: true })
  deletedAt?: Date;

  // Email verification fields
  @Prop({ default: false })
  emailVerified!: boolean;

  @Prop({ select: false })
  emailVerificationToken?: string;

  @Prop()
  emailVerificationExpiry?: Date;

  // Account lockout fields for brute force protection
  @Prop({ default: 0 })
  failedLoginAttempts!: number;

  @Prop({ type: Date })
  lockedUntil?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Index for efficient user listing and filtering by status
// Useful for admin queries: "show me all active users, sorted by creation date"
UserSchema.index({ status: 1, createdAt: -1 });

// Index for role-based queries
// Useful for admin operations: "show me all admins"
UserSchema.index({ role: 1 });

// Compound index for login queries with soft-delete support
// Useful for: "find user by email where not deleted"
UserSchema.index({ email: 1, deletedAt: 1 });

// Partial index for account lockout cleanup queries
// Only indexes documents that have a lockout set (saves space)
UserSchema.index(
  { lockedUntil: 1 },
  {
    partialFilterExpression: { lockedUntil: { $exists: true, $ne: null } },
    name: 'lockout_cleanup',
  }
);

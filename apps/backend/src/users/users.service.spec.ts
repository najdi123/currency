import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types, Query } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User, UserDocument, UserRole, UserStatus } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UsersService', () => {
  let service: UsersService;
  let userModel: jest.Mocked<Model<UserDocument>>;

  const mockUserId = new Types.ObjectId();
  const mockUser = {
    _id: mockUserId,
    email: 'test@example.com',
    passwordHash: '$2b$12$hashedpassword',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    firstName: 'John',
    lastName: 'Doe',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Mock MongoDB session for transactions
    const mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    const mockModel = {
      create: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      updateOne: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      db: {
        startSession: jest.fn().mockResolvedValue(mockSession),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: mockModel },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userModel = module.get(getModelToken(User.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create user with hashed password', async () => {
      const createDto: CreateUserDto = {
        email: 'newuser@example.com',
        password: 'Password123!',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      const createdUser = {
        ...mockUser,
        email: createDto.email,
        firstName: createDto.firstName,
        lastName: createDto.lastName,
        toObject: jest.fn().mockReturnValue({
          _id: mockUserId,
          email: createDto.email,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          firstName: createDto.firstName,
          lastName: createDto.lastName,
          passwordHash: '$2b$12$newhash',
        }),
      };

      // Mock findByEmail to return null (no existing user)
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      userModel.findOne.mockReturnValue(mockQuery as any);

      // Mock create to return an array when called with session
      userModel.create.mockResolvedValue([createdUser] as any);

      const result = await service.create(createDto);

      expect(result.email).toBe(createDto.email.toLowerCase().trim());
      expect(result.firstName).toBe(createDto.firstName);
      expect(result.lastName).toBe(createDto.lastName);
      expect(result.passwordHash).toBeUndefined(); // Should be sanitized
      expect(userModel.create).toHaveBeenCalledWith(
        [expect.objectContaining({
          email: createDto.email.toLowerCase().trim(),
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          firstName: createDto.firstName,
          lastName: createDto.lastName,
        })],
        expect.objectContaining({ session: expect.anything() })
      );
    });

    it('should throw ConflictException for duplicate email', async () => {
      const createDto: CreateUserDto = {
        email: 'existing@example.com',
        password: 'Password123!',
      };

      // Mock findByEmail to return existing user
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUser),
      };
      userModel.findOne.mockReturnValue(mockQuery as any);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      await expect(service.create(createDto)).rejects.toThrow('Email already in use');
      expect(userModel.create).not.toHaveBeenCalled();
    });

    it('should set default status to ACTIVE', async () => {
      const createDto: CreateUserDto = {
        email: 'newuser@example.com',
        password: 'Password123!',
      };

      const createdUser = {
        ...mockUser,
        email: createDto.email,
        toObject: jest.fn().mockReturnValue({
          _id: mockUserId,
          email: createDto.email,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          passwordHash: '$2b$12$newhash',
        }),
      };

      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      userModel.findOne.mockReturnValue(mockQuery as any);
      userModel.create.mockResolvedValue([createdUser] as any);

      const result = await service.create(createDto);

      expect(userModel.create).toHaveBeenCalledWith(
        [expect.objectContaining({
          status: UserStatus.ACTIVE,
        })],
        expect.objectContaining({ session: expect.anything() })
      );
    });

    it('should hash password before saving', async () => {
      const createDto: CreateUserDto = {
        email: 'newuser@example.com',
        password: 'Password123!',
      };

      const createdUser = {
        ...mockUser,
        toObject: jest.fn().mockReturnValue(mockUser),
      };

      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      userModel.findOne.mockReturnValue(mockQuery as any);
      userModel.create.mockResolvedValue([createdUser] as any);

      await service.create(createDto);

      const createCall = (userModel.create.mock.calls[0][0] as any)[0];
      expect(createCall.passwordHash).toBeDefined();
      expect(createCall.passwordHash).not.toBe(createDto.password);
      // Verify it's a bcrypt hash
      expect(createCall.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
    });
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUser),
      };
      userModel.findOne.mockReturnValue(mockQuery as any);

      const result = await service.findByEmail('test@example.com');

      expect(result).toBeDefined();
      expect(result?.email).toBe(mockUser.email);
      expect(userModel.findOne).toHaveBeenCalledWith({
        email: 'test@example.com',
        deletedAt: null,
      });
    });

    it('should exclude password hash by default', async () => {
      const userWithoutPassword = { ...mockUser };
      delete (userWithoutPassword as any).passwordHash;

      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(userWithoutPassword),
      };
      userModel.findOne.mockReturnValue(mockQuery as any);

      const result = await service.findByEmail('test@example.com');

      expect(result?.passwordHash).toBeUndefined();
    });

    it('should include password hash when requested', async () => {
      const userWithPasswordHash = { ...mockUser, passwordHash: '$2b$12$hashedpassword' };
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(userWithPasswordHash),
      };
      userModel.findOne.mockReturnValue(mockQuery as any);

      const result = await service.findByEmail('test@example.com', true);

      expect(result?.passwordHash).toBeDefined();
      expect(mockQuery.select).toHaveBeenCalledWith('+passwordHash');
    });

    it('should return null for non-existent email', async () => {
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      userModel.findOne.mockReturnValue(mockQuery as any);

      const result = await service.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should normalize email to lowercase and trim', async () => {
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUser),
      };
      userModel.findOne.mockReturnValue(mockQuery as any);

      await service.findByEmail('  TEST@EXAMPLE.COM  ');

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: 'test@example.com',
        deletedAt: null,
      });
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUser),
      };
      userModel.findOne.mockReturnValue(mockQuery as any);

      const result = await service.findById(mockUserId.toString());

      expect(result).toBeDefined();
      expect(result._id).toEqual(mockUserId);
      expect(result.passwordHash).toBeUndefined(); // Should be sanitized
    });

    it('should throw NotFoundException for invalid ID', async () => {
      const validButNonExistentId = new Types.ObjectId().toString();
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      userModel.findOne.mockReturnValue(mockQuery as any);

      await expect(service.findById(validButNonExistentId)).rejects.toThrow(NotFoundException);
      await expect(service.findById(validButNonExistentId)).rejects.toThrow('User not found');
    });

    it('should include password hash when requested', async () => {
      const userWithPasswordHash = { ...mockUser, passwordHash: '$2b$12$hashedpassword' };
      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(userWithPasswordHash),
      };
      userModel.findOne.mockReturnValue(mockQuery as any);

      const result = await service.findById(mockUserId.toString(), true);

      expect(result.passwordHash).toBeDefined();
      expect(mockQuery.select).toHaveBeenCalledWith('+passwordHash');
    });
  });

  describe('update', () => {
    it('should update user fields successfully', async () => {
      const updateDto: UpdateUserDto = {
        firstName: 'UpdatedFirstName',
        lastName: 'UpdatedLastName',
      };

      const updatedUser = {
        ...mockUser,
        ...updateDto,
      };

      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(updatedUser),
      };
      userModel.findByIdAndUpdate.mockReturnValue(mockQuery as any);

      const result = await service.update(mockUserId.toString(), updateDto);

      expect(result.firstName).toBe(updateDto.firstName);
      expect(result.lastName).toBe(updateDto.lastName);
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUserId.toString(),
        { $set: updateDto },
        { new: true, runValidators: true }
      );
    });

    it('should throw NotFoundException for invalid ID', async () => {
      const updateDto: UpdateUserDto = {
        firstName: 'Updated',
      };

      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      };
      userModel.findByIdAndUpdate.mockReturnValue(mockQuery as any);

      await expect(service.update('invalid-id', updateDto)).rejects.toThrow(NotFoundException);
      await expect(service.update('invalid-id', updateDto)).rejects.toThrow('User not found');
    });

    it('should sanitize returned user', async () => {
      const updateDto: UpdateUserDto = {
        firstName: 'Updated',
      };

      const updatedUser = {
        ...mockUser,
        ...updateDto,
      };

      const mockQuery = {
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(updatedUser),
      };
      userModel.findByIdAndUpdate.mockReturnValue(mockQuery as any);

      const result = await service.update(mockUserId.toString(), updateDto);

      expect(result.passwordHash).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should return paginated users', async () => {
      const users = [mockUser, { ...mockUser, _id: new Types.ObjectId() }];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(users),
      };

      userModel.find.mockReturnValue(mockQuery as any);
      userModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(2),
      } as any);

      const result = await service.list(1, 10);

      expect(result.users).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(10);
    });

    it('should exclude password hashes', async () => {
      const users = [mockUser];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(users),
      };

      userModel.find.mockReturnValue(mockQuery as any);
      userModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      } as any);

      const result = await service.list(1, 10);

      expect(mockQuery.select).toHaveBeenCalledWith('-passwordHash');
      result.users.forEach((user: any) => {
        expect(user.passwordHash).toBeUndefined();
      });
    });

    it('should calculate total correctly', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      userModel.find.mockReturnValue(mockQuery as any);
      userModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(50),
      } as any);

      const result = await service.list(1, 10);

      expect(result.pagination.total).toBe(50);
    });

    it('should respect pagination parameters', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      };

      userModel.find.mockReturnValue(mockQuery as any);
      userModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      } as any);

      await service.list(3, 15);

      expect(mockQuery.skip).toHaveBeenCalledWith(30); // (3-1) * 15
      expect(mockQuery.limit).toHaveBeenCalledWith(15);
    });
  });

  describe('updatePassword', () => {
    it('should hash and update password', async () => {
      const userId = mockUserId.toString();
      const newPassword = 'NewPassword123!';

      const mockQuery = {
        exec: jest.fn().mockResolvedValue(mockUser),
      };
      userModel.findByIdAndUpdate.mockReturnValue(mockQuery as any);

      await service.updatePassword(userId, newPassword);

      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          $set: expect.objectContaining({
            passwordHash: expect.any(String),
          }),
        })
      );

      const updateCall = userModel.findByIdAndUpdate.mock.calls[0][1] as any;
      const hashedPassword = updateCall.$set.passwordHash;

      // Verify it's a bcrypt hash
      expect(hashedPassword).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(hashedPassword).not.toBe(newPassword);
    });
  });

  describe('setLastLogin', () => {
    it('should update lastLogin timestamp', async () => {
      const userId = mockUserId.toString();

      const mockQuery = {
        exec: jest.fn().mockResolvedValue(undefined),
      };
      userModel.updateOne.mockReturnValue(mockQuery as any);

      await service.setLastLogin(userId);

      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: userId },
        expect.objectContaining({
          $set: expect.objectContaining({
            lastLogin: expect.any(Date),
          }),
        })
      );
    });
  });
});

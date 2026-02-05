import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UserRepository } from '../user/user.repository';
import { OtpRepository } from './otp.repository';
import { MailService } from './mail.service';
import { APP_REPOSITORIES } from '../../constants/repositories';
import { UserRole } from '../user/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: jest.Mocked<UserRepository>;
  let otpRepo: jest.Mocked<OtpRepository>;
  let mailService: jest.Mocked<MailService>;
  let configGet: jest.Mock;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hash',
    emailVerified: false,
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOtpRecord = {
    id: 'otp-1',
    email: 'test@example.com',
    otp: '123456',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    used: false,
  };

  beforeEach(async () => {
    configGet = jest.fn((key: string) => (key === 'ADMIN_EMAILS' ? '' : undefined));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: APP_REPOSITORIES.USER,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn().mockResolvedValue(mockUser),
            save: jest.fn().mockResolvedValue(mockUser),
          },
        },
        {
          provide: OtpRepository,
          useValue: {
            create: jest.fn().mockResolvedValue(mockOtpRecord),
            findValid: jest.fn(),
            markUsed: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: MailService,
          useValue: { sendOtpEmail: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('jwt-token') },
        },
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get(APP_REPOSITORIES.USER) as jest.Mocked<UserRepository>;
    otpRepo = module.get(OtpRepository) as jest.Mocked<OtpRepository>;
    mailService = module.get(MailService) as jest.Mocked<MailService>;
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('registers a new user and sends OTP', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(null);

      const result = await service.register('test@example.com', 'Password123!');

      expect(result).toEqual({ message: 'Registration successful. Check your email for the OTP.' });
      expect(userRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          emailVerified: false,
        }),
      );
      expect(otpRepo.create).toHaveBeenCalled();
      expect(mailService.sendOtpEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('normalizes email to lowercase', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(null);

      await service.register('Test@Example.COM', 'Password123!');

      expect(userRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' }),
      );
    });

    it('throws ConflictException when email already exists', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.register('test@example.com', 'Password123!')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register('test@example.com', 'Password123!')).rejects.toThrow(
        'User with this email already exists',
      );
      expect(userRepo.create).not.toHaveBeenCalled();
      expect(otpRepo.create).not.toHaveBeenCalled();
    });

    it('still returns success when mail delivery fails (OTP logged)', async () => {
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(null);
      (mailService.sendOtpEmail as jest.Mock).mockRejectedValue(new Error('SMTP failed'));

      const result = await service.register('test@example.com', 'Password123!');

      expect(result).toEqual({ message: 'Registration successful. Check your email for the OTP.' });
      expect(userRepo.create).toHaveBeenCalled();
      expect(otpRepo.create).toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    it('verifies OTP and returns JWT with user', async () => {
      (otpRepo.findValid as jest.Mock).mockResolvedValue(mockOtpRecord);
      (userRepo.findByEmail as jest.Mock).mockResolvedValue({ ...mockUser, emailVerified: false });
      configGet.mockReturnValue('');

      const result = await service.verifyOtp('test@example.com', '123456');

      expect(result).toMatchObject({
        access_token: 'jwt-token',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          emailVerified: true,
          role: UserRole.USER,
        },
      });
      expect(otpRepo.markUsed).toHaveBeenCalledWith('otp-1');
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('assigns ADMIN role when email is in ADMIN_EMAILS', async () => {
      (otpRepo.findValid as jest.Mock).mockResolvedValue(mockOtpRecord);
      (userRepo.findByEmail as jest.Mock).mockResolvedValue({ ...mockUser, emailVerified: false });
      const configGet = (service as any).config.get as jest.Mock;
      configGet.mockReturnValue('admin@example.com,test@example.com');

      const result = await service.verifyOtp('test@example.com', '123456');

      expect(result.user.role).toBe(UserRole.ADMIN);
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.ADMIN }),
      );
    });

    it('normalizes email when verifying', async () => {
      (otpRepo.findValid as jest.Mock).mockResolvedValue(mockOtpRecord);
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(mockUser);

      await service.verifyOtp('  Test@Example.COM  ', '123456');

      expect(otpRepo.findValid).toHaveBeenCalledWith('test@example.com', '123456');
    });

    it('throws BadRequestException for invalid OTP', async () => {
      (otpRepo.findValid as jest.Mock).mockResolvedValue(null);

      await expect(service.verifyOtp('test@example.com', '999999')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyOtp('test@example.com', '999999')).rejects.toThrow(
        'Invalid or expired OTP',
      );
      expect(otpRepo.markUsed).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for expired OTP', async () => {
      const expiredRecord = {
        ...mockOtpRecord,
        expiresAt: new Date(Date.now() - 60 * 1000),
      };
      (otpRepo.findValid as jest.Mock).mockResolvedValue(expiredRecord);

      await expect(service.verifyOtp('test@example.com', '123456')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyOtp('test@example.com', '123456')).rejects.toThrow('OTP has expired');
    });

    it('throws BadRequestException when user not found', async () => {
      (otpRepo.findValid as jest.Mock).mockResolvedValue(mockOtpRecord);
      (userRepo.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(service.verifyOtp('test@example.com', '123456')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.verifyOtp('test@example.com', '123456')).rejects.toThrow('User not found');
    });
  });

  describe('validateUser', () => {
    it('returns user when found', async () => {
      (userRepo.findById as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.validateUser({ sub: 'user-1' });

      expect(result).toEqual(mockUser);
      expect(userRepo.findById).toHaveBeenCalledWith('user-1');
    });

    it('returns null when user not found', async () => {
      (userRepo.findById as jest.Mock).mockResolvedValue(null);

      const result = await service.validateUser({ sub: 'unknown' });

      expect(result).toBeNull();
    });
  });
});

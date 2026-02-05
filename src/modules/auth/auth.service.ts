import { Injectable, ConflictException, BadRequestException, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../user/user.repository';
import { OtpRepository } from './otp.repository';
import { MailService } from './mail.service';
import { APP_REPOSITORIES } from '../../constants/repositories';
import type { User } from '../user/entities/user.entity';
import { UserRole } from '../user/entities/user.entity';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(APP_REPOSITORIES.USER)
    private readonly userRepo: UserRepository,
    private readonly config: ConfigService,
    private readonly otpRepo: OtpRepository,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string): Promise<{ message: string }> {
    const normalized = email.toLowerCase().trim();
    const existing = await this.userRepo.findByEmail(normalized);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.userRepo.create({
      email: normalized,
      passwordHash,
      emailVerified: false,
    });
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await this.otpRepo.create({
      email: normalized,
      otp,
      expiresAt,
    });
    try {
      await this.mailService.sendOtpEmail(normalized, otp);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Mail delivery failed: ${msg}. OTP for ${normalized}: ${otp}`);
    }
    return { message: 'Registration successful. Check your email for the OTP.' };
  }

  async verifyOtp(
    email: string,
    otp: string,
  ): Promise<{
    access_token: string;
    user: { id: string; email: string; emailVerified: boolean; role: UserRole };
  }> {
    const normalized = email.toLowerCase().trim();
    const record = await this.otpRepo.findValid(normalized, otp);
    if (!record) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    if (new Date() > record.expiresAt) {
      throw new BadRequestException('OTP has expired');
    }
    const user = await this.userRepo.findByEmail(normalized);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    await this.otpRepo.markUsed(record.id);
    user.emailVerified = true;

    const adminEmails = this.config.get<string>('ADMIN_EMAILS', '');
    const isAdmin = adminEmails
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
      .includes(normalized);
    if (isAdmin) {
      user.role = UserRole.ADMIN;
    }

    await this.userRepo.save(user);
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
      },
    };
  }

  async validateUser(payload: { sub: string }): Promise<User | null> {
    return this.userRepo.findById(payload.sub);
  }
}

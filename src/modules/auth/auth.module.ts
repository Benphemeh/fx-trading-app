import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MailService } from './mail.service';
import { OtpVerification } from './entities/otp-verification.entity';
import { OtpRepository } from './otp.repository';
import { JwtStrategy } from './jwt.strategy';
import { UserModule } from '../user/user.module';
import { APP_REPOSITORIES } from '../../constants/repositories';

@Module({
  imports: [
    UserModule,
    TypeOrmModule.forFeature([OtpVerification]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    MailService,
    OtpRepository,
    JwtStrategy,
    { provide: APP_REPOSITORIES.OTP_VERIFICATION, useExisting: OtpRepository },
  ],
  exports: [AuthService],
})
export class AuthModule {}

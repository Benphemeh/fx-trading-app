import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyDto } from './dto/verify.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a user and trigger OTP email' })
  @ApiResponse({ status: 201, description: 'OTP sent to email' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify OTP and activate account' })
  @ApiResponse({ status: 200, description: 'Account verified and JWT returned' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verify(@Body() dto: VerifyDto) {
    return this.authService.verifyOtp(dto.email, dto.otp);
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { User } from '../user/entities/user.entity';

@Injectable()
export class VerifiedUserGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: User = request.user;
    if (!user?.emailVerified) {
      throw new ForbiddenException('Email must be verified to access this resource');
    }
    return true;
  }
}

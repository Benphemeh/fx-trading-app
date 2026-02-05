import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserRepository } from './user.repository';
import { APP_REPOSITORIES } from '../../constants/repositories';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [
    UserRepository,
    { provide: APP_REPOSITORIES.USER, useExisting: UserRepository },
  ],
  exports: [APP_REPOSITORIES.USER, UserRepository],
})
export class UserModule {}

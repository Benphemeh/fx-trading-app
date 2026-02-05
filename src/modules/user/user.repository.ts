import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { APP_REPOSITORIES } from '../../constants/repositories';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  getRepository(): Repository<User> {
    return this.repo;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.repo.create({
      ...data,
      email: data.email?.toLowerCase(),
    });
    return this.repo.save(user);
  }

  async save(user: User): Promise<User> {
    return this.repo.save(user);
  }
}

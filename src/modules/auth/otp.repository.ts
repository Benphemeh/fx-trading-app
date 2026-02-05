import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OtpVerification } from './entities/otp-verification.entity';
import { APP_REPOSITORIES } from '../../constants/repositories';

@Injectable()
export class OtpRepository {
  constructor(
    @InjectRepository(OtpVerification)
    private readonly repo: Repository<OtpVerification>,
  ) {}

  async create(data: Partial<OtpVerification>): Promise<OtpVerification> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async findValid(email: string, otp: string): Promise<OtpVerification | null> {
    return this.repo.findOne({
      where: { email: email.toLowerCase(), otp, used: false },
    });
  }

  async markUsed(id: string): Promise<void> {
    await this.repo.update({ id }, { used: true });
  }
}

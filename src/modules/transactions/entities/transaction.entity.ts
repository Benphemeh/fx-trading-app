import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum TransactionType {
  FUND = 'FUND',
  CONVERT = 'CONVERT',
  TRADE = 'TRADE',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('transactions')
@Index(['userId', 'createdAt'])
@Index(['userId', 'type'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.COMPLETED,
  })
  status: TransactionStatus;

  @Column({ type: 'bigint' })
  amountMinor: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'bigint', nullable: true })
  amountDestinationMinor: string | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currencyDestination: string | null;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  rateUsed: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  idempotencyKey: string | null;
}

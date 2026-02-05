import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from './transaction.service';
import { TransactionRepository } from './transaction.repository';
import { APP_REPOSITORIES } from '../../constants/repositories';
import { TransactionType, TransactionStatus } from './entities/transaction.entity';

describe('TransactionService', () => {
  let service: TransactionService;
  let transactionRepo: jest.Mocked<TransactionRepository>;

  const mockTransactions = [
    {
      id: 'tx-2',
      userId: 'user-1',
      type: TransactionType.CONVERT,
      status: TransactionStatus.COMPLETED,
      amountMinor: '100000',
      currency: 'NGN',
      amountDestinationMinor: '72',
      currencyDestination: 'USD',
      rateUsed: '0.00072',
      createdAt: new Date('2026-02-04T13:27:14Z'),
      idempotencyKey: null,
    },
    {
      id: 'tx-1',
      userId: 'user-1',
      type: TransactionType.FUND,
      status: TransactionStatus.COMPLETED,
      amountMinor: '100000',
      currency: 'NGN',
      amountDestinationMinor: null,
      currencyDestination: null,
      rateUsed: null,
      createdAt: new Date('2026-02-04T12:50:27Z'),
      idempotencyKey: null,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: APP_REPOSITORIES.TRANSACTION,
          useValue: {
            findByUserId: jest.fn().mockResolvedValue(mockTransactions),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    transactionRepo = module.get(APP_REPOSITORIES.TRANSACTION) as jest.Mocked<TransactionRepository>;
    jest.clearAllMocks();
  });

  describe('getHistory', () => {
    it('returns formatted transaction list with amounts in major units', async () => {
      const result = await service.getHistory('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'tx-2',
        type: TransactionType.CONVERT,
        status: 'COMPLETED',
        amount: 1000,
        currency: 'NGN',
        amountDestination: 0.72,
        currencyDestination: 'USD',
        rateUsed: 0.00072,
      });
      expect(result[1]).toMatchObject({
        id: 'tx-1',
        type: TransactionType.FUND,
        status: 'COMPLETED',
        amount: 1000,
        currency: 'NGN',
        amountDestination: null,
        currencyDestination: null,
        rateUsed: null,
      });
      expect(result[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('converts minor units to major correctly', async () => {
      (transactionRepo.findByUserId as jest.Mock).mockResolvedValue([
        {
          ...mockTransactions[0],
          amountMinor: '5000',
          currency: 'USD',
          amountDestinationMinor: null,
          currencyDestination: null,
          rateUsed: null,
        },
      ]);

      const result = await service.getHistory('user-1');

      expect(result[0].amount).toBe(50);
    });

    it('filters by type when provided', async () => {
      await service.getHistory('user-1', { type: TransactionType.FUND });

      expect(transactionRepo.findByUserId).toHaveBeenCalledWith('user-1', {
        type: TransactionType.FUND,
        limit: 50,
      });
    });

    it('respects limit and offset', async () => {
      await service.getHistory('user-1', { limit: 10, offset: 5 });

      expect(transactionRepo.findByUserId).toHaveBeenCalledWith('user-1', {
        limit: 10,
        offset: 5,
      });
    });

    it('returns empty array when no transactions', async () => {
      (transactionRepo.findByUserId as jest.Mock).mockResolvedValue([]);

      const result = await service.getHistory('user-1');

      expect(result).toEqual([]);
    });

    it('handles CONVERT transaction with destination amount', async () => {
      (transactionRepo.findByUserId as jest.Mock).mockResolvedValue([
        {
          id: 'tx-convert',
          userId: 'user-1',
          type: TransactionType.CONVERT,
          status: TransactionStatus.COMPLETED,
          amountMinor: '5000',
          currency: 'EUR',
          amountDestinationMinor: '8194955',
          currencyDestination: 'NGN',
          rateUsed: '1638.991',
          createdAt: new Date(),
          idempotencyKey: null,
        },
      ]);

      const result = await service.getHistory('user-1');

      expect(result[0].amount).toBe(50);
      expect(result[0].amountDestination).toBeCloseTo(81949.55, 2);
      expect(result[0].rateUsed).toBe(1638.991);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { WalletService } from './wallet.service';
import { WalletRepository } from './wallet.repository';
import { TransactionRepository } from '../transactions/transaction.repository';
import { FxRatesService } from '../fx/fx-rates.service';
import { APP_REPOSITORIES } from '../../constants/repositories';
import type { User } from '../user/entities/user.entity';

describe('WalletService', () => {
  let service: WalletService;
  let walletRepo: WalletRepository;
  let transactionRepo: TransactionRepository;
  let fxRatesService: FxRatesService;
  let dataSource: DataSource;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hash',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: APP_REPOSITORIES.WALLET,
          useValue: {
            findByUserId: jest.fn().mockResolvedValue([]),
            findByUserAndCurrency: jest.fn().mockResolvedValue(null),
            getOrCreate: jest.fn().mockResolvedValue({}),
            addBalance: jest.fn().mockResolvedValue(undefined),
            subtractBalance: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: APP_REPOSITORIES.TRANSACTION,
          useValue: {
            findByIdempotencyKey: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: FxRatesService,
          useValue: {
            convert: jest.fn().mockResolvedValue({
              amountDestinationMinor: 72,
              rate: 0.00072,
            }),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: () => mockQueryRunner,
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'SUPPORTED_CURRENCIES' ? 'NGN,USD,EUR,GBP' : null)) },
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    walletRepo = module.get(APP_REPOSITORIES.WALLET);
    transactionRepo = module.get(APP_REPOSITORIES.TRANSACTION);
    fxRatesService = module.get<FxRatesService>(FxRatesService);
    dataSource = module.get<DataSource>(DataSource);
    jest.clearAllMocks();
  });

  describe('getBalances', () => {
    it('returns supported currencies with zero balance when no wallet rows', async () => {
      const result = await service.getBalances(mockUser.id);
      expect(result.length).toBeGreaterThanOrEqual(4);
      expect(result.map((r) => r.currency).sort()).toContain('NGN');
      expect(result.map((r) => r.currency).sort()).toContain('USD');
      expect(result.every((r) => r.balance >= 0)).toBe(true);
    });

    it('includes balanceMinor for each currency', async () => {
      const result = await service.getBalances(mockUser.id);
      result.forEach((r) => {
        expect(r).toHaveProperty('balanceMinor');
        expect(r).toHaveProperty('currency');
        expect(r).toHaveProperty('balance');
      });
    });

    it('returns existing wallet rows with correct balance conversion', async () => {
      (walletRepo.findByUserId as jest.Mock).mockResolvedValue([
        { currency: 'NGN', balanceMinor: '100000' },
        { currency: 'USD', balanceMinor: '5000' },
      ]);

      const result = await service.getBalances(mockUser.id);

      const ngn = result.find((r) => r.currency === 'NGN');
      const usd = result.find((r) => r.currency === 'USD');
      expect(ngn?.balance).toBe(1000);
      expect(ngn?.balanceMinor).toBe('100000');
      expect(usd?.balance).toBe(50);
      expect(usd?.balanceMinor).toBe('5000');
    });
  });

  describe('fund', () => {
    it('validates currency', async () => {
      await expect(
        service.fund(mockUser, 'XXX', 100),
      ).rejects.toThrow('Unsupported currency');
    });

    it('validates positive amount', async () => {
      await expect(
        service.fund(mockUser, 'NGN', 0),
      ).rejects.toThrow('Amount must be positive');
    });

    it('validates negative amount', async () => {
      await expect(
        service.fund(mockUser, 'NGN', -100),
      ).rejects.toThrow('Amount must be positive');
    });

    it('returns idempotent result when idempotencyKey matches existing FUND', async () => {
      const existingTx = {
        id: 'tx-1',
        type: 'FUND' as const,
        amountDestinationMinor: null,
        rateUsed: null,
      };
      (transactionRepo.findByIdempotencyKey as jest.Mock).mockResolvedValue(existingTx);
      (walletRepo.findByUserAndCurrency as jest.Mock).mockResolvedValue({
        balanceMinor: '50000',
      });

      const result = await service.fund(mockUser, 'NGN', 1000, 'idem-key-123');

      expect(result.newBalance).toBe(500);
      expect(walletRepo.addBalance).not.toHaveBeenCalled();
    });
  });

  describe('convert', () => {
    it('rejects same source and destination', async () => {
      await expect(
        service.convert(mockUser, 'NGN', 'NGN', 100),
      ).rejects.toThrow('Source and destination currencies must differ');
    });

    it('validates source currency', async () => {
      await expect(
        service.convert(mockUser, 'XXX', 'USD', 100),
      ).rejects.toThrow('Unsupported currency');
    });

    it('validates destination currency', async () => {
      await expect(
        service.convert(mockUser, 'NGN', 'XXX', 100),
      ).rejects.toThrow('Unsupported currency');
    });

    it('validates positive amount', async () => {
      await expect(
        service.convert(mockUser, 'NGN', 'USD', 0),
      ).rejects.toThrow('Amount must be positive');
    });

    it('throws Insufficient balance when subtractBalance fails', async () => {
      (walletRepo.subtractBalance as jest.Mock).mockResolvedValue(false);
      (fxRatesService.convert as jest.Mock).mockResolvedValue({
        amountDestinationMinor: 72,
        rate: 0.00072,
      });

      await expect(
        service.convert(mockUser, 'NGN', 'USD', 1000),
      ).rejects.toThrow('Insufficient balance');

      expect(walletRepo.addBalance).not.toHaveBeenCalled();
    });

    it('returns idempotent result when idempotencyKey matches existing CONVERT', async () => {
      const existingTx = {
        id: 'tx-1',
        type: 'CONVERT' as const,
        amountDestinationMinor: '72',
        currencyDestination: 'USD',
        rateUsed: '0.00072',
      };
      (transactionRepo.findByIdempotencyKey as jest.Mock).mockResolvedValue(existingTx);

      const result = await service.convert(mockUser, 'NGN', 'USD', 1000, 'idem-convert-123');

      expect(result).toMatchObject({
        sourceCurrency: 'NGN',
        destinationCurrency: 'USD',
        amountSource: 1000,
        amountDestination: 0.72,
        rateUsed: 0.00072,
      });
      expect(walletRepo.subtractBalance).not.toHaveBeenCalled();
    });
  });

  describe('trade', () => {
    it('delegates to convert and maps response', async () => {
      (fxRatesService.convert as jest.Mock).mockResolvedValue({
        amountDestinationMinor: 72,
        rate: 0.00072,
      });
      (walletRepo.subtractBalance as jest.Mock).mockResolvedValue(true);

      const result = await service.trade(mockUser, 'NGN', 'USD', 1000);

      expect(result).toMatchObject({
        fromCurrency: 'NGN',
        toCurrency: 'USD',
        amountFrom: 1000,
        amountTo: 0.72,
        rateUsed: 0.00072,
      });
    });
  });
});

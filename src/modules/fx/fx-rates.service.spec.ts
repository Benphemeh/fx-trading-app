import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FxRatesService } from './fx-rates.service';
import { CacheService } from '../cache/cache.service';

describe('FxRatesService', () => {
  let service: FxRatesService;
  let cacheService: jest.Mocked<CacheService>;

  const mockRatesUsdBase = {
    base: 'USD',
    rates: {
      USD: 1,
      NGN: 1388.5769,
      EUR: 0.8468,
      GBP: 0.7305,
    },
    fetchedAt: new Date().toISOString(),
  };

  const mockRatesNgnBase = {
    base: 'NGN',
    rates: {
      NGN: 1,
      USD: 1 / 1388.5769,
      EUR: 0.8468 / 1388.5769,
      GBP: 0.7305 / 1388.5769,
    },
    fetchedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FxRatesService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: unknown) => {
              if (key === 'FX_RATES_CACHE_TTL') return 3600;
              return def;
            }),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            getOrSet: jest.fn().mockImplementation(async (_key, factory) => {
              return factory();
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FxRatesService>(FxRatesService);
    cacheService = module.get(CacheService) as jest.Mocked<CacheService>;
    jest.clearAllMocks();
  });

  describe('getRates (via getOrSet mock)', () => {
    it('returns rates from cache when getOrSet returns cached value', async () => {
      (cacheService.getOrSet as jest.Mock).mockResolvedValue(mockRatesUsdBase);

      const result = await service.getRates('USD');

      expect(result).toEqual(mockRatesUsdBase);
      expect(result.base).toBe('USD');
      expect(result.rates.NGN).toBe(1388.5769);
      expect(result.rates.EUR).toBe(0.8468);
    });
  });

  describe('getRate', () => {
    it('returns 1 when source and destination are the same', async () => {
      (cacheService.getOrSet as jest.Mock).mockResolvedValue(mockRatesUsdBase);

      const rate = await service.getRate('USD', 'USD');

      expect(rate).toBe(1);
    });

    it('returns rate from API response for valid pair', async () => {
      (cacheService.getOrSet as jest.Mock).mockResolvedValue(mockRatesUsdBase);

      const rate = await service.getRate('USD', 'NGN');

      expect(rate).toBe(1388.5769);
    });

    it('throws for unsupported currency pair', async () => {
      (cacheService.getOrSet as jest.Mock).mockResolvedValue(mockRatesUsdBase);

      await expect(service.getRate('USD', 'XXX')).rejects.toThrow(
        'Unsupported currency pair: USD/XXX',
      );
    });

    it('uses correct base currency when fetching rates', async () => {
      (cacheService.getOrSet as jest.Mock).mockResolvedValue(mockRatesNgnBase);

      const rate = await service.getRate('NGN', 'USD');

      expect(rate).toBeCloseTo(1 / 1388.5769, 8);
    });
  });

  describe('convert', () => {
    it('converts NGN to USD correctly', async () => {
      (cacheService.getOrSet as jest.Mock).mockResolvedValue(mockRatesNgnBase);

      const result = await service.convert(100000, 'NGN', 'USD');

      expect(result.rate).toBeCloseTo(1 / 1388.5769, 8);
      expect(result.amountDestinationMinor).toBe(72);
    });

    it('converts USD to NGN correctly', async () => {
      (cacheService.getOrSet as jest.Mock).mockResolvedValue(mockRatesUsdBase);

      const result = await service.convert(1000, 'USD', 'NGN');

      expect(result.rate).toBe(1388.5769);
      expect(result.amountDestinationMinor).toBe(1388576);
    });

    it('uses floor for fractional amounts (no floating point drift)', async () => {
      (cacheService.getOrSet as jest.Mock).mockResolvedValue(mockRatesUsdBase);

      const result = await service.convert(1, 'USD', 'NGN');

      expect(result.amountDestinationMinor).toBe(Math.floor(0.01 * 1388.5769 * 100));
    });

    it('handles same currency (rate 1)', async () => {
      (cacheService.getOrSet as jest.Mock).mockResolvedValue(mockRatesUsdBase);

      const result = await service.convert(100, 'USD', 'USD');

      expect(result.rate).toBe(1);
      expect(result.amountDestinationMinor).toBe(100);
    });
  });

  describe('error handling', () => {
    it('throws BadGatewayException when getOrSet returns null', async () => {
      (cacheService.getOrSet as jest.Mock).mockResolvedValue(null);

      await expect(service.getRates('USD')).rejects.toThrow(BadGatewayException);
      await expect(service.getRates('USD')).rejects.toThrow('Failed to load FX rates');
    });
  });
});

import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import { getMinorUnitMultiplier } from '../../constants/currencies';

const CACHE_KEY_PREFIX = 'fx:rates:';
const DEFAULT_BASE = 'USD';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export interface FxRatesResponse {
  base: string;
  rates: Record<string, number>;
  fetchedAt: string;
}

@Injectable()
export class FxRatesService {
  private readonly logger = new Logger(FxRatesService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {}

  private getCacheKey(base: string): string {
    return `${CACHE_KEY_PREFIX}${base}`;
  }

  private getTtl(): number {
    return this.config.get<number>('FX_RATES_CACHE_TTL', 3600);
  }

  async getRates(base: string = DEFAULT_BASE): Promise<FxRatesResponse> {
    const key = this.getCacheKey(base);
    const ttl = this.getTtl();

    const result = await this.cache.getOrSet<FxRatesResponse | null>(
      key,
      async () => {
        try {
          return await this.fetchFromApiWithRetry(base);
        } catch (err) {
          this.logger.warn(`FX API fetch failed for base ${base} after retries: ${err}`);
          const stale = await this.cache.get<FxRatesResponse>(key);
          if (stale) {
            this.logger.log(`Returning stale cached rates for ${base}`);
            return stale;
          }
          throw new BadGatewayException(
            'FX rates unavailable. External API failed and no cached rates. Please try again later.',
          );
        }
      },
      ttl,
    );

    if (!result) {
      throw new BadGatewayException('Failed to load FX rates');
    }
    return result;
  }

  private async fetchFromApiWithRetry(base: string): Promise<FxRatesResponse> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.fetchFromApi(base);
      } catch (err) {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          this.logger.warn(`FX API attempt ${attempt}/${MAX_RETRIES} failed, retrying in ${RETRY_DELAY_MS}ms`);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        }
      }
    }
    throw lastError;
  }

  private async fetchFromApi(base: string): Promise<FxRatesResponse> {
    const apiKey = this.config.get<string>('EXCHANGE_RATE_API_KEY');
    const baseUrl = this.config.get<string>('EXCHANGE_RATE_API_BASE_URL', 'https://v6.exchangerate-api.com/v6');
    const url = `${baseUrl}/${apiKey}/latest/${base}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`FX API error: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    if (data.result !== 'success' || !data.conversion_rates) {
      throw new Error('Invalid FX API response');
    }
    const response: FxRatesResponse = {
      base: data.base_code || base,
      rates: data.conversion_rates,
      fetchedAt: new Date().toISOString(),
    };
    return response;
  }

  async getRate(sourceCurrency: string, destinationCurrency: string): Promise<number> {
    if (sourceCurrency === destinationCurrency) return 1;
    const rates = await this.getRates(sourceCurrency);
    const rate = rates.rates[destinationCurrency];
    if (rate == null) {
      throw new Error(`Unsupported currency pair: ${sourceCurrency}/${destinationCurrency}`);
    }
    return rate;
  }

  async convert(
    amountMinor: number,
    sourceCurrency: string,
    destinationCurrency: string,
  ): Promise<{ amountDestinationMinor: number; rate: number }> {
    const rate = await this.getRate(sourceCurrency, destinationCurrency);
    const mulSource = getMinorUnitMultiplier(sourceCurrency);
    const mulDest = getMinorUnitMultiplier(destinationCurrency);
    const amountMajor = amountMinor / mulSource;
    const destMajor = amountMajor * rate;
    const amountDestinationMinor = Math.floor(destMajor * mulDest);
    return { amountDestinationMinor, rate };
  }
}

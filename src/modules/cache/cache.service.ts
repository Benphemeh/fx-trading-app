import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis({
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds != null) {
      await this.client.setex(key, ttlSeconds, serialized);
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached != null) return cached;
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}

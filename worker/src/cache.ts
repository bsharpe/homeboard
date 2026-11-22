export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

export class CacheStore {
  private readonly kv?: KVLike;
  private readonly memory = new Map<string, MemoryEntry>();

  constructor(kv?: KVLike) {
    this.kv = kv;
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (this.kv) {
      const raw = await this.kv.get(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }

    const entry = this.memory.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.memory.delete(key);
      return null;
    }
    try {
      return JSON.parse(entry.value) as T;
    } catch {
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (this.kv) {
      await this.kv.put(key, serialized, { expirationTtl: Math.max(60, ttlSeconds) });
      return;
    }
    this.memory.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}

export function roundCoord(val: number): string {
  return (Math.round(val * 100) / 100).toFixed(2);
}

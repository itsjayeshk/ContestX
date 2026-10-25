import { PermanentProviderError } from "./types";

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function userAgent(): string {
  const contact = process.env.PROVIDER_CONTACT;
  return `ContestX/1.0 (contest reminder service${contact ? `; ${contact}` : ""})`;
}

/** Exponential backoff with full jitter: base * 2^attempt, capped at 30 s. */
export function backoffDelay(attempt: number, baseMs: number, random: () => number = Math.random): number {
  const cap = 30_000;
  const exp = Math.min(cap, baseMs * 2 ** attempt);
  return Math.round(exp / 2 + random() * (exp / 2));
}

/**
 * Fetch JSON with a timeout and retries on transient failures (network errors,
 * timeouts, 429 and 5xx). Returns the parsed body and how many attempts it took.
 */
export async function fetchJsonWithRetry(
  url: string,
  init: RequestInit = {},
  opts: RetryOptions = {},
): Promise<{ body: unknown; attempts: number }> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 1000;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const sleep = opts.sleep ?? defaultSleep;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { Accept: "application/json", "User-Agent": userAgent(), ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
      }
      if (!res.ok) {
        throw new PermanentProviderError(`HTTP ${res.status} from ${new URL(url).host}`);
      }
      const text = await res.text();
      try {
        return { body: JSON.parse(text), attempts: attempt + 1 };
      } catch {
        throw new PermanentProviderError(`Non-JSON response from ${new URL(url).host}`);
      }
    } catch (err) {
      lastError = describeNetworkError(err, url);
      if (err instanceof PermanentProviderError) {
        (err as Error & { attempts?: number }).attempts = attempt + 1;
        throw err;
      }
      if (attempt < retries) await sleep(backoffDelay(attempt, base));
    }
  }
  const e = lastError instanceof Error ? lastError : new Error(String(lastError));
  (e as Error & { attempts?: number }).attempts = retries + 1;
  throw e;
}

/** Turn undici's bare "fetch failed" into something an operator can act on. */
function describeNetworkError(err: unknown, url: string): unknown {
  if (!(err instanceof Error) || err instanceof PermanentProviderError) return err;
  const host = new URL(url).host;
  if (err.name === "TimeoutError" || err.name === "AbortError") return new Error(`Timed out reaching ${host}`);
  if (err.message === "fetch failed") {
    const cause = (err as Error & { cause?: { code?: string; message?: string } }).cause;
    return new Error(`Could not reach ${host}${cause?.code ? ` (${cause.code})` : cause?.message ? ` (${cause.message})` : ""}`);
  }
  return err;
}

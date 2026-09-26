const KEY = 'wortflip.device.v1';

/** A random, anonymous id per browser: only used for the daily share limit and "one report per device". */
export function deviceId(): string {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && /^[a-z0-9-]{8,64}$/.test(stored)) return stored;
    const fresh = crypto.randomUUID();
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return `session-${Math.random().toString(36).slice(2, 14)}`;
  }
}

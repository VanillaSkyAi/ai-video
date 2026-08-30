const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function allowedKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const permitted = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!permitted.has(key)) throw new Error(`${path} contains unsupported field ${key}`);
  }
}

export function string(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${path} must be a non-empty string`);
  return value;
}

export function finite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${path} must be finite`);
  return value;
}

export function nonNegativeInteger(value: unknown, path: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${path} must be a non-negative integer`);
  }
  return Number(value);
}

export function jsonValue(value: unknown, path: string, seen = new Set<unknown>()): void {
  if (value == null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    finite(value, path);
    return;
  }
  if (typeof value !== "object" || seen.has(value)) throw new Error(`${path} must be JSON-serializable`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => jsonValue(item, `${path}[${index}]`, seen));
  } else {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.has(key)) throw new Error(`${path} contains unsupported field ${key}`);
      jsonValue(child, `${path}.${key}`, seen);
    }
  }
  seen.delete(value);
}

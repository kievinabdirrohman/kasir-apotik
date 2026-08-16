// Explicit asymmetric overrides: TS camelCase key → SQL snake_case key
const FIELD_OVERRIDES_TO_SQL: Record<string, string> = {
  user: 'user_name', // StockHistory.user → stock_history.user_name
};

// SQLite INTEGER 0/1 ↔ TypeScript boolean columns
const BOOLEAN_COLUMNS = new Set([
  'is_active',
  'is_prescription',
  'is_ppn_included',
  'is_super_admin',
  'is_ppn',
  'auto_print_receipt',
]);

function camelToSnake(key: string): string {
  return key.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Sanitize a value to a type SQLite can bind (number, string, bigint, Buffer, null).
 *  undefined → null; arrays/objects → JSON string; everything else passes through. */
function toBindable(v: unknown): number | string | bigint | Buffer | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'bigint') return v;
  if (Buffer.isBuffer(v)) return v;
  if (typeof v === 'boolean') return v ? 1 : 0; // fallback — booleans should be converted before this
  // arrays or plain objects: JSON-encode so nothing blows up at the DB layer
  return JSON.stringify(v);
}

/** Convert a TypeScript object to a SQL row (camelCase keys → snake_case, boolean → 0|1) */
export function toSQL(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = FIELD_OVERRIDES_TO_SQL[key] ?? camelToSnake(key);
    if (BOOLEAN_COLUMNS.has(snakeKey) && typeof value === 'boolean') {
      result[snakeKey] = value ? 1 : 0;
    } else {
      result[snakeKey] = toBindable(value);
    }
  }
  return result;
}

/** Convert a SQL row to a TypeScript object (snake_case keys → camelCase, 0|1 → boolean, strip transaction_items.id) */
export function toTS(
  row: Record<string, unknown> | null | undefined,
  opts?: { stripId?: boolean },
): Record<string, unknown> {
  if (!row) return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    // Strip AUTOINCREMENT id from transaction_items rows
    if (opts?.stripId && key === 'id') continue;

    const camelKey = snakeToCamel(key);
    if (BOOLEAN_COLUMNS.has(key) && (value === 0 || value === 1)) {
      result[camelKey] = value === 1;
    } else {
      // SQLite NULL → undefined so React controlled inputs don't get null
      result[camelKey] = value === null ? undefined : value;
    }
  }
  return result;
}

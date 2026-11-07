import { getSupabase } from '../../lib/supabaseClient';
import { ensureOk } from './cloudErrors';
import type { CloudTable } from './rows';

/** Supabase returns at most 1000 rows per request; read every page. */
const PAGE_SIZE = 1000;

export interface RowFilter {
  column: string;
  op: 'eq' | 'gte';
  value: string;
}

/**
 * Reads every row of a table the signed-in user can see. RLS restricts the
 * result to the account's own profiles, so no owner filter is needed here.
 */
export async function fetchAllRows<T>(table: CloudTable, filters: RowFilter[] = []): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = getSupabase().from(table).select('*');
    for (const filter of filters) query = filter.op === 'eq' ? query.eq(filter.column, filter.value) : query.gte(filter.column, filter.value);
    const page = ensureOk(await query.order('id').range(from, from + PAGE_SIZE - 1), `Could not load ${table.replace(/_/g, ' ')}.`) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

/** Insert-or-update one row on its natural key; returns the stored row. */
export async function upsertRow<T>(table: CloudTable, row: Record<string, unknown>, onConflict: string, fallback: string): Promise<T> {
  const data = ensureOk(await getSupabase().from(table).upsert(row, { onConflict }).select('*'), fallback) as T[];
  if (!data || data.length === 0) throw new Error(fallback);
  return data[0];
}

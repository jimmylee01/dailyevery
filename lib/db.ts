import { Pool, types, type PoolClient } from "pg";

// date 컬럼을 'YYYY-MM-DD' 문자열 그대로
types.setTypeParser(1082, (v) => v);

const g = globalThis as unknown as { _pgPool?: Pool; _schemaReady?: Promise<void> };
export const pool = g._pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
if (process.env.NODE_ENV !== "production") g._pgPool = pool;

/** 표가 없으면 만들기 (여러 번 실행해도 안전) — Neon에서 SQL을 따로 실행할 필요 없음 */
function ensureSchema(): Promise<void> {
  g._schemaReady ??= pool
    .query(
      `create table if not exists items (
         id serial primary key, num int, title text not null, url text not null default '',
         grp text not null default '', note text not null default '', active boolean not null default true,
         created_at timestamptz not null default now()
       );
       create table if not exists checks (
         item_id int not null references items(id) on delete cascade, day date not null,
         checked_at timestamptz, opened_at timestamptz, memo text,
         primary key (item_id, day)
       );
       create table if not exists settings (key text primary key, value text not null);
       create table if not exists day_notes (day date primary key, body text not null default '', updated_at timestamptz not null default now());`,
    )
    .then(() => undefined)
    .catch((e) => { g._schemaReady = undefined; throw e; });
  return g._schemaReady;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function q<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  return (await pool.query(text, params)).rows as T[];
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const c = await pool.connect();
  try {
    await c.query("begin");
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

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
       create table if not exists day_notes (day date primary key, body text not null default '', updated_at timestamptz not null default now());
       create table if not exists lists (
         id serial primary key, name text not null, color text not null default 'indigo', sort int not null default 0,
         created_at timestamptz not null default now()
       );
       create table if not exists repeat_tasks (
         id serial primary key, title text not null, list_id int references lists(id) on delete set null, day int,
         note text not null default '', important boolean not null default false, from_month text not null,
         active boolean not null default true, created_at timestamptz not null default now()
       );
       create table if not exists tasks (
         id serial primary key, title text not null, list_id int references lists(id) on delete set null,
         due date, my_day date, month text, important boolean not null default false, note text not null default '',
         done_at timestamptz, done_note text not null default '',
         repeat_id int references repeat_tasks(id) on delete set null, hidden boolean not null default false,
         created_at timestamptz not null default now()
       );
       create unique index if not exists tasks_repeat_month on tasks(repeat_id, month) where repeat_id is not null;
       create index if not exists tasks_done on tasks(done_at);
       create table if not exists attachments (
         id serial primary key, drive_id text not null, name text not null, mime text not null default '',
         size bigint, link text not null default '', task_id int references tasks(id) on delete cascade, day date,
         created_at timestamptz not null default now()
       );
       create index if not exists attachments_task on attachments(task_id);
       create index if not exists attachments_day on attachments(day);
       create table if not exists labels (
         id serial primary key, name text not null, color text not null default 'sky', sort int not null default 0,
         created_at timestamptz not null default now()
       );
       create table if not exists task_labels (
         task_id int not null references tasks(id) on delete cascade, label_id int not null references labels(id) on delete cascade,
         primary key (task_id, label_id)
       );
       create index if not exists task_labels_label on task_labels(label_id);
       alter table tasks add column if not exists start_day date;`,
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

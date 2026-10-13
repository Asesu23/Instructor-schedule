import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const dir = fileURLToPath(new URL('../db/migrations/', import.meta.url));
const sql = neon(url);

function skipQuoted(text, from, quote) {
  let i = from + 1;
  while (i < text.length) {
    if (text[i] === quote) {
      if (text[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i += 1;
  }
  return text.length;
}

function splitStatements(text) {
  const statements = [];
  let current = '';
  let i = 0;

  const flush = () => {
    const statement = current.trim();
    if (statement) statements.push(statement);
    current = '';
  };

  while (i < text.length) {
    const ch = text[i];

    if (ch === '-' && text[i + 1] === '-') {
      const end = text.indexOf('\n', i);
      i = end === -1 ? text.length : end;
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 2;
      current += ' ';
    } else if (ch === "'" || ch === '"') {
      const end = skipQuoted(text, i, ch);
      current += text.slice(i, end);
      i = end;
    } else if (ch === '$') {
      const tag = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(text.slice(i))?.[0];
      const close = tag ? text.indexOf(tag, i + tag.length) : -1;
      if (tag && close !== -1) {
        current += text.slice(i, close + tag.length);
        i = close + tag.length;
      } else {
        current += ch;
        i += 1;
      }
    } else if (ch === ';') {
      flush();
      i += 1;
    } else {
      current += ch;
      i += 1;
    }
  }

  flush();
  return statements;
}

async function migrate() {
  await sql`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`;

  const applied = new Set((await sql`select name from schema_migrations`).map((row) => row.name));
  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
  let count = 0;

  for (const file of files) {
    if (applied.has(file)) continue;
    const statements = splitStatements(await readFile(join(dir, file), 'utf8'));
    await sql.transaction([
      ...statements.map((statement) => sql.query(statement)),
      sql`insert into schema_migrations (name) values (${file})`,
    ]);
    console.log(`applied ${file}`);
    count += 1;
  }

  console.log(count === 0 ? 'database is up to date' : `applied ${count} migration(s)`);
}

migrate().catch((error) => {
  console.error('migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});

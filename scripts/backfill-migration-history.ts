/**
 * Backfill supabase_migrations.schema_migrations so it matches reality.
 *
 * Migrations 001-032 were applied via the Supabase CLI and are tracked.
 * Migrations 033-059 were applied manually (npm run db), which does NOT write
 * to the tracking table. This script records the missing versions so a future
 * `supabase db push` / `db reset` does not try to re-apply them.
 *
 * Usage:
 *   npx tsx scripts/backfill-migration-history.ts
 *
 * Reads the connection string from .env.supabase (SUPABASE_DB_URL).
 * Idempotent: existing versions are skipped (ON CONFLICT DO NOTHING).
 */
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { Client } from 'pg'
import { loadEnvFile } from 'process'

try {
  loadEnvFile('.env.supabase')
} catch {
  // no .env.supabase - fall back to process env
}

const url = process.env.SUPABASE_DB_URL
if (!url || url.includes('PASSWORD_HERE')) {
  console.error('SUPABASE_DB_URL is not set in .env.supabase (or still has the placeholder password).')
  process.exit(1)
}

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

function splitStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let i = 0

  while (i < sql.length) {
    const ch = sql[i]

    // Line comment
    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i)
      const stop = end === -1 ? sql.length : end + 1
      current += sql.slice(i, stop)
      i = stop
      continue
    }

    // Block comment
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i)
      const stop = end === -1 ? sql.length : end + 2
      current += sql.slice(i, stop)
      i = stop
      continue
    }

    // Single-quoted string with '' escapes
    if (ch === "'") {
      const start = i
      i++
      while (i < sql.length) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      current += sql.slice(start, i)
      continue
    }

    // Dollar-quoted string ($$ or $tag$), e.g. plpgsql function bodies
    if (ch === '$') {
      const dollarMatch = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i))
      if (dollarMatch) {
        const tag = dollarMatch[0]
        const end = sql.indexOf(tag, i + tag.length)
        const stop = end === -1 ? sql.length : end + tag.length
        current += sql.slice(i, stop)
        i = stop
        continue
      }
    }

    // Statement terminator
    if (ch === ';') {
      current += ch
      const trimmed = current.trim()
      if (trimmed) {
        statements.push(trimmed)
      }
      current = ''
      i++
      continue
    }

    current += ch
    i++
  }

  const tail = current.trim()
  if (tail) {
    statements.push(tail)
  }

  return statements
}

async function main() {
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  console.log('[backfill] connected')

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const versionRe = /^(\d+)_(.+)\.sql$/

  let inserted = 0
  let skipped = 0

  for (const file of files) {
    const match = versionRe.exec(file)
    if (!match) {
      console.log(`[backfill] ${file}: SKIPPED (no NNN_name.sql pattern)`)
      skipped++
      continue
    }

    const version = match[1]
    const name = match[2]
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    const statements = splitStatements(sql)

    const res = await client.query(
      `INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (version) DO NOTHING`,
      [version, statements, name]
    )

    if (res.rowCount === 1) {
      console.log(`[backfill] ${file}: INSERTED (${statements.length} statements)`)
      inserted++
    } else {
      console.log(`[backfill] ${file}: SKIPPED (version already tracked)`)
      skipped++
    }
  }

  const { rows } = await client.query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM supabase_migrations.schema_migrations'
  )

  console.log(`[backfill] done: ${inserted} inserted, ${skipped} skipped, total tracked = ${rows[0].count}`)
  await client.end()
}

main().catch((e) => {
  console.error('[backfill] ERROR:', e.message)
  process.exit(1)
})

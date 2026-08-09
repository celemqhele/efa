/**
 * Direct SQL runner against the Supabase database.
 *
 * Usage:
 *   npm run db -- path/to/migration.sql      # run a SQL file
 *   echo "SELECT 1;" | npm run db            # run SQL from stdin
 *   npm run db -- -c "SELECT 1;"             # run SQL string
 *
 * Reads the connection string from .env.supabase (SUPABASE_DB_URL)
 * or the SUPABASE_DB_URL environment variable.
 */
import { readFileSync } from 'fs'
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

let sql: string
const args = process.argv.slice(2)

if (args[0] === '-c') {
  sql = args[1]
} else if (args[0]) {
  sql = readFileSync(args[0], 'utf8')
} else {
  sql = readFileSync(0, 'utf8')
}

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  await client.connect()
  console.log('[db] connected')
  const res = await client.query(sql)
  if (res.command) console.log(`[db] ${res.command}${res.rowCount != null ? ` (${res.rowCount} rows)` : ''}`)
  if (Array.isArray(res.rows) && res.rows.length > 0) {
    console.table(res.rows)
  }
  await client.end()
}

main().catch(async (e) => {
  console.error('[db] ERROR:', e.message)
  try { await client.end() } catch {}
  process.exit(1)
})

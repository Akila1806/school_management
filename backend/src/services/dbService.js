const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

async function executeQuery(sql, params = []) {
  const client = await pool.connect()
  try {
    const result = await client.query(sql, params)
    if (result.rows) return result.rows
    return []
  } finally {
    client.release()
  }
}

async function getDynamicSchema() {
  const tables = await executeQuery(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`
  )

  const lines = ['DATABASE SCHEMA:']

  for (const { table_name } of tables) {
    const columns = await executeQuery(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = '${table_name}' AND table_schema = 'public'
       ORDER BY ordinal_position`
    )
    const colDefs = columns.map(
      c => `  ${c.column_name} ${c.data_type} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`
    )
    lines.push(`${table_name}(`, colDefs.join(',\n'), ')', '')
  }

  const fkRows = await executeQuery(
    `SELECT tc.table_name, kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
     FROM information_schema.table_constraints AS tc
     JOIN information_schema.key_column_usage AS kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage AS ccu
       ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'`
  )

  if (fkRows.length) {
    lines.push('RELATIONSHIPS:')
    for (const fk of fkRows) {
      lines.push(`${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`)
    }
  }

  return lines.join('\n')
}

module.exports = { executeQuery, getDynamicSchema }

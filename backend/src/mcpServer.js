require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { z } = require('zod')
const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

const server = new McpServer({
  name: 'school-db-server',
  version: '1.0.0',
})

// Tool 1: Execute a SQL query and return rows
server.tool(
  'query_database',
  'Execute a SQL SELECT/INSERT/UPDATE query on the school PostgreSQL database and return results',
  { sql: z.string().describe('The SQL query to execute') },
  async ({ sql }) => {
    const client = await pool.connect()
    try {
      console.error('Executing SQL:', sql)
      const result = await client.query(sql)
      const rows = result.rows || []
      console.error('Query successful, rows:', rows.length)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(rows, null, 2),
          },
        ],
      }
    } catch (error) {
      console.error('Database query error:', error.message)
      console.error('Failed SQL:', sql)
      // Return the error as JSON so the client can handle it
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message, sql }, null, 2),
          },
        ],
      }
    } finally {
      client.release()
    }
  }
)

// Tool 2: Get the full database schema dynamically
server.tool(
  'get_schema',
  'Get the full PostgreSQL schema (tables, columns, foreign keys) of the school database',
  {},
  async () => {
    const client = await pool.connect()
    try {
      const tables = await client.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' ORDER BY table_name`
      )

      const lines = ['DATABASE SCHEMA:']

      for (const { table_name } of tables.rows) {
        const cols = await client.query(
          `SELECT column_name, data_type, is_nullable
           FROM information_schema.columns
           WHERE table_name = $1 AND table_schema = 'public'
           ORDER BY ordinal_position`,
          [table_name]
        )
        const colDefs = cols.rows.map(
          c => `  ${c.column_name} ${c.data_type} ${c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`
        )
        lines.push(`${table_name}(`, colDefs.join(',\n'), ')', '')
      }

      const fks = await client.query(
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

      if (fks.rows.length) {
        lines.push('RELATIONSHIPS:')
        for (const fk of fks.rows) {
          lines.push(
            `${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`
          )
        }
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      }
    } finally {
      client.release()
    }
  }
)

async function runMigrations() {
  const client = await pool.connect()
  try {
    // Make email nullable — it is not a required field
    await client.query(`ALTER TABLE students ALTER COLUMN email DROP NOT NULL`)
    console.error('Migration: email column is now nullable')
  } catch (err) {
    // Ignore if already nullable or table doesn't exist yet
    console.error('Migration note:', err.message)
  } finally {
    client.release()
  }
}

async function main() {
  await runMigrations()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('School MCP Server running on stdio')
}

main().catch(err => {
  console.error('MCP Server error:', err)
  process.exit(1)
})

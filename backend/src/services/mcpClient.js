const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js')
const path = require('path')

let _client = null

async function getMcpClient() {
  if (_client) return _client

  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, '../mcpServer.js')],
  })

  const client = new Client({ name: 'school-backend-client', version: '1.0.0' })
  await client.connect(transport)

  _client = client
  return client
}

// Call the query_database MCP tool
async function mcpQueryDatabase(sql) {
  const client = await getMcpClient()
  try {
    const result = await client.callTool({ name: 'query_database', arguments: { sql } })
    const text = result.content?.[0]?.text || '[]'
    console.log('Raw MCP response:', text)
    
    // Try to parse JSON, if it fails, log the error and return empty array
    try {
      const parsed = JSON.parse(text)
      
      // Check if the response contains an error
      if (parsed.error) {
        throw new Error(`Database error: ${parsed.error}`)
      }
      
      return parsed
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message)
      console.error('Raw text that failed to parse:', text)
      throw new Error(`Invalid JSON response from database: ${parseError.message}`)
    }
  } catch (mcpError) {
    console.error('MCP tool call error:', mcpError)
    throw mcpError
  }
}

// Call the get_schema MCP tool
async function mcpGetSchema() {
  const client = await getMcpClient()
  const result = await client.callTool({ name: 'get_schema', arguments: {} })
  return result.content?.[0]?.text || ''
}

module.exports = { mcpQueryDatabase, mcpGetSchema }

// ─── mcpAgent — task-based AI+MCP operations ──────────────────────────────────
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'school_secret'
const JWT_EXPIRES = '7d'

function cleanSql(sql) {
  return sql.trim()
    .replace(/^```sql\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
}

async function aiSql(prompt) {
  // lazy require to avoid circular dependency (groqService → mcpClient → groqService)
  const { generateAuthSql } = require('./groqService')
  return cleanSql(await generateAuthSql(prompt))
}

async function ensureUsersTable() {
  await mcpQueryDatabase(
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'teacher', grade VARCHAR(50), phone VARCHAR(20),
      address TEXT, city VARCHAR(100), state VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    )`
  )
}

const mcpAgent = {
  async run({ task, data }) {
    const t = task.toLowerCase()

    if (t.includes('create user')) {
      await ensureUsersTable()
      const existing = await mcpQueryDatabase(`SELECT id FROM users WHERE email = '${data.email}' LIMIT 1`)
      if (existing.length > 0) throw new Error('Email already registered')
      const skip = ['password', 'confirmPassword']
      const insertData = Object.fromEntries(
        Object.entries(data).filter(([k, v]) => !skip.includes(k) && v !== null && v !== undefined && v !== '')
      )
      const insertSql = await aiSql(
        `Generate a PostgreSQL INSERT INTO users query.\nDATA (JSON):\n${JSON.stringify(insertData, null, 2)}\nRULES:\n- Use ONLY the keys present in DATA\n- Do NOT include id or created_at\n- Escape all string values with single quotes\n- End with: ON CONFLICT (email) DO NOTHING RETURNING *\n- Output ONLY SQL`
      )
      const rows = await mcpQueryDatabase(insertSql)
      if (!rows || rows.length === 0) throw new Error('User insert failed')
      return { data: rows[0], rows }
    }

    if (t.includes('login user')) {
      const { email, password } = data
      if (!email || !password) throw new Error('Email and password are required')
      const rows = await mcpQueryDatabase(`SELECT * FROM users WHERE email = '${email}' LIMIT 1`)
      if (!rows || rows.length === 0) throw new Error('Invalid email or password')
      const user = rows[0]
      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) throw new Error('Invalid email or password')
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
      return { data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role, grade: user.grade } }, rows }
    }

    if (t.includes('get user')) {
      const rows = await mcpQueryDatabase(`SELECT id, name, email, role, grade, phone, address, city, state, created_at FROM users WHERE id = ${data.id} LIMIT 1`)
      if (!rows || rows.length === 0) throw new Error('User not found')
      return { data: rows[0], rows }
    }

    if (t.includes('get subjects')) {
      const rows = await mcpQueryDatabase(`SELECT subject_id, subject_name FROM subjects ORDER BY subject_name ASC`)
      return { data: rows[0] ?? null, rows }
    }

    if (t.includes('get grades')) {
      const sql = data.subject_id
        ? `SELECT DISTINCT grade_level FROM subject_grades WHERE subject_id = ${parseInt(data.subject_id)} ORDER BY grade_level ASC`
        : `SELECT DISTINCT grade_level FROM students WHERE grade_level IS NOT NULL ORDER BY grade_level ASC`
      const rows = await mcpQueryDatabase(sql)
      return { data: rows.map(r => r.grade_level), rows }
    }

    if (t.includes('get students by grade')) {
      if (!data.grade) throw new Error('grade required')
      const grade = String(data.grade).replace(/'/g, "''")
      const rows = await mcpQueryDatabase(`SELECT student_id, first_name, last_name, grade_level FROM students WHERE grade_level = '${grade}' ORDER BY first_name, last_name ASC`)
      return { data: rows[0] ?? null, rows }
    }

    if (t.includes('get attendance')) {
      const filters = []
      if (data.date) filters.push(`a.attendance_date = '${data.date}'`)
      if (data.subject_id) filters.push(`a.subject_id = ${parseInt(data.subject_id)}`)
      if (data.grade) filters.push(`s.grade_level = '${String(data.grade).replace(/'/g, "''")}'`)
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
      const rows = await mcpQueryDatabase(`SELECT a.*, s.first_name, s.last_name, s.grade_level FROM attendance a JOIN students s ON a.student_id = s.student_id ${where} ORDER BY s.grade_level, s.first_name ASC`)
      return { data: rows[0] ?? null, rows }
    }

    throw new Error(`Unknown task: ${task}`)
  }
}

module.exports = { mcpQueryDatabase, mcpGetSchema, mcpAgent }

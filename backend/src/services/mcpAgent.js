const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { generateAuthSql } = require('./groqService')
const { mcpQueryDatabase } = require('./mcpClient')

const JWT_SECRET = process.env.JWT_SECRET || 'school_secret'
const JWT_EXPIRES = '7d'

function cleanSql(sql) {
  return sql
    .trim()
    .replace(/^```sql\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
}

async function aiSql(prompt) {
  const raw = await generateAuthSql(prompt)
  return cleanSql(raw)
}

async function ensureUsersTable() {
  const sql = await aiSql(
    `Generate CREATE TABLE IF NOT EXISTS for users table with columns:
     id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL,
     email VARCHAR(150) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL,
     role VARCHAR(50) DEFAULT 'teacher', grade VARCHAR(50), phone VARCHAR(20),
     address TEXT, city VARCHAR(100), state VARCHAR(100),
     created_at TIMESTAMP DEFAULT NOW(). Output ONLY SQL.`
  )
  await mcpQueryDatabase(sql)
}

const mcpAgent = {
  async run({ task, data }) {
    const t = task.toLowerCase()

    // ── CREATE USER ────────────────────────────────────────────────────
    if (t.includes('create user')) {
      await ensureUsersTable()

      // AI: check duplicate
      const checkSql = await aiSql(
        `Generate SELECT id FROM users WHERE email = '${data.email}' LIMIT 1. Output ONLY SQL.`
      )
      const existing = await mcpQueryDatabase(checkSql)
      if (existing.length > 0) throw new Error('Email already registered')

      // filter out null/empty/password fields
      const insertData = {}
      const skip = ['password', 'confirmPassword']
      for (const [k, v] of Object.entries(data)) {
        if (!skip.includes(k) && v !== null && v !== undefined && v !== '') {
          insertData[k] = v
        }
      }

      // AI: insert
      const insertSql = await aiSql(
        `Generate a PostgreSQL INSERT INTO users query.
DATA (JSON):
${JSON.stringify(insertData, null, 2)}

RULES:
- Use ONLY the keys present in DATA
- Do NOT include id or created_at
- Escape all string values with single quotes
- End with: ON CONFLICT (email) DO NOTHING RETURNING *
- Output ONLY SQL`
      )
      const rows = await mcpQueryDatabase(insertSql)
      if (!rows || rows.length === 0) throw new Error('User insert failed')
      return { data: rows[0], rows }
    }

    // ── LOGIN USER ─────────────────────────────────────────────────────
    if (t.includes('login user')) {
      const { email, password } = data
      if (!email || !password) throw new Error('Email and password are required')

      // AI: fetch user
      const selectSql = await aiSql(
        `Generate SELECT * FROM users WHERE email = '${email}' LIMIT 1. Output ONLY SQL.`
      )
      const rows = await mcpQueryDatabase(selectSql)
      if (!rows || rows.length === 0) throw new Error('Invalid email or password')

      const user = rows[0]
      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) throw new Error('Invalid email or password')

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      )
      const userData = { id: user.id, name: user.name, email: user.email, role: user.role, grade: user.grade }
      return {
        data: { token, user: userData },
        rows
      }
    }

    // ── GET USER ───────────────────────────────────────────────────────
    if (t.includes('get user')) {
      const selectSql = await aiSql(
        `Generate SELECT id, name, email, role, grade, phone, address, city, state, created_at
         FROM users WHERE id = ${data.id} LIMIT 1. Output ONLY SQL.`
      )
      const rows = await mcpQueryDatabase(selectSql)
      if (!rows || rows.length === 0) throw new Error('User not found')
      return { data: rows[0], rows }
    }

    // ── GET SUBJECTS ───────────────────────────────────────────────────
    if (t.includes('get subjects')) {
      const sql = `SELECT subject_id, subject_name FROM subjects ORDER BY subject_name ASC;`
      const rows = await mcpQueryDatabase(sql)
      return { data: rows[0] ?? null, rows }
    }

    // ── GET GRADES ─────────────────────────────────────────────────────
    if (t.includes('get grades')) {
      let sql
      if (data.subject_id) {
        sql = `SELECT DISTINCT grade_level FROM subject_grades WHERE subject_id = ${parseInt(data.subject_id)} ORDER BY grade_level ASC;`
      } else {
        sql = `SELECT DISTINCT grade_level FROM students WHERE grade_level IS NOT NULL ORDER BY grade_level ASC;`
      }
      const rows = await mcpQueryDatabase(sql)
      const grades = rows.map(r => r.grade_level)
      return { data: grades, rows }
    }

    // ── GET STUDENTS BY GRADE ──────────────────────────────────────────
    if (t.includes('get students by grade')) {
      if (!data.grade) throw new Error('grade required')
      // Direct SQL — no AI needed for a simple parameterized lookup
      const grade = String(data.grade).replace(/'/g, "''")
      const sql = `SELECT student_id, first_name, last_name, grade_level FROM students WHERE grade_level = '${grade}' ORDER BY first_name, last_name ASC;`
      console.log('[mcpAgent] get students by grade SQL:', sql)
      const rows = await mcpQueryDatabase(sql)
      console.log('[mcpAgent] students found:', rows.length)
      return { data: rows[0] ?? null, rows }
    }

    // ── GET ATTENDANCE RECORDS ─────────────────────────────────────────
    if (t.includes('get attendance')) {
      const filters = []
      if (data.date) filters.push(`a.attendance_date = '${data.date}'`)
      if (data.subject_id) filters.push(`a.subject_id = ${parseInt(data.subject_id)}`)
      if (data.grade) filters.push(`s.grade_level = '${String(data.grade).replace(/'/g, "''")}'`)
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
      const sql = `SELECT a.*, s.first_name, s.last_name, s.grade_level FROM attendance a JOIN students s ON a.student_id = s.student_id ${where} ORDER BY s.grade_level, s.first_name ASC;`
      const rows = await mcpQueryDatabase(sql)
      return { data: rows[0] ?? null, rows }
    }

    throw new Error(`Unknown task: ${task}`)
  }
}

module.exports = { mcpAgent }

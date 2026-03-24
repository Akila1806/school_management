const { generateSql } = require('../services/groqService')
const { mcpQueryDatabase, mcpGetSchema } = require('../services/mcpClient')
const { sanitizeSql } = require('../utils/sanitizeSql')
const { executeQuery } = require('../services/dbService')
const { StatusCodes } = require('../utils/statusCodes')

async function getSubjects(_req, res) {
  try {
    const rows = await executeQuery('SELECT subject_id, subject_name FROM subjects ORDER BY subject_name')
    return res.json({ subjects: rows })
  } catch (err) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: err.message })
  }
}

// If subject_id provided, return only grades assigned to that subject via subject_grades table
async function getGrades(req, res) {
  const { subject_id } = req.query
  try {
    let rows
    if (subject_id) {
      rows = await executeQuery(
        'SELECT grade_level FROM subject_grades WHERE subject_id = $1',
        [Number(subject_id)]
      )
    } else {
      rows = await executeQuery(
        'SELECT DISTINCT grade_level FROM students WHERE grade_level IS NOT NULL'
      )
    }
    const sorted = rows
      .map(r => r.grade_level)
      .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10))
    return res.json({ grades: sorted })
  } catch (err) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: err.message })
  }
}

async function getStudentsByGrade(req, res) {
  const { grade } = req.query
  if (!grade) return res.status(StatusCodes.BAD_REQUEST).json({ error: 'grade required' })
  try {
    const rows = await executeQuery(
      'SELECT student_id, first_name, last_name, grade_level FROM students WHERE grade_level = $1 ORDER BY first_name, last_name',
      [grade]
    )
    return res.json({ students: rows })
  } catch (err) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: err.message })
  }
}

// AI + MCP — Groq generates upsert SQL from schema + records, MCP executes it
async function markAttendance(req, res) {
  const { records } = req.body
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'records array required' })
  }
  try {
    const schema = await mcpGetSchema()

    const prompt = [
      'You are a PostgreSQL expert. Generate a single SQL statement to upsert attendance records.',
      '',
      'DATABASE SCHEMA:',
      schema,
      '',
      'RECORDS TO UPSERT (JSON):',
      JSON.stringify(records, null, 2),
      '',
      'STRICT RULES:',
      '- Generate ONE single INSERT INTO attendance ... VALUES (...), (...), ... statement',
      '- Include ALL ' + records.length + ' records from the JSON array — do NOT skip any',
      '- Columns to insert: student_id, student_name, subject_id, attendance_date, status, remarks',
      '- student_id MUST be the first column — it is NOT NULL and must always be included',
      '- Use ON CONFLICT (student_id, subject_id, attendance_date) DO UPDATE SET status = EXCLUDED.status, remarks = EXCLUDED.remarks, student_name = EXCLUDED.student_name',
      '- End with RETURNING attendance_id, student_id, student_name, subject_id, attendance_date, status;',
      '- Output ONLY the SQL, no markdown, no explanation',
      '- student_id and subject_id must be integers',
      '- attendance_date must be in YYYY-MM-DD format',
      "- status must be exactly one of: 'Present', 'Absent', 'Late', 'Excused'",
      "- remarks can be empty string ''",
    ].join('\n')

    const rawSql = await generateSql(prompt)
    console.log('Generated attendance SQL:', rawSql)

    const sql = sanitizeSql(rawSql)
    console.log('Sanitized attendance SQL:', sql)

    const rows = await mcpQueryDatabase(sql)
    console.log('Attendance save result:', Array.isArray(rows) ? rows.length : 0, 'records')

    return res.json({ saved: Array.isArray(rows) ? rows.length : 0, records: rows ?? [] })
  } catch (err) {
    console.error('markAttendance error:', err.message)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: err.message })
  }
}

async function getAttendance(req, res) {
  const { date, subject_id, grade } = req.query
  try {
    const conditions = []
    const params = []
    let idx = 1
    if (date)       { conditions.push('a.attendance_date = $' + idx++); params.push(date) }
    if (subject_id) { conditions.push('a.subject_id = $' + idx++);      params.push(Number(subject_id)) }
    if (grade)      { conditions.push('s.grade_level = $' + idx++);     params.push(grade) }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
    const rows = await executeQuery(
      'SELECT a.*, s.first_name, s.last_name, s.grade_level FROM attendance a JOIN students s ON s.student_id = a.student_id ' + where + ' ORDER BY s.grade_level, s.first_name',
      params
    )
    return res.json({ records: rows })
  } catch (err) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: err.message })
  }
}

module.exports = { getSubjects, getGrades, getStudentsByGrade, markAttendance, getAttendance }

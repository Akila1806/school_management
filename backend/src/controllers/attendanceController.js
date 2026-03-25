const { generateSql } = require('../services/groqService')
const { mcpQueryDatabase, mcpGetSchema } = require('../services/mcpClient')
const { sanitizeSql } = require('../utils/sanitizeSql')
const { StatusCodes } = require('../utils/statusCodes')
const { mcpAgent } = require('../services/mcpAgent')

async function getSubjects(req, res) {
  try {
    const response = await mcpAgent.run({ task: 'Get subjects', data: req.query })
    res.json({ subjects: response.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

async function getGrades(req, res) {
  try {
    const response = await mcpAgent.run({ task: 'Get grades', data: req.query })
    res.json({ grades: response.data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

async function getStudentsByGrade(req, res) {
  try {
    const response = await mcpAgent.run({ task: 'Get students by grade', data: req.query })
    res.json({ students: response.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

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
    const sql = sanitizeSql(rawSql)
    const rows = await mcpQueryDatabase(sql)
    return res.json({ saved: Array.isArray(rows) ? rows.length : 0, records: rows ?? [] })
  } catch (err) {
    console.error('markAttendance error:', err.message)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: err.message })
  }
}

async function getAttendance(req, res) {
  try {
    const response = await mcpAgent.run({ task: 'Get attendance records', data: req.query })
    res.json({ records: response.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getSubjects, getGrades, getStudentsByGrade, markAttendance, getAttendance }

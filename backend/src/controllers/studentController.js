const { generateSql, summarizeData } = require('../services/groqService')
const { mcpQueryDatabase } = require('../services/mcpClient')
const { sanitizeSql } = require('../utils/sanitizeSql')

/**
 * Generic AI-driven student endpoint
 * Accepts JSON form data and analyzes it with AI agent before inserting
 * All database interactions go through MCP
 */

async function handleStudentRequest(req, res) {
  let studentData = req.body

  try {

    const prompt = `
Generate a PostgreSQL INSERT query for the students table.

DATA (JSON):
${JSON.stringify(studentData, null, 2)}

RULES:
- Use ONLY keys with non-null values
- Do NOT include student_id
- Do NOT include email
- Convert dob to YYYY-MM-DD
- Map camelCase JSON keys to snake_case DB columns
- Do NOT insert "Not provided" or null values
- Output ONLY SQL

FORMAT:
INSERT INTO students (columns...) VALUES (values...) RETURNING *;
`

    const rawSql = await generateSql(prompt)
    const sql = sanitizeSql(rawSql)

    const rows = await mcpQueryDatabase(sql)

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: "Insert failed" })
    }

    const student = rows[0]
    const first = (student.first_name || 'student')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')

    const last = (student.last_name || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')

    const email = `${first}.${last}.${student.student_id}@school.edu`
    const updateSql = `
      UPDATE students
      SET email = '${email}'
      WHERE student_id = ${student.student_id}
      RETURNING *;
    `

    const updatedRows = await mcpQueryDatabase(updateSql)

    res.json({
      success: true,
      data: updatedRows
    })

  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

/**
 * GET endpoint - retrieve students with optional filters
 */
async function getStudents(req, res) {
  const query = req.query.q || 'get all students'

  try {
    const rawSql = await generateSql(query)
    const sql = sanitizeSql(rawSql)
    const rows = await mcpQueryDatabase(sql)
    res.json({ students: rows })
  } catch (err) {
    console.error('Get students error:', err.message)
    res.status(500).json({ detail: err.message })
  }
}

/**
 * PUT /api/students/:id - update an existing student
 */
async function updateStudent(req, res) {
  const { id } = req.params
  let studentData = req.body

  if (!id) {
    return res.status(400).json({ detail: 'Student ID is required' })
  }

  if (!studentData || typeof studentData !== 'object') {
    return res.status(400).json({ detail: 'Form data is required' })
  }

  try {

    const normalizedData = Object.fromEntries(
      Object.entries(studentData).map(([key, value]) => [
        key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`),
        value
      ])
    )

    const prompt = `
You are an expert PostgreSQL query generator.

TASK:
Generate a STRICT UPDATE query for the "students" table.

INPUT DATA (JSON):
${JSON.stringify(normalizedData, null, 2)}

CONDITION:
student_id = ${id}

STRICT RULES:
- Use ONLY keys with non-null, non-empty values
- IGNORE null, undefined, empty string, "Not provided"
- DO NOT include student_id in SET
- DO NOT include email in SET
- MUST include ALL valid fields from input (do NOT skip any)
- Use EXACT column names as given in JSON (already snake_case)
- Convert dob to YYYY-MM-DD if needed
- Strings must be in single quotes
- DO NOT generate empty SET clause
- MUST include WHERE student_id = ${id}
- MUST include RETURNING *

OUTPUT:
ONLY SQL query

FORMAT:
UPDATE students SET column=value,... WHERE student_id = ${id} RETURNING *;
`

    const rawSql = await generateSql(prompt)
    console.log("Generated UPDATE SQL:", rawSql)

    let sql = sanitizeSql(rawSql)

    sql = sql.replace(/\bgrade\b/g, "grade_level")

    console.log("Final Fixed SQL:", sql)

    const lower = sql.toLowerCase()

    if (
      !lower.startsWith("update students") ||
      !lower.includes(`where student_id = ${id}`) ||
      lower.includes("set ;") ||
      lower.includes("set where")
    ) {
      return res.status(400).json({
        error: "Invalid SQL generated"
      })
    }

    const rows = await mcpQueryDatabase(sql)

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        detail: `Student with ID ${id} not found`
      })
    }

    const student = rows[0]

    const first = (student.first_name || 'student')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')

    const last = (student.last_name || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')

    const email = `${first}.${last}.${student.student_id}@school.edu`

    const updateEmailSql = `
      UPDATE students
      SET email = '${email}'
      WHERE student_id = ${student.student_id}
      RETURNING *;
    `

    const updatedRows = await mcpQueryDatabase(updateEmailSql)

    res.json({
      success: true,
      message: "Student updated successfully",
      data: {
        studentId: updatedRows[0].student_id,
        fullName: `${updatedRows[0].first_name} ${updatedRows[0].last_name}`,
        grade: updatedRows[0].grade_level,
        email: updatedRows[0].email
      }
    })

  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message
    console.error("Update student error:", detail)
    res.status(500).json({ detail })
  }
}

module.exports = { handleStudentRequest, getStudents, updateStudent }

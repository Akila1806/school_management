const { generateSql, summarizeData } = require('../services/groqService')
const { mcpQueryDatabase } = require('../services/mcpClient')
const { sanitizeSql } = require('../utils/sanitizeSql')

/**
 * Generic AI-driven student endpoint
 * Accepts JSON form data and analyzes it with AI agent before inserting
 * All database interactions go through MCP
 */
async function handleStudentRequest(req, res) {
  const formData = req.body

  try {
    const currentDate = new Date().toISOString().split('T')[0]

    const email =
      formData.email ||
      `${formData.firstName}.${formData.lastName}@school.edu`.toLowerCase()

    const structuredData = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      dob: formData.dob,
      grade_level: formData.grade,
      gender: formData.gender,
      email,
      father_name: formData.fatherName,
      father_occupation: formData.fatherOccupation,
      mother_name: formData.motherName,
      mother_occupation: formData.motherOccupation,
      address: formData.address,
      parent_phone: formData.parentPhone,
      enrollment_date: currentDate
    }

    const studentSchema = { table: "students", fields: Object.keys(structuredData) }

    const prompt = `
    Schema: ${JSON.stringify(studentSchema)}
    Data: ${JSON.stringify(structuredData)}

    Generate INSERT SQL with ON CONFLICT (email) DO NOTHING RETURNING *;
    `

    const rawSql = await generateSql(prompt)
    const sql = sanitizeSql(rawSql)

    if (!sql.toLowerCase().includes("insert into students")) {
      return res.status(400).json({ error: "Invalid SQL generated" })
    }

    const rows = await mcpQueryDatabase(sql)

    res.json({
      success: true,
      data: rows
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
  const formData = req.body

  if (!id) {
    return res.status(400).json({ detail: 'Student ID is required' })
  }

  if (!formData || typeof formData !== 'object') {
    return res.status(400).json({ detail: 'Form data is required' })
  }

  try {
    const email =
      formData.email ||
      `${(formData.firstName || 'student')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')}.${(formData.lastName || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
      }@school.edu`

    const structuredData = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      dob: formData.dob,
      grade_level: formData.grade,
      gender: formData.gender,
      email,
      father_name: formData.fatherName,
      father_occupation: formData.fatherOccupation,
      mother_name: formData.motherName,
      mother_occupation: formData.motherOccupation,
      address: formData.address,
      parent_phone: formData.parentPhone
    }

    Object.keys(structuredData).forEach(
      key => structuredData[key] === undefined && delete structuredData[key]
    )

    const studentSchema = {
      table: "students",
      allowedFields: Object.keys(structuredData),
      where: "student_id"
    }

    const prompt = `
    You are a SQL generator.

    Schema:
    ${JSON.stringify(studentSchema, null, 2)}

    Data:
    ${JSON.stringify(structuredData, null, 2)}

    Condition:
    student_id = ${id}

    Task:
    Generate a safe UPDATE SQL query.
    - Use only given fields
    - Do not add extra columns
    - Do not modify other tables
    - Must include WHERE student_id = ${id}
    - Add RETURNING *;
    `

    const rawSql = await generateSql(prompt)
    console.log("Generated UPDATE SQL:", rawSql)

    const sql = sanitizeSql(rawSql)
    console.log("Sanitized UPDATE SQL:", sql)

    const normalized = sql.toLowerCase()

    if (
      !normalized.startsWith("update students") ||
      !normalized.includes(`where student_id = ${id}`)
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

    res.json({
      success: true,
      message: "Student updated successfully",
      data: {
        studentId: rows[0].student_id,
        fullName: `${rows[0].first_name} ${rows[0].last_name}`,
        grade: rows[0].grade_level,
        email: rows[0].email
      }
    })

  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message
    console.error("Update student error:", detail)
    res.status(500).json({ detail })
  }
}

module.exports = { handleStudentRequest, getStudents, updateStudent }

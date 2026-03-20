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

  if (!formData || typeof formData !== 'object') {
    return res.status(400).json({ detail: 'Form data is required' })
  }

  try {
    console.log('Processing student data:', formData)

    const currentDate = new Date().toISOString().split('T')[0]

    // Auto-generate email from name if not provided
    const email = formData.email ||
      `${(formData.firstName || 'student').toLowerCase().replace(/[^a-z0-9]/g, '')}.${(formData.lastName || 'user').toLowerCase().replace(/[^a-z0-9]/g, '')}@school.edu`

    const prompt = `Insert a new student with the following information:
- First Name: ${formData.firstName || 'Not provided'}
- Last Name: ${formData.lastName || 'Not provided'}
- Date of Birth: ${formData.dob || 'Not provided'}
- Grade: ${formData.grade || 'Not provided'}
- Gender: ${formData.gender || 'Not provided'}
- Email: ${email}
- Father's Name: ${formData.fatherName || 'Not provided'}
- Father's Occupation: ${formData.fatherOccupation || 'Not provided'}
- Mother's Name: ${formData.motherName || 'Not provided'}
- Mother's Occupation: ${formData.motherOccupation || 'Not provided'}
- Address: ${formData.address || 'Not provided'}
- Parent Phone: ${formData.parentPhone || 'Not provided'}
- Enrollment Date: ${currentDate}

IMPORTANT: Generate an INSERT SQL statement. Do NOT include student_id (auto-increment).
Add ON CONFLICT (email) DO NOTHING RETURNING * at the end.
Use this exact format:
INSERT INTO students (columns...) VALUES (values...) ON CONFLICT (email) DO NOTHING RETURNING *;`

    console.log('Generated prompt:', prompt)

    // Check if student already exists
    const checkSql = `SELECT COUNT(*) as count FROM students WHERE first_name ILIKE '${formData.firstName}' AND last_name ILIKE '${formData.lastName}'`
    const existingStudents = await mcpQueryDatabase(checkSql)

    if (existingStudents && existingStudents.length > 0 && existingStudents[0].count > 0) {
      return res.status(409).json({
        detail: `Student "${formData.firstName} ${formData.lastName}" already exists`,
      })
    }

    const rawSql = await generateSql(prompt)
    console.log('Generated SQL:', rawSql)

    const sql = sanitizeSql(rawSql)
    console.log('Sanitized SQL:', sql)

    const rows = await mcpQueryDatabase(sql)
    console.log('Query result:', rows)

    const analysis = await summarizeData(prompt, JSON.stringify(rows, null, 2))

    res.json({ analysis, data: rows, sql })
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message
    console.error('Student request error:', detail)
    res.status(500).json({ detail })
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

module.exports = { handleStudentRequest, getStudents }

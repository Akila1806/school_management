const { generateSql, summarizeData, resolveIntent } = require('../services/groqService')
const { mcpQueryDatabase } = require('../services/mcpClient')
const { sanitizeSql } = require('../utils/sanitizeSql')
const { Messages } = require('../utils/messages')
const { StatusCodes } = require('../utils/statusCodes')
const ExcelJS = require('exceljs')

/**
 * Convert form data to natural language prompt
 */
function formDataToPrompt(data) {
  const parts = []
  
  if (data.fullName) {
    const [firstName, ...lastNameParts] = data.fullName.trim().split(/\s+/)
    const lastName = lastNameParts.join(' ') || 'Unknown'
    parts.push(`add a new student named ${firstName} ${lastName}`)
  }
  
  if (data.dob) {
    parts.push(`born on ${data.dob}`)
  }
  
  if (data.grade) {
    parts.push(`in ${data.grade}`)
  }
  
  if (data.fatherName) {
    parts.push(`father's name is ${data.fatherName}`)
  }
  
  if (data.fatherOccupation) {
    parts.push(`father's occupation is ${data.fatherOccupation}`)
  }
  
  if (data.motherName) {
    parts.push(`mother's name is ${data.motherName}`)
  }
  
  if (data.motherOccupation) {
    parts.push(`mother's occupation is ${data.motherOccupation}`)
  }
  
  if (data.address) {
    parts.push(`address is ${data.address}`)
  }
  
  if (data.parentPhone) {
    parts.push(`parent phone is ${data.parentPhone}`)
  }
  
  return parts.join(', ')
}

async function agent(req, res) {
  let prompt = (req.body.message || '').trim()
  
  if (!prompt && req.body.fullName) {
    prompt = formDataToPrompt(req.body)
  }
  
  if (!prompt) return res.status(StatusCodes.BAD_REQUEST).json({ detail: Messages.Agent.EmptyMessage })

  // Build conversation history for context-aware SQL generation
  // history is an array of { role: 'user'|'assistant', content: string }
  const rawHistory = Array.isArray(req.body.history) ? req.body.history : []
  // Keep last 6 messages (3 turns) to stay within token limits
  const history = rawHistory.slice(-6).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: String(m.content || ''),
  }))

  try {
    const resolvedPrompt = await resolveIntent(prompt, history)
    console.log(`[resolveIntent] "${prompt}" → "${resolvedPrompt}"`)
    const rawSql = await generateSql(resolvedPrompt)
    console.log("Generated SQL:", rawSql)
    const sql = sanitizeSql(rawSql)
    console.log("Sanitized SQL:", sql)
    // If this is an UPDATE intent, first SELECT matching students to check for duplicates
    const isUpdateIntent = /\b(update|change|modify|set|edit)\b/i.test(resolvedPrompt)
    if (isUpdateIntent && sql.toLowerCase().startsWith('update')) {
      // Extract WHERE clause and build a SELECT to find matching students
      const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+RETURNING|;|$)/i)
      if (whereMatch) {
        const whereClause = whereMatch[1]
        const checkSql = `SELECT student_id, first_name, last_name, grade_level, gender, dob, email FROM students WHERE ${whereClause};`
        const matchedRows = await mcpQueryDatabase(checkSql)
        console.log("Disambiguation check rows:", matchedRows)

        if (Array.isArray(matchedRows) && matchedRows.length > 1) {
          return res.status(StatusCodes.OK).json({
            analysis: `Found ${matchedRows.length} students with that name. Which one do you want to update?`,
            data: matchedRows,
            sql,
            disambiguate: true,
            originalPrompt: resolvedPrompt,
          })
        }
      }
    }

    const rows = await mcpQueryDatabase(sql)
    console.log("Query Result:", rows)

    if (Array.isArray(rows) && rows.length > 1) {
      const isAllStudents = /all\s+students|list.*students|show.*students/i.test(resolvedPrompt)
      const message = isAllStudents
        ? Messages.Agent.AllStudents(rows.length)
        : Messages.Agent.QueryResults(rows.length)
      return res.status(StatusCodes.OK).json({ analysis: message, data: rows, sql })
    }

    const analysis = await summarizeData(resolvedPrompt, JSON.stringify(rows, null, 2))
    console.log("Data Analysis:", analysis)
    res.status(StatusCodes.OK).json({ analysis, data: rows, sql })
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message
    console.error('Agent error:', detail)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ detail })
  }
}

async function exportExcel(req, res) {
  const prompt = (req.body.message || '').trim()
  console.log("Prompt",prompt);
  if (!prompt) return res.status(StatusCodes.BAD_REQUEST).json({ detail: Messages.Agent.EmptyMessage })

  try {
    const rawSql = await generateSql(prompt)
    const sql = sanitizeSql(rawSql)
    const rows = await mcpQueryDatabase(sql)

    if (!rows.length) return res.status(StatusCodes.NOT_FOUND).json({ detail: Messages.Agent.NoDataToExport })

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Results')

    const headers = Object.keys(rows[0])
    sheet.addRow(headers.map(h => h.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())))
    const headerRow = sheet.getRow(1)
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.alignment = { horizontal: 'center' }
    })

    // Data rows
    for (const row of rows) {
      sheet.addRow(headers.map(h => {
        const v = row[h]
        if (v === null || v === undefined) return ''
        // Format ISO datetime strings as DD/MM/YYYY
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
          const d = new Date(v)
          return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
        }
        if (v instanceof Date) {
          return `${String(v.getDate()).padStart(2,'0')}/${String(v.getMonth()+1).padStart(2,'0')}/${v.getFullYear()}`
        }
        return String(v)
      }))
    }

    sheet.columns.forEach(col => {
      let maxLen = 10
      col.eachCell(cell => {
        const len = cell.value ? String(cell.value).length : 0
        if (len > maxLen) maxLen = len
      })
      col.width = Math.min(maxLen + 4, 40)
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=results.xlsx')
    await workbook.xlsx.write(res)
    res.end()
  } catch (err) {
    console.error('Export error:', err.message)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ detail: err.message })
  }
}

module.exports = { agent, exportExcel }

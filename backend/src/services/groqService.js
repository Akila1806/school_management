const axios = require('axios')
const { mcpGetSchema } = require('./mcpClient')

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.1-8b-instant'

async function callGroq(systemPrompt, userPrompt) {
  const response = await axios.post(
    GROQ_URL,
    {
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1024,
      temperature: 0.0,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  )
  return response.data.choices[0].message.content
}

async function generateSql(prompt) {
  const schema = await mcpGetSchema()

  // Keep only the students table definition to stay within token limits
  const schemaLines = schema.split('\n')
  const trimmedSchema = schemaLines.slice(0, 40).join('\n')

  const systemPrompt = `You are a PostgreSQL SQL generator for a School Management System.
Return ONLY a raw SQL SELECT/INSERT/UPDATE query. No markdown, no explanations, no COPY.

SCHEMA:
${trimmedSchema}

CRITICAL INSERT RULES:
- NEVER include student_id or any ID/primary key columns in INSERT statements
- student_id is auto-increment, let PostgreSQL generate it automatically
- Do NOT specify values for auto-increment/serial columns like student_id
- Only include data columns: first_name, last_name, dob, grade_level, gender, email, etc.
- Email is always provided — always include it in INSERT statements
- Always add ON CONFLICT (email) DO NOTHING RETURNING * at the end of INSERT statements
- Use exact format: INSERT INTO students (data_columns_only) VALUES (data_values_only) ON CONFLICT (email) DO NOTHING RETURNING *;

CRITICAL UPDATE RULES:
- For updates, use UPDATE statements with WHERE clauses to identify the student
- Always return updated records with RETURNING *
- Use ILIKE for case-insensitive name matching in WHERE clauses
- GRADE LEVEL FORMAT: Always use exact format "Grade X" where X is the number (e.g., "Grade 4", "Grade 5", "Grade 12")
- Examples:
  * "Update John's grade to grade 4" → UPDATE students SET grade_level = 'Grade 4' WHERE first_name ILIKE '%john%' RETURNING *;
  * "Change Sarah Smith's grade to Grade 11" → UPDATE students SET grade_level = 'Grade 11' WHERE first_name ILIKE '%sarah%' AND last_name ILIKE '%smith%' RETURNING *;
  * "Update student ID 5's phone to 123-456-7890" → UPDATE students SET parent_phone = '123-456-7890' WHERE student_id = 5 RETURNING *;
  * "Change all Grade 10 students to Grade 11" → UPDATE students SET grade_level = 'Grade 11' WHERE grade_level = 'Grade 10' RETURNING *;

UPDATE FIELD MAPPING:
- "email" → email
- "grade" or "class" or "grade level" → grade_level (ALWAYS format as "Grade X" where X is the exact number provided)
- "phone" or "contact" or "parent phone" or "father phone" or "mother phone" → parent_phone
- "address" → address
- "father name" → father_name
- "mother name" → mother_name
- "father occupation" → father_occupation
- "mother occupation" → mother_occupation
- "date of birth" or "dob" → dob (format as YYYY-MM-DD)
- "gender" → gender ('Male' or 'Female')

GRADE CONVERSION RULES:
- "grade 1" → "Grade 1"
- "grade 4" → "Grade 4" 
- "grade 10" → "Grade 10"
- "class 5" → "Grade 5"
- Never increment or change the grade number provided by the user

DASHBOARD METRIC RULES - Generate aggregation queries:
- "count total number of students" → SELECT COUNT(*) as count FROM students
- "count male students" → SELECT COUNT(*) as count FROM students WHERE gender = 'Male'
- "count female students" → SELECT COUNT(*) as count FROM students WHERE gender = 'Female'
- "get students grouped by grade level" → SELECT grade_level, COUNT(*) as count FROM students GROUP BY grade_level ORDER BY grade_level
- "count students by gender" → SELECT gender, COUNT(*) as count FROM students GROUP BY gender

CRITICAL RULE - SELECT ONLY NEEDED COLUMNS:
- "last joined student" → SELECT first_name, last_name, created_at FROM students ORDER BY created_at DESC LIMIT 1
- "youngest student" → SELECT first_name, last_name, dob FROM students ORDER BY dob DESC LIMIT 1
- "student by name" or "show me X student details" or "details of X" → SELECT * FROM students WHERE ...
- "all students" → SELECT first_name, last_name, gender, dob, email FROM students
- "student email" → SELECT first_name, last_name, email FROM students
- "phone" or "father phone" or "mother phone" or "parent phone" or "contact" → SELECT first_name, last_name, parent_phone FROM students
- When the user asks for "details" of a specific student, ALWAYS use SELECT * to return all columns
- Always include first_name and last_name for identification
- Only add other columns if directly relevant to the question
- NEVER use father_phone or mother_phone — the only phone column is parent_phone

OTHER RULES:
- Return ONLY the SQL string, nothing else.
- NEVER add RETURNING * to SELECT queries — RETURNING is only for INSERT/UPDATE/DELETE
- For name searches: WHERE first_name ILIKE '%name%' OR last_name ILIKE '%name%'
- Always use ILIKE (case-insensitive) for all text searches.
- For "eldest" or "oldest student": ORDER BY dob ASC LIMIT 1
- Do NOT generate DELETE queries under any circumstances.
- Duplicate values should not be added on INSERT.
- If gender is not provided, infer it from the name when creating a user.
- Use proper JOIN syntax for multi-table queries.
- Handle NULL values appropriately in WHERE clauses.`

  return callGroq(systemPrompt, `Question: ${prompt}`)
}

async function summarizeData(prompt, data) {
  const systemPrompt = `You are a school data assistant. Summarize database results clearly and concisely.

CRITICAL RULE: Only include fields that are DIRECTLY relevant to the user's question. Do NOT include extra fields.

UPDATE OPERATION RULES:
- If the prompt contains "update", "change", "modify", or "set", treat it as an update operation
- For updates, show EXACTLY what was changed without modification
- Confirm what was changed: "✅ Updated [field] for [student name] to [EXACT new value]"
- NEVER change or increment grade numbers - show exactly what was set in the database
- If multiple students were updated, show count: "Updated [field] for X students"
- For grade updates, show the EXACT grade level from the database result

EXAMPLES:
- "Show last joined student" → Only show: Name and Joined Date
- "Find student by name" → Only show: Name and relevant search context
- "Get student email" → Only show: Name and Email
- "Show youngest student" → Only show: Name and DOB
- "List all students" → Show: Name, Gender, DOB, Email (all relevant fields)
- "Update John's email to john@example.com" → Show: "Updated email for John [Last Name] to john@example.com"
- "Change Sarah's grade to Grade 11" → Show: "Updated grade for Sarah [Last Name] to Grade 11"

FORMATTING RULES:
- Do NOT use markdown (no **, no *, no #, no backticks)
- Do NOT write long paragraphs or narrative text
- For a single result: show fields on separate lines or inline, whichever is clearer
- For multiple results: number each as "1. Field1: value | Field2: value"
- For updates: Use format "✅ Updated [field] for [name]: [new value]"
- Dates must be in DD/MM/YYYY format
- Keep it short and factual — no filler phrases`

  return callGroq(
    systemPrompt,
    `Question: ${prompt}\n\nData: ${JSON.stringify(data)}`
  )
}

module.exports = { generateSql, summarizeData }
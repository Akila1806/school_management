const axios = require('axios')
const { mcpGetSchema } = require('./mcpClient')

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 
 'llama-3.3-70b-versatile'
//  'llama-3.1-8b-instant'

// Cache schema so we don't call MCP on every generateSql invocation
let _schemaCache = null
async function getCachedSchema() {
  if (!_schemaCache) _schemaCache = await mcpGetSchema()
  return _schemaCache
}

async function callGroq(systemPrompt, userPrompt, history = []) {
  const response = await axios.post(
    GROQ_URL,
    {
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
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

/**
 * Resolves the user's intent by:
 * 1. Fixing spelling/grammar mistakes
 * 2. Expanding vague follow-ups using conversation history into a clear standalone question
 *
 * Examples:
 *   history: "How many students in Grade 6?" → "There are 12 students in Grade 6."
 *   prompt:  "hwo are tey" → resolved: "List all students in Grade 6"
 *
 *   history: "Show me John's details"
 *   prompt:  "updaet his emial to x@y.com" → resolved: "Update John's email to x@y.com"
 */
async function resolveIntent(prompt, history = []) {
  // Skip if prompt already has a student_id — it's a targeted update, no resolution needed
  if (/student_id\s*=\s*\d+/i.test(prompt)) return prompt
  if (history.length === 0 && prompt.split(' ').length > 4) return prompt

  const systemPrompt = `You are a query normalizer for a school management chatbot.

Your job:
1. Fix ALL spelling and grammar mistakes in the user's question.
2. If the question is a follow-up (uses pronouns or vague references like "they", "them", "their", "him", "her", "it", "those", "that", "who are all", "show them", "list them", "who are they"), rewrite it as a fully self-contained question using context from the conversation history.
3. CRITICAL: Determine the correct INTENT from the question:
   - "who are they", "list them", "show them", "who are all", "name them" → intent is LIST (SELECT names/details), NOT count
   - "how many", "count", "total" → intent is COUNT
   - "show details", "tell me about" → intent is DETAILS
   - "update", "change", "modify" → intent is UPDATE
4. When rewriting follow-ups, ALWAYS use the grade/name/filter from the previous SQL or question in history.
5. Output ONLY the corrected, standalone question. No explanation, no extra text.

CRITICAL EXAMPLES:
- history: [user: "how many students in grade 10", assistant: "[SQL: SELECT COUNT(*) FROM students WHERE grade_level='Grade 10'] 1. Count: 12"]
  input: "who are they" → output: "List all students in Grade 10"

- history: [user: "how many students in grade 10", assistant: "1. Count: 12"]
  input: "woh are tey" → output: "List all students in Grade 10"

- history: [user: "show grade 5 students", assistant: "Found 8 students in Grade 5"]
  input: "shwo thier attndance" → output: "Show attendance for Grade 5 students"

- history: [user: "find john smith", assistant: "John Smith, Grade 7, Male"]
  input: "updaet his emial to john@test.com" → output: "Update John Smith's email to john@test.com"

- history: []
  input: "hw many studnts in graed 8" → output: "How many students are in Grade 8"

- history: [user: "how many male students", assistant: "Count: 31"]
  input: "who are all" → output: "List all male students"

- history: [user: "count grade 6 students", assistant: "Count: 7"]
  input: "names" → output: "List all students in Grade 6"

- history: [user: "count grade 6 students", assistant: "Count: 7"]
  input: "show them" → output: "List all students in Grade 6"`

  const historyText = history
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')

  const userPrompt = history.length > 0
    ? `Conversation so far:\n${historyText}\n\nCurrent input: "${prompt}"`
    : `Input: "${prompt}"`

  const resolved = await callGroq(systemPrompt, userPrompt)
  return resolved.trim().replace(/^["']|["']$/g, '') // strip any surrounding quotes
}

async function generateSql(prompt) {
  const schema = await getCachedSchema()

  // Include enough schema lines to cover all tables (students + attendance + relationships)
  const schemaLines = schema.split('\n')
  const trimmedSchema = schemaLines.slice(0, 80).join('\n')

  const systemPrompt = `You are a PostgreSQL SQL generator for a School Management System.
Return ONLY a raw SQL SELECT/INSERT/UPDATE query. No markdown, no explanations, no COPY.

SCHEMA:
${trimmedSchema}

CROSS-TABLE QUERY RULES (CRITICAL):
- "status" column belongs to the attendance table, NOT students table
- attendance table columns: attendance_id, student_id, student_name, subject_id, attendance_date, status, remarks
- attendance.status values: 'Present', 'Absent', 'Late', 'Excused'
- students table columns: student_id, first_name, last_name, dob, grade_level, gender, email, parent_phone, address, father_name, mother_name, father_occupation, mother_occupation, created_at
- NEVER use attendance columns (status, attendance_date, subject_id) in a WHERE clause on the students table
- For any query involving attendance status + student info, ALWAYS JOIN:
  SELECT s.first_name, s.last_name, s.parent_phone
  FROM students s
  JOIN attendance a ON s.student_id = a.student_id
  WHERE a.status = 'Late'
- Examples:
  * "phone number of late students" → SELECT s.first_name, s.last_name, s.parent_phone FROM students s JOIN attendance a ON s.student_id = a.student_id WHERE a.status = 'Late'
  * "absent students today" → SELECT s.first_name, s.last_name FROM students s JOIN attendance a ON s.student_id = a.student_id WHERE a.status = 'Absent' AND a.attendance_date = CURRENT_DATE
  * "present students in grade 6" → SELECT s.first_name, s.last_name FROM students s JOIN attendance a ON s.student_id = a.student_id WHERE a.status = 'Present' AND s.grade_level = 'Grade 6'
  * "excused students contact" → SELECT s.first_name, s.last_name, s.parent_phone FROM students s JOIN attendance a ON s.student_id = a.student_id WHERE a.status = 'Excused'

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

async function getCitiesByState(state) {
  const systemPrompt = `You are a geography assistant. Return ONLY a valid JSON array of major cities for the given Indian state.
No markdown, no explanation, no code block — just a raw JSON array of strings.
Example output: ["Chennai","Coimbatore","Madurai","Salem","Tiruchirappalli"]
Include 10-20 well-known cities/towns. Sort alphabetically.`

  const raw = await callGroq(systemPrompt, `List major cities in ${state}, India.`)
  // Strip any accidental markdown fences
  const cleaned = raw.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim()
  return JSON.parse(cleaned)
}

async function classifyIntent(prompt) {
  const systemPrompt = `You are an intent classifier for a school management chatbot.

Classify the user's message into EXACTLY one of these intents:
- create_student : user wants to add, create, register, enroll a new student, or open the student form (even with typos or indirect phrasing)
- show_dashboard : user wants to see the dashboard, stats, overview, metrics
- show_attendance : user explicitly wants to OPEN or NAVIGATE TO the attendance sheet/form (e.g. "open attendance", "go to attendance sheet", "show attendance form")
- agent : everything else — including ANY question ABOUT attendance data (who is absent, late students, present count, attendance records, etc.)

Rules:
- Output ONLY the intent label, nothing else. No explanation, no punctuation.
- Be generous with create_student — if the user is asking to open a form, add a student, register someone, fill a form, it's create_student
- show_attendance is ONLY for navigation/open requests, NOT for data questions. Any question asking WHO is absent/present/late is agent.
- Typos and mixed languages are fine — understand the intent

Examples:
"create student" → create_student
"add new student" → create_student
"open student form" → create_student
"register a kid" → create_student
"enroll student" → create_student
"new admission" → create_student
"student add pannanum" → create_student
"pudhu student" → create_student
"show dashboard" → show_dashboard
"open attendance sheet" → show_attendance
"go to attendance" → show_attendance
"show attendance form" → show_attendance
"mark attendance" → show_attendance
"who is absent" → agent
"who is absent today" → agent
"who are the late students" → agent
"how many students are present" → agent
"show absent students" → agent
"attendance of grade 6" → agent
"how many students in grade 6" → agent
"update john's email" → agent`

  const result = await callGroq(systemPrompt, `Message: "${prompt}"`)
  const intent = result.trim().toLowerCase()
  // Validate — fallback to agent if unexpected output
  if (['create_student', 'show_dashboard', 'show_attendance'].includes(intent)) return intent
  return 'agent'
}


async function generateAuthSql(prompt) {  const systemPrompt = `You are a PostgreSQL SQL generator for a users authentication table.

TABLE SCHEMA:
users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'teacher',
  grade VARCHAR(50),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
)

RULES:
- Return ONLY raw SQL, no markdown, no explanation, no code blocks
- Never hardcode actual values — embed them exactly as given in the prompt
- Output ONLY the SQL string`

  return callGroq(systemPrompt, prompt)
}

module.exports = { generateSql, summarizeData, getCitiesByState, generateAuthSql, resolveIntent, classifyIntent }

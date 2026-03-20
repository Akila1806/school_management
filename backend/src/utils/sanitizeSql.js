/**
 * Strip markdown fences, block COPY TO FILE, and patch missing NOT NULL
 * columns in INSERT statements before they reach the database.
 */
function sanitizeSql(sql) {
  sql = sql.trim().replace(/^```sql/i, '').replace(/^```/, '').replace(/```$/, '').trim()

  const copyWrapped = sql.match(/COPY\s*\(([\s\S]+?)\)\s*TO\s+/i)
  if (copyWrapped) return copyWrapped[1].trim()

  if (/^\s*COPY\b/i.test(sql)) {
    throw new Error('COPY TO FILE is not allowed. Use a SELECT query instead.')
  }

  // Patch missing NOT NULL columns on any INSERT INTO students
  if (/^\s*INSERT\s+INTO\s+students\b/i.test(sql)) {
    sql = ensureColumn(sql, 'enrollment_date', 'CURRENT_DATE')
    sql = ensureEmailColumn(sql)
  }

  return sql
}

/**
 * If `column` is absent from the INSERT, append it with `value`.
 */
function ensureColumn(sql, column, value) {
  if (new RegExp(`\\b${column}\\b`, 'i').test(sql)) return sql

  const m = sql.match(/^(INSERT\s+INTO\s+students\s*\()([^)]+)(\)\s*VALUES\s*\()([^)]+)(\).*)/is)
  if (!m) return sql
  const [, pre, cols, mid, vals, suf] = m
  return `${pre}${cols.trim()}, ${column}${mid}${vals.trim()}, ${value}${suf}`
}

/**
 * If email is absent or its value is NULL / 'Not provided',
 * derive it from first_name + last_name already in the INSERT.
 */
function ensureEmailColumn(sql) {
  if (!/\bemail\b/i.test(sql)) {
    const m = sql.match(/^(INSERT\s+INTO\s+students\s*\()([^)]+)(\)\s*VALUES\s*\()([^)]+)(\).*)/is)
    if (!m) return sql
    const [, pre, cols, mid, vals, suf] = m
    const email = deriveEmail(cols, vals)
    return `${pre}${cols.trim()}, email${mid}${vals.trim()}, '${email}'${suf}`
  }

  const m = sql.match(/^(INSERT\s+INTO\s+students\s*\()([^)]+)(\)\s*VALUES\s*\()([^)]+)(\).*)/is)
  if (!m) return sql
  const [, pre, cols, mid, vals, suf] = m

  const colList = cols.split(',').map(c => c.trim().toLowerCase())
  const valList = splitValues(vals)
  const emailIdx = colList.indexOf('email')
  if (emailIdx === -1) return sql

  const emailVal = (valList[emailIdx] ?? '').trim()
  const isNull = /^null$/i.test(emailVal) || /not\s*provided/i.test(emailVal) || emailVal === "''"

  if (isNull) {
    const email = deriveEmail(cols, vals)
    valList[emailIdx] = `'${email}'`
    return `${pre}${cols}${mid}${valList.join(', ')}${suf}`
  }

  return sql
}

function deriveEmail(cols, vals) {
  const colList = cols.split(',').map(c => c.trim().toLowerCase())
  const valList = splitValues(vals)
  const fn = stripQuotes(valList[colList.indexOf('first_name')] ?? 'student').toLowerCase().replace(/[^a-z0-9]/g, '') || 'student'
  const ln = stripQuotes(valList[colList.indexOf('last_name')]  ?? 'user').toLowerCase().replace(/[^a-z0-9]/g, '')  || 'user'
  return `${fn}.${ln}@school.edu`
}

function splitValues(vals) {
  const result = []
  let cur = '', inQ = false, qc = ''
  for (const ch of vals) {
    if (!inQ && (ch === "'" || ch === '"')) { inQ = true; qc = ch; cur += ch }
    else if (inQ && ch === qc)             { inQ = false; cur += ch }
    else if (!inQ && ch === ',')           { result.push(cur.trim()); cur = '' }
    else                                   { cur += ch }
  }
  if (cur.trim()) result.push(cur.trim())
  return result
}

function stripQuotes(v) { return v.replace(/^['"]|['"]$/g, '') }

module.exports = { sanitizeSql }

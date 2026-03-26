const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { generateSql, getCitiesByState } = require('../services/groqService')
const { mcpQueryDatabase, mcpGetSchema } = require('../services/mcpClient')
const { sanitizeSql } = require('../utils/sanitizeSql')
const { Messages } = require('../utils/messages')
const { StatusCodes } = require('../utils/statusCodes')

const JWT_SECRET = process.env.JWT_SECRET || 'school_secret_key'

// POST /api/auth/signup
async function signup(req, res) {
  if (!req.body.name || !req.body.email || !req.body.password) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: Messages.Auth.NameEmailPasswordRequired })
  }

  try {
    const schema = await mcpGetSchema()

    // AI: check duplicate email
    const checkPrompt = [
      'You are a PostgreSQL expert. Generate a SQL query for the users table.',
      '',
      'DATABASE SCHEMA:',
      schema,
      '',
      'TASK: Check if a user with this email already exists.',
      'INPUT (JSON):',
      JSON.stringify({ email: req.body.email }, null, 2),
      '',
      'STRICT RULES:',
      '- Output ONLY the SQL, no markdown, no explanation',
      '- SELECT only the id column',
      '- Use LIMIT 1',
    ].join('\n')

    const checkRows = await mcpQueryDatabase(sanitizeSql(await generateSql(checkPrompt)))
    if (checkRows && checkRows.length > 0) {
      return res.status(StatusCodes.CONFLICT).json({ error: Messages.Auth.EmailAlreadyRegistered })
    }

    const password_hash = await bcrypt.hash(req.body.password, 10)

    // AI: insert new user
    const insertPrompt = [
      'You are a PostgreSQL expert. Generate a SQL INSERT statement for the users table.',
      '',
      'DATABASE SCHEMA:',
      schema,
      '',
      'RECORD TO INSERT (JSON):',
      JSON.stringify({ ...req.body, password_hash, role: 'teacher', password: undefined }, null, 2),
      '',
      'STRICT RULES:',
      '- Output ONLY the SQL, no markdown, no explanation',
      '- Columns: name, email, password_hash, role, phone, address, city, state',
      '- Use ON CONFLICT (email) DO NOTHING',
      '- End with RETURNING id, name, email, role, phone, address, city, state, created_at',
      '- Escape all single quotes in string values',
    ].join('\n')

    const rows = await mcpQueryDatabase(sanitizeSql(await generateSql(insertPrompt)))
    if (!rows || rows.length === 0) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: Messages.Auth.UserInsertFailed })
    }

    return res.status(StatusCodes.CREATED).json({ message: 'Account created successfully', user: rows[0] })
  } catch (err) {
    console.error('signup error:', err.message)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: Messages.Auth.LoginFailed })
  }
}

// POST /api/auth/login
async function login(req, res) {
  if (!req.body.email || !req.body.password) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: Messages.Auth.NameEmailPasswordRequired })
  }

  try {
    const schema = await mcpGetSchema()

    // AI: fetch user by email
    const selectPrompt = [
      'You are a PostgreSQL expert. Generate a SQL SELECT query for the users table.',
      '',
      'DATABASE SCHEMA:',
      schema,
      '',
      'TASK: Fetch user credentials by email for login.',
      'INPUT (JSON):',
      JSON.stringify({ email: req.body.email }, null, 2),
      '',
      'STRICT RULES:',
      '- Output ONLY the SQL, no markdown, no explanation',
      '- SELECT columns: id, name, email, password_hash, role, phone, address, city, state',
      '- Use WHERE email = the given email (exact match)',
      '- Use LIMIT 1',
    ].join('\n')

    const rows = await mcpQueryDatabase(sanitizeSql(await generateSql(selectPrompt)))
    if (!rows || rows.length === 0) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ error: Messages.Auth.InvalidEmailOrPassword })
    }

    const user = rows[0]
    const valid = await bcrypt.compare(req.body.password, user.password_hash)
    if (!valid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({ error: Messages.Auth.InvalidEmailOrPassword })
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    )
    const { password_hash, ...safeUser } = user

    return res.status(StatusCodes.OK).json({ token, user: safeUser })
  } catch (err) {
    console.error('login error:', err.message)
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: Messages.Auth.LoginFailed })
  }
}

// GET /api/auth/me
async function getMe(req, res) {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: Messages.Auth.NoTokenProvided })
  }

  try {
    const decoded = jwt.verify(req.headers.authorization.split(' ')[1], JWT_SECRET)
    const schema = await mcpGetSchema()

    // AI: fetch user by id
    const selectPrompt = [
      'You are a PostgreSQL expert. Generate a SQL SELECT query for the users table.',
      '',
      'DATABASE SCHEMA:',
      schema,
      '',
      'TASK: Fetch a user by their numeric ID.',
      'INPUT (JSON):',
      JSON.stringify({ id: decoded.id }, null, 2),
      '',
      'STRICT RULES:',
      '- Output ONLY the SQL, no markdown, no explanation',
      '- SELECT columns: id, name, email, role, phone, address, city, state, created_at',
      '- Use WHERE id = the given integer ID',
      '- Use LIMIT 1',
    ].join('\n')

    const rows = await mcpQueryDatabase(sanitizeSql(await generateSql(selectPrompt)))
    if (!rows || rows.length === 0) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: Messages.Auth.UserNotFound })
    }

    return res.status(StatusCodes.OK).json({ user: rows[0] })
  } catch (err) {
    console.error('getMe error:', err.message)
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: Messages.Auth.InvalidOrExpiredToken })
  }
}

// GET /api/auth/cities?state=Tamil Nadu
async function getCities(req, res) {
  if (!req.query.state) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: Messages.Auth.StateRequired })
  }
  try {
    const cities = await getCitiesByState(req.query.state)
    res.status(StatusCodes.OK).json({ cities })
  } catch (err) {
    console.error('getCities error:', err.message)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: Messages.Auth.FailedToFetchCities })
  }
}

module.exports = { signup, login, getMe, getCities }

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { getCitiesByState } = require('../services/groqService')
const { mcpAgent } = require('../services/mcpAgent')
const { StatusCodes } = require('../utils/statusCodes')
const { Messages } = require('../utils/messages')

const JWT_SECRET = process.env.JWT_SECRET || 'school_secret'
const JWT_EXPIRES = '7d'

async function signup(req, res) {
  const userData = req.body

  if (!userData.name || !userData.email || !userData.password)
    return res.status(StatusCodes.BAD_REQUEST).json({ error: Messages.Auth.NameEmailPasswordRequired })

  try {
    const password_hash = await bcrypt.hash(userData.password, 10)
    const finalData = { ...userData, password_hash }

    const response = await mcpAgent.run({ task: 'Create user', data: finalData })

    if (!response || !response.data)
      return res.status(StatusCodes.BAD_REQUEST).json({ error: Messages.Auth.UserInsertFailed })

    const user = response.data
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    )
    res.status(StatusCodes.CREATED).json({ success: true, data: { token, user } })
  } catch (err) {
    const status = err.message.includes('already') ? StatusCodes.CONFLICT ?? 409 : StatusCodes.INTERNAL_SERVER_ERROR
    res.status(status).json({ error: err.message })
  }
}

async function login(req, res) {
  try {
    const response = await mcpAgent.run({ task: 'Login user', data: req.body })

    if (!response || !response.data)
      return res.status(StatusCodes.UNAUTHORIZED).json({ error: Messages.Auth.LoginFailed })

    res.status(StatusCodes.OK).json({ success: true, data: response.data })
  } catch (err) {
    console.error('Login error:', err)
    const status = err.message.includes('Invalid') ? StatusCodes.UNAUTHORIZED : StatusCodes.INTERNAL_SERVER_ERROR
    res.status(status).json({ error: err.message })
  }
}

async function getMe(req, res) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(StatusCodes.UNAUTHORIZED).json({ error: Messages.Auth.NoTokenProvided })

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, JWT_SECRET)

    const response = await mcpAgent.run({ task: 'Get user', data: { id: decoded.id } })

    if (!response || !response.data)
      return res.status(StatusCodes.NOT_FOUND).json({ error: Messages.Auth.UserNotFound })

    res.status(StatusCodes.OK).json({ user: response.data })
  } catch (err) {
    res.status(StatusCodes.UNAUTHORIZED).json({ error: Messages.Auth.InvalidOrExpiredToken })
  }
}

async function getCities(req, res) {
  const { state } = req.query
  if (!state) return res.status(StatusCodes.BAD_REQUEST).json({ error: Messages.Auth.StateRequired })
  try {
    const cities = await getCitiesByState(state)
    res.status(StatusCodes.OK).json({ cities })
  } catch (err) {
    console.error('getCities error:', err)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: Messages.Auth.FailedToFetchCities })
  }
}

module.exports = { signup, login, getMe, getCities }

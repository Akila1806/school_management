const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { getCitiesByState } = require('../services/groqService')
const { mcpAgent } = require('../services/mcpAgent')

const JWT_SECRET = process.env.JWT_SECRET || 'school_secret'
const JWT_EXPIRES = '7d'

async function signup(req, res) {
  let userData = req.body;

  if (!userData.name || !userData.email || !userData.password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }

  try {
    // ✅ hash password (backend)
    const password_hash = await bcrypt.hash(userData.password, 10);

    const finalData = {
      ...userData,
      password_hash
    };

    // ✅ AI handles everything (NO SQL)
    const response = await mcpAgent.run({
      task: "Create user",
      data: finalData,
      instructions: `
        - Create users table if not exists
        - Ignore null or empty values
        - Check if email already exists
        - If exists, return error
        - Insert new user
        - Return created user
      `
    });

    if (!response || !response.data) {
      return res.status(400).json({ error: "User insert failed" });
    }

    const user = response.data;

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      success: true,
      data: {
        token,
        user
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function login(req, res) {
  try {

    // ✅ Send full req.body directly to AI
    const response = await mcpAgent.run({
      task: "Login user",
      data: req.body
    });

    if (!response || !response.data) {
      return res.status(401).json({ error: "Login failed" });
    }

    // mcpAgent already returns { token, user } — pass through directly
    res.json({
      success: true,
      data: response.data
    });

  } catch (err) {
    console.error("Login error:", err);

    const status =
      err.message.includes("Invalid email") ||
      err.message.includes("Invalid password")
        ? 401
        : 500;

    res.status(status).json({ error: err.message });
  }
}
async function getMe(req, res) {
  try {
    const response = await mcpAgent.run({
      task: "Get current user",
      data: {
        headers: req.headers
      },
      instructions: `
        - Extract token from Authorization header (Bearer token)
        - If token not present, return error "No token provided"
        - Verify JWT token using secret
        - Decode user id from token
        - Fetch user from users table using id
        - If user not found, return error "User not found"
        - Return user details (id, name, email, role, grade, phone, address, city, state, created_at)
        - Do not include sensitive fields like password_hash
      `
    });

    if (!response || !response.data) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: response.data });

  } catch (err) {
    const status =
      err.message.includes("No token") ||
      err.message.includes("Invalid") ||
      err.message.includes("expired")
        ? 401
        : 500;

    res.status(status).json({ error: err.message });
  }
}
async function getCities(req, res) {
  const { state } = req.query
  if (!state) return res.status(400).json({ error: 'state is required' })
  try {
    const cities = await getCitiesByState(state)
    res.json({ cities })
  } catch (err) {
    console.error('getCities error:', err)
    res.status(500).json({ error: 'Failed to fetch cities' })
  }
}

module.exports = { signup, login, getMe, getCities }

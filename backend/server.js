require('dotenv').config()
const app = require('./src/app')
const { Pool } = require('pg')

const PORT = process.env.PORT || 8000

async function runMigrations() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  })
  const client = await pool.connect()
  try {
    await client.query(`ALTER TABLE students ALTER COLUMN email DROP NOT NULL`)
    // console.log('Migration: email column is now nullable')
  } catch (err) {
    // Already nullable or table not yet created — safe to ignore
    console.log('Migration note:', err.message)
  } finally {
    client.release()
    await pool.end()
  }
}

runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`School AI Backend running on http://localhost:${PORT}`)
  })
}).catch(err => {
  console.error('Startup migration failed:', err.message)
  app.listen(PORT, () => {
    console.log(`School AI Backend running on http://localhost:${PORT}`)
  })
})

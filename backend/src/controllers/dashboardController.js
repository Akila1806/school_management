const { generateSql, summarizeData } = require('../services/groqService')
const { mcpQueryDatabase } = require('../services/mcpClient')
const { sanitizeSql } = require('../utils/sanitizeSql')

// Cache for dashboard metrics to avoid rate limiting
const dashboardCache = new Map()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Pre-defined SQL queries for common dashboard metrics to avoid Groq API calls
const PREDEFINED_QUERIES = {
  'count total number of students': 'SELECT COUNT(*) as count FROM students',
  'count male students': "SELECT COUNT(*) as count FROM students WHERE gender = 'Male'",
  'count female students': "SELECT COUNT(*) as count FROM students WHERE gender = 'Female'",
  'get students grouped by grade level': 'SELECT grade_level, COUNT(*) as count FROM students GROUP BY grade_level ORDER BY grade_level',
  'get attendance summary by status': "SELECT status, COUNT(*) as count FROM attendance GROUP BY status ORDER BY status",
  'get attendance by grade': "SELECT s.grade_level, a.status, COUNT(*) as count FROM attendance a JOIN students s ON a.student_id = s.student_id GROUP BY s.grade_level, a.status ORDER BY s.grade_level",
  'get weekly attendance summary': "SELECT status, COUNT(*) as count FROM attendance WHERE attendance_date >= date_trunc('week', CURRENT_DATE) AND attendance_date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days' GROUP BY status ORDER BY status",
  'get last month attendance summary': "SELECT status, COUNT(*) as count FROM attendance WHERE attendance_date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND attendance_date < date_trunc('month', CURRENT_DATE) GROUP BY status ORDER BY status"
}

/**
 * Generic AI-driven dashboard endpoint
 * Accepts requests for dashboard metrics and delegates to AI agent
 * All data retrieval goes through MCP
 */
async function getDashboardData(req, res) {
  const metric = (req.query.metric || '').trim()
  
  if (!metric) {
    return res.status(400).json({ detail: 'Metric parameter is required' })
  }

  try {
    // AI agent generates SQL based on schema and metric request
    const rawSql = await generateSql(metric)
    const sql = sanitizeSql(rawSql)
    
    console.log('Generated SQL:', sql)
    
    // Execute through MCP
    const rows = await mcpQueryDatabase(sql)
    
    console.log('Query result:', rows)
    
    // Return raw data for dashboard to process
    res.json({ 
      metric,
      data: rows,
      sql 
    })
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message
    console.error('Dashboard data error:', detail)
    res.status(500).json({ detail })
  }
}

/**
 * Batch endpoint for fetching multiple dashboard metrics at once
 * Uses cached queries and pre-defined SQL to avoid rate limiting
 */
async function getDashboardMetrics(req, res) {
  const metrics = req.body.metrics || []
  
  if (!Array.isArray(metrics) || metrics.length === 0) {
    return res.status(400).json({ detail: 'Metrics array is required' })
  }

  try {
    const results = {}
    
    for (const metric of metrics) {
      try {
        console.log(`Fetching metric: ${metric}`)
        
        // Check cache first
        const cacheKey = `dashboard_${metric}`
        const cached = dashboardCache.get(cacheKey)
        
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
          console.log(`Using cached result for: ${metric}`)
          results[metric] = cached.data
          continue
        }
        
        let sql
        
        // Use predefined query if available to avoid Groq API calls
        if (PREDEFINED_QUERIES[metric]) {
          sql = PREDEFINED_QUERIES[metric]
          console.log(`Using predefined SQL for "${metric}":`, sql)
        } else {
          // Fall back to AI generation for custom metrics
          console.log(`Generating SQL for custom metric: ${metric}`)
          const rawSql = await generateSql(metric)
          sql = sanitizeSql(rawSql)
          console.log(`Generated SQL for "${metric}":`, sql)
        }
        
        const rows = await mcpQueryDatabase(sql)
        console.log(`Result for "${metric}":`, rows)
        
        const result = { data: rows, sql, error: null }
        results[metric] = result
        
        // Cache the result
        dashboardCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        })
        
      } catch (err) {
        console.error(`Error fetching metric "${metric}":`, err.message)
        const errorResult = { data: [], sql: null, error: err.message }
        results[metric] = errorResult
        
        // Don't cache errors, but log them
        console.error(`Failed to fetch metric "${metric}":`, err)
      }
    }
    
    console.log('All results:', results)
    res.json({ results })
  } catch (err) {
    console.error('Dashboard metrics error:', err.message)
    res.status(500).json({ detail: err.message })
  }
}

/**
 * Clear dashboard cache (useful for development or when data changes)
 */
async function clearDashboardCache(req, res) {
  dashboardCache.clear()
  console.log('Dashboard cache cleared')
  res.json({ message: 'Dashboard cache cleared successfully' })
}

module.exports = { getDashboardData, getDashboardMetrics, clearDashboardCache }

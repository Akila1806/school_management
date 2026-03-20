const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js')
const path = require('path')

let _client = null

async function getMcpClient() {
  if (_client) return _client

  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, '../mcpServer.js')],
  })

  const client = new Client({ name: 'school-backend-client', version: '1.0.0' })
  await client.connect(transport)

  _client = client
  return client
}

// Call the query_database MCP tool
async function mcpQueryDatabase(sql) {
  const client = await getMcpClient()
  try {
    const result = await client.callTool({ name: 'query_database', arguments: { sql } })
    const text = result.content?.[0]?.text || '[]'
    console.log('Raw MCP response:', text)
    
    // Try to parse JSON, if it fails, log the error and return empty array
    try {
      const parsed = JSON.parse(text)
      
      // Check if the response contains an error
      if (parsed.error) {
        throw new Error(`Database error: ${parsed.error}`)
      }
      
      return parsed
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message)
      console.error('Raw text that failed to parse:', text)
      throw new Error(`Invalid JSON response from database: ${parseError.message}`)
    }
  } catch (mcpError) {
    console.error('MCP tool call error:', mcpError)
    throw mcpError
  }
}

// Call the get_schema MCP tool
async function mcpGetSchema() {
  const client = await getMcpClient()
  const result = await client.callTool({ name: 'get_schema', arguments: {} })
  return result.content?.[0]?.text || ''
}

module.exports = { mcpQueryDatabase, mcpGetSchema }

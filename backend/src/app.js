const express = require('express')
const cors = require('cors')
const agentRoutes = require('./routes/agentRoutes')

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.json())

app.use('/api', agentRoutes)

module.exports = app

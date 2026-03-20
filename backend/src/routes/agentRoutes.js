const { Router } = require('express')
const { agent, exportExcel } = require('../controllers/agentController')
const { handleStudentRequest, getStudents } = require('../controllers/studentController')
const { getDashboardData, getDashboardMetrics, clearDashboardCache } = require('../controllers/dashboardController')

const router = Router()

router.post('/agent', agent)
router.post('/export', exportExcel)
router.post('/students', handleStudentRequest)
router.get('/students', getStudents)
router.get('/dashboard', getDashboardData)
router.post('/dashboard/metrics', getDashboardMetrics)
router.delete('/dashboard/cache', clearDashboardCache)

module.exports = router

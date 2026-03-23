import { useState, useEffect } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import styles from '../styles.module.css'
import { postData } from '../utils/api'
import { Messages } from '../utils/messages'

interface DashboardMetrics {
  totalStudents: number
  maleCount: number
  femaleCount: number
  gradeDistribution: Array<{ name: string; value: number }>
  genderData: Array<{ name: string; value: number; fill: string }>
  attendanceSummary: Array<{ name: string; value: number; fill: string }>
}

interface ApiResult {
  data: Array<{ count?: string; grade_level?: string; [key: string]: string | undefined }>
  sql: string | null
  error: string | null
}

interface ApiResponse {
  results: Record<string, ApiResult>
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalStudents: 0,
    maleCount: 0,
    femaleCount: 0,
    gradeDistribution: [],
    genderData: [],
    attendanceSummary: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [profileOpen, setProfileOpen] = useState(false)
  const [attendanceView, setAttendanceView] = useState<'weekly' | 'monthly'>('weekly')
  const [weeklyAttendance, setWeeklyAttendance] = useState<Array<{ name: string; value: number; fill: string }>>([])
  const [monthlyAttendance, setMonthlyAttendance] = useState<Array<{ name: string; value: number; fill: string }>>([])


  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Add a small delay to ensure the component is fully mounted
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Make direct fetch call to dashboard metrics
        const data = await postData('/api/dashboard/metrics', {
            metrics: [
              'count total number of students',
              'count male students',
              'count female students',
              'get students grouped by grade level',
              'get attendance summary by status',
              'get weekly attendance summary',
              'get last month attendance summary',
            ]
          }) as ApiResponse

        if (!data || !data.results) {
          throw new Error(Messages.Dashboard.NoResults)
        }

        const results = data.results

        // Check if any of the results have errors
        const criticalMetrics = ['count total number of students', 'count male students', 'count female students', 'get students grouped by grade level']
        const hasCriticalErrors = criticalMetrics.some((m) => results[m]?.error)
        if (hasCriticalErrors) {
          const errorMessages = criticalMetrics
            .filter((m) => results[m]?.error)
            .map((m) => `${m}: ${results[m].error}`)
          throw new Error(`API errors: ${errorMessages.join(', ')}`)
        }

        // Process results - convert string counts to numbers
        const totalStudents = parseInt(results['count total number of students']?.data?.[0]?.count || '0', 10)
        const maleCount = parseInt(results['count male students']?.data?.[0]?.count || '0', 10)
        const femaleCount = parseInt(results['count female students']?.data?.[0]?.count || '0', 10)
        
        // Grade distribution - sort by grade level
        const gradeDataArray = results['get students grouped by grade level']?.data || []
        
        const gradeDistribution = gradeDataArray
          .map((g: { count?: string; grade_level?: string }) => ({
            name: g.grade_level || '',
            value: parseInt(g.count || '0', 10)
          }))
          .sort((a: { name: string; value: number }, b: { name: string; value: number }) => {
            const gradeA = parseInt(a.name.replace('Grade ', ''), 10)
            const gradeB = parseInt(b.name.replace('Grade ', ''), 10)
            return gradeA - gradeB
          })

        // Gender distribution percentages
        const total = totalStudents || 1
        const genderData = [
          { name: 'Male', value: Math.round((maleCount / total) * 100), fill: '#6366f1' },
          { name: 'Female', value: Math.round((femaleCount / total) * 100), fill: '#ec4899' },
        ]

        const ATTENDANCE_COLORS: Record<string, string> = {
          present: '#10b981',
          absent: '#ef4444',
          late: '#f59e0b',
          excused: '#6366f1',
        }

        const attendanceRaw = results['get attendance summary by status']?.data || []
        const attendanceSummary = attendanceRaw.map((r: { status?: string; count?: string }) => {
          const status = String(r.status ?? '').toLowerCase()
          return {
            name: status.charAt(0).toUpperCase() + status.slice(1),
            value: parseInt(String(r.count ?? '0'), 10),
            fill: ATTENDANCE_COLORS[status] ?? '#94a3b8',
          }
        })

        const weeklyRaw = results['get weekly attendance summary']?.data || []
        const weekly = weeklyRaw.map((r: { status?: string; count?: string }) => {
          const status = String(r.status ?? '').toLowerCase()
          return {
            name: status.charAt(0).toUpperCase() + status.slice(1),
            value: parseInt(String(r.count ?? '0'), 10),
            fill: ATTENDANCE_COLORS[status] ?? '#94a3b8',
          }
        })

        const monthlyRaw = results['get last month attendance summary']?.data || []
        const monthly = monthlyRaw.map((r: { status?: string; count?: string }) => {
          const status = String(r.status ?? '').toLowerCase()
          return {
            name: status.charAt(0).toUpperCase() + status.slice(1),
            value: parseInt(String(r.count ?? '0'), 10),
            fill: ATTENDANCE_COLORS[status] ?? '#94a3b8',
          }
        })

        setWeeklyAttendance(weekly)
        setMonthlyAttendance(monthly)

        setMetrics({
          totalStudents,
          maleCount,
          femaleCount,
          gradeDistribution,
          genderData,
          attendanceSummary,
        })
      } catch (err) {
        console.error('Dashboard API error:', err)
        const errorMessage = err instanceof Error ? err.message : Messages.Dashboard.LoadError
        setError(errorMessage)
        
        // Auto-retry with exponential backoff for rate limiting
        if (retryCount < 2) {
          const delay = retryCount === 0 ? 3000 : 10000 // 3s then 10s
          console.log(`Retrying in ${delay/1000} seconds...`)
          setTimeout(() => {
            setRetryCount(prev => prev + 1)
          }, delay)
          return
        }
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [retryCount])

  const handleRetry = () => {
    setRetryCount((prev: number) => prev + 1)
    setError(null)
  }

  // Stats calculated from real data
  const stats = [
    { label: 'Total Students', value: metrics.totalStudents.toString(), icon: '🎓', color: '#6366f1' },
    { label: 'Male Students', value: metrics.maleCount.toString(), icon: '👨', color: '#3b82f6' },
    { label: 'Female Students', value: metrics.femaleCount.toString(), icon: '👩', color: '#ec4899' },
    { label: 'Total Grades', value: metrics.gradeDistribution.length.toString(), icon: '📊', color: '#10b981' },
  ]

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <div style={{ fontSize: '24px', marginBottom: '20px' }}>⏳</div>
          <p>Loading dashboard data...</p>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
            Fetching student metrics from database...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.dashboard}>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <div style={{ fontSize: '24px', marginBottom: '20px', color: 'red' }}>❌</div>
          <p style={{ color: 'red', marginBottom: '20px' }}>Error loading dashboard: {error}</p>
          <button 
            onClick={handleRetry}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#6366f1', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '20px' }}>
            Check console for more details
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.dashHeader}>
        <h1 className={styles.dashTitle}>School Dashboard</h1>

        <div className={styles.profileWrapper}>
        <button className={styles.profileBtn} onClick={() => setProfileOpen(o => !o)}>
          <div className={styles.profileAvatar}>
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=SarahJohnson&backgroundColor=6366f1&clothingColor=6366f1"
              alt="Ms. Sarah Johnson"
              width="32"
              height="32"
              style={{ borderRadius: '50%', display: 'block' }}
            />
          </div>
          <div className={styles.profileInfo}>
            <span className={styles.profileName}>Ms. Sarah Johnson</span>
            <span className={styles.profileRole}>Class Teacher · Grade 4</span>
          </div>
          <span className={styles.profileChevron}>{profileOpen ? '▲' : '▼'}</span>
        </button>

        {profileOpen && (
          <div className={styles.profileDropdown}>
            <div className={styles.profileDropdownHeader}>
              <div className={styles.profileAvatarLg}>
                <img
                  src="https://api.dicebear.com/7.x/avataaars/svg?seed=SarahJohnson&backgroundColor=6366f1&clothingColor=6366f1"
                  alt="Ms. Sarah Johnson"
                  width="42"
                  height="42"
                  style={{ borderRadius: '50%', display: 'block' }}
                />
              </div>
              <div>
                <div className={styles.profileDropdownName}>Ms. Sarah Johnson</div>
                <div className={styles.profileDropdownRole}>Class Teacher</div>
                <div className={styles.profileDropdownEmail}>sarah.j@school.edu</div>
              </div>
            </div>
            <div className={styles.profileDropdownDivider} />
            <button className={styles.profileDropdownItem}>👤 My Profile</button>
            <button className={styles.profileDropdownItem}>📅 My Schedule</button>
            <button className={styles.profileDropdownItem}>🔔 Notifications</button>
            <button className={styles.profileDropdownItem}>⚙️ Settings</button>
            <div className={styles.profileDropdownDivider} />
            <button className={`${styles.profileDropdownItem} ${styles.profileDropdownLogout}`}>
              🚪 Sign Out
            </button>
          </div>
        )}
        </div>
      </div>

      <div className={styles.statsRow}>
        {stats.map(s => (
          <div key={s.label} className={styles.statCard} style={{ borderColor: s.color }}>
            <span className={styles.statIcon}>{s.icon}</span>
            <div>
              <div className={styles.statValue} style={{ color: s.color }}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Gender Distribution (%)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={metrics.genderData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value">
                {metrics.genderData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #3a3f55', borderRadius: 8 }} formatter={(v) => [`${v}%`]} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#e2e8f0' }} formatter={(v) => <span style={{ color: '#e2e8f0' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Students by Grade</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={metrics.gradeDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #3a3f55', borderRadius: 8 }} />
              <Bar dataKey="value" fill="#6366f1" radius={[3, 3, 0, 0]} name="Students" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.chartCard} style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 className={styles.chartTitle} style={{ margin: 0 }}>Attendance Overview</h3>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setAttendanceView('weekly')}
                style={{
                  padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                  background: attendanceView === 'weekly' ? '#6366f1' : '#2a2d3e',
                  color: attendanceView === 'weekly' ? '#fff' : '#94a3b8',
                  fontWeight: attendanceView === 'weekly' ? 600 : 400,
                }}
              >Weekly</button>
              <button
                onClick={() => setAttendanceView('monthly')}
                style={{
                  padding: '4px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
                  background: attendanceView === 'monthly' ? '#6366f1' : '#2a2d3e',
                  color: attendanceView === 'monthly' ? '#fff' : '#94a3b8',
                  fontWeight: attendanceView === 'monthly' ? 600 : 400,
                }}
              >Last Month</button>
            </div>
          </div>
          {(() => {
            const activeData = attendanceView === 'weekly' ? weeklyAttendance : monthlyAttendance
            return activeData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
                No attendance data available for {attendanceView === 'weekly' ? 'this week' : 'last month'}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                <ResponsiveContainer width="40%" height={180}>
                  <PieChart>
                    <Pie data={activeData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value">
                      {activeData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #3a3f55', borderRadius: 8 }} formatter={(v) => [v, 'Records']} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeData.map((item) => {
                    const total = activeData.reduce((s, r) => s + r.value, 0)
                    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
                    return (
                      <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: item.fill, flexShrink: 0 }} />
                        <span style={{ color: '#e2e8f0', fontSize: 13, minWidth: 70 }}>{item.name}</span>
                        <div style={{ flex: 1, background: '#2a2d3e', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: item.fill, borderRadius: 4, transition: 'width 0.6s ease' }} />
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: 12, minWidth: 50, textAlign: 'right' }}>
                          {item.value} ({pct}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
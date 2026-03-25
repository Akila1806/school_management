import { useState, useRef, useEffect } from 'react'
import { fetchDataFromApi } from '@/utils/api'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'
import Dashboard from '@/components/Dashboard'
import StudentsSection from '@/components/StudentsSection'
import UpdateStudentForm from '@/components/UpdateStudentForm'
import AttendanceSheet from '@/components/AttendanceSheet'
import ChatPanel, { ChatPanelHandle } from '@/components/ChatPanel'
import TabBar, { Tab } from '@/components/TabBar'
import SplitLayout from '@/components/SplitLayout'
import styles from '@/styles.module.css'

let studentTabCounter = 0

function rowToForm(row: Record<string, unknown>) {
  const dob = String(row.dob ?? '')
  const dobFormatted = dob ? dob.split('T')[0] : ''
  let age = ''
  if (dobFormatted) {
    const birth = new Date(dobFormatted)
    const today = new Date()
    let a = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--
    age = String(Math.max(0, a))
  }
  return {
    studentId: String(row.student_id ?? ''),
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    grade: String(row.grade_level ?? ''),
    dob: dobFormatted,
    age,
    gender: String(row.gender ?? ''),
    email: String(row.email ?? ''),
    fatherName: String(row.father_name ?? ''),
    fatherOccupation: String(row.father_occupation ?? ''),
    motherName: String(row.mother_name ?? ''),
    motherOccupation: String(row.mother_occupation ?? ''),
    address: String(row.address ?? ''),
    parentPhone: String(row.parent_phone ?? ''),
  }
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

function AppContent() {
  const { isAuthenticated } = useAuth()
  const [authView, setAuthView] = useState<'login' | 'signup'>('login')

  if (!isAuthenticated) {
    return authView === 'login'
      ? <Login onSwitchToSignup={() => setAuthView('signup')} />
      : <Signup onSwitchToLogin={() => setAuthView('login')} />
  }

  return <MainApp />
}

function MainApp() {
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()

  const DASHBOARD_TAB: Tab = { id: 'dashboard', title: 'Dashboard', icon: '📊', closable: true, modified: false }

  const [tabs, setTabs] = useState<Tab[]>(() => {
    try {
      const saved = sessionStorage.getItem('openTabs')
      const parsed: Tab[] = saved ? JSON.parse(saved) : []
      // always ensure dashboard tab exists
      if (!parsed.find(t => t.id === 'dashboard')) return [DASHBOARD_TAB, ...parsed]
      return parsed
    } catch { return [DASHBOARD_TAB] }
  })
  const [activeTab, setActiveTab] = useState<string>(() => {
    const saved = sessionStorage.getItem('activeTab')
    return saved || 'dashboard'
  })
  const [prefillMap, setPrefillMap] = useState<Record<string, ReturnType<typeof rowToForm>>>(() => {
    try {
      const saved = sessionStorage.getItem('prefillMap')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const chatRef = useRef<ChatPanelHandle>(null)

  // Persist tabs and activeTab to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('openTabs', JSON.stringify(tabs))
  }, [tabs])

  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab)
  }, [activeTab])

  useEffect(() => {
    sessionStorage.setItem('prefillMap', JSON.stringify(prefillMap))
  }, [prefillMap])

  // Always open dashboard on login
  useEffect(() => {
    setTabs(prev => prev.find(t => t.id === 'dashboard') ? prev : [{ id: 'dashboard', title: 'Dashboard', icon: '📊', closable: true, modified: false }, ...prev])
    setActiveTab('dashboard')
  }, [])

  const handleBadgeClick = (badge: string): boolean => {
    if (badge === 'Create Student') {
      const existing = tabs.find(tab => tab.title === 'Create Form')
      if (existing) {
        setActiveTab(existing.id)
        return true // already existed
      }
      const newTabId = `student-${++studentTabCounter}`
      setTabs(prev => [...prev, { id: newTabId, title: 'Create Form', icon: '👤', closable: true, modified: false }])
      setActiveTab(newTabId)
      return false // newly opened
    }
    return false
  }

  const handleStudentCreated = (form: Record<string, string>) => {
    chatRef.current?.addStudentCreatedMessage(form)
  }

  const handleUpdateStudent = async (row: Record<string, unknown>) => {
    let fullRow = row
    try {
      const studentId = row.student_id
      if (studentId) {
        const json = await fetchDataFromApi(`/api/students/${studentId}`)
        if ((json as any).student) fullRow = (json as any).student
      } else {
        const q = row.email
          ? `get student with email ${row.email}`
          : `get student named ${row.first_name} ${row.last_name ?? ''}`
        const json = await fetchDataFromApi(`/api/students?q=${encodeURIComponent(q as string)}`)
        if ((json as any).students?.length > 0) fullRow = (json as any).students[0]
      }
    } catch {
    }

    const tabId = `student-${++studentTabCounter}`
    const name = `${fullRow.first_name ?? ''} ${fullRow.last_name ?? ''}`.trim()
    const newTab: Tab = {
      id: tabId,
      title: name || 'Update Student',
      icon: '✏️',
      closable: true,
      modified: false,
    }
    setPrefillMap(prev => ({ ...prev, [tabId]: rowToForm(fullRow) }))
    setTabs(prev => [...prev, newTab])
    setActiveTab(tabId)
  }

  const handleStudentUpdated = (form: Record<string, string>) => {
    chatRef.current?.addStudentUpdatedMessage(form)
  }

  const handleShowAttendance = () => {
    const existing = tabs.find(tab => tab.id === 'attendance')
    if (existing) { setActiveTab('attendance'); return }
    setTabs(prev => [...prev, { id: 'attendance', title: 'Attendance', icon: '📋', closable: true, modified: false }])
    setActiveTab('attendance')
  }

  const handleShowDashboard = () => {
    // Check if dashboard tab already exists
    const existingDashboard = tabs.find(tab => tab.id === 'dashboard')

    if (existingDashboard) {
      // If dashboard exists, just switch to it
      setActiveTab('dashboard')
    } else {
      // Create new dashboard tab
      const dashboardTab: Tab = {
        id: 'dashboard',
        title: 'Dashboard',
        icon: '📊',
        closable: true,
        modified: false
      }
      setTabs(prev => [...prev, dashboardTab])
      setActiveTab('dashboard')
    }
  }

  const handleTabSelect = (tabId: string) => {
    setActiveTab(tabId)
  }

  const handleTabClose = (tabId: string) => {
    setTabs(prev => prev.filter(tab => tab.id !== tabId))
    if (tabId.startsWith('student-')) {
      setPrefillMap(prev => { const next = { ...prev }; delete next[tabId]; return next })
    }
    if (activeTab === tabId) {
      const remainingTabs = tabs.filter(tab => tab.id !== tabId)
      setActiveTab(remainingTabs.length > 0 ? remainingTabs[0].id : '')
    }
  }

  const renderMainContent = () => {
    if (activeTab === 'dashboard') {
      return <Dashboard onNavigateToAttendance={handleShowAttendance} user={user} onLogout={logout} />
    } else if (activeTab === 'attendance') {
      return <AttendanceSheet />
    } else if (activeTab.startsWith('student-')) {
      const prefill = prefillMap[activeTab]
      if (prefill?.studentId) {
        return <UpdateStudentForm prefill={prefill} onStudentUpdated={handleStudentUpdated} />
      }
      return <StudentsSection onStudentCreated={handleStudentCreated} />
    } else if (activeTab === '' || tabs.length === 0) {
      // Show greeting screen when no tabs are open
      return (
        <div className={styles.greetingScreen}>
          <div className={styles.greetingContent}>
            <div className={styles.greetingIcon}>🎓</div>
            <h1 className={styles.greetingTitle}>Welcome to School Management System</h1>
            <p className={styles.greetingSubtitle}>
              Your comprehensive solution for managing student information and school operations
            </p>

            <div className={styles.greetingHint}>
              <p>You can also use the AI assistant in the chat panel to get started →</p>
            </div>
          </div>
        </div>
      )
    }
    // Fallback to greeting screen
    return (
      <div className={styles.greetingScreen}>
        <div className={styles.greetingContent}>
          <div className={styles.greetingIcon}>🎓</div>
          <h1 className={styles.greetingTitle}>Welcome Back!</h1>
          <p className={styles.greetingSubtitle}>Select an option to continue</p>
          <div className={styles.greetingActions}>
            <button className={styles.greetingButton} onClick={handleShowDashboard}>
              📊 Open Dashboard
            </button>
            <button className={styles.greetingButton} onClick={() => handleBadgeClick('Create Student')}>
              👤 Create Student
            </button>
            <button className={styles.greetingButton} onClick={handleShowAttendance}>
              📋 Attendance
            </button>
          </div>
        </div>
      </div>
    )
  }

  const leftPanel = (
    <div className={styles.mainPanel}>
      {tabs.length > 0 && (
        <TabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabSelect={handleTabSelect}
          onTabClose={handleTabClose}
          onNewTab={(type) => {
            if (type === 'dashboard') handleShowDashboard()
            else if (type === 'attendance') handleShowAttendance()
            else handleBadgeClick('Create Student')
          }}
        />
      )}
      <div className={styles.tabContent}>
        {renderMainContent()}
      </div>
    </div>
  )

  const rightPanel = (
    <ChatPanel ref={chatRef} onBadgeClick={handleBadgeClick} onShowDashboard={handleShowDashboard} onShowAttendance={handleShowAttendance} onUpdateStudent={handleUpdateStudent} />
  )

  return (
    <div className={styles.layout}>
      <button
        className={styles.globalThemeToggle}
        onClick={toggleTheme}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
      <SplitLayout
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        initialSplit={70}
        minLeftWidth={400}
        minRightWidth={300}
      />
    </div>
  )
}

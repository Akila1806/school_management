import { useState, useRef, useEffect } from 'react'
import { fetchDataFromApi } from '@/utils/api'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { useTheme } from '@/contexts/ThemeContext'
import Dashboard from '@/components/Dashboard'
import StudentsSection from '@/components/StudentsSection'
import UpdateStudentForm from '@/components/UpdateStudentForm'
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
  const { theme, toggleTheme } = useTheme()
  const [tabs, setTabs] = useState<Tab[]>(() => {
    try {
      const saved = sessionStorage.getItem('openTabs')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [activeTab, setActiveTab] = useState<string>(() => {
    return sessionStorage.getItem('activeTab') || ''
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

  // Auto-open dashboard on first load only (not on every refresh)
  useEffect(() => {
    const hasAutoOpened = sessionStorage.getItem('dashboardAutoOpened')
    const hasSavedTabs = sessionStorage.getItem('openTabs')
    const savedTabs = hasSavedTabs ? JSON.parse(hasSavedTabs) : []

    if (!hasAutoOpened && savedTabs.length === 0) {
      const timer = setTimeout(() => {
        handleShowDashboard()
        sessionStorage.setItem('dashboardAutoOpened', 'true')
      }, 500)

      return () => clearTimeout(timer)
    }
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
      return <Dashboard />
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
            <button
              className={styles.greetingButton}
              onClick={handleShowDashboard}
            >
              📊 Open Dashboard
            </button>
            <button
              className={styles.greetingButton}
              onClick={() => handleBadgeClick('Create Student')}
            >
              👤 Create Student
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
        />
      )}
      <div className={styles.tabContent}>
        {renderMainContent()}
      </div>
    </div>
  )

  const rightPanel = (
    <ChatPanel ref={chatRef} onBadgeClick={handleBadgeClick} onShowDashboard={handleShowDashboard} onUpdateStudent={handleUpdateStudent} />
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

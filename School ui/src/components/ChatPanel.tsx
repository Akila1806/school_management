import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import styles from '../styles.module.css'
import { postData, postBlob } from '../utils/api'
import { Messages } from '../utils/messages'

type Message = {
  id: number
  role: 'user' | 'assistant'
  text: string
  data?: Record<string, unknown>[]
  sql?: string
  loading?: boolean
  error?: boolean
}

interface Props {
  onBadgeClick: (badge: string) => boolean
  onShowDashboard: () => void
  onUpdateStudent: (row: Record<string, unknown>) => void
}

export interface ChatPanelHandle {
  addStudentCreatedMessage: (form: Record<string, string>) => void
  addStudentUpdatedMessage: (form: Record<string, string>) => void
}

let msgId = 0

const SLASH_COMMANDS = [
  { label: '👤 Create Student', key: 'create student', display: 'Create Student' },
  { label: '📊 Show Dashboard', key: 'show dashboard', display: 'Show Dashboard' },
]

// ── SVG Icons ──────────────────────────────────────────────
const IconCopy = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const IconExport = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

// ── Gender badge color ──────────────────────────────────────
function genderColor(g: string) {
  const l = g.toLowerCase()
  if (l === 'male') return styles.genderMale
  if (l === 'female') return styles.genderFemale
  return styles.genderOther
}

// ── Structured text renderer ────────────────────────────────
function renderText(raw: string) {
  const text = raw.replace(/\\n/g, '\n')
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && l !== '---')

  const isUpdate = lines.some(line => line.includes('✅') || line.toLowerCase().includes('updated'))
  if (isUpdate) {
    return (
      <div className={styles.chatUpdateConfirmation}>
        <div className={styles.chatUpdateIcon}></div>
        <div className={styles.chatUpdateText}>
          {lines.map((line, i) => (
            <div key={i} className={styles.chatUpdateLine}>{line}</div>
          ))}
        </div>
      </div>
    )
  }

  const headerLine = lines[0] ?? ''
  const countMatch = headerLine.match(/found\s+(\d+)\s+student/i)
  if (countMatch) {
    const rows = lines.slice(1).filter(l => /^\d+\./.test(l))
    return (
      <div className={styles.chatStudentList}>
        <div className={styles.chatListHeader}>
          <span className={styles.chatListHeaderIcon}>👥</span>
          <span>{headerLine}</span>
        </div>
        {rows.map((row, i) => {
          const m = row.match(/^(\d+)\.\s+(.+)$/)
          if (!m) return null
          const parts = m[2].split('|').map(p => p.trim())
          const name = parts[0] ?? ''
          const gender = parts[1] ?? ''
          const dob = parts[2]?.replace('DOB:', '').trim() ?? ''
          const email = parts[3] ?? ''
          return (
            <div key={i} className={styles.chatStudentRow}>
              <span className={styles.chatStudentRowNum}>{m[1]}</span>
              <div className={styles.chatStudentRowInfo}>
                <span className={styles.chatStudentRowName}>{name}</span>
                <span className={styles.chatStudentRowEmail}>{email}</span>
              </div>
              <div className={styles.chatStudentRowMeta}>
                {gender && <span className={`${styles.chatGenderBadge} ${genderColor(gender)}`}>{gender}</span>}
                {dob && <span className={styles.chatDobBadge}>🎂 {dob}</span>}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  type Section = { title: string; fields: { key: string; val: string }[] }
  const sections: Section[] = []
  let current: Section | null = null

  for (const line of lines) {
    if (/^[A-Za-z ]+:$/.test(line)) {
      current = { title: line.slice(0, -1), fields: [] }
      sections.push(current)
      continue
    }
    const kv = line.match(/^([^:]+):\s+(.+)$/)
    if (kv) {
      if (!current) { current = { title: '', fields: [] }; sections.push(current) }
      current.fields.push({ key: kv[1].trim(), val: kv[2].trim() })
      continue
    }
    sections.push({ title: '', fields: [{ key: '', val: line }] })
  }

  if (sections.length === 0) {
    return <div className={styles.chatPlainLine}>{raw}</div>
  }

  return (
    <div className={styles.chatCard}>
      {sections.map((sec, si) => (
        <div key={si} className={styles.chatCardSection}>
          {sec.title && <div className={styles.chatCardSectionTitle}>{sec.title}</div>}
          {sec.fields.map((f, fi) =>
            f.key ? (
              <div key={fi} className={styles.chatCardRow}>
                <span className={styles.chatCardKey}>{f.key}</span>
                <span className={styles.chatCardVal}>{f.val}</span>
              </div>
            ) : (
              <div key={fi} className={styles.chatPlainLine}>{f.val}</div>
            )
          )}
        </div>
      ))}
    </div>
  )
}

// ── Table renderer for multi-row results ───────────────────
function renderTable(data: Record<string, unknown>[]) {
  if (!data.length) return null
  const headers = Object.keys(data[0]).filter(h => h !== 'student_id')
  const formatVal = (v: unknown) => {
    if (v === null || v === undefined || v === '') return '—'
    const s = String(v)
    // Format ISO date
    if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(s)) {
      const d = new Date(s)
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
    }
    return s
  }
  const formatHeader = (h: string) =>
    h.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className={styles.chatTableWrap}>
      <div className={styles.chatTableCount}>{data.length} students found</div>
      <div className={styles.chatTableScroll}>
        <table className={styles.chatTable}>
          <thead>
            <tr>
              <th className={styles.chatTableTh}>#</th>
              {headers.map(h => (
                <th key={h} className={styles.chatTableTh}>{formatHeader(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? styles.chatTableRowEven : styles.chatTableRowOdd}>
                <td className={styles.chatTableTd}>{i + 1}</td>
                {headers.map(h => (
                  <td key={h} className={styles.chatTableTd}>{formatVal(row[h])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}


function buildFields(form: Record<string, string>) {
  return [
    form.firstName && form.lastName ? `Name: ${form.firstName} ${form.lastName}` : null,
    form.grade ? `Grade: ${form.grade}` : null,
    form.dob ? `Date of Birth: ${form.dob}` : null,
    form.gender ? `Gender: ${form.gender}` : null,
    form.email ? `Email: ${form.email}` : null,
    form.fatherName ? `Father's Name: ${form.fatherName}` : null,
    form.fatherOccupation ? `Father's Occupation: ${form.fatherOccupation}` : null,
    form.motherName ? `Mother's Name: ${form.motherName}` : null,
    form.motherOccupation ? `Mother's Occupation: ${form.motherOccupation}` : null,
    form.address ? `Address: ${form.address}` : null,
    form.parentPhone ? `Parent Phone: ${form.parentPhone}` : null,
  ].filter(Boolean).join('\n')
}

const ChatPanel = forwardRef<ChatPanelHandle, Props>(function ChatPanel(
  { onBadgeClick, onShowDashboard, onUpdateStudent },
  ref
) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: ++msgId,
      role: 'assistant',
      text: "Hi! I'm your School Assistant. I can help you view, search, and update student information.",
    },
  ])
  const [input, setInput] = useState('')
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [exporting, setExporting] = useState<number | null>(null)
  const [copied, setCopied] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useImperativeHandle(ref, () => ({
    addStudentCreatedMessage(form: Record<string, string>) {
      const fields = buildFields(form)
      const text = `✅ Student Created Successfully!\n\n${fields}`
      setMessages(prev => [...prev, { id: ++msgId, role: 'assistant', text }])
    },
    addStudentUpdatedMessage(form: Record<string, string>) {
      const fields = buildFields(form)
      const text = `✅ Student Updated Successfully!\n\n${fields}`
      setMessages(prev => [...prev, { id: ++msgId, role: 'assistant', text }])
    },
  }))

  const execLocalCommand = (key: string, display: string): boolean => {
    if (key === 'create student') {
      const alreadyOpen = onBadgeClick('Create Student')
      setMessages(prev => [
        ...prev,
        { id: ++msgId, role: 'user', text: display },
        { id: ++msgId, role: 'assistant', text: alreadyOpen ? 'Switched to the open student form.' : 'Opening the student creation form.' },
      ])
      return true
    }
    if (key === 'show dashboard') {
      onShowDashboard()
      setMessages(prev => [
        ...prev,
        { id: ++msgId, role: 'user', text: display },
        { id: ++msgId, role: 'assistant', text: 'Switched to the dashboard view.' },
      ])
      return true
    }
    return false
  }

  const sendToAgent = async (text: string) => {
    const loadingId = ++msgId
    setMessages(prev => [
      ...prev,
      { id: ++msgId, role: 'user', text },
      { id: loadingId, role: 'assistant', text: Messages.Chat.Thinking, loading: true },
    ])
    try {
      const json = await postData('/api/agent', { message: text })
      if ((json as any).detail) throw new Error((json as any).detail)
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingId
            ? { ...m, text: (json as any).analysis, data: (json as any).data, sql: (json as any).sql, loading: false }
            : m
        )
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : Messages.Chat.ConnectionError
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingId
            ? { ...m, text: `Error: ${msg}`, loading: false, error: true }
            : m
        )
      )
    }
  }

  const CREATE_STUDENT_PATTERNS = [
    // create / crate / craete / creat
    /cr[ea]{1,3}te?\s+a?\s*stu[a-z]*/i,
    // add student
    /add\s+a?\s*stu[a-z]*/i,
    // new student
    /new\s+stu[a-z]*/i,
    // open / opn / ope + form / student form
    /op[a-z]*\s+.*?(stu[a-z]*\s+)?form/i,
    // fill form / fill student form
    /fil+\s+.*?form/i,
    // student form (any order)
    /stu[a-z]*\s+form/i,
    // register student
    /reg[a-z]*\s+.*?stu[a-z]*/i,
    // enroll student
    /enro[a-z]*\s+.*?stu[a-z]*/i,
    // student registration
    /stu[a-z]*\s+reg[a-z]*/i,
    // insert student
    /insert\s+.*?stu[a-z]*/i,
  ]

  const send = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    setInput('')
    setShowSlashMenu(false)

    if (execLocalCommand(trimmed.toLowerCase(), trimmed)) return

    // Detect create-student intent
    if (CREATE_STUDENT_PATTERNS.some(p => p.test(trimmed))) {
      const alreadyOpen = onBadgeClick('Create Student')
      setMessages(prev => [
        ...prev,
        { id: ++msgId, role: 'user', text: trimmed },
        { id: ++msgId, role: 'assistant', text: alreadyOpen ? 'Switched to the open student form.' : 'Opening the student creation form.' },
      ])
      return
    }

    // Detect attendance intent
    if (/attend[a-z]*/i.test(trimmed)) {
      onShowDashboard()
      setMessages(prev => [
        ...prev,
        { id: ++msgId, role: 'user', text: trimmed },
        { id: ++msgId, role: 'assistant', text: 'Opened the dashboard — scroll down to see the Attendance Overview chart.' },
      ])
      return
    }

    sendToAgent(trimmed)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)
    // show slash menu when input starts with "\"
    setShowSlashMenu(val.startsWith('\\'))
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSlashMenu && e.key === 'Escape') {
      setShowSlashMenu(false)
      setInput('')
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const handleSlashPick = (key: string, display: string) => {
    setShowSlashMenu(false)
    setInput('')
    execLocalCommand(key, display)
    inputRef.current?.focus()
  }

  const handleCopy = (msg: Message) => {
    navigator.clipboard.writeText(msg.text)
    setCopied(msg.id)
    setTimeout(() => setCopied(null), 1500)
  }

  const handleExport = async (msg: Message) => {
    if (!msg.data?.length) return
    setExporting(msg.id)
    try {
      const prompt = msg.sql ? `Export this query: ${msg.sql}` : 'export'
      const exportBlob = await postBlob('/api/export', { message: prompt })
      if (exportBlob) {
        const url = URL.createObjectURL(exportBlob)
        const a = document.createElement('a')
        a.href = url; a.download = 'results.xlsx'; a.click()
        URL.revokeObjectURL(url)
      } else {
        const headers = Object.keys(msg.data[0])
        const rows = msg.data.map(r =>
          headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
        )
        const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'results.csv'; a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelIcon}>🤖</span>
        <span className={styles.panelTitle}>School Assistant</span>
      </div>

      <div className={styles.messages}>
        {messages.map(msg => (
          <div key={msg.id} className={`${styles.message} ${msg.role === 'user' ? styles.user : ''}`}>
            <div className={styles.chatAvatar}>{msg.role === 'assistant' ? '🤖' : '👤'}</div>
            <div className={styles.bubble}>
              {msg.loading || msg.error ? (
                <p className={`${msg.loading ? styles.loadingText : ''} ${msg.error ? styles.errorText : ''}`}>
                  {msg.text}
                </p>
              ) : msg.role === 'user' ? (
                <p>{msg.text}</p>
              ) : (
                <div className={styles.bubbleText}>
                  {msg.data && msg.data.length > 1
                    ? <>
                        <div className={styles.chatTableMessage}>{msg.text}</div>
                        {renderTable(msg.data)}
                      </>
                    : renderText(msg.text)}
                </div>
              )}

              {msg.role === 'assistant' && !msg.loading && !msg.error && (
                <div className={styles.msgActions}>
                  <button
                    className={`${styles.msgActionBtn} ${copied === msg.id ? styles.msgActionActive : ''}`}
                    onClick={() => handleCopy(msg)}
                    title="Copy"
                  >
                    <IconCopy />
                  </button>
                  <button
                    className={`${styles.msgActionBtn} ${msg.data && msg.data.length > 1 ? styles.msgActionExport : styles.msgActionDisabled}`}
                    onClick={() => handleExport(msg)}
                    disabled={!msg.data || msg.data.length <= 1 || exporting === msg.id}
                    title="Export to Excel"
                  >
                    {exporting === msg.id
                      ? <span style={{ fontSize: '0.7rem' }}>⏳</span>
                      : <IconExport />}
                  </button>
                  {msg.data && msg.data.length === 1 && (
                    <button
                      className={styles.updateStudentBtn}
                      onClick={() => onUpdateStudent(msg.data![0])}
                      title="Update this student"
                    >
                      ✏️ Update Student
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Slash command popup — shown above input when user types \ */}
      {showSlashMenu && (
        <div className={styles.slashMenu}>
          {SLASH_COMMANDS.filter(({ display }) =>
            display.toLowerCase().includes(input.slice(1).toLowerCase())
          ).map(({ label, key, display }) => (
            <button
              key={key}
              className={styles.slashMenuItem}
              onMouseDown={e => { e.preventDefault(); handleSlashPick(key, display) }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={styles.chatInput}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKey}
          placeholder="Ask anything... (type \ for commands)"
          rows={1}
        />
        <button className={styles.sendBtn} onClick={send} disabled={!input.trim()} aria-label="Send message">
          ➤
        </button>
      </div>
    </div>
  )
})

export default ChatPanel

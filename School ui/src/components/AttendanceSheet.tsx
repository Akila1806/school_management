import { useState, useEffect } from 'react'
import styles from './AttendanceSheet.module.css'
import { fetchDataFromApi, postData } from '../utils/api'

type Status = 'Present' | 'Absent' | 'Late'

interface Student {
  student_id: number
  first_name: string
  last_name: string
  grade_level: string
}

interface Subject {
  subject_id: number
  subject_name: string
}

interface AttendanceRow {
  student_id: number
  status: Status
  remarks: string
}

const STATUS_CONFIG: { key: Status; label: string; short: string }[] = [
  { key: 'Present', label: 'Present', short: 'P' },
  { key: 'Absent', label: 'Absent', short: 'A' },
  { key: 'Late', label: 'Late', short: 'L' },
]

const PAGE_SIZE = 10

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function AttendanceSheet() {
  const [date, setDate] = useState(todayStr())
  const [gradeFilter, setGradeFilter] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [grades, setGrades] = useState<string[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [rows, setRows] = useState<Record<number, AttendanceRow>>({})
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [page, setPage] = useState(1)
  const [isDirty, setIsDirty] = useState(false)
  const [pendingGrade, setPendingGrade] = useState<string | null>(null)


  // Load subjects on mount
  useEffect(() => {
    fetchDataFromApi<{ subjects: Subject[] }>('/api/subjects')
      .then(res => setSubjects(res.subjects ?? []))
      .catch(err => console.error('subjects fetch failed:', err))
  }, [])

  // When subject changes, fetch grades assigned to that subject
  useEffect(() => {
    setGradeFilter('')
    setStudents([])
    setRows({})
    if (!subjectId) {
      setGrades([])
      return
    }
    fetchDataFromApi<{ grades: string[] }>(`/api/attendance/grades?subject_id=${subjectId}`)
      .then(res => setGrades(res.grades ?? []))
      .catch(err => console.error('grades fetch failed:', err))
  }, [subjectId])

  // Load students when grade changes
  useEffect(() => {
    if (!gradeFilter) { setStudents([]); setRows({}); return }
    setLoadingStudents(true)
    fetchDataFromApi<{ students: Student[] }>(
      `/api/attendance/students?grade=${encodeURIComponent(gradeFilter)}`
    )
      .then(res => {
        const list = res.students ?? []
        setStudents(list)
        // default all to Present
        const init: Record<number, AttendanceRow> = {}
        list.forEach(s => {
          init[s.student_id] = { student_id: s.student_id, status: 'Present', remarks: '' }
        })
        setRows(init)
        setPage(1)
        setIsDirty(false)
      })
      .finally(() => setLoadingStudents(false))
  }, [gradeFilter])

  const setStatus = (studentId: number, status: Status) => {
    setRows(prev => ({ ...prev, [studentId]: { ...prev[studentId], status } }))
    setIsDirty(true)
  }

  const setRemarks = (studentId: number, remarks: string) => {
    setRows(prev => ({ ...prev, [studentId]: { ...prev[studentId], remarks } }))
    setIsDirty(true)
  }

  const markAllPresent = () => {
    setRows(prev => {
      const next = { ...prev }
      students.forEach(s => { next[s.student_id] = { ...next[s.student_id], status: 'Present' } })
      return next
    })
    setIsDirty(true)
  }

  const handleGradeChange = (newGrade: string) => {
    if (isDirty && students.length > 0) {
      setPendingGrade(newGrade)
    } else {
      setGradeFilter(newGrade)
    }
  }

  const handleSave = async () => {
    if (!date || !subjectId || students.length === 0) return
    setSaving(true)
    setSuccessMsg('')
    try {
      const payload = students.map(s => ({
        student_id: s.student_id,
        subject_id: Number(subjectId),
        attendance_date: date,
        status: rows[s.student_id]?.status ?? 'Present',
        remarks: rows[s.student_id]?.remarks ?? '',
      }))
      await postData('/api/attendance', { records: payload })
      setSuccessMsg('Attendance saved!')
      setIsDirty(false)
      setTimeout(() => setSuccessMsg(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  // Summary counts
  const counts = { Present: 0, Absent: 0, Late: 0 }
  Object.values(rows).forEach(r => { counts[r.status]++ })

  const totalPages = Math.ceil(students.length / PAGE_SIZE)
  const pagedStudents = students.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const canSave = date && subjectId && students.length > 0

  return (
    <div className={styles.attendanceSheet}>

      {/* Unsaved changes warning */}
      {isDirty && (
        <div className={styles.unsavedBanner}>
          ⚠ You have unsaved attendance changes — save before switching grade.
        </div>
      )}

      {/* Grade switch confirmation dialog */}
      {pendingGrade && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            <p className={styles.confirmMsg}>
              You have unsaved attendance for <strong>{gradeFilter}</strong>.<br />
              Switch to <strong>{pendingGrade}</strong> and discard changes?
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmDiscard} onClick={() => {
                setGradeFilter(pendingGrade)
                setPendingGrade(null)
                setIsDirty(false)
              }}>Discard & Switch</button>
              <button className={styles.confirmCancel} onClick={() => setPendingGrade(null)}>
                Stay & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>📋</div>
          <div>
            <h2 className={styles.headerTitle}>Attendance Sheet</h2>
            <p className={styles.headerSubtitle}>Mark daily attendance by subject and grade</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersBar}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>📅 Date</span>
          <input
            type="date"
            className={styles.filterInput}
            value={date}
            max={todayStr()}
            onChange={e => setDate(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>📚 Subject</span>
          <select
            className={styles.filterSelect}
            value={subjectId}
            onChange={e => setSubjectId(e.target.value)}
          >
            <option value="">Select subject</option>
            {subjects.map(s => (
              <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>🎓 Grade</span>
          <select
            className={styles.filterSelect}
            value={gradeFilter}
            onChange={e => handleGradeChange(e.target.value)}
            disabled={!subjectId}
          >
            <option value="">{subjectId ? 'Select grade' : 'Select subject first'}</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}          </select>
        </div>

        {students.length > 0 && (
          <button className={styles.markAllBtn} onClick={markAllPresent}>
            ✅ Mark All Present
          </button>
        )}
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Student Name</th>
              <th className={styles.centerCol}>P</th>
              <th className={styles.centerCol}>A</th>
              <th className={styles.centerCol}>L</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {loadingStudents ? (
              <tr className={styles.loadingRow}>
                <td colSpan={6}>Loading students...</td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📋</div>
                    <p className={styles.emptyText}>No students loaded</p>
                    <p className={styles.emptyHint}>Select a grade to load students</p>
                  </div>
                </td>
              </tr>
            ) : (
              pagedStudents.map((student, idx) => {
                const row = rows[student.student_id]
                const currentStatus = row?.status ?? 'Present'
                const serialNo = (page - 1) * PAGE_SIZE + idx + 1
                return (
                  <tr key={student.student_id}>
                    <td className={styles.serialNo}>{serialNo}</td>
                    <td>
                      <div className={styles.studentName}>
                        {student.first_name} {student.last_name}
                      </div>
                      <div className={styles.studentGrade}>{student.grade_level}</div>
                    </td>
                    {STATUS_CONFIG.map(({ key, short }) => (
                      <td key={key} className={styles.centerCol}>
                        <div className={styles.statusBtns}>
                          <button
                            className={`${styles.statusBtn} ${currentStatus === key ? styles[key.toLowerCase() as keyof typeof styles] : ''}`}
                            onClick={() => setStatus(student.student_id, key)}
                            title={key}
                          >
                            {short}
                          </button>
                        </div>
                      </td>
                    ))}
                    <td>
                      <input
                        type="text"
                        className={styles.remarksInput}
                        placeholder="Optional..."
                        value={row?.remarks ?? ''}
                        onChange={e => setRemarks(student.student_id, e.target.value)}
                      />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.summary}>
          {STATUS_CONFIG.map(({ key }) => (
            <div key={key} className={styles.summaryItem}>
              <span className={`${styles.summaryDot} ${styles[key.toLowerCase() as keyof typeof styles]}`} />
              <span className={styles.summaryCount}>{counts[key]}</span>
              <span className={styles.summaryLabel}>{key}</span>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              className={styles.pageBtn}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >‹</button>
            <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
            <button
              className={styles.pageBtn}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >›</button>
          </div>
        )}

        <div className={styles.footerActions}>
          {successMsg && (
            <span className={styles.successMsg}>✅ {successMsg}</span>
          )}
          {!canSave && !saving && (
            <span className={styles.saveHint}>
              {!subjectId && !gradeFilter
                ? '⚠ Select a subject and grade to enable saving'
                : !subjectId
                  ? '⚠ Select a subject to enable saving'
                  : students.length === 0
                    ? '⚠ Select a grade to load students'
                    : ''}
            </span>
          )}
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? '⏳ Saving...' : '💾 Save Attendance'}
          </button>
        </div>
      </div>

    </div>
  )
}

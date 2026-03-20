import { useState, useEffect } from 'react'
import styles from '../styles.module.css'

const API = 'http://localhost:8000'

type FormData = {
  studentId: string
  firstName: string
  lastName: string
  grade: string
  dob: string
  age: string
  gender: string
  email: string
  fatherName: string
  fatherOccupation: string
  motherName: string
  motherOccupation: string
  address: string
  parentPhone: string
}

interface Props {
  prefill: FormData
  onStudentUpdated?: (form: Record<string, string>) => void
}

export default function UpdateStudentForm({ prefill, onStudentUpdated }: Props) {
  const [form, setForm] = useState<FormData>(prefill)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    setForm(prefill)
  }, [prefill])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(prev => {
      const updated = { ...prev, [name]: value }
      if (name === 'dob' && value) {
        const birth = new Date(value)
        const today = new Date()
        let age = today.getFullYear() - birth.getFullYear()
        const m = today.getMonth() - birth.getMonth()
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
        updated.age = String(Math.max(0, age))
      }
      return updated
    })
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.firstName.trim()) e.firstName = 'First name is required'
    if (!form.lastName.trim()) e.lastName = 'Last name is required'
    if (!form.grade) e.grade = 'Grade is required'
    if (!form.dob) e.dob = 'Date of birth is required'
    if (!form.gender) e.gender = 'Gender is required'
    if (!form.fatherName.trim()) e.fatherName = "Father's name is required"
    if (!form.fatherOccupation.trim()) e.fatherOccupation = "Father's occupation is required"
    if (!form.motherName.trim()) e.motherName = "Mother's name is required"
    if (!form.address.trim()) e.address = 'Address is required'
    if (!form.parentPhone.trim()) e.parentPhone = 'Parent phone number is required'
    else if (!/^[\+]?[1-9][\d]{0,15}$/.test(form.parentPhone.replace(/[\s\-\(\)]/g, '')))
      e.parentPhone = 'Please enter a valid phone number'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`${API}/api/students/${form.studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Update failed')
      setSuccessMsg(`✅ ${form.firstName} ${form.lastName} updated successfully!`)
      onStudentUpdated?.(form as Record<string, string>)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating student'
      setErrors(prev => ({ ...prev, _api: msg }))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.studentsSection}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerIcon}>✏️</div>
          <div className={styles.headerText}>
            <h1 className={styles.title}>Update Student</h1>
            <p className={styles.subtitle}>Editing: {form.firstName} {form.lastName}</p>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.formSection}>
          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Student Information</h3>
              <div className={`${styles.formRow} ${styles.twoColumns}`}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>First Name <span className={styles.requiredIndicator}>*</span></label>
                  <input className={styles.fieldInput} name="firstName" value={form.firstName} onChange={handleChange} placeholder="Enter first name" />
                  {errors.firstName && <div className={styles.fieldError}>{errors.firstName}</div>}
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Last Name <span className={styles.requiredIndicator}>*</span></label>
                  <input className={styles.fieldInput} name="lastName" value={form.lastName} onChange={handleChange} placeholder="Enter last name" />
                  {errors.lastName && <div className={styles.fieldError}>{errors.lastName}</div>}
                </div>
              </div>
              <div className={`${styles.formRow} ${styles.threeColumns}`}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Grade <span className={styles.requiredIndicator}>*</span></label>
                  <select className={styles.fieldSelect} name="grade" value={form.grade} onChange={handleChange}>
                    <option value="">Select grade</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={`Grade ${i + 1}`}>Grade {i + 1}</option>
                    ))}
                  </select>
                  {errors.grade && <div className={styles.fieldError}>{errors.grade}</div>}
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Date of Birth <span className={styles.requiredIndicator}>*</span></label>
                  <input className={styles.fieldInput} type="date" name="dob" value={form.dob} onChange={handleChange} />
                  {errors.dob && <div className={styles.fieldError}>{errors.dob}</div>}
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Age</label>
                  <input className={styles.fieldInput} name="age" value={form.age} placeholder="Auto-calculated" readOnly />
                  <div className={styles.fieldHint}>Calculated from date of birth</div>
                </div>
              </div>
              <div className={`${styles.formRow} ${styles.twoColumns}`}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Gender <span className={styles.requiredIndicator}>*</span></label>
                  <select className={styles.fieldSelect} name="gender" value={form.gender} onChange={handleChange}>
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.gender && <div className={styles.fieldError}>{errors.gender}</div>}
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Email</label>
                  <input className={styles.fieldInput} name="email" value={form.email} onChange={handleChange} placeholder="student@school.edu" type="email" />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Parent Information</h3>
              <div className={`${styles.formRow} ${styles.twoColumns}`}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Father's Name <span className={styles.requiredIndicator}>*</span></label>
                  <input className={styles.fieldInput} name="fatherName" value={form.fatherName} onChange={handleChange} placeholder="Enter father's full name" />
                  {errors.fatherName && <div className={styles.fieldError}>{errors.fatherName}</div>}
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Father's Occupation <span className={styles.requiredIndicator}>*</span></label>
                  <input className={styles.fieldInput} name="fatherOccupation" value={form.fatherOccupation} onChange={handleChange} placeholder="e.g. Engineer" />
                  {errors.fatherOccupation && <div className={styles.fieldError}>{errors.fatherOccupation}</div>}
                </div>
              </div>
              <div className={`${styles.formRow} ${styles.twoColumns}`}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Mother's Name <span className={styles.requiredIndicator}>*</span></label>
                  <input className={styles.fieldInput} name="motherName" value={form.motherName} onChange={handleChange} placeholder="Enter mother's full name" />
                  {errors.motherName && <div className={styles.fieldError}>{errors.motherName}</div>}
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Mother's Occupation</label>
                  <input className={styles.fieldInput} name="motherOccupation" value={form.motherOccupation} onChange={handleChange} placeholder="e.g. Doctor" />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Contact Information</h3>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Address <span className={styles.requiredIndicator}>*</span></label>
                <textarea className={styles.fieldTextarea} name="address" value={form.address} onChange={handleChange} placeholder="Enter full residential address" rows={2} />
                {errors.address && <div className={styles.fieldError}>{errors.address}</div>}
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Parent Phone Number <span className={styles.requiredIndicator}>*</span></label>
                <input className={styles.fieldInput} name="parentPhone" value={form.parentPhone} onChange={handleChange} placeholder="+1 (555) 000-0000" type="tel" />
                {errors.parentPhone && <div className={styles.fieldError}>{errors.parentPhone}</div>}
              </div>
            </div>

            <div className={styles.formActions}>
              <button type="button" className={styles.resetButton} onClick={() => setForm(prefill)} disabled={isSubmitting}>
                Reset
              </button>
              <button type="submit" className={styles.saveButton} disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : '✏️ Update Student'}
              </button>
            </div>

            {successMsg && <div className={styles.successMessage}>{successMsg}</div>}
            {errors._api && <div className={styles.fieldError}>{errors._api}</div>}
          </form>
        </div>
      </div>
    </div>
  )
}

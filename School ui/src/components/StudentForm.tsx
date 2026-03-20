import { useState } from 'react'
import { api } from '../services/api'
import styles from '../styles.module.css'

interface Props {
  instanceId: number
  onClose: (id: number) => void
}

export default function StudentForm({ instanceId, onClose }: Props) {
  const [form, setForm] = useState({
    fullName: '', 
    grade: '', 
    dob: '', 
    age: '',
    fatherName: '', 
    fatherOccupation: '',
    motherName: '', 
    motherOccupation: '',
    address: '', 
    parentPhone: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(prev => {
      const updated = { ...prev, [name]: value }
      if (name === 'dob' && value) {
        const birth = new Date(value)
        const today = new Date()
        let age = today.getFullYear() - birth.getFullYear()
        const monthDiff = today.getMonth() - birth.getMonth()
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
          age--
        }
        updated.age = String(Math.max(0, age))
      }
      return updated
    })

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!form.fullName.trim()) {
      newErrors.fullName = 'Full name is required'
    }

    if (!form.grade) {
      newErrors.grade = 'Grade is required'
    }

    if (!form.dob) {
      newErrors.dob = 'Date of birth is required'
    }

    if (form.parentPhone && !/^[\+]?[1-9][\d]{0,15}$/.test(form.parentPhone.replace(/[\s\-\(\)]/g, ''))) {
      newErrors.parentPhone = 'Please enter a valid phone number'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    
    try {
      const response = await api.post('/students', form)
      alert(`Student "${form.fullName}" saved successfully!`)
      onClose(instanceId)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error saving student. Please try again.'
      alert(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (Object.values(form).some(value => value.trim())) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose(instanceId)
      }
    } else {
      onClose(instanceId)
    }
  }

  return (
    <div className={styles.formCard}>
      <div className={styles.formHeader}>
        <div className={styles.headerContent}>
          <div className={styles.formIcon}>👤</div>
          <div className={styles.headerText}>
            <h2 className={styles.formTitle}>Create Form</h2>
            <p className={styles.formSubtitle}>Fill in the student information below</p>
          </div>
        </div>
        <button 
          className={styles.closeButton} 
          onClick={handleCancel}
          aria-label="Close form"
        >
          ✕
        </button>
      </div>

      <div className={styles.formContent}>
        <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Student Information</h3>
            
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Full Name <span className={styles.requiredIndicator}>*</span>
              </label>
              <input 
                className={styles.fieldInput}
                name="fullName" 
                value={form.fullName} 
                onChange={handleChange} 
                placeholder="Enter student's full name"
                required 
              />
              {errors.fullName && <div className={styles.fieldError}>{errors.fullName}</div>}
            </div>

            <div className={`${styles.formRow} ${styles.threeColumns}`}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Grade <span className={styles.requiredIndicator}>*</span>
                </label>
                <select 
                  className={styles.fieldSelect}
                  name="grade" 
                  value={form.grade} 
                  onChange={handleChange} 
                  required
                >
                  <option value="">Select grade</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={`Grade ${i + 1}`}>Grade {i + 1}</option>
                  ))}
                </select>
                {errors.grade && <div className={styles.fieldError}>{errors.grade}</div>}
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Date of Birth <span className={styles.requiredIndicator}>*</span>
                </label>
                <input 
                  className={styles.fieldInput}
                  type="date" 
                  name="dob" 
                  value={form.dob} 
                  onChange={handleChange} 
                  required 
                />
                {errors.dob && <div className={styles.fieldError}>{errors.dob}</div>}
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Age</label>
                <input 
                  className={styles.fieldInput}
                  name="age" 
                  value={form.age} 
                  placeholder="Auto-calculated"
                  readOnly 
                />
                <div className={styles.fieldHint}>Calculated from date of birth</div>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Parent Information</h3>
            
            <div className={`${styles.formRow} ${styles.twoColumns}`}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Father's Name</label>
                <input 
                  className={styles.fieldInput}
                  name="fatherName" 
                  value={form.fatherName} 
                  onChange={handleChange} 
                  placeholder="Enter father's full name" 
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Father's Occupation</label>
                <input 
                  className={styles.fieldInput}
                  name="fatherOccupation" 
                  value={form.fatherOccupation} 
                  onChange={handleChange} 
                  placeholder="e.g. Engineer, Teacher, etc." 
                />
              </div>
            </div>

            <div className={`${styles.formRow} ${styles.twoColumns}`}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Mother's Name</label>
                <input 
                  className={styles.fieldInput}
                  name="motherName" 
                  value={form.motherName} 
                  onChange={handleChange} 
                  placeholder="Enter mother's full name" 
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Mother's Occupation</label>
                <input 
                  className={styles.fieldInput}
                  name="motherOccupation" 
                  value={form.motherOccupation} 
                  onChange={handleChange} 
                  placeholder="e.g. Doctor, Homemaker, etc." 
                />
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Contact Information</h3>
            
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Address</label>
              <textarea 
                className={styles.fieldTextarea}
                name="address" 
                value={form.address} 
                onChange={handleChange} 
                placeholder="Enter full residential address"
                rows={3}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Parent Phone Number</label>
              <input 
                className={styles.fieldInput}
                name="parentPhone" 
                value={form.parentPhone} 
                onChange={handleChange} 
                placeholder="+1 (555) 000-0000"
                type="tel"
              />
              {errors.parentPhone && <div className={styles.fieldError}>{errors.parentPhone}</div>}
              <div className={styles.fieldHint}>Primary contact number for emergencies</div>
            </div>
          </div>
        </form>
      </div>

      <div className={styles.formActions}>
        <button 
          type="button"
          className={styles.cancelButton} 
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button 
          type="submit"
          className={styles.saveButton} 
          onClick={handleSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <span>💾</span>
              <span>Save Student</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

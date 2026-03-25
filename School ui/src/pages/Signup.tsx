import { useState, useEffect, FormEvent } from 'react'
import { postData, fetchDataFromApi } from '../utils/api'
import { Messages } from '../utils/messages'
import styles from './Auth.module.css'

interface Props {
  onSwitchToLogin: () => void
}

const STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh','Puducherry',
]

const RULES = {
  name:     (v: string) => !/^[a-zA-Z\s.'-]+$/.test(v.trim())    ? Messages.Auth.NameInvalid : '',
  email:    (v: string) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)  ? Messages.Auth.EmailInvalid : '',
  password: (v: string) => v.length < 6                            ? Messages.Auth.PasswordShort :
                           !/[a-zA-Z]/.test(v)                     ? Messages.Auth.PasswordNoLetter :
                           !/[0-9]/.test(v)                        ? Messages.Auth.PasswordNoNumber : '',
  phone:    (v: string) => !/^[6-9]\d{9}$/.test(v.replace(/[\s\-+]/g, '')) ? Messages.Auth.PhoneInvalid : '',
  address:  (v: string) => v.trim().length < 5                     ? Messages.Auth.AddressShort : '',
  state:    (v: string) => !v                                      ? Messages.Auth.StateRequired : '',
  city:     (v: string) => !v                                      ? Messages.Auth.CityRequired : '',
}

type Field = keyof typeof RULES

export default function Signup({ onSwitchToLogin }: Props) {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', address: '', city: '', state: '' })
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [cities, setCities] = useState<string[]>([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const touch = (k: Field) => setTouched(t => ({ ...t, [k]: true }))
  const err = (k: Field) => touched[k] ? RULES[k](form[k]) : ''

  useEffect(() => {
    if (!form.state) { setCities([]); return }
    setCitiesLoading(true)
    set('city', '')
    fetchDataFromApi<{ cities: string[] }>(`/api/auth/cities?state=${encodeURIComponent(form.state)}`)
      .then(d => setCities(d.cities || []))
      .catch(() => setCities([]))
      .finally(() => setCitiesLoading(false))
  }, [form.state])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    // touch all fields to show errors
    const allTouched = Object.fromEntries((Object.keys(RULES) as Field[]).map(k => [k, true]))
    setTouched(allTouched)

    const firstError = (Object.keys(RULES) as Field[]).map(k => RULES[k](form[k])).find(e => e)
    if (firstError) { setSubmitError(firstError); return }

    setSubmitError('')
    setLoading(true)
    try {
      const data = await postData<any>('/api/auth/signup', form)
      if (data.error) throw new Error(data.error)
      onSwitchToLogin()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const field = (k: Field, label: string, inputEl: React.ReactNode) => (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {inputEl}
      {err(k) && <span className={styles.fieldError}>{err(k)}</span>}
    </div>
  )

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>🎓</div>
        <h1 className={styles.title}>Create account</h1>
        <p className={styles.subtitle}>Join School Management System</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>

          {field('name', 'Full Name',
            <input className={`${styles.input} ${err('name') ? styles.inputError : ''}`}
              type="text" placeholder="Ms. Sarah Johnson"
              value={form.name}
              onChange={e => { set('name', e.target.value); touch('name') }}
              onBlur={() => touch('name')}
              autoFocus />
          )}

          {field('email', 'Email',
            <input className={`${styles.input} ${err('email') ? styles.inputError : ''}`}
              type="email" placeholder="you@school.edu"
              value={form.email}
              onChange={e => { set('email', e.target.value); touch('email') }}
              onBlur={() => touch('email')} />
          )}

          {field('password', 'Password',
            <input className={`${styles.input} ${err('password') ? styles.inputError : ''}`}
              type="password" placeholder="Min. 6 chars with letter & number"
              value={form.password}
              onChange={e => { set('password', e.target.value); touch('password') }}
              onBlur={() => touch('password')} />
          )}

          {field('phone', 'Phone Number',
            <input className={`${styles.input} ${err('phone') ? styles.inputError : ''}`}
              type="tel" placeholder="9876543210"
              value={form.phone}
              onChange={e => { set('phone', e.target.value.replace(/[^0-9\s\-+]/g, '')); touch('phone') }}
              onBlur={() => touch('phone')} />
          )}

          {field('address', 'Address',
            <input className={`${styles.input} ${err('address') ? styles.inputError : ''}`}
              type="text" placeholder="123 Main Street"
              value={form.address}
              onChange={e => { set('address', e.target.value); touch('address') }}
              onBlur={() => touch('address')} />
          )}

          <div className={styles.row}>
            {field('city', 'City',
              <select className={`${styles.input} ${err('city') ? styles.inputError : ''}`}
                value={form.city}
                onChange={e => { set('city', e.target.value); touch('city') }}
                onBlur={() => touch('city')}
                disabled={!form.state || citiesLoading}>
                <option value="">{citiesLoading ? 'Loading...' : form.state ? 'Select city' : 'Select state first'}</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {field('state', 'State',
              <select className={`${styles.input} ${err('state') ? styles.inputError : ''}`}
                value={form.state}
                onChange={e => { set('state', e.target.value); touch('state') }}
                onBlur={() => touch('state')}>
                <option value="">Select state</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>

          {submitError && <p className={styles.error}>⚠ {submitError}</p>}

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className={styles.switchText}>
          Already have an account?{' '}
          <button className={styles.switchBtn} onClick={onSwitchToLogin}>Sign In</button>
        </p>
      </div>
    </div>
  )
}

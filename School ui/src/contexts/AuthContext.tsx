import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: number
  name: string
  email: string
  role: string
  grade?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    // version stamp — clear old cache on app update
    const stamp = localStorage.getItem('auth_version')
    if (stamp !== '2') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      localStorage.setItem('auth_version', '2')
    }
    return localStorage.getItem('auth_token')
  })
  const [user, setUser] = useState<User | null>(() => {
    try {
      const u = localStorage.getItem('auth_user')
      if (!u) return null
      const parsed = JSON.parse(u)
      if (!parsed?.name) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        return null
      }
      return parsed
    } catch { return null }
  })

  const login = (t: string, u: User) => {
    // clear any stale cached user first
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    setToken(t)
    setUser(u)
    localStorage.setItem('auth_token', t)
    localStorage.setItem('auth_user', JSON.stringify(u))
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    sessionStorage.clear()
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

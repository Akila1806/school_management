import { useState } from 'react'
import styles from '../styles.module.css'

export interface Tab {
  id: string
  title: string
  icon?: string
  closable?: boolean
  modified?: boolean
}

interface TabBarProps {
  tabs: Tab[]
  activeTab: string
  onTabSelect: (tabId: string) => void
  onTabClose: (tabId: string) => void
  onNewTab?: (type: 'dashboard' | 'attendance' | 'student') => void
}

export default function TabBar({ tabs, activeTab, onTabSelect, onTabClose, onNewTab }: TabBarProps) {
  const [draggedTab, setDraggedTab] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    setDraggedTab(tabId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault()
    if (draggedTab && draggedTab !== targetTabId) {
      // Handle tab reordering logic here if needed
    }
    setDraggedTab(null)
  }

  return (
    <div className={styles.tabBar}>
      <div className={styles.tabList}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => onTabSelect(tab.id)}
            draggable
            onDragStart={(e) => handleDragStart(e, tab.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, tab.id)}
          >
            {tab.icon && <span className={styles.tabIcon}>{tab.icon}</span>}
            <span className={styles.tabTitle}>{tab.title}</span>
            {tab.modified && <span className={styles.modifiedIndicator}>●</span>}
            {tab.closable && (
              <button
                className={styles.closeButton}
                onClick={(e) => {
                  e.stopPropagation()
                  onTabClose(tab.id)
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      
      <div className={styles.tabActions}>
        {onNewTab && (
          <div style={{ position: 'relative' }}>
            <button
              className={styles.themeToggle}
              title="Open new tab"
              onClick={() => setMenuOpen(p => !p)}
            >
              ＋
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', top: '110%', right: 0,
                background: 'var(--card-bg, #1a1d27)',
                border: '1px solid var(--border-color, #2a2d3e)',
                borderRadius: 10, zIndex: 50, minWidth: 160,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                overflow: 'hidden',
              }}>
                {[
                  { type: 'dashboard' as const,   icon: '📊', label: 'Dashboard' },
                  { type: 'attendance' as const,  icon: '📋', label: 'Attendance' },
                  { type: 'student' as const,     icon: '👤', label: 'Create Student' },
                ].map(item => (
                  <button key={item.type} onClick={() => { onNewTab(item.type); setMenuOpen(false) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', background: 'none', border: 'none',
                      color: 'var(--text-primary, #e2e8f0)', fontSize: 13,
                      padding: '9px 14px', cursor: 'pointer', textAlign: 'left',
                      borderBottom: '1px solid var(--border-color, #2a2d3e)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--sidebar-active, #1e1b4b)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
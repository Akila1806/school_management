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
}

export default function TabBar({ tabs, activeTab, onTabSelect, onTabClose }: TabBarProps) {
  const [draggedTab, setDraggedTab] = useState<string | null>(null)

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
      </div>
    </div>
  )
}
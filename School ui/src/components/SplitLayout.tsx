import { useState, useRef, useCallback, useEffect } from 'react'
import styles from '../styles.module.css'

interface SplitLayoutProps {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  initialSplit?: number // percentage for left panel (default 60)
  minLeftWidth?: number
  minRightWidth?: number
}

export default function SplitLayout({ 
  leftPanel, 
  rightPanel, 
  initialSplit = 60,
  minLeftWidth = 300,
  minRightWidth = 250
}: SplitLayoutProps) {
  const [splitPercentage, setSplitPercentage] = useState(initialSplit)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return

    const container = containerRef.current
    const containerRect = container.getBoundingClientRect()
    const containerWidth = containerRect.width
    
    const mouseX = e.clientX - containerRect.left
    const newPercentage = (mouseX / containerWidth) * 100
    
    // Calculate minimum percentages based on pixel values
    const minLeftPercentage = (minLeftWidth / containerWidth) * 100
    const minRightPercentage = (minRightWidth / containerWidth) * 100
    const maxLeftPercentage = 100 - minRightPercentage
    
    // Clamp the percentage within bounds
    const clampedPercentage = Math.max(
      minLeftPercentage,
      Math.min(maxLeftPercentage, newPercentage)
    )
    
    setSplitPercentage(clampedPercentage)
  }, [isDragging, minLeftWidth, minRightWidth])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Add global mouse event listeners when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div 
      ref={containerRef}
      className={`${styles.splitContainer} ${isDragging ? styles.dragging : ''}`}
    >
      <div 
        className={styles.leftPanel}
        style={{ width: `${splitPercentage}%` }}
      >
        {leftPanel}
      </div>
      
      <div 
        className={styles.resizer}
        onMouseDown={handleMouseDown}
      >
        <div className={styles.resizerHandle} />
      </div>
      
      <div 
        className={styles.rightPanel}
        style={{ width: `${100 - splitPercentage}%` }}
      >
        {rightPanel}
      </div>
    </div>
  )
}
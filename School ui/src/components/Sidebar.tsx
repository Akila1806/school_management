import styles from '../styles.module.css'

type View = 'dashboard' | 'students'

interface Props {
  activeView: View
  onNavigate: (view: View) => void
}

const navItems = [
  { id: 'dashboard' as View, icon: '⊞', label: 'Dashboard' },
  { id: 'students' as View, icon: '🎓', label: 'Students' },
]

const bottomItems = [
  { icon: '👩‍🏫', label: 'Teachers' },
  { icon: '📅', label: 'Schedule' },
  { icon: '⚙️', label: 'Settings' },
]

export default function Sidebar({ activeView, onNavigate }: Props) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>🏫</span>
        <span className={styles.logoText}>EduManage</span>
      </div>

      <nav className={styles.nav}>
        {navItems.map(item => (
          <button
            key={item.id}
            className={`${styles.navItem} ${activeView === item.id ? styles.active : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.divider} />

      <nav className={styles.nav}>
        {bottomItems.map(item => (
          <button key={item.label} className={styles.navItem}>
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.userSection}>
        <div className={styles.sidebarAvatar}>A</div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>Admin</span>
          <span className={styles.userRole}>School Admin</span>
        </div>
      </div>
    </aside>
  )
}

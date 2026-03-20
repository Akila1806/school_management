import { NavLink } from 'react-router-dom'
import styles from './Navbar.module.css'

const links = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
]

function Navbar() {
  return (
    <nav className={styles.navbar}>
      <div className={styles.brand}>
        <span className={styles.logoWrap}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true">
            <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
          </svg>
        </span>
        MyApp
      </div>
      <ul className={styles.links}>
        {links.map(({ to, label }) => (
          <li key={to}>
            <NavLink
              to={to}
              end
              className={({ isActive }) => (isActive ? styles.active : undefined)}
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default Navbar

import { Link } from 'react-router-dom'
import styles from './NotFound.module.css'

function NotFound() {
  return (
    <div className={styles.container}>
      <h1>404</h1>
      <p>Page not found.</p>
      <Link to="/">Go home</Link>
    </div>
  )
}

export default NotFound

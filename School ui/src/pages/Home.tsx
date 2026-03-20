import { useCounter } from '@/hooks/useCounter'
import Button from '@/components/Button'
import styles from './Home.module.css'

function Home() {
  const { count, increment, decrement, reset } = useCounter()

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Welcome to MyApp</h1>
      <p className={styles.subtitle}>A clean Vite + React + TypeScript starter.</p>

      <div className={styles.counter}>
        <p className={styles.count}>{count}</p>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={decrement}>−</Button>
          <Button onClick={increment}>+</Button>
          <Button variant="secondary" onClick={reset}>Reset</Button>
        </div>
      </div>
    </div>
  )
}

export default Home

import { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

function Button({ variant = 'primary', children, ...rest }: ButtonProps) {
  return (
    <button className={`${styles.btn} ${styles[variant]}`} {...rest}>
      {children}
    </button>
  )
}

export default Button

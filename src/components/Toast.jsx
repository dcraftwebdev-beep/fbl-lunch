import { useEffect } from 'react'
import styles from './Toast.module.css'

export default function Toast({ message, tone, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className={`${styles.toast} ${tone === 'error' ? styles.error : ''}`} role="status">
      {message}
    </div>
  )
}

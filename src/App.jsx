import { useCallback, useState } from 'react'
import styles from './App.module.css'
import { useLunchData } from './hooks/useLunchData'
import { isLive } from './lib/store'
import Header from './components/Header'
import TodayPanel from './components/TodayPanel'
import StatsRow from './components/StatsRow'
import RegisterTable from './components/RegisterTable'
import ExportPanel from './components/ExportPanel'
import ChefCard from './components/ChefCard'
import MembersPanel from './components/MembersPanel'
import Toast from './components/Toast'

export default function App() {
  const [toast, setToast] = useState(null)

  const notify = useCallback((message, tone = 'ok') => {
    setToast({ message, tone, key: Date.now() })
  }, [])

  const data = useLunchData(notify)

  return (
    <div className={styles.page}>
      <Header live={isLive} />

      <main className={styles.main}>
        {data.error && <div className={styles.errorBar} role="alert">{data.error}</div>}

        {data.loading ? (
          <div className={styles.loading}>Setting the table…</div>
        ) : (
          <>
            <div className={styles.topGrid}>
              <TodayPanel data={data} />
              <StatsRow data={data} />
            </div>

            <RegisterTable data={data} />

            <div className={styles.bottomGrid}>
              <div className={styles.leftStack}>
                <ChefCard data={data} />
                <ExportPanel data={data} notify={notify} />
              </div>
              <MembersPanel data={data} />
            </div>
          </>
        )}
      </main>

      <footer className={styles.footer}>
        firebrand labs · internal lunch register
        {!isLive && <span className={styles.demoNote}> · running in demo mode — add Supabase keys in .env to go live</span>}
      </footer>

      {toast && <Toast key={toast.key} message={toast.message} tone={toast.tone} onDone={() => setToast(null)} />}
    </div>
  )
}

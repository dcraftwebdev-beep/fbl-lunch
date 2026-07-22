import { useCallback, useState } from 'react'
import styles from './App.module.css'
import { useLunchData } from './hooks/useLunchData'
import { isLive } from './lib/store'
import { isAuthed, logout } from './lib/auth'
import Login from './components/Login'
import Header from './components/Header'
import TodayPanel from './components/TodayPanel'
import StatsRow from './components/StatsRow'
import RegisterTable from './components/RegisterTable'
import ExportPanel from './components/ExportPanel'
import ChefCard from './components/ChefCard'
import MembersPanel from './components/MembersPanel'
import Toast from './components/Toast'
import TasksView from './modules/tasks/TasksView'

function LunchRegisterWrapper({ notify, data }) {
  const [authed, setAuthed] = useState(isAuthed)

  if (!authed) return <Login onSuccess={() => setAuthed(true)} />

  return (
    <div className={styles.lunchWrapper}>
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
    </div>
  )
}

export default function App() {
  const [toast, setToast] = useState(null)
  const [activeModule, setActiveModule] = useState('tasks') // 'tasks' or 'lunch'
  const [authed, setAuthed] = useState(isAuthed)

  const notify = useCallback((message, tone = 'ok') => {
    setToast({ message, tone, key: Date.now() })
  }, [])

  const lunchData = useLunchData(notify)

  return (
    <div className={styles.page}>
      <Header 
        live={isLive} 
        onLogout={() => { logout(); setAuthed(false) }} 
        activeModule={activeModule}
        onSwitchModule={setActiveModule}
        authed={authed}
      />

      <main className={styles.main}>
        {activeModule === 'tasks' ? (
          <TasksView notify={notify} />
        ) : (
          <LunchRegisterWrapper notify={notify} data={lunchData} />
        )}
      </main>

      <footer className={styles.footer}>
        firebrand labs · internal portal
        {!isLive && <span className={styles.demoNote}> · running in demo mode — add Supabase keys in .env to go live</span>}
      </footer>

      {toast && <Toast key={toast.key} message={toast.message} tone={toast.tone} onDone={() => setToast(null)} />}
    </div>
  )
}

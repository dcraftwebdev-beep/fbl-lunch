import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useTasks } from './hooks/useTasks'
import styles from './TasksView.module.css'
import TasksAnalytics from './TasksAnalytics'
import { format, parseISO, differenceInCalendarDays, startOfWeek, endOfWeek, startOfMonth, differenceInCalendarWeeks, differenceInCalendarMonths } from 'date-fns'

const TODAY_STR = new Date().toISOString().split('T')[0]
const PRIORITIES = ['Urgent!', 'High', 'Medium', 'Low']
const STATUSES = ['Not Started', 'WIP', 'Approval pending', 'Completed']
const PAGE_SIZE = 10

const STATUS_META = {
  'Not Started': { dot: '#9a8f80', label: 'Not Started', pct: 8 },
  'WIP': { dot: '#f59401', label: 'In Progress', pct: 55 },
  'Approval pending': { dot: '#d9ac00', label: 'Approval', pct: 85 },
  'Completed': { dot: '#2d8a56', label: 'Completed', pct: 100 },
}
const PRIORITY_META = {
  'Urgent!': { color: '#df2429', soft: 'var(--ember-soft)' },
  'High': { color: '#ee6200', soft: 'var(--flame-soft)' },
  'Medium': { color: '#d9ac00', soft: 'var(--gold-soft)' },
  'Low': { color: '#6b625a', soft: 'var(--line)' },
}

const TIME_SUGGESTIONS = ['10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '3:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '9:00 PM', 'EOD']
const REMARK_SUGGESTIONS = ['Awaiting assets', 'Client review', 'Revisions needed', 'Approved', 'On hold', 'Sent for approval', 'Ready to publish']

const AVATAR_COLORS = ['#df2429', '#ee6200', '#f59401', '#d9ac00', '#2d8a56', '#3a7bd5', '#8e44ad', '#16a085']
function avatarColor(name) {
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
const initials = (n) => (n || '?').trim().charAt(0).toUpperCase()
const toList = (s) => (s || '').split(',').map(x => x.trim()).filter(Boolean)
const listToStr = (arr) => arr.join(', ')

const emptyRow = () => ({
  client: '', account_manager: '', task_name: '', task_type: '',
  assigned_to: '', assigned_on: TODAY_STR,
  priority: 'Medium', deadline_date: '', deadline_time: '', status: 'Not Started', remarks: ''
})

export default function TasksView({ notify }) {
  const { tasks, members, loading, error, addTask, updateTask, deleteTask, addMember, deleteMember } = useTasks()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('All')
  const [view, setView] = useState('list')
  const [groupBy, setGroupBy] = useState('flat') // flat | week | month
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(() => new Set())
  const [editingId, setEditingId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState(emptyRow)
  const [showFilters, setShowFilters] = useState(false)
  const [showTeam, setShowTeam] = useState(false)
  const [analyticsFocus, setAnalyticsFocus] = useState(null)
  const [filters, setFilters] = useState({ client: 'All', designer: 'All', manager: 'All', priority: 'All', status: 'All' })

  const designers = useMemo(() => members.filter(m => m.role === 'Designer'), [members])
  const managers = useMemo(() => members.filter(m => m.role === 'Account Manager'), [members])

  const clientOptions = useMemo(() => Array.from(new Set(tasks.map(t => t.client).filter(Boolean))).sort(), [tasks])
  const timeOptions = useMemo(() => Array.from(new Set([...TIME_SUGGESTIONS, ...tasks.map(t => t.deadline_time).filter(Boolean)])), [tasks])
  const remarkOptions = useMemo(() => Array.from(new Set([...REMARK_SUGGESTIONS, ...tasks.map(t => t.remarks).filter(Boolean)])), [tasks])

  const activeFilterCount = Object.values(filters).filter(v => v !== 'All').length

  const kpi = useMemo(() => {
    let completed = 0, active = 0, overdue = 0, today = 0
    tasks.forEach(t => {
      const done = t.status === 'Completed'
      if (done) completed++; else active++
      if (!done && t.deadline_date && t.deadline_date < TODAY_STR) overdue++
      if (!done && t.deadline_date === TODAY_STR) today++
    })
    const total = tasks.length || 1
    return {
      total: tasks.length, completed, active, overdue, today,
      completedPct: Math.round((completed / total) * 100),
      activePct: Math.round((active / total) * 100),
      overduePct: Math.round((overdue / total) * 100),
    }
  }, [tasks])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter(t => {
      if (q) {
        const hay = `${t.task_name} ${t.client} ${t.assigned_to} ${t.account_manager} ${t.task_type} ${t.remarks} ${t.status} ${t.priority}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (tab === 'Today' && t.deadline_date !== TODAY_STR) return false
      if (tab === 'Overdue' && !(t.status !== 'Completed' && t.deadline_date && t.deadline_date < TODAY_STR)) return false
      if (tab === 'Completed' && t.status !== 'Completed') return false
      if (filters.client !== 'All' && t.client !== filters.client) return false
      if (filters.priority !== 'All' && t.priority !== filters.priority) return false
      if (filters.status !== 'All' && t.status !== filters.status) return false
      if (filters.designer !== 'All' && !toList(t.assigned_to).includes(filters.designer)) return false
      if (filters.manager !== 'All' && !toList(t.account_manager).includes(filters.manager)) return false
      return true
    })
  }, [tasks, search, tab, filters])

  // grouping for week/month
  const grouped = useMemo(() => {
    if (groupBy === 'flat') return null
    const now = new Date()
    const map = {}
    filtered.forEach(t => {
      let key = 'zzz_none', title = 'No deadline', range = '', sort = '9999'
      if (t.deadline_date) {
        const d = parseISO(t.deadline_date)
        if (groupBy === 'week') {
          const s = startOfWeek(d, { weekStartsOn: 1 }), e = endOfWeek(d, { weekStartsOn: 1 })
          const wd = differenceInCalendarWeeks(d, now, { weekStartsOn: 1 })
          title = wd === 0 ? 'This week' : wd === 1 ? 'Next week' : wd === -1 ? 'Last week' : `Week of ${format(s, 'dd MMM')}`
          range = `${format(s, 'dd MMM')} – ${format(e, 'dd MMM yyyy')}`
          sort = format(s, 'yyyy-MM-dd'); key = sort
        } else {
          const s = startOfMonth(d)
          const md = differenceInCalendarMonths(s, startOfMonth(now))
          title = md === 0 ? 'This month' : md === 1 ? 'Next month' : md === -1 ? 'Last month' : format(d, 'MMMM yyyy')
          range = format(d, 'MMMM yyyy')
          sort = format(s, 'yyyy-MM'); key = sort
        }
      }
      if (!map[key]) map[key] = { title, range, sort, tasks: [] }
      map[key].tasks.push(t)
    })
    return Object.values(map).sort((a, b) => a.sort.localeCompare(b.sort))
  }, [filtered, groupBy])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [search, tab, filters, groupBy])

  const update = useCallback(async (id, updates) => {
    try { await updateTask(id, updates) } catch { notify('Failed to save change', 'error') }
  }, [updateTask, notify])

  const handleDelete = async (id) => {
    try { await deleteTask(id); setSelected(s => { const n = new Set(s); n.delete(id); return n }); notify('Task deleted') }
    catch { notify('Failed to delete task', 'error') }
  }

  const handleAddMember = async (name, role) => {
    try { await addMember(name, role); notify(`${role} added`) }
    catch { notify('Failed to add member', 'error') }
  }
  const handleRemoveMember = async (id) => {
    try { await deleteMember(id); notify('Member removed') }
    catch { notify('Failed to remove member', 'error') }
  }

  const handleSaveNew = async () => {
    if (!newRow.client || !newRow.task_name || !newRow.assigned_to) {
      notify('Client, Task Name, and at least one Designer are required', 'error'); return
    }
    try { await addTask(newRow); notify('Task added'); setNewRow(emptyRow()); setAdding(false) }
    catch { notify('Error adding task', 'error') }
  }

  const toggleSelect = (id) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allOnPageSelected = pageItems.length > 0 && pageItems.every(t => selected.has(t.id))
  const toggleSelectAll = () => setSelected(s => {
    const n = new Set(s)
    if (allOnPageSelected) pageItems.forEach(t => n.delete(t.id)); else pageItems.forEach(t => n.add(t.id))
    return n
  })
  const bulkComplete = async () => { for (const id of selected) await update(id, { status: 'Completed' }); notify(`${selected.size} marked completed`); setSelected(new Set()) }
  const bulkDelete = async () => { for (const id of selected) { try { await deleteTask(id) } catch {} } notify(`${selected.size} deleted`); setSelected(new Set()) }

  const rowProps = (task) => ({
    task, selected: selected.has(task.id), expanded: editingId === task.id,
    onSelect: () => toggleSelect(task.id),
    onEdit: () => { setEditingId(id => id === task.id ? null : task.id); setAdding(false) },
    onDelete: () => handleDelete(task.id),
    onAnalytics: () => { setAnalyticsFocus({ dim: 'client', value: task.client || 'Unassigned', title: 'Client' }); setView('analytics') },
    onQuick: (u) => update(task.id, u),
  })

  const renderRows = (list) => list.map(task => (
    <React.Fragment key={task.id}>
      <Row {...rowProps(task)} />
      {editingId === task.id && (
        <EditPanel task={task} designers={designers} managers={managers} timeOptions={timeOptions} remarkOptions={remarkOptions}
          onSave={async (u) => { await update(task.id, u); setEditingId(null); notify('Task updated') }}
          onCancel={() => setEditingId(null)} />
      )}
    </React.Fragment>
  ))

  return (
    <div className={styles.container}>
      {/* MAIN PANEL */}
      <div className={styles.panelCard}>
        <div className={styles.panelHead}>
          <div>
            <div className={styles.panelTitleRow}>
              <h2 className={styles.panelH2}>Daily Tasks</h2>
              <span className={styles.countPill}>{filtered.length} tasks</span>
            </div>
            <p className={styles.panelSub}>Track every deliverable, owner, and deadline in one place.</p>
          </div>
          <div className={styles.panelActions}>
            <div className={styles.viewToggle}>
              <button className={`${styles.viewToggleButton} ${view === 'list' ? styles.active : ''}`} onClick={() => setView('list')}>List</button>
              <button className={`${styles.viewToggleButton} ${view === 'analytics' ? styles.active : ''}`} onClick={() => { setView('analytics'); setAnalyticsFocus(null) }}>Analytics</button>
            </div>
            {view === 'list' && <button className={styles.teamBtn} onClick={() => setShowTeam(true)}><IconUsers /> Team</button>}
            {view === 'list' && <button className={styles.addBtn} onClick={() => { setAdding(a => !a); setEditingId(null) }}><PlusIcon /> Add task</button>}
          </div>
        </div>

        {showTeam && (
          <TeamModal designers={designers} managers={managers} onAdd={handleAddMember} onRemove={handleRemoveMember} onClose={() => setShowTeam(false)} />
        )}

        {error && <div className={styles.errorBar}>{error}</div>}

        {view === 'analytics' ? (
          <div className={styles.analyticsInset}><TasksAnalytics tasks={tasks} focus={analyticsFocus} onClearFocus={() => setAnalyticsFocus(null)} /></div>
        ) : (
          <>
            {/* Toolbar */}
            <div className={styles.toolbar}>
              <div className={styles.tabs}>
                {['All', 'Today', 'Overdue', 'Completed'].map(t => (
                  <button key={t} className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`} onClick={() => setTab(t)}>
                    {t}{t === 'Overdue' && kpi.overdue > 0 && <span className={styles.tabBadge}>{kpi.overdue}</span>}
                  </button>
                ))}
              </div>
              <div className={styles.toolbarRight}>
                <div className={styles.segmented}>
                  <span className={styles.segLabel}>Group</span>
                  {[['flat', 'None'], ['week', 'Week'], ['month', 'Month']].map(([v, l]) => (
                    <button key={v} className={`${styles.segBtn} ${groupBy === v ? styles.segActive : ''}`} onClick={() => setGroupBy(v)}>{l}</button>
                  ))}
                </div>
                <div className={styles.filterWrap}>
                  <button data-filter-toggle className={`${styles.filterBtn} ${activeFilterCount ? styles.filterBtnActive : ''}`} onClick={() => setShowFilters(s => !s)}>
                    <IconFilter /> Filters{activeFilterCount > 0 && <span className={styles.filterCount}>{activeFilterCount}</span>}
                  </button>
                  {showFilters && (
                    <FilterPopover filters={filters} setFilters={setFilters} clientOptions={clientOptions} designers={designers} managers={managers} onClose={() => setShowFilters(false)} />
                  )}
                </div>
                <div className={styles.searchBox}>
                  <SearchIcon />
                  <input className={styles.searchInput} placeholder="Search anything…" value={search} onChange={e => setSearch(e.target.value)} />
                  {search && <button className={styles.clearBtn} onClick={() => setSearch('')} aria-label="Clear">✕</button>}
                </div>
              </div>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className={styles.activeFilters}>
                {Object.entries(filters).filter(([, v]) => v !== 'All').map(([k, v]) => (
                  <span key={k} className={styles.activeChip}>
                    <b>{k}:</b> {v}
                    <button onClick={() => setFilters(f => ({ ...f, [k]: 'All' }))}>✕</button>
                  </span>
                ))}
                <button className={styles.clearAllChip} onClick={() => setFilters({ client: 'All', designer: 'All', manager: 'All', priority: 'All', status: 'All' })}>Clear all</button>
              </div>
            )}

            {/* Bulk bar */}
            {selected.size > 0 && (
              <div className={styles.bulkBar}>
                <span className={styles.bulkCount}>{selected.size} selected</span>
                <button className={styles.bulkBtn} onClick={bulkComplete}><IconCheck /> Mark completed</button>
                <button className={`${styles.bulkBtn} ${styles.bulkDanger}`} onClick={bulkDelete}><IconTrash /> Delete</button>
                <button className={styles.bulkClear} onClick={() => setSelected(new Set())}>Clear</button>
              </div>
            )}

            {/* Table */}
            <div className={styles.tableScroll}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th className={styles.checkCol}><input type="checkbox" className={styles.check} checked={allOnPageSelected} onChange={toggleSelectAll} /></th>
                    <th>Task</th>
                    <th className={styles.narrowCol}>Added</th>
                    <th className={styles.progCol}>Progress</th>
                    <th>Designers</th>
                    <th>Account Mgr</th>
                    <th>Deadline</th>
                    <th>Status</th>
                    <th className={styles.actionsCol}></th>
                  </tr>
                </thead>
                <tbody>
                  {adding && (
                    <EditPanel isAdd draft={newRow} setDraft={setNewRow} designers={designers} managers={managers} timeOptions={timeOptions} remarkOptions={remarkOptions}
                      onSave={handleSaveNew} onCancel={() => { setAdding(false); setNewRow(emptyRow()) }} />
                  )}

                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className={styles.skRow}>{Array.from({ length: 9 }).map((__, j) => <td key={j}><div className={styles.sk} style={{ width: `${40 + ((i + j) % 5) * 12}%` }} /></td>)}</tr>
                    ))
                  ) : filtered.length === 0 && !adding ? (
                    <tr><td colSpan="9"><div className={styles.emptyState}><div className={styles.emptyTitle}>No tasks here</div><div>{search || tab !== 'All' || activeFilterCount ? 'Try a different tab, search, or filter.' : 'Add your first task to get started.'}</div></div></td></tr>
                  ) : grouped ? (
                    grouped.map(g => (
                      <React.Fragment key={g.sort}>
                        <tr className={styles.groupRow}><td colSpan="9"><div className={styles.groupCell}><span className={styles.groupDot} /><span className={styles.groupLabel}>{g.title}</span>{g.range && <span className={styles.groupRange}>{g.range}</span>}<span className={styles.groupCount}>{g.tasks.length}</span></div></td></tr>
                        {renderRows(g.tasks)}
                      </React.Fragment>
                    ))
                  ) : (
                    renderRows(pageItems)
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination (flat only) */}
            {!loading && filtered.length > 0 && !grouped && (
              <div className={styles.pagination}>
                <span className={styles.pageInfo}>Page {safePage} of {pageCount} · {filtered.length} results</span>
                <div className={styles.pageBtns}>
                  <button className={styles.pageBtn} disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
                  <button className={styles.pageBtn} disabled={safePage >= pageCount} onClick={() => setPage(p => Math.min(pageCount, p + 1))}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ============ AVATAR STACK ============ */
function AvatarStack({ value, empty = 'Unassigned' }) {
  const list = toList(value)
  if (list.length === 0) return <span className={styles.muted}>{empty}</span>
  const shown = list.slice(0, 3)
  return (
    <div className={styles.stackCell} title={list.join(', ')}>
      <div className={styles.stack}>
        {shown.map((n, i) => <span key={i} className={styles.avatarSm} style={{ background: avatarColor(n), zIndex: 10 - i }}>{initials(n)}</span>)}
        {list.length > 3 && <span className={`${styles.avatarSm} ${styles.avatarMore}`}>+{list.length - 3}</span>}
      </div>
      <span className={styles.stackName}>{list.length === 1 ? list[0] : `${list.length} people`}</span>
    </div>
  )
}

/* ============ TEAM MODAL ============ */
function TeamModal({ designers, managers, onAdd, onRemove, onClose }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('Designer')
  const submit = () => {
    if (!name.trim()) return
    onAdd(name.trim(), role)
    setName('')
  }
  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div>
            <h3 className={styles.modalTitle}>Manage team</h3>
            <p className={styles.modalSub}>Add or remove designers and account managers</p>
          </div>
          <button className={styles.modalClose} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.teamAddRow}>
          <input className={styles.teamInput} placeholder="Full name" value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }} autoFocus />
          <select className={styles.teamSelect} value={role} onChange={e => setRole(e.target.value)}>
            <option value="Designer">Designer</option>
            <option value="Account Manager">Account Manager</option>
          </select>
          <button className={styles.saveRowBtn} onClick={submit}><PlusIcon /> Add</button>
        </div>

        <div className={styles.teamColumns}>
          <TeamColumn title="Designers" list={designers} onRemove={onRemove} />
          <TeamColumn title="Account Managers" list={managers} onRemove={onRemove} />
        </div>
      </div>
    </div>
  )
}
function TeamColumn({ title, list, onRemove }) {
  return (
    <div className={styles.teamCol}>
      <div className={styles.teamColHead}>{title}<span className={styles.teamColCount}>{list.length}</span></div>
      <div className={styles.teamList}>
        {list.length === 0 && <div className={styles.teamEmpty}>None yet</div>}
        {list.map(m => (
          <div key={m.id} className={styles.teamItem}>
            <span className={styles.avatarSm} style={{ background: avatarColor(m.name) }}>{initials(m.name)}</span>
            <span className={styles.teamName}>{m.name}</span>
            <button className={styles.teamRemove} onClick={() => onRemove(m.id)} title="Remove"><IconTrash /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============ FILTER POPOVER ============ */
function FilterPopover({ filters, setFilters, clientOptions, designers, managers, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => {
      // Ignore clicks on the toggle button — let its own onClick handle closing,
      // otherwise mousedown closes and the click re-opens (flicker / won't close).
      if (e.target.closest?.('[data-filter-toggle]')) return
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  // Close on Escape too.
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])

  const set = (k) => (e) => setFilters(f => ({ ...f, [k]: e.target.value }))
  const pick = (k, v) => setFilters(f => ({ ...f, [k]: v }))
  const resetAll = () => setFilters({ client: 'All', designer: 'All', manager: 'All', priority: 'All', status: 'All' })
  const activeCount = Object.values(filters).filter(v => v !== 'All').length

  return (
    <div className={styles.popover} ref={ref} role="dialog" aria-label="Filter tasks">
      <div className={styles.popHead}>
        <span className={styles.popTitle}>Filters{activeCount > 0 && <span className={styles.popHeadCount}>{activeCount}</span>}</span>
        <button type="button" className={styles.popClear} onClick={resetAll} disabled={activeCount === 0}>Clear all</button>
      </div>

      <div className={styles.popGrid}>
        <FilterField label="Client"><select value={filters.client} onChange={set('client')}><option>All</option>{clientOptions.map(c => <option key={c}>{c}</option>)}</select></FilterField>
        <FilterField label="Designer"><select value={filters.designer} onChange={set('designer')}><option>All</option>{designers.map(m => <option key={m.id}>{m.name}</option>)}</select></FilterField>
        <FilterField label="Account Manager" wide><select value={filters.manager} onChange={set('manager')}><option>All</option>{managers.map(m => <option key={m.id}>{m.name}</option>)}</select></FilterField>
      </div>

      <div className={styles.popPillGroup}>
        <span className={styles.popPillLabel}>Priority</span>
        <div className={styles.pills}>
          <button type="button" className={`${styles.pill} ${filters.priority === 'All' ? styles.pillActive : ''}`} onClick={() => pick('priority', 'All')}>All</button>
          {PRIORITIES.map(p => {
            const active = filters.priority === p
            const c = PRIORITY_META[p]?.color
            return (
              <button type="button" key={p} className={`${styles.pill} ${active ? styles.pillActive : ''}`}
                style={active ? { borderColor: c, color: c, background: c + '18' } : undefined}
                onClick={() => pick('priority', p)}>{p}</button>
            )
          })}
        </div>
      </div>

      <div className={styles.popPillGroup}>
        <span className={styles.popPillLabel}>Status</span>
        <div className={styles.pills}>
          <button type="button" className={`${styles.pill} ${filters.status === 'All' ? styles.pillActive : ''}`} onClick={() => pick('status', 'All')}>All</button>
          {STATUSES.map(s => {
            const active = filters.status === s
            const c = STATUS_META[s]?.dot
            return (
              <button type="button" key={s} className={`${styles.pill} ${active ? styles.pillActive : ''}`}
                style={active ? { borderColor: c, color: c, background: c + '18' } : undefined}
                onClick={() => pick('status', s)}>
                <span className={styles.pillDot} style={{ background: c }} />{STATUS_META[s]?.label || s}
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.popActions}>
        <button type="button" className={styles.saveRowBtn} onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
function FilterField({ label, children, wide }) {
  return <label className={`${styles.filterField} ${wide ? styles.filterFieldWide : ''}`}><span>{label}</span>{children}</label>
}

/* ============ MULTISELECT ============ */
function MultiPeople({ value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const list = toList(value)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  const toggle = (name) => {
    const next = list.includes(name) ? list.filter(x => x !== name) : [...list, name]
    onChange(listToStr(next))
  }
  return (
    <div className={styles.multi} ref={ref}>
      <button type="button" className={styles.multiControl} onClick={() => setOpen(o => !o)}>
        {list.length === 0 ? <span className={styles.multiPlaceholder}>{placeholder}</span>
          : <span className={styles.multiChips}>{list.map(n => <span key={n} className={styles.multiChip} style={{ background: avatarColor(n) + '22', color: avatarColor(n) }}>{n}<span onClick={(e) => { e.stopPropagation(); toggle(n) }}>✕</span></span>)}</span>}
        <IconChevron />
      </button>
      {open && (
        <div className={styles.multiMenu}>
          {options.map(m => (
            <label key={m.id} className={styles.multiOption}>
              <input type="checkbox" checked={list.includes(m.name)} onChange={() => toggle(m.name)} />
              <span className={styles.avatarSm} style={{ background: avatarColor(m.name) }}>{initials(m.name)}</span>
              {m.name}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============ ROW ============ */
const Row = React.memo(function Row({ task, selected, expanded, onSelect, onEdit, onDelete, onAnalytics, onQuick }) {
  const meta = STATUS_META[task.status] || STATUS_META['Not Started']
  const done = task.status === 'Completed'
  const overdue = !done && task.deadline_date && task.deadline_date < TODAY_STR
  const dl = deadlineLabel(task.deadline_date, done)
  const pr = PRIORITY_META[task.priority] || PRIORITY_META.Medium
  return (
    <tr className={`${styles.row} ${selected ? styles.rowSelected : ''} ${overdue ? styles.rowOverdue : ''}`}>
      <td className={styles.checkCol}><input type="checkbox" className={styles.check} checked={selected} onChange={onSelect} /></td>
      <td>
        <div className={styles.taskCell}>
          <span className={styles.avatar} style={{ background: avatarColor(task.client) }}>{initials(task.client)}</span>
          <div className={styles.taskText}>
            <div className={styles.taskNameRow}>
              <span className={`${styles.taskName} ${done ? styles.strike : ''}`}>{task.task_name || 'Untitled task'}</span>
              <span className={styles.prChip} style={{ color: pr.color, background: pr.soft }}>{task.priority}</span>
            </div>
            <div className={styles.taskClient}>{task.client || '—'}{task.task_type ? ` · ${task.task_type}` : ''}</div>
          </div>
        </div>
      </td>
      <td className={styles.narrowCol}><span className={styles.addedDate}>{task.assigned_on ? format(parseISO(task.assigned_on), 'dd MMM') : '—'}</span></td>
      <td className={styles.progCol}>
        <div className={styles.progWrap}>
          <div className={styles.progTrack}><div className={styles.progFill} style={{ width: `${meta.pct}%`, background: done ? '#2d8a56' : 'var(--primary)' }} /></div>
          <span className={styles.progPct}>{meta.pct}%</span>
        </div>
      </td>
      <td><AvatarStack value={task.assigned_to} empty="Unassigned" /></td>
      <td><AvatarStack value={task.account_manager} empty="None" /></td>
      <td>
        <div className={styles.dlCell}>
          <span className={`${styles.dlText} ${dl.tone === 'overdue' ? styles.dlOverdue : dl.tone === 'soon' ? styles.dlSoon : ''}`}>{dl.text}</span>
          {task.deadline_time && <span className={styles.dlTime}>{task.deadline_time}</span>}
        </div>
      </td>
      <td>
        <div className={styles.statusSelectWrap}>
          <span className={styles.statusDotText}><span className={styles.statusDot} style={{ background: meta.dot }} />{meta.label}</span>
          <select className={styles.hiddenSelect} value={task.status} onChange={e => onQuick({ status: e.target.value })}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
        </div>
      </td>
      <td className={styles.actionsCol}>
        <div className={styles.actions}>
          <button className={`${styles.iconBtn} ${styles.iconBtnPie}`} onClick={onAnalytics} title="View client analytics"><IconPie /></button>
          <button className={`${styles.iconBtn} ${expanded ? styles.iconBtnActive : ''}`} onClick={onEdit} title="Edit"><IconPencil /></button>
          <button className={styles.iconBtn} onClick={onDelete} title="Delete"><IconTrash /></button>
        </div>
      </td>
    </tr>
  )
})

function deadlineLabel(deadline, done) {
  if (!deadline) return { text: 'No deadline', tone: 'none' }
  const d = differenceInCalendarDays(parseISO(deadline), new Date())
  if (!done && d < 0) return { text: `${Math.abs(d)}d overdue`, tone: 'overdue' }
  if (d === 0) return { text: 'Today', tone: 'soon' }
  if (d === 1) return { text: 'Tomorrow', tone: 'soon' }
  if (!done && d <= 3) return { text: `In ${d} days`, tone: 'soon' }
  return { text: format(parseISO(deadline), 'dd MMM yyyy'), tone: 'normal' }
}

/* ============ EDIT / ADD PANEL ============ */
function EditPanel({ task, isAdd, draft, setDraft, designers, managers, timeOptions, remarkOptions, onSave, onCancel }) {
  const [local, setLocal] = useState(isAdd ? null : { ...task })
  const d = isAdd ? draft : local
  const setD = isAdd ? setDraft : setLocal
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value })
  const setVal = (k) => (v) => setD({ ...d, [k]: v })
  return (
    <tr className={styles.editRow}>
      <td colSpan="9">
        <datalist id="time-suggestions">{timeOptions.map(t => <option key={t} value={t} />)}</datalist>
        <datalist id="remark-suggestions">{remarkOptions.map(r => <option key={r} value={r} />)}</datalist>
        <div className={styles.editGrid}>
          <Field label="Task name"><input autoFocus={isAdd} placeholder={isAdd ? 'Required' : ''} value={d.task_name || ''} onChange={set('task_name')} /></Field>
          <Field label="Client"><input placeholder={isAdd ? 'Required' : ''} value={d.client || ''} onChange={set('client')} /></Field>
          <Field label="Type"><input value={d.task_type || ''} onChange={set('task_type')} /></Field>
          <Field label="Priority"><select value={d.priority || 'Medium'} onChange={set('priority')}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Designers (multiple)" wide><MultiPeople value={d.assigned_to} options={designers} onChange={setVal('assigned_to')} placeholder="Select one or more designers" /></Field>
          <Field label="Account Managers (multiple)" wide><MultiPeople value={d.account_manager} options={managers} onChange={setVal('account_manager')} placeholder="Select one or more managers" /></Field>
          <Field label="Status"><select value={d.status || 'Not Started'} onChange={set('status')}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Assigned on"><input type="date" value={d.assigned_on || ''} onChange={set('assigned_on')} /></Field>
          <Field label="Deadline date"><input type="date" value={d.deadline_date || ''} onChange={set('deadline_date')} /></Field>
          <Field label="Deadline time"><input list="time-suggestions" placeholder="Start typing…" value={d.deadline_time || ''} onChange={set('deadline_time')} /></Field>
          <Field label="Remarks" wide><input list="remark-suggestions" placeholder="Start typing…" value={d.remarks || ''} onChange={set('remarks')} /></Field>
        </div>
        <div className={styles.editActions}>
          <button className={styles.saveRowBtn} onClick={() => isAdd ? onSave() : onSave({
            task_name: d.task_name, client: d.client, task_type: d.task_type, account_manager: d.account_manager,
            assigned_to: d.assigned_to, priority: d.priority, status: d.status, assigned_on: d.assigned_on,
            deadline_date: d.deadline_date, deadline_time: d.deadline_time, remarks: d.remarks
          })}>{isAdd ? 'Add task' : 'Save changes'}</button>
          <button className={styles.cancelRowBtn} onClick={onCancel}>Cancel</button>
        </div>
      </td>
    </tr>
  )
}
function Field({ label, children, wide }) {
  return <label className={`${styles.field} ${wide ? styles.fieldWide : ''}`}><span className={styles.fieldLabel}>{label}</span>{children}</label>
}

/* ============ ICONS ============ */
function SearchIcon() { return <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> }
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> }
function IconFilter() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg> }
function IconUsers() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> }
function IconChevron() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg> }
function IconPencil() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg> }
function IconTrash() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg> }
function IconPie() {
  return (
    <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="none" stroke="var(--line)" strokeWidth="6" />
      <circle cx="16" cy="16" r="13" fill="none" stroke="var(--flame)" strokeWidth="6" strokeDasharray="27 82" strokeDashoffset="0" transform="rotate(-90 16 16)" />
      <circle cx="16" cy="16" r="13" fill="none" stroke="var(--amber)" strokeWidth="6" strokeDasharray="20 82" strokeDashoffset="-27" transform="rotate(-90 16 16)" />
      <circle cx="16" cy="16" r="13" fill="none" stroke="var(--gold)" strokeWidth="6" strokeDasharray="18 82" strokeDashoffset="-47" transform="rotate(-90 16 16)" />
    </svg>
  )
}
function IconCheck() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> }

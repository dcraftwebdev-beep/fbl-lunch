import React, { useMemo, useState } from 'react'
import styles from './TasksView.module.css'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, PolarAngleAxis, LabelList
} from 'recharts'
import { format, parseISO, startOfMonth } from 'date-fns'

const TODAY = new Date().toISOString().split('T')[0]
/* Firebrand global palette (values mirror src/styles/global.css) */
const T = {
  teal: '#ee6200',   /* flame — primary series / completed */
  mid: '#f59401',    /* amber — secondary / active */
  mint: '#fcca00',   /* gold — light context */
  mint2: '#fcca00',  /* gold */
  mint3: '#fef7dd',  /* gold-soft — lightest fill */
  ink: '#171412',    /* ink */
  slate: '#6b625a',  /* ink-soft — axis labels */
  muted: '#6b625a',  /* ink-soft */
  line: '#ece7dd',   /* line */
  pos: '#d9ac00',    /* gold-deep — positive delta */
  neg: '#df2429',    /* ember — alert / overdue */
  amber: '#ee6200',  /* flame — high priority */
}
const toList = (s) => (s || '').split(',').map(x => x.trim()).filter(Boolean)
const tip = { borderRadius: 10, border: '1px solid #ece7dd', fontFamily: 'var(--font-body)', fontSize: 12, boxShadow: '0 8px 24px -12px rgba(23,20,18,0.2)' }

export default function TasksAnalytics({ tasks = [], focus = null, onClearFocus }) {
  const [seg, setSeg] = useState('overview')

  if (focus) return <FocusView tasks={tasks} focus={focus} onClear={onClearFocus} />

  return (
    <div className={styles.aRoot}>
      <div className={styles.aHead}>
        <div>
          <h3 className={styles.aHeadTitle}>Task analytics</h3>
          <p className={styles.aHeadSub}>Performance across clients, designers and managers</p>
        </div>
        <div className={styles.aTabsBar}>
          {[['overview', 'Overview'], ['client', 'By client'], ['designer', 'By designer'], ['manager', 'By manager']].map(([v, l]) => (
            <button key={v} className={`${styles.aTab} ${seg === v ? styles.aTabActive : ''}`} onClick={() => setSeg(v)}>{l}</button>
          ))}
        </div>
      </div>
      {seg === 'overview' && <Overview tasks={tasks} />}
      {seg === 'client' && <Breakdown tasks={tasks} dim="client" title="Client" split={false} />}
      {seg === 'designer' && <Breakdown tasks={tasks} dim="assigned_to" title="Designer" split />}
      {seg === 'manager' && <Breakdown tasks={tasks} dim="account_manager" title="Account manager" split />}
    </div>
  )
}

/* ================= FOCUSED (single client/person) ================= */
function FocusView({ tasks, focus, onClear }) {
  const filtered = useMemo(() => tasks.filter(t => {
    if (focus.dim === 'client') return (t.client || 'Unassigned') === focus.value
    return toList(t[focus.dim]).includes(focus.value)
  }), [tasks, focus])

  return (
    <div className={styles.aRoot}>
      <div className={styles.focusHead}>
        <button className={styles.focusBack} onClick={onClear}>← All analytics</button>
        <div className={styles.focusTitleWrap}>
          <span className={styles.focusEyebrow}>{focus.title} analytics</span>
          <h3 className={styles.focusTitle}>{focus.value}</h3>
        </div>
        <span className={styles.focusCount}>{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
      </div>
      {filtered.length === 0 ? (
        <div className={styles.emptyState}><div className={styles.emptyTitle}>No tasks for {focus.value}</div><div>Nothing to analyze yet.</div></div>
      ) : (
        <Overview
          tasks={filtered}
          groupDim={focus.dim === 'client' ? 'assigned_to' : 'client'}
          groupTitle={focus.dim === 'client' ? 'Designer' : 'Client'}
          groupSplit={focus.dim === 'client'}
        />
      )}
    </div>
  )
}

/* ================= OVERVIEW ================= */
function Overview({ tasks, groupDim = 'client', groupTitle = 'Client', groupSplit = false }) {
  const s = useMemo(() => {
    let completed = 0, wip = 0, pending = 0, notStarted = 0, overdue = 0, dueToday = 0, onTime = 0, late = 0
    const priorityMap = { 'Urgent!': 0, High: 0, Medium: 0, Low: 0 }
    const groupMap = {}, monthMap = {}
    tasks.forEach(t => {
      const done = t.status === 'Completed'
      if (done) completed++; else if (t.status === 'WIP') wip++; else if (t.status === 'Approval pending') pending++; else notStarted++
      if (!done && t.deadline_date && t.deadline_date < TODAY) overdue++
      if (!done && t.deadline_date === TODAY) dueToday++
      if (priorityMap[t.priority] !== undefined) priorityMap[t.priority]++
      if (done && t.deadline_date) { if (t.deadline_date >= (t.assigned_on || TODAY)) onTime++; else late++ }
      const keys = groupSplit ? toList(t[groupDim]) : [t[groupDim] || 'Unassigned']
      ;(keys.length ? keys : ['Unassigned']).forEach(k => { groupMap[k] = (groupMap[k] || 0) + 1 })
      if (t.deadline_date) {
        const key = format(startOfMonth(parseISO(t.deadline_date)), 'yyyy-MM')
        if (!monthMap[key]) monthMap[key] = { key, label: format(parseISO(t.deadline_date), 'MMM'), Total: 0, Completed: 0 }
        monthMap[key].Total++
        if (done) monthMap[key].Completed++
      }
    })
    const total = tasks.length
    return {
      total, completed, active: total - completed, overdue, dueToday, wip, pending, notStarted,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
      onTimeRate: (onTime + late) ? Math.round((onTime / (onTime + late)) * 100) : 0,
      priorityData: Object.entries(priorityMap).map(([name, value]) => ({ name, value })),
      groupData: Object.entries(groupMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5),
      timeData: Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key)),
      statusData: [
        { name: 'Completed', value: completed, fill: T.teal },
        { name: 'In progress', value: wip + pending, fill: T.mid },
        { name: 'Not started', value: notStarted, fill: T.mint3 },
      ].filter(d => d.value > 0),
    }
  }, [tasks, groupDim, groupSplit])

  return (
    <>
      {/* KPI row */}
      <div className={styles.aKpiRow}>
        <AKpi label="Total tasks" value={s.total} sub={`${s.active} active`} pct={100} tone={T.teal} />
        <AKpi label="Completed" value={s.completed} delta={`${s.completionRate}%`} deltaPos sub="of all tasks" pct={s.completionRate} tone={T.teal} />
        <AKpi label="On-time rate" value={`${s.onTimeRate}%`} sub="of completed" pct={s.onTimeRate} tone={T.mid} />
        <AKpi label="Overdue" value={s.overdue} delta={s.overdue ? `${s.overdue}` : '0'} deltaPos={s.overdue === 0} sub={`${s.dueToday} due today`} pct={s.total ? Math.round(s.overdue / s.total * 100) : 0} tone={T.neg} alert={s.overdue > 0} />
      </div>

      {/* Middle row */}
      <div className={styles.aGrid3}>
        <Card title="Status mix">
          <div className={styles.vennWrap}>
            {s.statusData.map((d, i) => {
              const max = Math.max(...s.statusData.map(x => x.value), 1)
              const size = 64 + (d.value / max) * 64
              return (
                <div key={i} className={styles.vennCircle} style={{ width: size, height: size, background: d.fill, marginLeft: i ? -22 : 0, zIndex: 5 - i }}>
                  <span style={{ color: i === 2 ? T.ink : '#fff' }}>{d.value}</span>
                </div>
              )
            })}
          </div>
          <div className={styles.vennLegend}>
            {s.statusData.map((d, i) => <span key={i}><i style={{ background: d.fill }} />{d.name}</span>)}
          </div>
        </Card>

        <Card title="Priority load">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={s.priorityData} margin={{ top: 8, left: -18, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={T.line} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: T.muted }} />
              <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: T.muted }} />
              <Tooltip cursor={{ fill: '#faf3e2' }} contentStyle={tip} />
              <Bar dataKey="value" name="Tasks" radius={[4, 4, 0, 0]} barSize={26}>
                {s.priorityData.map((e, i) => <Cell key={i} fill={{ 'Urgent!': T.neg, High: T.amber, Medium: T.mid, Low: T.mint2 }[e.name]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <div className={styles.aPromo}>
          <div className={styles.aGauge}>
            <ResponsiveContainer width="100%" height={150}>
              <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ value: s.completionRate, fill: '#fff' }]} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar background={{ fill: 'rgba(255,255,255,0.22)' }} dataKey="value" cornerRadius={16} angleAxisId={0} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className={styles.aGaugeCenter}>{s.completionRate}%</div>
          </div>
          <div className={styles.aPromoText}>
            <strong>Completion rate</strong>
            <span>{s.completed} of {s.total} tasks delivered</span>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className={styles.aGrid2}>
        <Card title="Workload over time">
          <div className={styles.aTotals}>
            <div><span className={styles.aBig}>{s.total}</span><span className={styles.aBigLabel}>Total tasks</span></div>
            <div className={styles.aTotDivider} />
            <div><span className={styles.aBig} style={{ color: T.teal }}>{s.completed}</span><span className={styles.aBigLabel}>Completed</span></div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={s.timeData} margin={{ top: 8, left: -18, right: 8 }}>
              <defs>
                <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.teal} stopOpacity={0.18} /><stop offset="100%" stopColor={T.teal} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={T.line} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: T.muted }} />
              <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: T.muted }} />
              <Tooltip contentStyle={tip} />
              <Area type="monotone" dataKey="Total" stroke={T.mint} strokeWidth={2} fill="none" dot={false} />
              <Area type="monotone" dataKey="Completed" stroke={T.teal} strokeWidth={2.5} fill="url(#gTotal)" dot={{ r: 3, fill: T.teal }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title={`Tasks by ${groupTitle.toLowerCase()}`}>
          <div className={styles.aTotals}><span className={styles.aBig}>{s.total}</span><span className={styles.aBigLabel}>Across {s.groupData.length} top {groupTitle.toLowerCase()}s</span></div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={s.groupData} margin={{ top: 20, left: -18, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={T.line} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: T.muted }} />
              <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: T.muted }} />
              <Tooltip cursor={{ fill: '#faf3e2' }} contentStyle={tip} />
              <Bar dataKey="value" name="Tasks" fill={T.mint2} radius={[4, 4, 0, 0]} barSize={34}>
                <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: T.slate, fontWeight: 600 }} />
                {s.groupData.map((e, i) => <Cell key={i} fill={i === 0 ? T.teal : i === 1 ? T.mid : T.mint2} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </>
  )
}

/* ================= BREAKDOWN ================= */
function Breakdown({ tasks, dim, title, split }) {
  const rows = useMemo(() => {
    const map = {}
    tasks.forEach(t => {
      const keys = split ? toList(t[dim]) : [t[dim] || 'Unassigned']
      const list = keys.length ? keys : ['Unassigned']
      list.forEach(k => {
        if (!map[k]) map[k] = { name: k, Completed: 0, Active: 0, Overdue: 0, total: 0 }
        const done = t.status === 'Completed'
        map[k].total++
        if (done) map[k].Completed++
        else if (t.deadline_date && t.deadline_date < TODAY) map[k].Overdue++
        else map[k].Active++
      })
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [tasks, dim, split])

  if (rows.length === 0) return <div className={styles.emptyState}><div className={styles.emptyTitle}>No data yet</div><div>Add tasks to see {title.toLowerCase()} analytics.</div></div>

  const chartData = rows.slice(0, 10)
  const height = Math.max(240, chartData.length * 46)
  const totals = rows.reduce((a, r) => ({ t: a.t + r.total, c: a.c + r.Completed, o: a.o + r.Overdue }), { t: 0, c: 0, o: 0 })

  return (
    <>
      <div className={styles.aKpiRow}>
        <AKpi label={`${title}s`} value={rows.length} sub="tracked" pct={100} tone={T.teal} />
        <AKpi label="Total tasks" value={totals.t} sub="assigned" pct={100} tone={T.mid} />
        <AKpi label="Completed" value={totals.c} sub={`${totals.t ? Math.round(totals.c / totals.t * 100) : 0}% rate`} pct={totals.t ? Math.round(totals.c / totals.t * 100) : 0} tone={T.teal} />
        <AKpi label="Overdue" value={totals.o} sub="need attention" pct={totals.t ? Math.round(totals.o / totals.t * 100) : 0} tone={T.neg} alert={totals.o > 0} />
      </div>
      <div className={styles.aGrid2}>
        <Card title={`Workload by ${title.toLowerCase()}`}>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={T.line} />
              <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: T.muted }} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={110} tick={{ fontSize: 12, fill: T.slate }} />
              <Tooltip cursor={{ fill: '#faf3e2' }} contentStyle={tip} />
              <Bar dataKey="Completed" stackId="a" fill={T.teal} barSize={18} />
              <Bar dataKey="Active" stackId="a" fill={T.mint2} barSize={18} />
              <Bar dataKey="Overdue" stackId="a" fill={T.neg} radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title={`${title} leaderboard`}>
          <div className={styles.leaderList}>
            {rows.map((r, i) => {
              const rate = r.total ? Math.round((r.Completed / r.total) * 100) : 0
              return (
                <div key={r.name} className={styles.leaderRow}>
                  <span className={styles.leaderRank}>{i + 1}</span>
                  <div className={styles.leaderMain}>
                    <div className={styles.leaderTop}><span className={styles.leaderName}>{r.name}</span><span className={styles.leaderPct}>{rate}%</span></div>
                    <div className={styles.leaderBar}><div className={styles.leaderFill} style={{ width: `${rate}%` }} /></div>
                    <div className={styles.leaderMeta}>{r.total} tasks · {r.Completed} done{r.Overdue ? ` · ${r.Overdue} overdue` : ''}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </>
  )
}

/* ================= PARTS ================= */
function AKpi({ label, value, delta, deltaPos, sub, pct = 0, tone, alert }) {
  return (
    <div className={`${styles.aKpi} ${alert ? styles.aKpiAlert : ''}`}>
      <div className={styles.aKpiLabel}>{label}</div>
      <div className={styles.aKpiRowVal}>
        <span className={styles.aKpiValue}>{value}</span>
        {delta && <span className={`${styles.aKpiDelta} ${deltaPos ? styles.deltaPos : styles.deltaNeg}`}>{deltaPos ? '▲' : '▼'} {delta}</span>}
      </div>
      <div className={styles.aKpiSub}>{sub}</div>
      <div className={styles.aSpark}><div className={styles.aSparkFill} style={{ width: `${pct}%`, background: tone }} /></div>
    </div>
  )
}
function Card({ title, children }) {
  return <div className={styles.aCard}><div className={styles.aCardTitle}>{title}</div>{children}</div>
}

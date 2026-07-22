import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const isLive = Boolean(SUPABASE_URL && SUPABASE_KEY)
const supabase = isLive ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

const demoTasks = [
  { id: '1', client: 'Relia', account_manager: 'Ritika', task_name: 'Internal branding - Blood donation center', task_type: 'Reception room', assigned_to: 'Lazzo', assigned_on: '2026-06-01', priority: 'High', deadline_date: new Date().toISOString().split('T')[0], deadline_time: '6:00 PM', status: 'Completed', remarks: '' },
  { id: '2', client: 'CPL', account_manager: 'Dipak', task_name: 'Wellness package post', task_type: 'Carousel', assigned_to: 'Lazzo', assigned_on: '2026-06-03', priority: 'Urgent!', deadline_date: '2026-07-25', deadline_time: '8:00 PM', status: 'WIP', remarks: '' }
]

const demoMembers = [
  { id: '1', name: 'Ritika', role: 'Account Manager' },
  { id: '2', name: 'Dipak', role: 'Account Manager' },
  { id: '3', name: 'Dhenuka', role: 'Account Manager' },
  { id: '4', name: 'Lazzo', role: 'Designer' },
  { id: '5', name: 'Catherine', role: 'Designer' },
  { id: '6', name: 'Srinithi', role: 'Designer' },
  { id: '7', name: 'Ajay', role: 'Designer' }
]

export function useTasks() {
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [groupTitles, setGroupTitles] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (isLive) {
        const [tasksRes, membersRes, titlesRes] = await Promise.all([
          supabase.from('daily_tasks').select('*').order('deadline_date', { ascending: true }),
          supabase.from('task_team_members').select('*'),
          supabase.from('task_group_titles').select('*')
        ])
        
        if (tasksRes.error) throw tasksRes.error
        if (membersRes.error) throw membersRes.error
        if (titlesRes.error) throw titlesRes.error

        setTasks(tasksRes.data || [])
        setMembers(membersRes.data || [])
        
        const titlesObj = {}
        ;(titlesRes.data || []).forEach(t => {
          titlesObj[t.week_key] = t.custom_title
        })
        setGroupTitles(titlesObj)
      } else {
        const localTasks = JSON.parse(localStorage.getItem('fbl_daily_tasks'))
        if (localTasks) setTasks(localTasks)
        else {
          setTasks(demoTasks)
          localStorage.setItem('fbl_daily_tasks', JSON.stringify(demoTasks))
        }

        const localMembers = JSON.parse(localStorage.getItem('fbl_task_members'))
        if (localMembers) setMembers(localMembers)
        else {
          setMembers(demoMembers)
          localStorage.setItem('fbl_task_members', JSON.stringify(demoMembers))
        }

        const localTitles = JSON.parse(localStorage.getItem('fbl_group_titles'))
        if (localTitles) setGroupTitles(localTitles)
        else setGroupTitles({})
      }
      setError(null)
    } catch (err) {
      console.error(err)
      setError('Could not fetch data. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const addTask = async (newTask) => {
    try {
      if (isLive) {
        const { data, error } = await supabase.from('daily_tasks').insert([newTask]).select().single()
        if (error) throw error
        setTasks((prev) => [...prev, data])
        return data
      } else {
        const localTask = { ...newTask, id: Date.now().toString() }
        const updatedTasks = [...tasks, localTask]
        setTasks(updatedTasks)
        localStorage.setItem('fbl_daily_tasks', JSON.stringify(updatedTasks))
        return localTask
      }
    } catch (err) {
      console.error(err)
      throw new Error('Failed to add task')
    }
  }

  const updateTask = async (id, updates) => {
    try {
      if (isLive) {
        const { error } = await supabase.from('daily_tasks').update(updates).eq('id', id)
        if (error) throw error
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)))
      } else {
        const updatedTasks = tasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
        setTasks(updatedTasks)
        localStorage.setItem('fbl_daily_tasks', JSON.stringify(updatedTasks))
      }
    } catch (err) {
      console.error(err)
      throw new Error('Failed to update task')
    }
  }

  const addMember = async (name, role) => {
    const clean = (name || '').trim()
    if (!clean) throw new Error('Name is required')
    try {
      if (isLive) {
        const { data, error } = await supabase.from('task_team_members').insert([{ name: clean, role }]).select().single()
        if (error) throw error
        setMembers((prev) => [...prev, data])
        return data
      } else {
        const localMember = { id: Date.now().toString(), name: clean, role }
        const updated = [...members, localMember]
        setMembers(updated)
        localStorage.setItem('fbl_task_members', JSON.stringify(updated))
        return localMember
      }
    } catch (err) {
      console.error(err)
      throw new Error('Failed to add member')
    }
  }

  const deleteMember = async (id) => {
    try {
      if (isLive) {
        const { error } = await supabase.from('task_team_members').delete().eq('id', id)
        if (error) throw error
        setMembers((prev) => prev.filter((m) => m.id !== id))
      } else {
        const updated = members.filter((m) => m.id !== id)
        setMembers(updated)
        localStorage.setItem('fbl_task_members', JSON.stringify(updated))
      }
    } catch (err) {
      console.error(err)
      throw new Error('Failed to remove member')
    }
  }

  const deleteTask = async (id) => {
    try {
      if (isLive) {
        const { error } = await supabase.from('daily_tasks').delete().eq('id', id)
        if (error) throw error
        setTasks((prev) => prev.filter((t) => t.id !== id))
      } else {
        const updatedTasks = tasks.filter((t) => t.id !== id)
        setTasks(updatedTasks)
        localStorage.setItem('fbl_daily_tasks', JSON.stringify(updatedTasks))
      }
    } catch (err) {
      console.error(err)
      throw new Error('Failed to delete task')
    }
  }

  const updateGroupTitle = async (weekKey, newTitle) => {
    try {
      if (isLive) {
        const { error } = await supabase
          .from('task_group_titles')
          .upsert({ week_key: weekKey, custom_title: newTitle })
        if (error) throw error
      }
      
      const newTitles = { ...groupTitles, [weekKey]: newTitle }
      setGroupTitles(newTitles)
      if (!isLive) localStorage.setItem('fbl_group_titles', JSON.stringify(newTitles))
    } catch (err) {
      console.error(err)
      throw new Error('Failed to update title')
    }
  }

  return { tasks, members, groupTitles, loading, error, addTask, updateTask, deleteTask, addMember, deleteMember, updateGroupTitle, refresh: fetchData, isLive }
}

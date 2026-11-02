
import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

const starterTasks = [
  { id: 1, title: 'Morning study session', category: 'Study', time: '07:00', done: false },
  { id: 2, title: 'Complete daily workout', category: 'Gym', time: '17:00', done: false },
  { id: 3, title: 'Review today’s lessons', category: 'Study', time: '19:00', done: false },
]

const durations = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
  free: 0,
}

const timerLabels = {
  focus: 'Focus Session',
  short: 'Short Rest',
  long: 'Extended Rest',
  free: 'Open Timer',
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function formatScheduleTime(time) {
  if (!time) return ''

  const [hours, minutes] = time.split(':')
  const hour = Number(hours)
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12

  return `${String(displayHour).padStart(2, '0')}:${minutes} ${period}`
}

function getDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : fallback
  } catch {
    return fallback
  }
}

function App() {
  // Authentication
  const [user, setUser] = useState(null)
  const [cloudDataLoaded, setCloudDataLoaded] = useState(false)
  const [cloudDataUserId, setCloudDataUserId] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  useEffect(() => {
    let mounted = true

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error) {
        setAuthMessage(error.message)
      }

      setUser(data?.session?.user ?? null)
      setAuthLoading(false)
    }

    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null)
        setAuthLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthMessage('')

    if (!authEmail.trim() || !authPassword) {
      setAuthMessage('Please enter your email and password.')
      return
    }

    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
      })

      if (error) {
        setAuthMessage(error.message)
        return
      }

      if (data.session) {
        setAuthMessage('Account created successfully!')
      } else {
        setAuthMessage('Account created! Please check your email to confirm it.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      })

      if (error) {
        setAuthMessage(error.message)
      }
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setAuthMessage(error.message)
    }
  }

  // General app state
  const [activePage, setActivePage] = useState('My Day')
  const [currentDateTime, setCurrentDateTime] = useState(new Date())

  // Tasks
  const [tasks, setTasks] = useState(() =>
    readStorage('luwang-tasks', starterTasks)
  )
  const [newTask, setNewTask] = useState('')
  const [category, setCategory] = useState('Study')
  const [time, setTime] = useState('')

  // Schedule and calendar
  const [schedule, setSchedule] = useState(() =>
    readStorage('luwang-schedule', [])
  )
  const [scheduleTitle, setScheduleTitle] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleEndTime, setScheduleEndTime] = useState('')
  const [selectedDate, setSelectedDate] = useState(() =>
    getDateKey(new Date())
  )
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [scheduleDate, setScheduleDate] = useState(() =>
    getDateKey(new Date())
  )

  // Activity and timer
  const [activityLog, setActivityLog] = useState(() =>
    readStorage('luwangActivityLog', [])
  )
  const [timerMode, setTimerMode] = useState('focus')
  const [secondsLeft, setSecondsLeft] = useState(durations.focus)
  const [timerRunning, setTimerRunning] = useState(false)
  const [savedSessionSeconds, setSavedSessionSeconds] = useState(0)
  const [focusSessions, setFocusSessions] = useState(0)

  // Workouts
  const [workouts, setWorkouts] = useState(() =>
    readStorage('luwang-workouts', [])
  )
  const [exerciseName, setExerciseName] = useState('')
  const [exerciseSets, setExerciseSets] = useState('3')
  const [exerciseReps, setExerciseReps] = useState('10')
  const [exerciseWeight, setExerciseWeight] = useState('')

  // Angee
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'ai',
      text: "Hey! I'm Angee. I'm here to help you plan your day. ✨",
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatMessagesRef = useRef(null)

  // Load the logged-in user's cloud data
  useEffect(() => {
    if (!user) {
      setCloudDataLoaded(false)
      setCloudDataUserId(null)
      return
    }

    let cancelled = false

    async function loadCloudData() {
      setCloudDataLoaded(false)
      setCloudDataUserId(null)

      const { data, error } = await supabase
        .from('luwang_data')
        .select('data_type, content')
        .eq('user_id', user.id)

      if (error) {
        console.error('Cloud loading error:', error.message)
        if (!cancelled) {
          setAuthMessage('Could not load your cloud data: ' + error.message)
        }
        return
      }

      if (cancelled) return

      const saved = Object.fromEntries(
        (data || []).map(item => [item.data_type, item.content])
      )

      const dataTypes = ['tasks', 'schedule', 'activityLog', 'workouts']
      const hasLegacyMigration = localStorage.getItem('luwang-legacy-migrated')
      const updates = []

      for (const type of dataTypes) {
        if (saved[type] !== undefined) continue

        let content = []

        if (!hasLegacyMigration) {
          const storageKey = {
            tasks: 'luwang-tasks',
            schedule: 'luwang-schedule',
            activityLog: 'luwangActivityLog',
            workouts: 'luwang-workouts',
          }[type]

          try {
            const localValue = localStorage.getItem(storageKey)

            if (localValue !== null) {
              content = JSON.parse(localValue)
            } else if (type === 'tasks') {
              content = starterTasks
            }
          } catch {
            content = type === 'tasks' ? starterTasks : []
          }
        } else if (type === 'tasks') {
          content = starterTasks
        }

        updates.push({
          user_id: user.id,
          data_type: type,
          content,
        })

        saved[type] = content
      }

      if (updates.length > 0) {
        const { error: saveError } = await supabase
          .from('luwang_data')
          .upsert(updates, { onConflict: 'user_id,data_type' })

        if (saveError) {
          console.error('Migration error:', saveError.message)
          if (!cancelled) {
            setAuthMessage('Could not save your existing data: ' + saveError.message)
          }
          return
        }
      }

      if (cancelled) return

      if (!hasLegacyMigration) {
        localStorage.setItem('luwang-legacy-migrated', 'true')
      }

      setTasks(saved.tasks ?? starterTasks)
      setSchedule(saved.schedule ?? [])
      setActivityLog(saved.activityLog ?? [])
      setWorkouts(saved.workouts ?? [])

      setCloudDataUserId(user.id)
      setCloudDataLoaded(true)
    }

    loadCloudData()

    return () => {
      cancelled = true
    }
  }, [user])

  // Save data locally
  useEffect(() => {
    localStorage.setItem('luwang-tasks', JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    localStorage.setItem('luwang-schedule', JSON.stringify(schedule))
  }, [schedule])

  useEffect(() => {
    localStorage.setItem('luwangActivityLog', JSON.stringify(activityLog))
  }, [activityLog])

  useEffect(() => {
    localStorage.setItem('luwang-workouts', JSON.stringify(workouts))
  }, [workouts])

  // Save data to the logged-in user's cloud account
  useEffect(() => {
    if (!user || !cloudDataLoaded || cloudDataUserId !== user.id) return

    let cancelled = false

    async function saveCloudData() {
      const records = [
        { data_type: 'tasks', content: tasks },
        { data_type: 'schedule', content: schedule },
        { data_type: 'activityLog', content: activityLog },
        { data_type: 'workouts', content: workouts },
      ].map(item => ({
        user_id: user.id,
        ...item,
        updated_at: new Date().toISOString(),
      }))

      const { error } = await supabase
        .from('luwang_data')
        .upsert(records, { onConflict: 'user_id,data_type' })

      if (cancelled) return

      if (error) {
        console.error('Cloud save error:', error.message)
        setAuthMessage('Cloud save failed: ' + error.message)
      }
    }

    saveCloudData()

    return () => {
      cancelled = true
    }
  }, [user, cloudDataLoaded, cloudDataUserId, tasks, schedule, activityLog, workouts])

  // Live clock
  useEffect(() => {
    const clock = setInterval(() => {
      setCurrentDateTime(new Date())
    }, 1000)

    return () => clearInterval(clock)
  }, [])

  // Keep Angee chat scrolled to the latest message
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTo({
        top: chatMessagesRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [chatMessages, isTyping])

  // Task management
  function addTask(event) {
    event.preventDefault()
    if (!newTask.trim()) return

    setTasks(previous => [
      ...previous,
      {
        id: Date.now(),
        title: newTask.trim(),
        category,
        time,
        done: false,
      },
    ])

    setNewTask('')
    setTime('')
  }

  function toggleTask(id) {
    setTasks(previous =>
      previous.map(task =>
        task.id === id ? { ...task, done: !task.done } : task
      )
    )
  }

  function deleteTask(id) {
    setTasks(previous => previous.filter(task => task.id !== id))
  }

  // Schedule management
  function addScheduleItem(event) {
    event.preventDefault()

    if (
      !scheduleTitle.trim() ||
      !scheduleDate ||
      !scheduleTime ||
      !scheduleEndTime
    ) {
      return
    }

    if (scheduleEndTime <= scheduleTime) {
      alert('End time must be later than start time.')
      return
    }

    setSchedule(previous => [
      ...previous,
      {
        id: Date.now(),
        title: scheduleTitle.trim(),
        date: scheduleDate,
        time: scheduleTime,
        endTime: scheduleEndTime,
        done: false,
      },
    ])

    setScheduleTitle('')
    setScheduleTime('')
    setScheduleEndTime('')
    setSelectedDate(scheduleDate)
  }

  function toggleScheduleItem(id) {
    setSchedule(previous =>
      previous.map(item =>
        item.id === id
          ? {
              ...item,
              done: !item.done,
              completedAt: !item.done ? new Date().toISOString() : null,
            }
          : item
      )
    )
  }

  // Study session history
  function saveActivity(type, seconds) {
    if (seconds <= 0) return

    const now = new Date()

    setActivityLog(previous => [
      ...previous,
      {
        id: Date.now(),
        type,
        seconds,
        date: now.toLocaleDateString(),
        dateISO: now.toISOString(),
        time: now.toLocaleTimeString(),
      },
    ])
  }

  function getElapsedSeconds() {
    return timerMode === 'free'
      ? secondsLeft
      : durations[timerMode] - secondsLeft
  }

  function saveCurrentSession() {
    const totalElapsed = getElapsedSeconds()
    const newSeconds = totalElapsed - savedSessionSeconds

    const activityType =
      timerMode === 'focus' || timerMode === 'free'
        ? 'study'
        : 'rest'

    if (newSeconds > 0) {
      saveActivity(activityType, newSeconds)
      setSavedSessionSeconds(totalElapsed)
    }
  }

  function changeTimerMode(mode) {
    if (mode === timerMode) return

    if (timerRunning) {
      saveCurrentSession()
    }

    setTimerRunning(false)
    setTimerMode(mode)
    setSecondsLeft(durations[mode])
    setSavedSessionSeconds(0)
  }

  function resetTimer() {
    setTimerRunning(false)
    setSecondsLeft(durations[timerMode])
    setSavedSessionSeconds(0)
  }

  function toggleTimer() {
    if (timerRunning) {
      saveCurrentSession()
      setTimerRunning(false)
    } else {
      setTimerRunning(true)
    }
  }

  // Timer countdown and open timer
  useEffect(() => {
    if (!timerRunning) return

    const interval = setInterval(() => {
      setSecondsLeft(seconds =>
        timerMode === 'free'
          ? seconds + 1
          : Math.max(0, seconds - 1)
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [timerRunning, timerMode])

  // Automatically handle completed focus and break sessions
  useEffect(() => {
    if (secondsLeft !== 0 || !timerRunning || timerMode === 'free') return

    saveCurrentSession()
    setTimerRunning(false)
    setSavedSessionSeconds(0)

    if (timerMode === 'focus') {
      const completed = focusSessions + 1
      setFocusSessions(completed)

      const nextMode = completed % 4 === 0 ? 'long' : 'short'
      setTimerMode(nextMode)
      setSecondsLeft(durations[nextMode])
    } else {
      setTimerMode('focus')
      setSecondsLeft(durations.focus)
    }
  }, [secondsLeft, timerRunning, timerMode, focusSessions])

  // Workout management
  function addWorkout(event) {
    event.preventDefault()
    if (!exerciseName.trim()) return

    const newWorkout = {
      id: Date.now(),
      name: exerciseName.trim(),
      sets: Number(exerciseSets),
      reps: Number(exerciseReps),
      weight: Number(exerciseWeight) || 0,
      date: new Date().toLocaleDateString(),
      completed: false,
    }

    setWorkouts(previous => [...previous, newWorkout])

    setExerciseName('')
    setExerciseSets('3')
    setExerciseReps('10')
    setExerciseWeight('')
  }

  function toggleWorkout(id) {
    setWorkouts(previous =>
      previous.map(workout =>
        workout.id === id
          ? {
              ...workout,
              completed: !workout.completed,
              completedAt: !workout.completed ? new Date().toISOString() : null,
            }
          : workout
      )
    )
  }

  function deleteWorkout(id) {
    setWorkouts(previous =>
      previous.filter(workout => workout.id !== id)
    )
  }

  // Progress calculations
  const completed = tasks.filter(task => task.done).length
  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0

  const completedWorkouts = workouts.filter(workout => workout.completed)
  const totalWorkouts = completedWorkouts.length
  const totalExercises = workouts.length

  const workoutDateKey = date => getDateKey(date)

  const workoutDays = new Set(
    completedWorkouts
      .filter(workout => workout.completedAt)
      .map(workout => workoutDateKey(new Date(workout.completedAt)))
  )

  let workoutStreak = 0
  const workoutStreakDate = new Date()

  while (workoutDays.has(workoutDateKey(workoutStreakDate))) {
    workoutStreak++
    workoutStreakDate.setDate(workoutStreakDate.getDate() - 1)
  }

  const weekStart = new Date()
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())

  const weeklyWorkouts = completedWorkouts.filter(workout => {
    if (!workout.completedAt) return false
    return new Date(workout.completedAt) >= weekStart
  }).length

  const workoutChartData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const dateKey = workoutDateKey(date)

    const count = completedWorkouts.filter(workout =>
      workout.completedAt &&
      workoutDateKey(new Date(workout.completedAt)) === dateKey
    ).length

    return {
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      count,
    }
  })

  const weeklyStudySeconds = activityLog.reduce((total, record) => {
    if (record.type !== 'study' || !record.dateISO) return total

    const recordDate = new Date(record.dateISO)
    return recordDate >= weekStart && recordDate <= new Date()
      ? total + record.seconds
      : total
  }, 0)

  const weeklyCompletedActivities = schedule.filter(item => {
    if (!item.done || !item.completedAt) return false

    const completedDate = new Date(item.completedAt)
    return completedDate >= weekStart && completedDate <= new Date()
  }).length

  const activeDays = new Set([
    ...activityLog
      .filter(record => record.type === 'study' && record.dateISO)
      .map(record => getDateKey(new Date(record.dateISO))),

    ...schedule
      .filter(item => item.done && item.completedAt)
      .map(item => getDateKey(new Date(item.completedAt))),
  ])

  let currentStreak = 0
  const streakDate = new Date()

  while (activeDays.has(getDateKey(streakDate))) {
    currentStreak++
    streakDate.setDate(streakDate.getDate() - 1)
  }

  // Angee assistant
  function sendMessage(event) {
    event.preventDefault()

    if (!chatInput.trim() || isTyping) return

    const userMessage = chatInput.trim()
    const message = userMessage.toLowerCase()

    setChatMessages(previous => [
      ...previous,
      { role: 'user', text: userMessage },
    ])

    setChatInput('')

    let aiReply = "I'm listening! Tell me more about what you need. 💜"

    if (message.includes('hello') || message.includes('hi')) {
      aiReply = "Hey bro! 👋 What are we working on today?"
    } else if (message.includes('study')) {
      aiReply = "📚 Let's get focused! Try a 25-minute focus session, followed by a 5-minute rest."
    } else if (
      message.includes('workout') ||
      message.includes('gym') ||
      message.includes('exercise')
    ) {
      aiReply = `💪 You've completed ${totalWorkouts} exercises out of ${totalExercises}. Your current workout streak is ${workoutStreak} days. Keep going!`
    } else if (message.includes('plan my day')) {
      aiReply = "✨ Start with your most important task, then make room for study, exercise and rest. Small consistent steps make a difference."
    } else if (message.includes('motivate') || message.includes('motivation')) {
      aiReply = "🌟 You don't need to do everything today. Just take the next small step. Progress is progress!"
    }

    setIsTyping(true)

    setTimeout(() => {
      setChatMessages(previous => [
        ...previous,
        { role: 'ai', text: aiReply },
      ])
      setIsTyping(false)
    }, 1000)
  }

  // Selected date's schedule
  const sortedSchedule = schedule
    .filter(item => (item.date || getDateKey(new Date())) === selectedDate)
    .slice()
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  // Calendar days
  const calendarDays = []

  const firstDay = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1
  ).getDay()

  const daysInMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    0
  ).getDate()

  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(
      new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth(),
        day
      )
    )
  }

  function changeCalendarMonth(offset) {
    const newMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + offset,
      1
    )

    const newDate = getDateKey(newMonth)

    setCalendarMonth(newMonth)
    setSelectedDate(newDate)
    setScheduleDate(newDate)
  }

  // Loading screens
  if (authLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        Loading Luwang...
      </div>
    )
  }

  if (user && (!cloudDataLoaded || cloudDataUserId !== user.id)) {
    return (
      <div className="loading-screen">
        <h2>Loading your Luwang...</h2>
        <p>Preparing your private workspace ☁️</p>
      </div>
    )
  }

  // Login or signup
  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        background: '#111827',
        color: 'white',
        fontFamily: 'sans-serif',
      }}>
        <form onSubmit={handleAuthSubmit} style={{
          width: '100%',
          maxWidth: 380,
          padding: 30,
          borderRadius: 20,
          background: '#1f2937',
          boxSizing: 'border-box',
        }}>
          <h1 style={{ textAlign: 'center' }}>Luwang</h1>
          <p style={{ textAlign: 'center', color: '#9ca3af' }}>
            Your personal productivity space
          </p>

          <h2 style={{ textAlign: 'center' }}>
            {authMode === 'login' ? 'Welcome Back!' : 'Create Account'}
          </h2>

          <input
            type="email"
            placeholder="Email address"
            value={authEmail}
            onChange={event => setAuthEmail(event.target.value)}
            required
            style={{
              width: '100%',
              padding: 14,
              marginBottom: 15,
              boxSizing: 'border-box',
              borderRadius: 10,
              border: '1px solid #4b5563',
            }}
          />

          <input
            type="password"
            placeholder="Password (minimum 6 characters)"
            value={authPassword}
            onChange={event => setAuthPassword(event.target.value)}
            required
            minLength={6}
            style={{
              width: '100%',
              padding: 14,
              marginBottom: 15,
              boxSizing: 'border-box',
              borderRadius: 10,
              border: '1px solid #4b5563',
            }}
          />

          <button type="submit" style={{
            width: '100%',
            padding: 14,
            border: 'none',
            borderRadius: 10,
            background: '#8b5cf6',
            color: 'white',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}>
            {authMode === 'login' ? 'Log In' : 'Sign Up'}
          </button>

          {authMessage && (
            <p style={{ textAlign: 'center', color: '#fbbf24' }}>
              {authMessage}
            </p>
          )}

          <p style={{ textAlign: 'center', marginTop: 20 }}>
            {authMode === 'login'
              ? "Don't have an account?"
              : 'Already have an account?'}
          </p>

          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'signup' : 'login')
              setAuthMessage('')
            }}
            style={{
              width: '100%',
              padding: 10,
              background: 'transparent',
              border: 'none',
              color: '#a78bfa',
              cursor: 'pointer',
            }}
          >
            {authMode === 'login' ? 'Create an account' : 'Log in instead'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">L</div>
          <span>Luwang</span>
        </div>

        <p className="nav-heading">WORKSPACE</p>

        <button
          className={`nav-item ${activePage === 'My Day' ? 'active' : ''}`}
          onClick={() => setActivePage('My Day')}
        >
          ◫ <span>My Day</span>
        </button>

        <button
          className={`nav-item ${activePage === 'My Schedule' ? 'active' : ''}`}
          onClick={() => setActivePage('My Schedule')}
        >
          ▦ <span>Schedule</span>
        </button>

        <button
          className={`nav-item ${activePage === 'Study & Fitness' ? 'active' : ''}`}
          onClick={() => setActivePage('Study & Fitness')}
        >
          ◷ <span>Study & Fitness</span>
        </button>

        <button
          className={`nav-item ${activePage === 'Angee' ? 'active' : ''}`}
          onClick={() => setActivePage('Angee')}
        >
          ✦ <span>Angee</span>
        </button>

        <div className="sidebar-bottom">
          <div className="mini-avatar">L</div>
          <div>
            <strong>My Luwang</strong>
            <small>Personal workspace</small>
          </div>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div className="live-clock">
            <h2>
              {currentDateTime.toLocaleDateString('en-US', {
                weekday: 'long',
              })}
            </h2>
            <p>
              {currentDateTime.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <h1>
              {currentDateTime.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
              })}
            </h1>
          </div>

          <span className="status-pill">
            <i /> Your day, your goals
          </span>

          <button
            onClick={handleLogout}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: '1px solid #ef4444',
              background: 'transparent',
              color: '#ef4444',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Log Out
          </button>
        </header>

        {/* MY DAY */}
        {activePage === 'My Day' && (
          <>
            <section className="welcome">
              <div>
                <p className="eyebrow">YOUR PERSONAL SPACE</p>
                <h1>Make today <span>count.</span></h1>
                <p className="subtitle">
                  Small steps every day lead to meaningful progress.
                </p>
              </div>
              <div className="welcome-symbol">✦</div>
            </section>

            <section className="stats-grid">
              <div className="stat-card">
                <span className="stat-icon purple">◷</span>
                <p>Planned Tasks</p>
                <h2>{tasks.length}</h2>
                <small>Total tasks for today</small>
              </div>

              <div className="stat-card">
                <span className="stat-icon green">✓</span>
                <p>Completed Tasks</p>
                <h2>{completed}</h2>
                <small>Tasks successfully finished</small>
              </div>

              <div className="stat-card">
                <span className="stat-icon orange">↗</span>
                <p>Daily Completion</p>
                <h2>{progress}%</h2>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </section>

            <section className="tasks-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">DAILY PRIORITIES</p>
                  <h2>Today's Priorities</h2>
                </div>
                <span className="task-count">
                  {completed} / {tasks.length} completed
                </span>
              </div>

              <form className="add-task-form" onSubmit={addTask}>
                <input
                  value={newTask}
                  onChange={event => setNewTask(event.target.value)}
                  placeholder="Enter a task or priority..."
                  aria-label="New task"
                />

                <select
                  value={category}
                  onChange={event => setCategory(event.target.value)}
                  aria-label="Task category"
                >
                  <option>Study</option>
                  <option>Gym</option>
                  <option>Personal</option>
                </select>

                <input
                  type="time"
                  value={time}
                  onChange={event => setTime(event.target.value)}
                  aria-label="Task time"
                />

                <button type="submit">+ Add Task</button>
              </form>

              <div className="task-list">
                {tasks.length === 0 && (
                  <p className="empty-state">
                    Your task list is clear. Add a priority to get started.
                  </p>
                )}

                {tasks.map(task => (
                  <div
                    className={`task-row ${task.done ? 'task-done' : ''}`}
                    key={task.id}
                  >
                    <button
                      className={`check-button ${task.done ? 'checked' : ''}`}
                      onClick={() => toggleTask(task.id)}
                      aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {task.done ? '✓' : ''}
                    </button>

                    <div className="task-info">
                      <strong>{task.title}</strong>
                      <small>
                        {task.category}{task.time ? ` · ${task.time}` : ''}
                      </small>
                    </div>

                    <button
                      className="delete-button"
                      onClick={() => deleteTask(task.id)}
                      aria-label="Delete task"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="activity-card">
              <p className="eyebrow">PERFORMANCE OVERVIEW</p>
              <h2>Weekly Overview</h2>

              <div className="activity-item">
                <strong>🔥 Current Study Streak</strong>
                <strong>{currentStreak} {currentStreak === 1 ? 'day' : 'days'}</strong>
              </div>

              <div className="activity-item">
                <strong>📚 Total Study Time</strong>
                <strong>
                  {Math.floor(weeklyStudySeconds / 3600)}h{' '}
                  {Math.floor((weeklyStudySeconds % 3600) / 60)}m
                </strong>
              </div>

              <div className="activity-item">
                <strong>✓ Activities Completed</strong>
                <strong>{weeklyCompletedActivities}</strong>
              </div>
            </section>

            <section className="ai-card">
              <div className="ai-icon">✦</div>
              <div>
                <p className="eyebrow">YOUR PERSONAL ASSISTANT</p>
                <h2>Meet Angee</h2>
                <p>
                  Your personal planning assistant is taking shape.
                  Angee will help you organise your goals and structure your day.
                </p>
              </div>
              <span className="coming-soon">In Development</span>
            </section>
          </>
        )}

        {/* SCHEDULE */}
        {activePage === 'My Schedule' && (
          <section className="schedule-card">
            <p className="eyebrow">DAILY PLANNING</p>
            <h2>My Schedule</h2>

            <div className="calendar-header">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => changeCalendarMonth(-1)}
              >
                ←
              </button>

              <div className="calendar-month-title">
                {selectedDate === getDateKey(new Date()) && (
                  <span className="calendar-today-label">Today</span>
                )}

                <h3>
                  {calendarMonth.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
              </div>

              <button
                type="button"
                aria-label="Next month"
                onClick={() => changeCalendarMonth(1)}
              >
                →
              </button>
            </div>

            <div className="calendar-grid">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div className="calendar-weekday" key={day}>
                  {day}
                </div>
              ))}

              {calendarDays.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} />
                }

                const dateKey = getDateKey(date)
                const hasActivity = schedule.some(
                  item => (item.date || getDateKey(new Date())) === dateKey
                )

                return (
                  <button
                    type="button"
                    key={dateKey}
                    className={`calendar-day ${selectedDate === dateKey ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedDate(dateKey)
                      setScheduleDate(dateKey)
                    }}
                  >
                    <span>{date.getDate()}</span>
                    {hasActivity && <span className="calendar-dot" />}
                  </button>
                )
              })}
            </div>

            <p className="section-description">
              Organise your day with a clear timeline of activities.
            </p>

            <form onSubmit={addScheduleItem} className="schedule-form">
              <input
                type="text"
                placeholder="Activity title"
                value={scheduleTitle}
                onChange={event => setScheduleTitle(event.target.value)}
                aria-label="Activity title"
                required
              />

              <input
                type="date"
                value={scheduleDate}
                onChange={event => {
                  const date = event.target.value
                  setScheduleDate(date)
                  setSelectedDate(date)

                  if (date) {
                    const chosenDate = new Date(`${date}T00:00:00`)
                    setCalendarMonth(
                      new Date(
                        chosenDate.getFullYear(),
                        chosenDate.getMonth(),
                        1
                      )
                    )
                  }
                }}
                aria-label="Schedule date"
                required
              />

              <input
                type="time"
                value={scheduleTime}
                onChange={event => setScheduleTime(event.target.value)}
                aria-label="Starting time"
                required
              />

              <input
                type="time"
                value={scheduleEndTime}
                onChange={event => setScheduleEndTime(event.target.value)}
                aria-label="Ending time"
                required
              />

              <button type="submit">+ Add to Schedule</button>
            </form>

            <div className="schedule-list">
              <div className="selected-date-heading">
                <h3>
                  {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
                    'en-US',
                    {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }
                  )}
                </h3>
              </div>

              {sortedSchedule.length === 0 ? (
                <p className="empty-state">
                  No activities scheduled yet. Add your first activity above.
                </p>
              ) : (
                sortedSchedule.map(item => (
                  <div
                    className={`schedule-item ${item.done ? 'schedule-done' : ''}`}
                    key={item.id}
                  >
                    <strong>
                      {formatScheduleTime(item.time)} – {formatScheduleTime(item.endTime || item.time)}
                    </strong>
                    <span>{item.title}</span>
                    <button onClick={() => toggleScheduleItem(item.id)}>
                      {item.done ? 'Undo' : 'Complete'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* STUDY AND FITNESS */}
        {activePage === 'Study & Fitness' && (
          <>
            <section className="timer-card">
              <div className="timer-heading">
                <div>
                  <p className="eyebrow">FOCUS & RECOVERY</p>
                  <h2>Focus Sessions</h2>
                  <p className="timer-description">
                    Work with intention. Take breaks. Stay consistent.
                  </p>
                </div>
                <div className="timer-symbol">◷</div>
              </div>

              <div className="pomodoro-modes">
                {Object.keys(durations).map(mode => (
                  <button
                    key={mode}
                    className={timerMode === mode ? 'selected' : ''}
                    onClick={() => changeTimerMode(mode)}
                  >
                    {timerLabels[mode]}
                  </button>
                ))}
              </div>

              <p className="timer-label">
                {timerMode === 'free'
                  ? timerRunning
                    ? 'Open timer running · No time limit'
                    : 'Ready when you are'
                  : timerRunning
                    ? `${timerLabels[timerMode]} in progress`
                    : timerMode === 'focus'
                      ? 'Ready to focus? Start your session.'
                      : 'Take a moment to recharge.'}
              </p>

              <div className="timer-display">
                {formatTime(secondsLeft)}
              </div>

              <div className="timer-buttons">
                <button
                  onClick={toggleTimer}
                  disabled={secondsLeft === 0 && timerMode !== 'free'}
                >
                  {timerRunning ? 'Pause Session' : 'Start Session'}
                </button>

                <button className="timer-reset" onClick={resetTimer}>
                  Reset
                </button>
              </div>
            </section>

            <section className="activity-card">
              <p className="eyebrow">SESSION RECORDS</p>
              <h2>Session History</h2>

              {activityLog.length === 0 ? (
                <p className="empty-state">
                  No sessions recorded yet. Start your first focus session.
                </p>
              ) : (
                <div className="activity-list">
                  {activityLog.slice().reverse().map(record => (
                    <div className="activity-item" key={record.id}>
                      <div>
                        <strong>
                          {record.type === 'study' ? '📚 Focus Session' : '☕ Rest Session'}
                        </strong>
                        <p>{record.date} · {record.time}</p>
                      </div>

                      <strong>
                        {Math.floor(record.seconds / 60)} min
                        {record.seconds % 60 > 0
                          ? ` ${record.seconds % 60} sec`
                          : ''}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">STRENGTH & CONSISTENCY</p>
                  <h2>Training Log</h2>
                  <p className="section-description">
                    Record your exercises and monitor your progress.
                  </p>
                </div>
              </div>

              <div className="workout-chart">
                <h3>Weekly Activity · Last 7 Days</h3>

                <div className="chart-bars">
                  {workoutChartData.map((day, index) => (
                    <div className="chart-day" key={index}>
                      <strong>{day.count}</strong>

                      <div className="chart-bar-track">
                        <div
                          className="chart-bar-fill"
                          style={{
                            height: `${Math.max(
                              day.count > 0 ? 8 : 0,
                              (day.count / Math.max(
                                1,
                                ...workoutChartData.map(item => item.count)
                              )) * 100
                            )}%`,
                          }}
                        />
                      </div>

                      <small>{day.label}</small>
                    </div>
                  ))}
                </div>
              </div>

              <div className="workout-dashboard">
                <div className="workout-stat">
                  <h3>{totalWorkouts}</h3>
                  <p>Completed Exercises</p>
                </div>

                <div className="workout-stat">
                  <h3>{totalExercises}</h3>
                  <p>Total Exercises</p>
                </div>

                <div className="workout-stat">
                  <h3>{weeklyWorkouts}</h3>
                  <p>This Week</p>
                </div>

                <div className="workout-stat">
                  <h3>🔥 {workoutStreak}</h3>
                  <p>Workout Streak · Days</p>
                </div>
              </div>

              <form onSubmit={addWorkout} className="workout-form">
                <input
                  type="text"
                  placeholder="Exercise name"
                  value={exerciseName}
                  onChange={event => setExerciseName(event.target.value)}
                  required
                  aria-label="Exercise name"
                />

                <input
                  type="number"
                  min="1"
                  placeholder="Sets"
                  value={exerciseSets}
                  onChange={event => setExerciseSets(event.target.value)}
                  required
                  aria-label="Sets"
                />

                <input
                  type="number"
                  min="1"
                  placeholder="Reps"
                  value={exerciseReps}
                  onChange={event => setExerciseReps(event.target.value)}
                  required
                  aria-label="Repetitions"
                />

                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Weight (kg)"
                  value={exerciseWeight}
                  onChange={event => setExerciseWeight(event.target.value)}
                  aria-label="Weight in kilograms"
                />

                <button type="submit">+ Save Exercise</button>
              </form>

              <div className="workout-list">
                {workouts.length === 0 ? (
                  <p className="empty-state">
                    Your training log is empty. Add your first exercise above.
                  </p>
                ) : (
                  workouts.map(workout => (
                    <div
                      key={workout.id}
                      className={`workout-item ${workout.completed ? 'workout-done' : ''}`}
                    >
                      <div>
                        <h3>{workout.name}</h3>
                        <p>
                          {workout.sets} sets × {workout.reps} reps
                          {workout.weight > 0 && ` · ${workout.weight} kg`}
                        </p>
                        <small>{workout.date}</small>
                      </div>

                      <button onClick={() => toggleWorkout(workout.id)}>
                        {workout.completed ? 'Undo' : 'Complete'}
                      </button>

                      <button
                        className="workout-delete"
                        onClick={() => deleteWorkout(workout.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}

        {/* ANGEE */}
        {activePage === 'Angee' && (
          <section className="ai-chat">
            <p className="eyebrow">YOUR PERSONAL ASSISTANT</p>
            <h1>✦ Angee</h1>
            <p className="subtitle">
              Your companion for planning, studying and reaching your goals.
            </p>

            <div className="chat-messages" ref={chatMessagesRef}>
              {chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={`chat-message ${message.role}`}
                >
                  {message.text}
                </div>
              ))}

              {isTyping && (
                <div className="chat-message ai typing-indicator">
                  Angee is typing...
                </div>
              )}
            </div>

            <form className="chat-form" onSubmit={sendMessage}>
              <input
                type="text"
                placeholder="Message Angee..."
                value={chatInput}
                onChange={event => setChatInput(event.target.value)}
                disabled={isTyping}
              />

              <button type="submit" disabled={isTyping}>
                Send ✦
              </button>
            </form>
          </section>
        )}

        <footer>LUWANG · BUILD YOUR DAY, YOUR WAY</footer>
      </section>

      {/* MOBILE NAVIGATION */}
      <nav className="mobile-nav">
        <button
          className={activePage === 'My Day' ? 'active' : ''}
          onClick={() => setActivePage('My Day')}
        >
          <span>⌂</span>
          <small>My Day</small>
        </button>

        <button
          className={activePage === 'My Schedule' ? 'active' : ''}
          onClick={() => setActivePage('My Schedule')}
        >
          <span>▦</span>
          <small>Schedule</small>
        </button>

        <button
          className={activePage === 'Study & Fitness' ? 'active' : ''}
          onClick={() => setActivePage('Study & Fitness')}
        >
          <span>◷</span>
          <small>Fitness</small>
        </button>

        <button
          className={activePage === 'Angee' ? 'active' : ''}
          onClick={() => setActivePage('Angee')}
        >
          <span>✦</span>
          <small>Angee</small>
        </button>
      </nav>
    </main>
  )
}

export default App

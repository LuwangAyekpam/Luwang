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

const themes = [
  { id: 'sunshine', name: 'Sunshine', colors: ['#fffdf5', '#f6c94b'], description: 'Warm yellow and white' },
  { id: 'midnight', name: 'Midnight', colors: ['#11131c', '#9b8afb'], description: 'Elegant dark theme' },
  { id: 'lavender', name: 'Lavender Dream', colors: ['#f8f5ff', '#a78bfa'], description: 'Soft lavender tones' },
  { id: 'sage', name: 'Sage Serenity', colors: ['#f5f8f1', '#91a987'], description: 'Calm natural greens' },
  { id: 'ocean', name: 'Ocean Breeze', colors: ['#f1f8fc', '#62b5d6'], description: 'Fresh ocean blues' },
  { id: 'peach', name: 'Peach Blossom', colors: ['#fff6f1', '#f3a68b'], description: 'Gentle peach tones' },
  { id: 'latte', name: 'Warm Latte', colors: ['#faf5ed', '#b9956d'], description: 'Warm neutral browns' },
  { id: 'emerald', name: 'Emerald Luxe', colors: ['#eff7f2', '#328b67'], description: 'Rich emerald greens' },
]

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
  return `${String(hour % 12 || 12).padStart(2, '0')}:${minutes} ${period}`
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : fallback
  } catch {
    return fallback
  }
}
function getDailyThought(date) {
  const thoughts = [
    'Small steps every day lead to meaningful progress.',
    'You do not have to be perfect. Just keep showing up.',
    'Your future is built by what you do today.',
    'A little progress is still progress.',
    'Make time for the things that matter to you.',
    'Believe in your ability to figure things out.',
    'You deserve to be proud of how far you have come.',
    'One focused hour can change your whole day.',
    'Start where you are. Use what you have.',
    'Give yourself the same patience you give others.',
  ]

  const dayNumber = Math.floor(
    new Date(`${date}T00:00:00`).getTime() / 86400000
  )

  return thoughts[((dayNumber % thoughts.length) + thoughts.length) % thoughts.length]
}

function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')

  const [cloudDataLoaded, setCloudDataLoaded] = useState(false)
  const [cloudDataUserId, setCloudDataUserId] = useState(null)

  const [activePage, setActivePage] = useState('Home')
  const [settingsSection, setSettingsSection] = useState('Appearance')
  const [currentDateTime, setCurrentDateTime] = useState(new Date())

  const [theme, setTheme] = useState(() => readStorage('luwang-theme', 'sunshine'))
  const [darkMode, setDarkMode] = useState(() => readStorage('luwang-dark-mode', false))

  const [notificationSettings, setNotificationSettings] = useState(() =>
    readStorage('luwang-notification-settings', {
      scheduleReminders: true,
      taskDeadlines: true,
      alarms: true,
      studyWorkoutReminders: true,
      dailySummary: true,
      reminderTiming: 'both',
      sound: true,
      soundType: 'normal',
      alarmDuration: 5,
      morningAlarmTime: '06:00',
      quietHours: true,
      quietStart: '22:00',
      quietEnd: '06:00',
      dailySummaryTime: '21:00',
    })
  )

  const [sentScheduleReminders, setSentScheduleReminders] = useState(() =>
    readStorage('luwang-sent-schedule-reminders', [])
  )
  const [sentWorkoutReminders, setSentWorkoutReminders] = useState(() =>
    readStorage('luwang-sent-workout-reminders', [])
  )

  const [tasks, setTasks] = useState(() => readStorage('luwang-tasks', starterTasks))
  const [projects, setProjects] = useState(() => readStorage('luwang-projects', []))
const [newProject, setNewProject] = useState('')
  const [newTask, setNewTask] = useState('')
  const [category, setCategory] = useState('Study')
  const [time, setTime] = useState('')

  const [schedule, setSchedule] = useState(() => readStorage('luwang-schedule', []))
  const [scheduleTitle, setScheduleTitle] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleEndTime, setScheduleEndTime] = useState('')
  const [scheduleAlarm, setScheduleAlarm] = useState(false)
  const [selectedDate, setSelectedDate] = useState(getDateKey(new Date()))
  const [scheduleDate, setScheduleDate] = useState(getDateKey(new Date()))
  const [scheduleMessage, setScheduleMessage] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })

  const [activityLog, setActivityLog] = useState(() => readStorage('luwangActivityLog', []))
  const [timerMode, setTimerMode] = useState('focus')
  const [secondsLeft, setSecondsLeft] = useState(durations.focus)
  const [timerRunning, setTimerRunning] = useState(false)
  const [savedSessionSeconds, setSavedSessionSeconds] = useState(0)
  const [focusSessions, setFocusSessions] = useState(0)

  const [workouts, setWorkouts] = useState(() => readStorage('luwang-workouts', []))
  const [exerciseName, setExerciseName] = useState('')
  const [exerciseSets, setExerciseSets] = useState('3')
  const [exerciseReps, setExerciseReps] = useState('10')
  const [exerciseWeight, setExerciseWeight] = useState('')
  const [exerciseTime, setExerciseTime] = useState('')

  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', text: "Hey! I'm Angee. I'm here to help you plan your day. ✨" },
  ])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatMessagesRef = useRef(null)

  const activeAlarmContext = useRef(null)
  const activeAlarmOscillator = useRef(null)

 useEffect(() => {
  let mounted = true

  async function checkSession() {
    try {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error) {
        setAuthMessage(error.message)
      }

      setUser(data?.session?.user ?? null)
    } catch (error) {
      if (!mounted) return
      console.warn('Session check failed:', error)
      setAuthMessage('Offline mode: unable to verify your account.')
      setUser(null)
    } finally {
      if (mounted) setAuthLoading(false)
    }
  }

  checkSession()

  const { data: authListener } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null)
      }
    }
  )

  return () => {
    mounted = false
    authListener.subscription.unsubscribe()
  }
}, [])


  async function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthMessage('')

    if (!authEmail.trim() || !authPassword) {
      setAuthMessage('Please enter your email and password.')
      return
    }

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
        })

        if (error) return setAuthMessage(error.message)

        setAuthMessage(
          data.session
            ? 'Account created successfully!'
            : 'Account created! Please check your email to confirm it.'
        )
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        })

        if (error) setAuthMessage(error.message)
      }
    } catch (error) {
      setAuthMessage(error.message || 'Authentication failed.')
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()
    if (error) setAuthMessage(error.message)
  }

  useEffect(() => {
    if (!user) {
      setCloudDataLoaded(false)
      setCloudDataUserId(null)
      return
    }

    let cancelled = false

    function loadLocalData() {
      setTasks(readStorage('luwang-tasks', starterTasks))
      setSchedule(readStorage('luwang-schedule', []))
      setActivityLog(readStorage('luwangActivityLog', []))
      setWorkouts(readStorage('luwang-workouts', []))
      setCloudDataUserId(user.id)
      setCloudDataLoaded(true)
    }

    async function loadCloudData() {
      if (!navigator.onLine) {
        loadLocalData()
        return
      }

      try {
        const { data, error } = await supabase
          .from('luwang_data')
          .select('data_type, content')
          .eq('user_id', user.id)

        if (cancelled) return

        if (error) {
          console.warn('Cloud unavailable. Using local data:', error.message)
          loadLocalData()
          return
        }

        const saved = Object.fromEntries(
          (data || []).map(item => [item.data_type, item.content])
        )

        const dataTypes = ['tasks', 'schedule', 'activityLog', 'workouts']
        const migrated = localStorage.getItem('luwang-legacy-migrated')
        const updates = []

        for (const type of dataTypes) {
          if (saved[type] !== undefined) continue

          let content = []
          if (!migrated) {
            const storageKey = {
              tasks: 'luwang-tasks',
              schedule: 'luwang-schedule',
              activityLog: 'luwangActivityLog',
              workouts: 'luwang-workouts',
            }[type]

            try {
              const localValue = localStorage.getItem(storageKey)
              if (localValue !== null) content = JSON.parse(localValue)
              else if (type === 'tasks') content = starterTasks
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

        if (updates.length) {
          const { error: saveError } = await supabase
            .from('luwang_data')
            .upsert(updates, { onConflict: 'user_id,data_type' })

          if (cancelled) return

          if (saveError) {
            console.warn('Cloud migration save failed:', saveError.message)
          }
        }

        if (cancelled) return

        if (!migrated) {
          localStorage.setItem('luwang-legacy-migrated', 'true')
        }

        setTasks(saved.tasks ?? starterTasks)
        setSchedule(saved.schedule ?? [])
        setActivityLog(saved.activityLog ?? [])
        setWorkouts(saved.workouts ?? [])
        setCloudDataUserId(user.id)
        setCloudDataLoaded(true)
      } catch (error) {
        if (cancelled) return
        console.warn('Cloud loading failed:', error)
        loadLocalData()
      }
    }

    loadCloudData()

    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    localStorage.setItem('luwang-tasks', JSON.stringify(tasks))
  }, [tasks])
  useEffect(() => {
  localStorage.setItem('luwang-projects', JSON.stringify(projects))
}, [projects])

  useEffect(() => {
    localStorage.setItem('luwang-schedule', JSON.stringify(schedule))
  }, [schedule])

  useEffect(() => {
    localStorage.setItem('luwangActivityLog', JSON.stringify(activityLog))
  }, [activityLog])

  useEffect(() => {
    localStorage.setItem('luwang-workouts', JSON.stringify(workouts))
  }, [workouts])

  useEffect(() => {
    localStorage.setItem('luwang-notification-settings', JSON.stringify(notificationSettings))
  }, [notificationSettings])

  useEffect(() => {
    localStorage.setItem('luwang-sent-schedule-reminders', JSON.stringify(sentScheduleReminders))
  }, [sentScheduleReminders])

  useEffect(() => {
    localStorage.setItem('luwang-sent-workout-reminders', JSON.stringify(sentWorkoutReminders))
  }, [sentWorkoutReminders])

  useEffect(() => {
    localStorage.setItem('luwang-theme', JSON.stringify(theme))
  }, [theme])

  useEffect(() => {
    localStorage.setItem('luwang-dark-mode', JSON.stringify(darkMode))
  }, [darkMode])
  useEffect(() => {
    if (!user || !cloudDataLoaded || cloudDataUserId !== user.id) return

    let cancelled = false

    async function saveCloudData() {
      if (!navigator.onLine) return

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

      try {
        const { error } = await supabase
          .from('luwang_data')
          .upsert(records, { onConflict: 'user_id,data_type' })

        if (cancelled) return

        if (error) {
          console.warn('Cloud sync failed:', error.message)
          setAuthMessage('Cloud sync pending. Your changes are saved on this device.')
        } else {
          setAuthMessage('')
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Cloud sync unavailable:', error)
        }
      }
    }

    function handleOnline() {
      saveCloudData()
    }

    window.addEventListener('online', handleOnline)

    saveCloudData()

    return () => {
      cancelled = true
      window.removeEventListener('online', handleOnline)
    }
  }, [user, cloudDataLoaded, cloudDataUserId, tasks, schedule, activityLog, workouts])
  useEffect(() => {
    const clock = setInterval(() => setCurrentDateTime(new Date()), 1000)
    return () => clearInterval(clock)
  }, [])

  useEffect(() => {
    const unlockAudio = async () => {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        if (!AudioContextClass) return
        if (!activeAlarmContext.current) activeAlarmContext.current = new AudioContextClass()
        if (activeAlarmContext.current.state === 'suspended') {
          await activeAlarmContext.current.resume()
        }
      } catch (error) {
        console.error('Could not unlock alarm audio:', error)
      }
    }

    window.addEventListener('pointerdown', unlockAudio)
    window.addEventListener('keydown', unlockAudio)

    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [])

  function stopAlarmSound() {
    if (!activeAlarmOscillator.current) return
    try {
      activeAlarmOscillator.current.stop()
    } catch {
      // The alarm may already have stopped.
    }
    activeAlarmOscillator.current.disconnect()
    activeAlarmOscillator.current = null
  }

  function playAlarmSound() {
    if (!notificationSettings.sound || notificationSettings.soundType !== 'alarm') return

    try {
      const audioContext = activeAlarmContext.current
      if (!audioContext || audioContext.state !== 'running') return

      stopAlarmSound()

      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      activeAlarmOscillator.current = oscillator

      const stopTime = audioContext.currentTime + (Number(notificationSettings.alarmDuration) || 5)

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime)
      gain.gain.setValueAtTime(0.15, audioContext.currentTime)
      gain.gain.setValueAtTime(0, stopTime)

      oscillator.connect(gain)
      gain.connect(audioContext.destination)

      oscillator.onended = () => {
        oscillator.disconnect()
        gain.disconnect()
        activeAlarmOscillator.current = null
      }

      oscillator.start()
      oscillator.stop(stopTime)
    } catch (error) {
      console.error('Could not play alarm sound:', error)
    }
  }

  function isQuietTime(now) {
    if (!notificationSettings.quietHours) return false

    const current = now.getHours() * 60 + now.getMinutes()
    const [sh, sm] = notificationSettings.quietStart.split(':').map(Number)
    const [eh, em] = notificationSettings.quietEnd.split(':').map(Number)
    const start = sh * 60 + sm
    const end = eh * 60 + em

    return start > end
      ? current >= start || current < end
      : current >= start && current < end
  }

  function requestNotificationPermission() {
    if (!('Notification' in window)) {
      alert('Notifications are not supported in this browser.')
      return
    }

    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification('Luwang notifications enabled!', {
          body: 'Your reminders are ready to be set up.',
        })
      } else {
        alert('Notification permission was not granted.')
      }
    })
  }

  useEffect(() => {
    if (!notificationSettings.scheduleReminders) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const checkReminders = () => {
      const now = new Date()
      if (isQuietTime(now)) return
      const today = getDateKey(now)

      schedule.forEach(item => {
        if (item.done || item.date !== today) return

        const [hours, minutes] = item.time.split(':').map(Number)
        const activityTime = new Date(now)
        activityTime.setHours(hours, minutes, 0, 0)

        const minutesUntil = Math.ceil((activityTime - now) / 60000)
        const reminderKey = `${item.id}-${today}-${minutesUntil}`

        const shouldRemind =
          notificationSettings.reminderTiming === 'both'
            ? minutesUntil === 15 || minutesUntil === 0
            : notificationSettings.reminderTiming === 'before'
              ? minutesUntil === 15
              : minutesUntil === 0

        if (shouldRemind && !sentScheduleReminders.includes(reminderKey)) {
          if (item.alarm) playAlarmSound()

          new Notification('Luwang Schedule Reminder', {
            body: `${item.title} ${minutesUntil === 15 ? 'starts in 15 minutes' : 'is starting now'}.`,
            silent: !notificationSettings.sound || (item.alarm && notificationSettings.soundType === 'alarm'),
          })

          setSentScheduleReminders(previous => [...previous, reminderKey])
        }
      })
    }

    checkReminders()
    const clock = setInterval(checkReminders, 30000)
    return () => clearInterval(clock)
  }, [schedule, notificationSettings, sentScheduleReminders])

  useEffect(() => {
    if (!notificationSettings.studyWorkoutReminders) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return

    const checkReminders = () => {
      const now = new Date()
      if (isQuietTime(now)) return
      const today = now.toLocaleDateString()

      workouts.forEach(workout => {
        if (workout.completed || !workout.time || workout.date !== today) return

        const [hours, minutes] = workout.time.split(':').map(Number)
        const workoutTime = new Date(now)
        workoutTime.setHours(hours, minutes, 0, 0)

        const minutesUntil = Math.ceil((workoutTime - now) / 60000)
        const reminderKey = `${workout.id}-${today}-${minutesUntil}`

        const shouldRemind =
          notificationSettings.reminderTiming === 'both'
            ? minutesUntil === 15 || minutesUntil === 0
            : notificationSettings.reminderTiming === 'before'
              ? minutesUntil === 15
              : minutesUntil === 0

        if (shouldRemind && !sentWorkoutReminders.includes(reminderKey)) {
          new Notification('Luwang Workout Reminder 💪', {
            body: `${workout.name} ${minutesUntil === 15 ? 'starts in 15 minutes' : 'is starting now'}!`,
            silent: !notificationSettings.sound,
          })
          setSentWorkoutReminders(previous => [...previous, reminderKey])
        }
      })
    }

    checkReminders()
    const clock = setInterval(checkReminders, 30000)
    return () => clearInterval(clock)
  }, [workouts, notificationSettings, sentWorkoutReminders])

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTo({
        top: chatMessagesRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [chatMessages, isTyping])

  function addTask(event) {
  event.preventDefault()
  if (!newTask.trim()) return

  setTasks(previous => [...previous, {
    id: Date.now(),
    title: newTask.trim(),
    category,
    time,
    date: selectedDate,
    done: false,
  }])

  setNewTask('')
  setTime('')
}
function addProject(event) {
  event.preventDefault()
  if (!newProject.trim()) return

  setProjects(previous => [
    ...previous,
    { id: Date.now(), name: newProject.trim() },
  ])

  setNewProject('')
}

function deleteProject(id) {
  setProjects(previous => previous.filter(project => project.id !== id))
}
function toggleTask(id) {
  setTasks(previous => previous.map(task =>
    task.id === id
      ? {
          ...task,
          done: !task.done,
          completedAt: !task.done ? new Date().toISOString() : null,
        }
      : task
  ))
}

  function deleteTask(id) {
    setTasks(previous => previous.filter(task => task.id !== id))
  }

  function addScheduleItem(event) {
    event.preventDefault()
    setScheduleMessage('')

    if (!scheduleTitle.trim() || !scheduleDate || !scheduleTime || !scheduleEndTime) return

    if (scheduleEndTime <= scheduleTime) {
      setScheduleMessage('Please choose an end time that is later than your start time.')
      return
    }

    const [year, month, day] = scheduleDate.split('-').map(Number)
    const [hours, minutes] = scheduleTime.split(':').map(Number)
    const selectedDateTime = new Date(year, month - 1, day, hours, minutes)

    if (selectedDateTime <= new Date()) {
      setScheduleMessage('Please choose a valid future date and time.')
      return
    }

    setSchedule(previous => [...previous, {
      id: Date.now(),
      title: scheduleTitle.trim(),
      date: scheduleDate,
      time: scheduleTime,
      endTime: scheduleEndTime,
      alarm: scheduleAlarm,
      done: false,
    }])

    setScheduleTitle('')
    setScheduleTime('')
    setScheduleEndTime('')
    setScheduleAlarm(false)
    setSelectedDate(scheduleDate)
  }

  function toggleScheduleItem(id) {
    setSchedule(previous => previous.map(item =>
      item.id === id
        ? {
            ...item,
            done: !item.done,
            completedAt: !item.done ? new Date().toISOString() : null,
          }
        : item
    ))
  }

  function saveActivity(type, seconds) {
    if (seconds <= 0) return
    const now = new Date()

    setActivityLog(previous => [...previous, {
      id: Date.now(),
      type,
      seconds,
      date: now.toLocaleDateString(),
      dateISO: now.toISOString(),
      time: now.toLocaleTimeString(),
    }])
  }

  function getElapsedSeconds() {
    return timerMode === 'free' ? secondsLeft : durations[timerMode] - secondsLeft
  }

  function saveCurrentSession() {
    const elapsed = getElapsedSeconds()
    const newSeconds = elapsed - savedSessionSeconds
    const type = timerMode === 'focus' || timerMode === 'free' ? 'study' : 'rest'

    if (newSeconds > 0) {
      saveActivity(type, newSeconds)
      setSavedSessionSeconds(elapsed)
    }
  }

  function changeTimerMode(mode) {
    if (mode === timerMode) return
    if (timerRunning) saveCurrentSession()
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

  useEffect(() => {
    if (!timerRunning) return

    const interval = setInterval(() => {
      setSecondsLeft(seconds =>
        timerMode === 'free' ? seconds + 1 : Math.max(0, seconds - 1)
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [timerRunning, timerMode])

  useEffect(() => {
    if (secondsLeft !== 0 || !timerRunning || timerMode === 'free') return

    saveCurrentSession()

    if (
      'Notification' in window &&
      Notification.permission === 'granted' &&
      notificationSettings.studyWorkoutReminders
    ) {
      new Notification(
        timerMode === 'focus' ? 'Focus session complete! 🎉' : 'Break finished! 💪',
        {
          body: timerMode === 'focus'
            ? 'Great work! Time for a break.'
            : 'Ready to focus again?',
          silent: !notificationSettings.sound,
        }
      )
    }

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

  function addWorkout(event) {
    event.preventDefault()
    if (!exerciseName.trim()) return

    setWorkouts(previous => [...previous, {
      id: Date.now(),
      name: exerciseName.trim(),
      sets: Number(exerciseSets),
      reps: Number(exerciseReps),
      weight: Number(exerciseWeight) || 0,
      time: exerciseTime,
      date: new Date().toLocaleDateString(),
      completed: false,
    }])

    setExerciseName('')
    setExerciseSets('3')
    setExerciseReps('10')
    setExerciseWeight('')
    setExerciseTime('')
  }

  function toggleWorkout(id) {
    setWorkouts(previous => previous.map(workout =>
      workout.id === id
        ? {
            ...workout,
            completed: !workout.completed,
            completedAt: !workout.completed ? new Date().toISOString() : null,
          }
        : workout
    ))
  }

  function deleteWorkout(id) {
    setWorkouts(previous => previous.filter(workout => workout.id !== id))
  }

  const completed = tasks.filter(task => task.done).length
  const todayKey = getDateKey(new Date())

const dailyTasks = tasks.filter(task =>
  (task.date || todayKey) === selectedDate
)

const dailyCompleted = dailyTasks.filter(task => task.done).length

const dailyProgress = dailyTasks.length
  ? Math.round((dailyCompleted / dailyTasks.length) * 100)
  : 0

const dateStrip = Array.from({ length: 7 }, (_, index) => {
  const date = new Date(`${selectedDate}T00:00:00`)
  date.setDate(date.getDate() - 3 + index)

  return {
    key: getDateKey(date),
    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
    number: date.getDate(),
    isToday: getDateKey(date) === todayKey,
  }
})
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0
  const completedWorkouts = workouts.filter(workout => workout.completed)
  const totalWorkouts = completedWorkouts.length
  const totalExercises = workouts.length

  const workoutDays = new Set(
    completedWorkouts
      .filter(workout => workout.completedAt)
      .map(workout => getDateKey(new Date(workout.completedAt)))
  )

  let workoutStreak = 0
  const workoutStreakDate = new Date()
  while (workoutDays.has(getDateKey(workoutStreakDate))) {
    workoutStreak++
    workoutStreakDate.setDate(workoutStreakDate.getDate() - 1)
  }

  const weekStart = new Date()
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())

  const weeklyWorkouts = completedWorkouts.filter(workout =>
    workout.completedAt && new Date(workout.completedAt) >= weekStart
  ).length

  const workoutChartData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const key = getDateKey(date)
    return {
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      count: completedWorkouts.filter(workout =>
        workout.completedAt && getDateKey(new Date(workout.completedAt)) === key
      ).length,
    }
  })

  const weeklyStudySeconds = activityLog.reduce((total, record) => {
    if (record.type !== 'study' || !record.dateISO) return total
    const date = new Date(record.dateISO)
    return date >= weekStart && date <= new Date() ? total + record.seconds : total
  }, 0)
const weeklyCompletedActivities = [
  ...tasks.filter(item => item.done && item.completedAt),
  ...schedule.filter(item => item.done && item.completedAt),
  ...completedWorkouts.filter(item => item.completedAt),
].filter(item => {
  const date = new Date(item.completedAt)
  return date >= weekStart && date <= new Date()
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

  function sendMessage(event) {
    event.preventDefault()
    if (!chatInput.trim() || isTyping) return

    const userMessage = chatInput.trim()
    const message = userMessage.toLowerCase()

    setChatMessages(previous => [...previous, { role: 'user', text: userMessage }])
    setChatInput('')

    let reply = "I'm listening! Tell me more about what you need. 💜"

    if (message.includes('hello') || message.includes('hi')) {
      reply = "Hey bro! 👋 What are we working on today?"
    } else if (message.includes('study')) {
      reply = "📚 Let's get focused! Try a 25-minute focus session, followed by a 5-minute rest."
    } else if (message.includes('workout') || message.includes('gym') || message.includes('exercise')) {
      reply = `💪 You've completed ${totalWorkouts} exercises out of ${totalExercises}. Your current workout streak is ${workoutStreak} days. Keep going!`
    } else if (message.includes('plan my day')) {
      reply = "✨ Start with your most important task, then make room for study, exercise and rest. Small consistent steps make a difference."
    } else if (message.includes('motivate') || message.includes('motivation')) {
      reply = "🌟 You don't need to do everything today. Just take the next small step. Progress is progress!"
    }

    setIsTyping(true)
    setTimeout(() => {
      setChatMessages(previous => [...previous, { role: 'ai', text: reply }])
      setIsTyping(false)
    }, 1000)
  }

  const sortedSchedule = schedule
    .filter(item => (item.date || getDateKey(new Date())) === selectedDate)
    .slice()
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay()
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate()

  const calendarDays = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) =>
      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index + 1)
    ),
  ]

  function changeCalendarMonth(offset) {
    const month = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1)
    const date = getDateKey(month)
    setCalendarMonth(month)
    setSelectedDate(date)
    setScheduleDate(date)
  }

  function navigate(page) {
    setActivePage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (authLoading || (user && (!cloudDataLoaded || cloudDataUserId !== user.id))) {
    return (
      <div className="initial-loading">
        <div className="loading-content">
          <div className="loading-logo">L</div>
          <h1 className="loading-title">Luwang</h1>
          <p className="loading-message">Your personal space is getting ready.</p>
          <div className="loading-spinner" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="auth-screen">
        <form className="auth-card" onSubmit={handleAuthSubmit}>
          <div className="auth-logo">L</div>
          <p className="eyebrow">YOUR PERSONAL SPACE</p>
          <h1>Luwang</h1>
          <p className="auth-subtitle">A little more organised. A little more you.</p>
          <h2>{authMode === 'login' ? 'Welcome back!' : 'Create your account'}</h2>

          <label>Email address</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={authEmail}
            onChange={event => setAuthEmail(event.target.value)}
            required
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="At least 6 characters"
            value={authPassword}
            onChange={event => setAuthPassword(event.target.value)}
            minLength={6}
            required
          />

          <button className="primary-button auth-submit" type="submit">
            {authMode === 'login' ? 'Log in' : 'Create account'}
          </button>

          {authMessage && <p className="auth-message">{authMessage}</p>}

          <p className="auth-switch">
            {authMode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login')
                setAuthMessage('')
              }}
            >
              {authMode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </form>
      </div>
    )
  }

  const pageTitles = {
    Home: 'Your day, your way',
    Schedule: 'Make room for what matters',
    'Study & Fitness': 'Build your momentum',
    Progress: 'Look how far you’ve come',
    Angee: 'Your personal companion',
    Settings: 'Make Luwang yours',
  }

  return (
    <main className={`app-shell theme-${theme} ${darkMode ? 'dark-mode' : ''}`}>
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate('Home')}>
          <span className="brand-icon">L</span>
          <span>Luwang</span>
        </button>

        <div className="sidebar-label">WORKSPACE</div>

        {[
          ['Home', '⌂'],
          ['Schedule', '▦'],
          ['Study & Fitness', '◷'],
          ['Progress', '↗'],
          ['Angee', '✦'],
        ].map(([page, icon]) => (
          <button
            key={page}
            className={`nav-item ${activePage === page ? 'active' : ''}`}
            onClick={() => navigate(page)}
          >
            <span className="nav-icon">{icon}</span>
            <span>{page}</span>
          </button>
        ))}

        <div className="sidebar-bottom">
          <div className="mini-avatar">L</div>
          <div className="sidebar-user">
            <strong>My Luwang</strong>
            <small>{user.email}</small>
          </div>
          <button className="sidebar-settings" onClick={() => navigate('Settings')} aria-label="Settings">
            ⚙
          </button>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div>
            <p className="topbar-date">
              {currentDateTime.toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <h1>{pageTitles[activePage]}</h1>
          </div>

          <div className="topbar-right">
            <div className="live-clock">
              {currentDateTime.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}
            </div>
            <button className="icon-button" onClick={() => navigate('Settings')} aria-label="Settings">
              ⚙
            </button>
          </div>
        </header>

       {activePage === 'Home' && (
  <>
    <section className="home-date-card">
      <div>
        <p className="eyebrow">YOUR PERSONAL SPACE</p>
        <h2>
          {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </h2>
      </div>

      <button
        className="today-button"
        onClick={() => setSelectedDate(todayKey)}
      >
        Today
      </button>
    </section>

    <section className="date-strip">
      <button
        className="date-arrow"
        onClick={() => {
          const date = new Date(`${selectedDate}T00:00:00`)
          date.setDate(date.getDate() - 7)
          setSelectedDate(getDateKey(date))
        }}
      >
        ←
      </button>

      <div className="date-strip-days">
        {dateStrip.map(date => (
          <button
            key={date.key}
            className={`date-chip ${selectedDate === date.key ? 'selected' : ''} ${date.isToday ? 'is-today' : ''}`}
            onClick={() => setSelectedDate(date.key)}
          >
            <small>{date.day}</small>
            <strong>{date.number}</strong>
            {date.isToday && <i />}
          </button>
        ))}
      </div>

      <button
        className="date-arrow"
        onClick={() => {
          const date = new Date(`${selectedDate}T00:00:00`)
          date.setDate(date.getDate() + 7)
          setSelectedDate(getDateKey(date))
        }}
      >
        →
      </button>
    </section>

    <section className="welcome sunshine-welcome">
      <div>
        <p className="eyebrow">A FRESH START</p>
        <h2>Make today <span>count.</span></h2>
        <p className="subtitle">
          Small steps every day lead to meaningful progress.
        </p>
        <button className="primary-button" onClick={() => navigate('Schedule')}>
          Plan my day <span>→</span>
        </button>
      </div>
      <div className="welcome-symbol">✳</div>
    </section>

    <section className="thought-card">
      <span>✦ THOUGHT OF THE DAY</span>
      <h3>“{getDailyThought(selectedDate)}”</h3>
    </section>

    <section className="stats-grid">
      <article className="stat-card">
        <span className="stat-icon">☷</span>
        <p>Planned tasks</p>
        <h2>{dailyTasks.length}</h2>
        <small>Your priorities for this day</small>
      </article>

      <article className="stat-card">
        <span className="stat-icon">✓</span>
        <p>Completed tasks</p>
        <h2>{dailyCompleted}</h2>
        <small>Look at you go!</small>
      </article>

      <article className="stat-card">
        <span className="stat-icon">↗</span>
        <p>Daily completion</p>
        <h2>{dailyProgress}%</h2>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${dailyProgress}%` }} />
        </div>
      </article>
    </section>

    <section className="content-card tasks-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR DAILY PRIORITIES</p>
          <h2>
            {selectedDate === todayKey ? "Today's priorities" : 'Your priorities'}
          </h2>
        </div>
        <span className="task-count">
          {dailyCompleted} / {dailyTasks.length} done
        </span>
      </div>

      <form className="add-task-form" onSubmit={addTask}>
        <input
          value={newTask}
          onChange={event => setNewTask(event.target.value)}
          placeholder="What would you like to get done?"
          aria-label="New task"
        />
        <select value={category} onChange={event => setCategory(event.target.value)}>
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
        <button className="primary-button" type="submit">+ Add task</button>
      </form>

      <div className="task-list">
        {dailyTasks.length === 0 && (
          <p className="empty-state">
            No tasks planned for this day. Add your first priority!
          </p>
        )}

        {dailyTasks.map(task => (
          <div className={`task-row ${task.done ? 'task-done' : ''}`} key={task.id}>
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
                {task.category}
                {task.time ? ` · ${formatScheduleTime(task.time)}` : ''}
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

    <section className="content-card projects-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">BIG IDEAS, LITTLE STEPS</p>
          <h2>Your projects</h2>
        </div>
        <span className="task-count">{projects.length} projects</span>
      </div>

      <form className="add-task-form" onSubmit={addProject}>
        <input
          value={newProject}
          onChange={event => setNewProject(event.target.value)}
          placeholder="Give your next project a name..."
          aria-label="New project"
        />
        <button className="primary-button" type="submit">+ Add project</button>
      </form>

      <div className="project-list">
        {projects.length === 0 ? (
          <p className="empty-state">
            Your next big idea belongs here. Add your first project!
          </p>
        ) : projects.map(project => (
          <div className="project-item" key={project.id}>
            <span className="project-icon">✦</span>
            <strong>{project.name}</strong>
            <button
              className="delete-button"
              onClick={() => deleteProject(project.id)}
              aria-label="Delete project"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </section>

    <section className="overview-grid">
      <article className="content-card">
        <p className="eyebrow">THIS WEEK</p>
        <h2>Your weekly overview</h2>
        <div className="activity-item">
          <span>🔥 Study streak</span>
          <strong>{currentStreak} days</strong>
        </div>
        <div className="activity-item">
          <span>📚 Study time</span>
          <strong>
            {Math.floor(weeklyStudySeconds / 3600)}h {Math.floor((weeklyStudySeconds % 3600) / 60)}m
          </strong>
        </div>
        <div className="activity-item">
          <span>✓ Activities completed</span>
          <strong>{weeklyCompletedActivities}</strong>
        </div>
      </article>

      <article className="angee-promo">
        <div className="ai-icon">✦</div>
        <p className="eyebrow">YOUR LITTLE HELPER</p>
        <h2>Meet Angee</h2>
        <p>Need a plan, a little motivation, or a fresh perspective? Angee is here.</p>
        <button className="secondary-button" onClick={() => navigate('Angee')}>
          Chat with Angee →
        </button>
      </article>
    </section>
  </>
)}

        {activePage === 'Schedule' && (
          <section className="content-card schedule-card">
            <p className="eyebrow">DAILY PLANNING</p>
            <h2>My schedule</h2>

            <div className="calendar-header">
              <button onClick={() => changeCalendarMonth(-1)} aria-label="Previous month">←</button>
              <h3>{calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
              <button onClick={() => changeCalendarMonth(1)} aria-label="Next month">→</button>
            </div>

            <div className="calendar-grid">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div className="calendar-weekday" key={day}>{day}</div>
              ))}
              {calendarDays.map((date, index) => {
                if (!date) return <div key={`empty-${index}`} />
                const key = getDateKey(date)
                const hasActivity = schedule.some(item => (item.date || getDateKey(new Date())) === key)
                return (
                  <button
                    key={key}
                    className={`calendar-day ${selectedDate === key ? 'selected' : ''} ${key === getDateKey(new Date()) ? 'today' : ''}`}
                    onClick={() => {
                      setSelectedDate(key)
                      setScheduleDate(key)
                    }}
                  >
                    <span>{date.getDate()}</span>
                    {hasActivity && <i />}
                  </button>
                )
              })}
            </div>

            <p className="section-description">Give your activities a time and a place in your day.</p>

            <form onSubmit={addScheduleItem} className="schedule-form" noValidate>
              <input
                placeholder="Activity title"
                value={scheduleTitle}
                onChange={event => {
                  setScheduleTitle(event.target.value)
                  setScheduleMessage('')
                }}
                required
              />
              <input
                type="date"
                min={getDateKey(new Date())}
                value={scheduleDate}
                onChange={event => {
                  const date = event.target.value
                  setScheduleDate(date)
                  setSelectedDate(date)
                  setScheduleMessage('')
                  if (date) {
                    const chosen = new Date(`${date}T00:00:00`)
                    setCalendarMonth(new Date(chosen.getFullYear(), chosen.getMonth(), 1))
                  }
                }}
                required
              />
              <label className="field-label">Starts
                <input type="time" value={scheduleTime} onChange={event => {
                  setScheduleTime(event.target.value)
                  setScheduleMessage('')
                }} required />
              </label>
              <label className="field-label">Ends
                <input type="time" value={scheduleEndTime} onChange={event => {
                  setScheduleEndTime(event.target.value)
                  setScheduleMessage('')
                }} required />
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={scheduleAlarm} onChange={event => setScheduleAlarm(event.target.checked)} />
                Enable alarm for this activity
              </label>
              {scheduleMessage && <p className="schedule-validation-message">{scheduleMessage}</p>}
              <button className="primary-button" type="submit">+ Add to schedule</button>
            </form>

            <div className="schedule-list">
              <div className="section-heading">
                <h3>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}</h3>
              </div>

              {sortedSchedule.length === 0 ? (
                <p className="empty-state">Nothing planned for this date yet.</p>
              ) : sortedSchedule.map(item => (
                <div className={`schedule-item ${item.done ? 'schedule-done' : ''}`} key={item.id}>
                  <div className="schedule-time">
                    {formatScheduleTime(item.time)}
                    <small>{formatScheduleTime(item.endTime || item.time)}</small>
                  </div>
                  <strong>{item.title}</strong>
                  {item.alarm && <span className="alarm-label">🔔 Alarm</span>}
                  <button className="secondary-button" onClick={() => toggleScheduleItem(item.id)}>
                    {item.done ? 'Undo' : 'Complete'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {activePage === 'Study & Fitness' && (
          <>
            <section className="content-card timer-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">FOCUS & RECOVERY</p>
                  <h2>Focus sessions</h2>
                  <p className="section-description">Work with intention. Take breaks. Stay consistent.</p>
                </div>
                <span className="timer-symbol">◷</span>
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
                  ? timerRunning ? 'Open timer running' : 'Ready when you are'
                  : timerRunning ? `${timerLabels[timerMode]} in progress` : 'Ready when you are'}
              </p>

              <div className="timer-display">{formatTime(secondsLeft)}</div>
              <div className="timer-buttons">
                <button className="primary-button" onClick={toggleTimer} disabled={secondsLeft === 0 && timerMode !== 'free'}>
                  {timerRunning ? 'Pause session' : 'Start session'}
                </button>
                <button className="secondary-button" onClick={resetTimer}>Reset</button>
              </div>
            </section>

            <section className="content-card">
              <p className="eyebrow">SESSION RECORDS</p>
              <h2>Session history</h2>
              {activityLog.length === 0 ? (
                <p className="empty-state">Your completed sessions will appear here.</p>
              ) : (
                <div className="activity-list">
                  {activityLog.slice().reverse().map(record => (
                    <div className="activity-item" key={record.id}>
                      <div>
                        <strong>{record.type === 'study' ? '📚 Focus session' : '☕ Rest session'}</strong>
                        <small>{record.date} · {record.time}</small>
                      </div>
                      <strong>{Math.floor(record.seconds / 60)} min {record.seconds % 60 ? `${record.seconds % 60} sec` : ''}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="content-card">
              <p className="eyebrow">STRENGTH & CONSISTENCY</p>
              <h2>Training log</h2>

              <div className="workout-chart">
                <h3>Weekly activity · Last 7 days</h3>
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
                              day.count / Math.max(1, ...workoutChartData.map(item => item.count)) * 100
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
                <div className="workout-stat"><h3>{totalWorkouts}</h3><p>Completed</p></div>
                <div className="workout-stat"><h3>{totalExercises}</h3><p>Total exercises</p></div>
                <div className="workout-stat"><h3>{weeklyWorkouts}</h3><p>This week</p></div>
                <div className="workout-stat"><h3>{workoutStreak}</h3><p>Day streak 🔥</p></div>
              </div>

              <form onSubmit={addWorkout} className="workout-form">
                <input placeholder="Exercise name" value={exerciseName} onChange={event => setExerciseName(event.target.value)} required />
                <input type="number" min="1" placeholder="Sets" value={exerciseSets} onChange={event => setExerciseSets(event.target.value)} required />
                <input type="number" min="1" placeholder="Reps" value={exerciseReps} onChange={event => setExerciseReps(event.target.value)} required />
                <input type="number" min="0" step="0.5" placeholder="Weight (kg)" value={exerciseWeight} onChange={event => setExerciseWeight(event.target.value)} />
                <input type="time" value={exerciseTime} onChange={event => setExerciseTime(event.target.value)} aria-label="Workout reminder time" />
                <button className="primary-button" type="submit">+ Save exercise</button>
              </form>

              <div className="workout-list">
                {workouts.length === 0 ? (
                  <p className="empty-state">Your training log is empty. Add your first exercise above.</p>
                ) : workouts.map(workout => (
                  <div className={`workout-item ${workout.completed ? 'workout-done' : ''}`} key={workout.id}>
                    <div>
                      <strong>{workout.name}</strong>
                      <p>{workout.sets} sets × {workout.reps} reps{workout.weight > 0 ? ` · ${workout.weight} kg` : ''}</p>
                      <small>{workout.date}{workout.time ? ` · Reminder ${workout.time}` : ''}</small>
                    </div>
                    <button className="secondary-button" onClick={() => toggleWorkout(workout.id)}>
                      {workout.completed ? 'Undo' : 'Complete'}
                    </button>
                    <button className="delete-button" onClick={() => deleteWorkout(workout.id)}>Delete</button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activePage === 'Progress' && (
          <>
            <section className="welcome progress-welcome">
              <div>
                <p className="eyebrow">YOUR JOURNEY</p>
                <h2>Progress looks good on you.</h2>
                <p className="subtitle">Every small step is worth celebrating.</p>
              </div>
              <div className="welcome-symbol">↗</div>
            </section>

            <section className="stats-grid">
              <article className="stat-card"><span className="stat-icon">✓</span><p>Tasks completed</p><h2>{completed}</h2><small>Out of {tasks.length} tasks</small></article>
              <article className="stat-card"><span className="stat-icon">🔥</span><p>Study streak</p><h2>{currentStreak}</h2><small>Consecutive active days</small></article>
              <article className="stat-card"><span className="stat-icon">💪</span><p>Workout streak</p><h2>{workoutStreak}</h2><small>Consecutive workout days</small></article>
            </section>

            <section className="content-card">
              <p className="eyebrow">STUDY</p>
              <h2>Your weekly study time</h2>
              <div className="progress-highlight">
                <strong>{Math.floor(weeklyStudySeconds / 3600)}h {Math.floor((weeklyStudySeconds % 3600) / 60)}m</strong>
                <span>Recorded this week</span>
              </div>
              <div className="activity-item"><span>Completed activities</span><strong>{weeklyCompletedActivities}</strong></div>
              <div className="activity-item"><span>Completed workout exercises</span><strong>{totalWorkouts}</strong></div>
            </section>

            <section className="content-card">
              <p className="eyebrow">WORKOUT ACTIVITY</p>
              <h2>Last seven days</h2>
              <div className="chart-bars progress-chart">
                {workoutChartData.map((day, index) => (
                  <div className="chart-day" key={index}>
                    <strong>{day.count}</strong>
                    <div className="chart-bar-track">
                      <div className="chart-bar-fill" style={{
                        height: `${Math.max(day.count > 0 ? 8 : 0, day.count / Math.max(1, ...workoutChartData.map(item => item.count)) * 100)}%`,
                      }} />
                    </div>
                    <small>{day.label}</small>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {activePage === 'Angee' && (
          <section className="content-card ai-chat">
            <div className="angee-heading">
              <div className="ai-icon">✦</div>
              <div>
                <p className="eyebrow">YOUR PERSONAL ASSISTANT</p>
                <h2>Angee</h2>
                <p className="section-description">Here to help you plan, study and reach your goals.</p>
              </div>
            </div>

            <div className="chat-messages" ref={chatMessagesRef}>
              {chatMessages.map((message, index) => (
                <div key={index} className={`chat-message ${message.role}`}>{message.text}</div>
              ))}
              {isTyping && <div className="chat-message ai typing-indicator">Angee is typing...</div>}
            </div>

            <form className="chat-form" onSubmit={sendMessage}>
              <input
                placeholder="Message Angee..."
                value={chatInput}
                onChange={event => setChatInput(event.target.value)}
                disabled={isTyping}
              />
              <button className="primary-button" type="submit" disabled={isTyping}>Send ✦</button>
            </form>
          </section>
        )}

        {activePage === 'Settings' && (
          <section className="settings-layout">
            <aside className="settings-menu">
              {[
                ['About Luwang', '✦'],
                ['Notifications', '♧'],
                ['Account', '◉'],
                ['Appearance', '◐'],
                ['Personalisation', '✧'],
                ['Privacy & Security', '◇'],
                ['Data & Backup', '▤'],
                ['Help & Feedback', '?'],
              ].map(([section, icon]) => (
                <button
                  key={section}
                  className={settingsSection === section ? 'selected' : ''}
                  onClick={() => setSettingsSection(section)}
                >
                  <span>{icon}</span>{section}
                </button>
              ))}
            </aside>

            <div className="content-card settings-content">
              {settingsSection === 'Appearance' && (
                <>
                  <p className="eyebrow">MAKE IT YOURS</p>
                  <h2>Appearance</h2>
                  <p className="section-description">Choose the look that makes Luwang feel like your space.</p>

                  <h3 className="settings-subheading">Choose a theme</h3>
                  <div className="theme-grid">
                    {themes.map(item => (
                      <button
                        key={item.id}
                        className={`theme-option ${theme === item.id ? 'selected' : ''}`}
                        onClick={() => setTheme(item.id)}
                      >
                        <span className="theme-preview">
                          <i style={{ background: item.colors[0] }} />
                          <i style={{ background: item.colors[1] }} />
                        </span>
                        <strong>{item.name}</strong>
                        <small>{item.description}</small>
                        {theme === item.id && <span className="theme-check">✓</span>}
                      </button>
                    ))}
                  </div>

                  <div className="settings-divider" />
                  <h3 className="settings-subheading">Display mode</h3>
                  <label className="setting-row">
                    <span><strong>Dark mode</strong><small>Use a darker appearance throughout the app.</small></span>
                    <input type="checkbox" checked={darkMode} onChange={event => setDarkMode(event.target.checked)} />
                  </label>
                </>
              )}

              {settingsSection === 'Notifications' && (
                <>
                  <p className="eyebrow">STAY IN THE LOOP</p>
                  <h2>Notifications</h2>
                  <p className="section-description">Manage how Luwang reminds you throughout the day.</p>

                  {[
                    ['scheduleReminders', 'Schedule reminders', 'Get notified before scheduled activities.'],
                    ['studyWorkoutReminders', 'Study and workout reminders', 'Get reminders for planned workouts and sessions.'],
                    ['taskDeadlines', 'Task deadlines', 'Task deadline preference.'],
                    ['alarms', 'Alarms', 'Allow activity alarms.'],
                    ['dailySummary', 'Daily summary', 'Daily summary preference.'],
                    ['sound', 'Notification sound', 'Play sounds with notifications.'],
                    ['quietHours', 'Quiet hours', 'Pause reminders during selected hours.'],
                  ].map(([key, label, description]) => (
                    <label className="setting-row" key={key}>
                      <span><strong>{label}</strong><small>{description}</small></span>
                      <input
                        type="checkbox"
                        checked={Boolean(notificationSettings[key])}
                        onChange={event => setNotificationSettings(previous => ({
                          ...previous,
                          [key]: event.target.checked,
                        }))}
                      />
                    </label>
                  ))}

                  <div className="settings-field">
                    <label>Reminder timing</label>
                    <select value={notificationSettings.reminderTiming} onChange={event => setNotificationSettings(previous => ({
                      ...previous,
                      reminderTiming: event.target.value,
                    }))}>
                      <option value="both">15 minutes before and at start</option>
                      <option value="before">15 minutes before</option>
                      <option value="at">At start time</option>
                    </select>
                  </div>

                  <div className="settings-field">
                    <label>Notification sound type</label>
                    <select value={notificationSettings.soundType} onChange={event => setNotificationSettings(previous => ({
                      ...previous,
                      soundType: event.target.value,
                    }))}>
                      <option value="normal">Normal notification</option>
                      <option value="alarm">Short alarm</option>
                    </select>
                  </div>

                  {notificationSettings.soundType === 'alarm' && (
                    <div className="settings-field">
                      <label>Alarm duration</label>
                      <select value={notificationSettings.alarmDuration} onChange={event => setNotificationSettings(previous => ({
                        ...previous,
                        alarmDuration: Number(event.target.value),
                      }))}>
                        <option value={5}>5 seconds</option>
                        <option value={10}>10 seconds</option>
                      </select>
                    </div>
                  )}

                  {notificationSettings.quietHours && (
                    <div className="settings-two-columns">
                      <div className="settings-field">
                        <label>Quiet hours start</label>
                        <input type="time" value={notificationSettings.quietStart} onChange={event => setNotificationSettings(previous => ({
                          ...previous,
                          quietStart: event.target.value,
                        }))} />
                      </div>
                      <div className="settings-field">
                        <label>Quiet hours end</label>
                        <input type="time" value={notificationSettings.quietEnd} onChange={event => setNotificationSettings(previous => ({
                          ...previous,
                          quietEnd: event.target.value,
                        }))} />
                      </div>
                    </div>
                  )}

                  <div className="settings-field">
                    <label>Daily summary time</label>
                    <input type="time" value={notificationSettings.dailySummaryTime} onChange={event => setNotificationSettings(previous => ({
                      ...previous,
                      dailySummaryTime: event.target.value,
                    }))} />
                  </div>

                  <button className="primary-button" onClick={requestNotificationPermission}>Enable browser notifications</button>
                </>
              )}

              {settingsSection === 'Account' && (
                <>
                  <p className="eyebrow">YOUR LUWANG ACCOUNT</p>
                  <h2>Account</h2>
                  <div className="account-profile">
                    <div className="profile-avatar">L</div>
                    <div><strong>{user.email}</strong><small>Signed in to Luwang</small></div>
                  </div>
                  <div className="settings-divider" />
                  <button className="danger-button" onClick={handleLogout}>Log out</button>
                </>
              )}

              {settingsSection === 'About Luwang' && (
                <>
                  <p className="eyebrow">A SPACE THAT'S YOURS</p>
                  <h2>About Luwang</h2>
                  <p className="section-description">Luwang is your personal space to organise your day, build habits, focus on your goals and celebrate progress.</p>
                  <div className="about-mark">L</div>
                  <h3>Luwang</h3>
                  <p className="section-description">Build your day, your way.</p>
                  <small>Personal productivity workspace</small>
                </>
              )}

              {settingsSection === 'Personalisation' && (
                <>
                  <p className="eyebrow">YOUR PREFERENCES</p>
                  <h2>Personalisation</h2>
                  <p className="section-description">Make your workspace feel right for you.</p>
                  <div className="settings-field">
                    <label>Default home page</label>
                    <select value={activePage} onChange={event => setActivePage(event.target.value)}>
                      <option value="Home">Home</option>
                      <option value="Schedule">Schedule</option>
                      <option value="Study & Fitness">Study & Fitness</option>
                      <option value="Progress">Progress</option>
                    </select>
                  </div>
                  <div className="settings-field">
                    <label>First day of the week</label>
                    <p className="section-description">Your calendar currently starts on Sunday.</p>
                  </div>
                </>
              )}

              {settingsSection === 'Privacy & Security' && (
                <>
                  <p className="eyebrow">YOUR PRIVACY MATTERS</p>
                  <h2>Privacy & Security</h2>
                  <p className="section-description">Your account uses Supabase authentication. Keep your login details private and use a strong password.</p>
                  <div className="setting-row"><span><strong>Signed-in account</strong><small>{user.email}</small></span><span className="status-tag">Active</span></div>
                  <div className="setting-row"><span><strong>Cloud data</strong><small>Your tasks, schedule, study history and workouts sync to your account.</small></span><span className="status-tag">Enabled</span></div>
                </>
              )}

              {settingsSection === 'Data & Backup' && (
                <>
                  <p className="eyebrow">YOUR INFORMATION</p>
                  <h2>Data & Backup</h2>
                  <p className="section-description">Your productivity data is stored locally and synced to your signed-in Luwang account.</p>
                  <div className="data-summary">
                    <div><strong>{tasks.length}</strong><small>Tasks</small></div>
                    <div><strong>{schedule.length}</strong><small>Schedule items</small></div>
                    <div><strong>{activityLog.length}</strong><small>Study records</small></div>
                    <div><strong>{workouts.length}</strong><small>Workout records</small></div>
                  </div>
                  <p className="section-description">Cloud sync status: {cloudDataLoaded ? 'Loaded' : 'Loading'}.</p>
                </>
              )}

              {settingsSection === 'Help & Feedback' && (
                <>
                  <p className="eyebrow">WE'RE HERE TO HELP</p>
                  <h2>Help & Feedback</h2>
                  <p className="section-description">Need help using Luwang? You can share feedback or report an issue with your app experience.</p>
                  <p className="section-description">For account issues, check your sign-in email and Supabase account configuration.</p>
                </>
              )}
            </div>
          </section>
        )}

        <footer>LUWANG · BUILD YOUR DAY, YOUR WAY</footer>
      </section>

      <nav className="mobile-nav">
        {[
          ['Home', '⌂'],
          ['Schedule', '▦'],
          ['Study & Fitness', '◷'],
          ['Progress', '↗'],
          ['Angee', '✦'],
          ['Settings', '⚙'],
        ].map(([page, icon]) => (
          <button key={page} className={activePage === page ? 'active' : ''} onClick={() => navigate(page)}>
            <span>{icon}</span>
            <small>{page === 'Study & Fitness' ? 'Study' : page}</small>
          </button>
        ))}
      </nav>
    </main>
  )
}

export default App
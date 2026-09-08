import { useEffect, useState, useCallback } from 'react'
import { Page, Task, Meeting, NotificationItem, CurrentUser, DbProfile } from './types'
import { supabase } from './lib/supabase'
import { getMyProfile, profileToUser, listTasks, listMeetings, listNotifications, subscribeToNotifications, subscribeToTable, signOut } from './lib/api'

import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AIAssistant from './pages/AIAssistant'
import Chat from './pages/Chat'
import Tasks from './pages/Tasks'
import TeamTasks from './pages/TeamTasks'
import Meetings from './pages/Meetings'
import Notifications from './pages/Notifications'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'

export default function App() {
  const [checkingSession, setCheckingSession] = useState(true)
  const [profile, setProfile] = useState<DbProfile | null>(null)
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [page, setPage] = useState<Page>(() => (sessionStorage.getItem('Innodatatics_page') as Page) || 'home')

  const [tasks, setTasks] = useState<Task[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  const loadEverything = useCallback(async (myId: string) => {
    const [t, m, n] = await Promise.all([listTasks(myId), listMeetings(), listNotifications(myId)])
    setTasks(t)
    setMeetings(m)
    setNotifications(n)
  }, [])

  async function loadProfile() {
    const p = await getMyProfile()
    setProfile(p)
    setUser(p ? profileToUser(p) : null)
    if (p) loadEverything(p.id)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) await loadProfile()
      setCheckingSession(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) await loadProfile()
      else {
        setProfile(null)
        setUser(null)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!profile) return
    const unsubNotifications = subscribeToNotifications(profile.id, () => {
      listNotifications(profile.id).then(setNotifications)
    })
    const unsubTasks = subscribeToTable('tasks', () => {
      listTasks(profile.id).then(setTasks)
    })
    const unsubMeetings = subscribeToTable('meetings', () => {
      listMeetings().then(setMeetings)
    })
    const unsubAttendees = subscribeToTable('meeting_attendees', () => {
      listMeetings().then(setMeetings)
    })
    return () => {
      unsubNotifications()
      unsubTasks()
      unsubMeetings()
      unsubAttendees()
    }
  }, [profile])

  useEffect(() => {
    sessionStorage.setItem('Innodatatics_page', page)
  }, [page])

  if (checkingSession) {
    return <div className="min-h-screen flex items-center justify-center bg-canvas text-inkmuted text-sm">Loading…</div>
  }

  if (!profile || !user) {
    return <Login onLogin={loadProfile} />
  }

  const unreadNotifications = notifications.filter((n) => !n.read).length

  async function handleLogout() {
    await signOut()
    setProfile(null)
    setUser(null)
    setPage('home')
    sessionStorage.removeItem('Innodatatics_page')
  }

  return (
    <div className="flex bg-canvas min-h-screen">
      <Sidebar
        active={page}
        onNavigate={setPage}
        unreadNotifications={unreadNotifications}
        plant={user.plant}
        showTeamTasks={user.role === 'Manager' || user.role === 'Admin' || user.role === 'Team Lead'}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar page={page} user={user} unreadNotifications={unreadNotifications} onNavigate={setPage} />
        <main className="flex-1 min-w-0">
          {page === 'home' && (
            <Dashboard user={user} tasks={tasks} meetings={meetings} notifications={notifications} onNavigate={setPage} />
          )}
          {page === 'assistant' && <AIAssistant user={user} myId={profile.id} />}
          {page === 'chat' && <Chat myId={profile.id} />}
          {page === 'tasks' && <Tasks user={user} myId={profile.id} tasks={tasks} setTasks={setTasks} />}
          {page === 'teamTasks' && <TeamTasks myId={profile.id} tasks={tasks} />}
          {page === 'meetings' && <Meetings myId={profile.id} meetings={meetings} setMeetings={setMeetings} />}
          {page === 'notifications' && (
            <Notifications myId={profile.id} notifications={notifications} setNotifications={setNotifications} />
          )}
          {page === 'analytics' && <Analytics myId={profile.id} />}
          {page === 'settings' && <Settings user={user} setUser={setUser as React.Dispatch<React.SetStateAction<CurrentUser>>} onLogout={handleLogout} />}
        </main>
      </div>
    </div>
  )
}

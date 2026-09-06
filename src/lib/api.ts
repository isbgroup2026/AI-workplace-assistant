import { supabase } from './supabase'
import {
  CurrentUser,
  DbProfile,
  Task,
  TaskPriority,
  TaskStatus,
  Meeting,
  MeetingPlatform,
  NotificationItem,
  Contact,
  ChatMessage,
  AIMessage,
} from '../types'

// ---------- Profiles / Auth ----------

export function profileToUser(p: DbProfile): CurrentUser {
  return {
    name: p.name,
    initials: p.initials,
    role: p.role,
    department: p.department,
    employeeId: p.employee_id,
    language: p.language,
    email: p.email,
    plant: p.plant,
  }
}

export async function getMyProfile(): Promise<DbProfile | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', auth.user.id).single()
  if (error) {
    console.error('getMyProfile error', error)
    return null
  }
  return data as DbProfile
}

export async function listProfiles(): Promise<
  { id: string; name: string; initials: string; role: string; department: string }[]
> {
  const { data, error } = await supabase.from('profiles').select('id, name, initials, role, department')
  if (error) {
    console.error('listProfiles error', error)
    return []
  }
  return data
}

export async function updateMyLanguage(language: CurrentUser['language']) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return
  await supabase.from('profiles').update({ language }).eq('id', auth.user.id)
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

// ---------- Tasks ----------

interface TaskRow {
  id: string
  title: string
  description: string
  assignee_id: string | null
  due_date: string
  priority: TaskPriority
  status: TaskStatus
  department: string
  updated_at: string
  assignee?: { name: string; initials: string } | null
}

function taskFromRow(row: TaskRow, myId: string): Task {
  const isMe = row.assignee_id === myId
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    assigneeId: row.assignee_id,
    assignee: isMe ? 'You' : row.assignee?.name ?? 'Unassigned',
    assigneeInitials: isMe ? 'ME' : row.assignee?.initials ?? '—',
    dueDate: row.due_date,
    priority: row.priority,
    status: row.status,
    department: row.department,
    updatedAt: row.updated_at,
  }
}

export async function listTasks(myId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, assignee:assignee_id(name, initials)')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('listTasks error', error)
    return []
  }
  return (data as TaskRow[]).map((row) => taskFromRow(row, myId))
}

export async function createTask(
  input: { title: string; description: string; assigneeId: string | null; dueDate: string; priority: TaskPriority; department: string },
  myId: string,
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: input.title,
      description: input.description,
      assignee_id: input.assigneeId,
      due_date: input.dueDate,
      priority: input.priority,
      department: input.department,
      created_by: myId,
    })
    .select('*, assignee:assignee_id(name, initials)')
    .single()
  if (error) throw new Error(error.message)
  return taskFromRow(data as TaskRow, myId)
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  const { error } = await supabase.from('tasks').update({ status }).eq('id', id)
  if (error) console.error('updateTaskStatus error', error)
}

// ---------- Meetings ----------

interface MeetingRow {
  id: string
  title: string
  meeting_date: string
  meeting_time: string
  duration_minutes: number
  platform: MeetingPlatform
  status: Meeting['status']
  agenda: string
  updated_at: string
}

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

export async function listMeetings(): Promise<Meeting[]> {
  const { data: rows, error } = await supabase.from('meetings').select('*').order('meeting_date', { ascending: true })
  if (error) {
    console.error('listMeetings error', error)
    return []
  }
  const meetings: Meeting[] = []
  for (const row of rows as MeetingRow[]) {
    const { data: attendeeRows } = await supabase
      .from('meeting_attendees')
      .select('profiles(name)')
      .eq('meeting_id', row.id)
    const attendees = (attendeeRows || []).map((a: any) => a.profiles?.name).filter(Boolean)
    meetings.push({
      id: row.id,
      title: row.title,
      date: row.meeting_date,
      time: formatTime(row.meeting_time),
      duration: `${row.duration_minutes} min`,
      platform: row.platform,
      attendees,
      status: row.status,
      agenda: row.agenda ?? '',
      updatedAt: row.updated_at,
    })
  }
  return meetings
}

export async function createMeeting(
  input: { title: string; date: string; time: string; durationMinutes: number; platform: MeetingPlatform; attendeeIds: string[]; agenda: string },
  myId: string,
): Promise<Meeting> {
  const { data, error } = await supabase
    .from('meetings')
    .insert({
      title: input.title,
      meeting_date: input.date,
      meeting_time: input.time,
      duration_minutes: input.durationMinutes,
      platform: input.platform,
      agenda: input.agenda,
      created_by: myId,
      status: 'Scheduled',
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  const row = data as MeetingRow
  const attendeeIds = Array.from(new Set([...input.attendeeIds, myId]))
  if (attendeeIds.length) {
    const { error: attendeeErr } = await supabase
      .from('meeting_attendees')
      .insert(attendeeIds.map((user_id) => ({ meeting_id: row.id, user_id })))
    if (attendeeErr) console.error('meeting_attendees insert error', attendeeErr)
  }
  const profiles = await listProfiles()
  const attendees = profiles.filter((p) => attendeeIds.includes(p.id)).map((p) => p.name)
  return {
    id: row.id,
    title: row.title,
    date: row.meeting_date,
    time: formatTime(row.meeting_time),
    duration: `${row.duration_minutes} min`,
    platform: row.platform,
    attendees,
    status: row.status,
    agenda: row.agenda ?? '',
    updatedAt: row.updated_at,
  }
}

export async function rescheduleMeeting(id: string, date: string, time: string) {
  const { error } = await supabase
    .from('meetings')
    .update({ meeting_date: date, meeting_time: time, status: 'Rescheduled' })
    .eq('id', id)
  if (error) console.error('rescheduleMeeting error', error)
}

export async function cancelMeeting(id: string) {
  const { error } = await supabase.from('meetings').update({ status: 'Cancelled' }).eq('id', id)
  if (error) console.error('cancelMeeting error', error)
}

// ---------- Notifications ----------

export async function listNotifications(userId: string): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('listNotifications error', error)
    return []
  }
  return data.map((row: any) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    detail: row.detail ?? '',
    read: row.read,
    timestamp: new Date(row.created_at).toLocaleString(),
  }))
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id)
  if (error) console.error('markNotificationRead error', error)
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
  if (error) console.error('markAllNotificationsRead error', error)
}

export function subscribeToNotifications(userId: string, onChange: () => void) {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

// ---------- Chat ----------

export async function listConversations(myId: string): Promise<Contact[]> {
  const { data: memberRows, error: memberErr } = await supabase
    .from('chat_members')
    .select('conversation_id')
    .eq('user_id', myId)
  if (memberErr || !memberRows?.length) return []

  const conversationIds = memberRows.map((m) => m.conversation_id)
  const { data: convRows } = await supabase.from('chat_conversations').select('*').in('id', conversationIds)

  const contacts: Contact[] = []
  for (const conv of convRows || []) {
    const { data: members } = await supabase
      .from('chat_members')
      .select('profiles(id, name, initials, role, department)')
      .eq('conversation_id', conv.id)

    const others = (members || []).map((m: any) => m.profiles).filter((p: any) => p && p.id !== myId)

    const { data: lastMsg } = await supabase
      .from('chat_messages')
      .select('text, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    contacts.push({
      id: conv.id,
      name: conv.is_group ? conv.name ?? 'Group' : others[0]?.name ?? 'Unknown',
      initials: conv.is_group ? (conv.name ?? 'GR').slice(0, 2).toUpperCase() : others[0]?.initials ?? '??',
      role: conv.is_group ? 'Group' : others[0]?.role ?? '',
      department: conv.is_group ? 'Cross-functional' : others[0]?.department ?? '',
      online: false,
      isGroup: conv.is_group,
      members: conv.is_group ? (members || []).length : undefined,
      otherProfileId: conv.is_group ? undefined : others[0]?.id,
      lastMessage: lastMsg?.text ?? 'No messages yet',
      lastTimestamp: lastMsg
        ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
      unread: 0,
    })
  }
  return contacts
}

// Finds an existing 1:1 conversation with `otherId`, or creates one. Returns the conversation id.
export async function getOrCreateDirectConversation(myId: string, otherId: string): Promise<string> {
  const { data: myConvos } = await supabase.from('chat_members').select('conversation_id').eq('user_id', myId)
  const myConvoIds = (myConvos || []).map((r) => r.conversation_id)

  if (myConvoIds.length) {
    const { data: theirConvos } = await supabase
      .from('chat_members')
      .select('conversation_id')
      .eq('user_id', otherId)
      .in('conversation_id', myConvoIds)
    const sharedIds = (theirConvos || []).map((r) => r.conversation_id)
    if (sharedIds.length) {
      const { data: groupCheck } = await supabase
        .from('chat_conversations')
        .select('id')
        .in('id', sharedIds)
        .eq('is_group', false)
        .limit(1)
        .maybeSingle()
      if (groupCheck) return groupCheck.id
    }
  }

  const newId = crypto.randomUUID()
  const { error } = await supabase
    .from('chat_conversations')
    .insert({ id: newId, is_group: false, created_by: myId })
  if (error) throw new Error(error.message)

  // Insert your own membership first — this is trivially allowed and must
  // commit before the "conversation creator" check (used for the other
  // person's row) can see it via chat_conversations' RLS policy.
  const { error: selfMemberErr } = await supabase.from('chat_members').insert({ conversation_id: newId, user_id: myId })
  if (selfMemberErr) throw new Error(selfMemberErr.message)

  const { error: otherMemberErr } = await supabase
    .from('chat_members')
    .insert({ conversation_id: newId, user_id: otherId })
  if (otherMemberErr) throw new Error(otherMemberErr.message)

  return newId
}

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('listMessages error', error)
    return []
  }
  return data.map((row: any) => ({
    id: row.id,
    senderId: row.sender_id,
    text: row.text,
    timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: row.status,
    attachment: row.attachment ?? undefined,
  }))
}

export async function sendMessage(conversationId: string, senderId: string, text: string) {
  const { error } = await supabase.from('chat_messages').insert({ conversation_id: conversationId, sender_id: senderId, text, status: 'sent' })
  if (error) console.error('sendMessage error', error)
}

export function subscribeToMessages(conversationId: string, onInsert: (msg: ChatMessage) => void) {
  const channel = supabase
    .channel(`messages-${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        const row: any = payload.new
        onInsert({
          id: row.id,
          senderId: row.sender_id,
          text: row.text,
          timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: row.status,
          attachment: row.attachment ?? undefined,
        })
      },
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

// ---------- AI Assistant ----------
// Note: ai_messages has no language column, so history is stored/loaded as one continuous thread per user.

export async function listAIMessages(userId: string): Promise<AIMessage[]> {
  const { data, error } = await supabase
    .from('ai_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('listAIMessages error', error)
    return []
  }
  return data.map((row: any) => ({
    id: row.id,
    role: row.role,
    text: row.text,
    timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }))
}

export async function saveAIMessage(userId: string, role: 'user' | 'assistant', text: string) {
  const { error } = await supabase.from('ai_messages').insert({ user_id: userId, role, text })
  if (error) console.error('saveAIMessage error', error)
}

// Calls the ai-assistant Edge Function (Groq, with function-calling over tasks/meetings/notifications/chat).
export async function askAssistant(
  history: { role: 'user' | 'assistant'; content: string }[],
  language: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: { messages: history, language },
  })
  if (error) {
    console.error('askAssistant error', error)
    return "Sorry, I couldn't reach the assistant service right now."
  }
  if (data?.error) {
    console.error('askAssistant returned error', data.error)
    return "Sorry, something went wrong processing that request."
  }
  return data?.reply ?? "Sorry, I couldn't generate a response."
}

// ---------- Analytics ----------

export interface AnalyticsData {
  kpis: { label: string; value: string; delta: string; positive: boolean }[]
  taskCompletionTrend: { label: string; value: number }[]
  departmentProductivity: { department: string; completion: number }[]
  messagingActivity: { label: string; value: number }[]
  meetingPlatformSplit: { platform: string; value: number; color: string }[]
}

function monthBounds(offsetMonths: number) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - offsetMonths, 1)
  const end = new Date(now.getFullYear(), now.getMonth() - offsetMonths + 1, 1)
  return { start, end, label: start.toLocaleDateString('en-US', { month: 'short' }) }
}

function inRange(dateStr: string, start: Date, end: Date) {
  const d = new Date(dateStr)
  return d >= start && d < end
}

function pct(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : 0
}

function formatDelta(current: number, previous: number, unit = '%') {
  if (previous === 0 && current === 0) return 'No data yet'
  const diff = current - previous
  const sign = diff > 0 ? '+' : diff < 0 ? '' : '±'
  return `${sign}${diff}${unit} vs last month`
}

export async function getAnalytics(myId: string): Promise<AnalyticsData> {
  const [{ data: allTasks }, { data: allMeetings }, { data: aiMsgs }, { data: myChatMsgs }] = await Promise.all([
    supabase.from('tasks').select('status, due_date, department'),
    supabase.from('meetings').select('meeting_date, platform, status'),
    supabase.from('ai_messages').select('created_at').eq('user_id', myId).eq('role', 'user'),
    supabase.from('chat_messages').select('created_at').eq('sender_id', myId),
  ])

  const tasks = allTasks ?? []
  const meetings = allMeetings ?? []
  const aiMessages = aiMsgs ?? []
  const chatMessages = myChatMsgs ?? []

  const thisMonth = monthBounds(0)
  const lastMonth = monthBounds(1)

  // Task completion rate KPI
  const tasksThisMonth = tasks.filter((t: any) => inRange(t.due_date, thisMonth.start, thisMonth.end))
  const tasksLastMonth = tasks.filter((t: any) => inRange(t.due_date, lastMonth.start, lastMonth.end))
  const completionThisMonth = pct(tasksThisMonth.filter((t: any) => t.status === 'Done').length, tasksThisMonth.length)
  const completionLastMonth = pct(tasksLastMonth.filter((t: any) => t.status === 'Done').length, tasksLastMonth.length)

  // AI interactions KPI (personal — ai_messages is owner-scoped by RLS)
  const aiThisMonth = aiMessages.filter((m: any) => inRange(m.created_at, thisMonth.start, thisMonth.end)).length
  const aiLastMonth = aiMessages.filter((m: any) => inRange(m.created_at, lastMonth.start, lastMonth.end)).length

  // Meetings held KPI
  const meetingsThisMonth = meetings.filter(
    (m: any) => m.status !== 'Cancelled' && inRange(m.meeting_date, thisMonth.start, thisMonth.end),
  ).length
  const meetingsLastMonth = meetings.filter(
    (m: any) => m.status !== 'Cancelled' && inRange(m.meeting_date, lastMonth.start, lastMonth.end),
  ).length

  // Messages sent KPI (personal — chat_messages is conversation-scoped by RLS)
  const msgsThisMonth = chatMessages.filter((m: any) => inRange(m.created_at, thisMonth.start, thisMonth.end)).length
  const msgsLastMonth = chatMessages.filter((m: any) => inRange(m.created_at, lastMonth.start, lastMonth.end)).length

  const kpis = [
    {
      label: 'Task completion rate',
      value: `${completionThisMonth}%`,
      delta: formatDelta(completionThisMonth, completionLastMonth),
      positive: completionThisMonth >= completionLastMonth,
    },
    {
      label: 'Your AI interactions',
      value: `${aiThisMonth}`,
      delta: formatDelta(aiThisMonth, aiLastMonth, ''),
      positive: aiThisMonth >= aiLastMonth,
    },
    {
      label: 'Meetings held',
      value: `${meetingsThisMonth}`,
      delta: formatDelta(meetingsThisMonth, meetingsLastMonth, ''),
      positive: meetingsThisMonth >= meetingsLastMonth,
    },
    {
      label: 'Your messages sent',
      value: `${msgsThisMonth}`,
      delta: formatDelta(msgsThisMonth, msgsLastMonth, ''),
      positive: msgsThisMonth >= msgsLastMonth,
    },
  ]

  // Task completion trend, last 6 months (by due_date)
  const taskCompletionTrend = Array.from({ length: 6 }, (_, i) => 5 - i).map((offset) => {
    const { start, end, label } = monthBounds(offset)
    const bucket = tasks.filter((t: any) => inRange(t.due_date, start, end))
    return { label, value: pct(bucket.filter((t: any) => t.status === 'Done').length, bucket.length) }
  })

  // Department-wise productivity (all-time, plant-wide)
  const departments = Array.from(new Set(tasks.map((t: any) => t.department))).filter(Boolean)
  const departmentProductivity = departments.map((dept) => {
    const deptTasks = tasks.filter((t: any) => t.department === dept)
    return { department: dept as string, completion: pct(deptTasks.filter((t: any) => t.status === 'Done').length, deptTasks.length) }
  })

  // Your messaging activity, last 7 days
  const messagingActivity = Array.from({ length: 7 }, (_, i) => 6 - i).map((offset) => {
    const day = new Date()
    day.setDate(day.getDate() - offset)
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate())
    const dayEnd = new Date(dayStart.getTime() + 86400000)
    const count = chatMessages.filter((m: any) => inRange(m.created_at, dayStart, dayEnd)).length
    return { label: dayStart.toLocaleDateString('en-US', { weekday: 'short' }), value: count }
  })

  // Meeting volume by platform (all-time, plant-wide, excluding cancelled)
  const platformColors: Record<string, string> = { 'Google Meet': '#1E8A5F', Zoom: '#3457A6', Webex: '#D98E04' }
  const activeMeetings = meetings.filter((m: any) => m.status !== 'Cancelled')
  const platforms = Array.from(new Set(activeMeetings.map((m: any) => m.platform)))
  const meetingPlatformSplit = platforms.map((platform) => ({
    platform: platform as string,
    value: pct(activeMeetings.filter((m: any) => m.platform === platform).length, activeMeetings.length),
    color: platformColors[platform as string] ?? '#8FA8DA',
  }))

  return { kpis, taskCompletionTrend, departmentProductivity, messagingActivity, meetingPlatformSplit }
}

export type Page =
  | 'home'
  | 'assistant'
  | 'chat'
  | 'tasks'
  | 'meetings'
  | 'notifications'
  | 'analytics'
  | 'settings'

export type Role = 'Employee' | 'Team Lead' | 'Manager' | 'Admin'

export interface DbProfile {
  id: string
  name: string
  initials: string
  role: Role
  department: string
  employee_id: string
  language: 'English' | 'Hindi' | 'Telugu'
  email: string
  plant: string
}

export interface CurrentUser {
  name: string
  initials: string
  role: Role
  department: string
  employeeId: string
  language: 'English' | 'Hindi' | 'Telugu'
  email: string
  plant: string
}

export type TaskStatus = 'Pending' | 'In Progress' | 'Done'
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical'

export interface Task {
  id: string
  title: string
  description: string
  assigneeId: string | null
  assignee: string
  assigneeInitials: string
  dueDate: string
  priority: TaskPriority
  status: TaskStatus
  department: string
}

export type MeetingPlatform = 'Google Meet' | 'Zoom' | 'Webex'
export type MeetingStatus = 'Scheduled' | 'Rescheduled' | 'Cancelled'

export interface Meeting {
  id: string
  title: string
  date: string
  time: string
  duration: string
  platform: MeetingPlatform
  attendees: string[]
  status: MeetingStatus
  agenda: string
}

export type NotificationType = 'task' | 'meeting' | 'approval' | 'system'

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  detail: string
  timestamp: string
  read: boolean
}

export interface ChatMessage {
  id: string
  senderId: string
  text: string
  timestamp: string
  status: 'sent' | 'delivered' | 'read'
  attachment?: string
}

export interface Contact {
  id: string
  name: string
  initials: string
  role: string
  department: string
  online: boolean
  isGroup?: boolean
  members?: number
  otherProfileId?: string
  lastMessage: string
  lastTimestamp: string
  unread: number
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: string
}

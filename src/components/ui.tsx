import React, { ReactNode, useEffect } from 'react'
import { TaskPriority, TaskStatus, MeetingStatus, NotificationType } from '../types'

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`bg-white border border-line rounded-card shadow-card ${className}`}
    >
      {children}
    </div>
  )
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-sm text-inkmuted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

const priorityColor: Record<TaskPriority, string> = {
  Low: '#8FA8DA',
  Medium: '#D98E04',
  High: '#C2680E',
  Critical: '#C24A3E',
}

export function PriorityTag({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border"
      style={{
        color: priorityColor[priority],
        borderColor: priorityColor[priority] + '40',
        backgroundColor: priorityColor[priority] + '14',
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: priorityColor[priority] }}
      />
      {priority}
    </span>
  )
}

const statusStyle: Record<TaskStatus, string> = {
  Pending: 'text-inkmuted bg-slate-100 border-slate-200',
  'In Progress': 'text-steel-600 bg-steel-50 border-steel-100',
  Done: 'text-signal-green bg-emerald-50 border-emerald-100',
}

export function StatusTag({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyle[status]}`}
    >
      {status}
    </span>
  )
}

const meetingStatusStyle: Record<MeetingStatus, string> = {
  Scheduled: 'text-steel-600 bg-steel-50 border-steel-100',
  Rescheduled: 'text-amber-600 bg-amber-50 border-amber-300/40',
  Cancelled: 'text-signal-red bg-red-50 border-red-100',
}

export function MeetingStatusTag({ status }: { status: MeetingStatus }) {
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${meetingStatusStyle[status]}`}
    >
      {status}
    </span>
  )
}

export function Avatar({
  initials,
  online,
  size = 'md',
}: {
  initials: string
  online?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-[11px]' : size === 'lg' ? 'w-12 h-12 text-sm' : 'w-9 h-9 text-xs'
  return (
    <div className="relative shrink-0">
      <div
        className={`${sizeClass} rounded-full bg-steel-600 text-white font-medium flex items-center justify-center font-display`}
      >
        {initials}
      </div>
      {online !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
            online ? 'bg-signal-green' : 'bg-slate-300'
          }`}
        />
      )}
    </div>
  )
}

export function NotificationDot({ type }: { type: NotificationType }) {
  const color =
    type === 'approval'
      ? '#D98E04'
      : type === 'task'
      ? '#3457A6'
      : type === 'meeting'
      ? '#1E8A5F'
      : '#525A72'
  return <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  className?: string
  type?: 'button' | 'submit'
}) {
  const base =
    'inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2'
  const variants: Record<string, string> = {
    primary: 'bg-steel-600 text-white hover:bg-steel-700',
    secondary: 'bg-white text-ink border border-line hover:bg-slate-50',
    ghost: 'text-inkmuted hover:bg-slate-100',
    danger: 'bg-white text-signal-red border border-red-200 hover:bg-red-50',
  }
  return (
    <button type={type} onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  widthClass = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  widthClass?: string
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        className={`relative bg-white rounded-card shadow-panel border border-line w-full ${widthClass} max-h-[88vh] overflow-y-auto`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-line sticky top-0 bg-white rounded-t-card">
          <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-inkmuted hover:text-ink w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-line px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus:border-steel-500'

// Supabase Edge Function: ai-assistant
// Real AI Assistant backed by Groq (fast open-model inference), with function-calling over your
// actual tasks / meetings / notifications / chat tables. All queries run as
// the calling user (their JWT is forwarded), so existing RLS policies apply
// automatically — this function never bypasses your row-level security.
//
// Deploy:
//   supabase functions deploy ai-assistant
// Set the secret (once):
//   supabase secrets set GROQ_API_KEY=your_key_here
//
// Called from the frontend via:
//   supabase.functions.invoke('ai-assistant', { body: { messages, language } })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

// Injected globally by the Supabase Edge Runtime — provides on-device ML
// models (no external API/secret needed). Used only for policy-search
// embeddings; isolated here so the provider can be swapped later without
// touching anything else in this file.
declare const Supabase: any

async function generateEmbedding(text: string): Promise<number[]> {
  const model = new Supabase.ai.Session('gte-small')
  const embedding = await model.run(text, { mean_pool: true, normalize: true })
  return embedding as number[]
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
// const GROQ_MODEL = 'qwen/qwen3.6-27b'
const GROQ_MODEL = 'qwen/qwen3.8-27b'
const MAX_GROQ_RETRIES = 3
const GROQ_TIMEOUT_MS = 20000
const MAX_ITERATIONS = 5
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504])

// ---------- Logging (never logs API keys / tokens / JWTs / user PII) ----------

function log(requestId: string, message: string, extra?: unknown) {
  if (extra !== undefined) console.log(`[${requestId}] ${message}`, extra)
  else console.log(`[${requestId}] ${message}`)
}

function logError(requestId: string, message: string, extra?: unknown) {
  if (extra !== undefined) console.error(`[${requestId}] ${message}`, extra)
  else console.error(`[${requestId}] ${message}`)
}

function jsonResponse(body: Record<string, unknown>, status: number, requestId: string) {
  return new Response(JSON.stringify({ ...body, requestId }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function friendlyMessageFor(code: string): string {
  switch (code) {
    case 'AUTH_ERROR':
      return 'Your session seems to have expired — please sign in again.'
    case 'PROFILE_ERROR':
      return "I couldn't find your employee profile — please contact your admin."
    case 'GROQ_NETWORK_ERROR':
    case 'GROQ_TIMEOUT':
      return "I'm having trouble reaching the AI service right now — please try again in a moment."
    case 'GROQ_RATE_LIMIT':
      return 'The assistant is a bit busy right now — please try again in a few seconds.'
    case 'GROQ_API_ERROR':
      return 'Something went wrong on the AI service side — please try again.'
    case 'INVALID_AI_RESPONSE':
    case 'EMPTY_AI_RESPONSE':
      return "I didn't get a clear answer that time — could you try rephrasing your request?"
    case 'MAX_TOOL_ITERATIONS':
      return "I wasn't able to finish that request — could you rephrase it or break it into smaller steps?"
    case 'CONFIG_ERROR':
      return 'The assistant is not fully configured yet. Please contact your admin.'
    case 'INVALID_REQUEST':
      return "Sorry, that request didn't come through correctly. Please try again."
    default:
      return 'Sorry, something went wrong. Please try again.'
  }
}

// ---------- Tool schema (OpenAI-style function calling; Groq is compatible) ----------

const tools = [
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: "List the caller's tasks, optionally filtered by status or overdue-only.",
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['Pending', 'In Progress', 'Done'] },
          overdue_only: { type: 'boolean' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description:
        'Create a new task, optionally assigned to a named colleague, or auto-assigned to someone in a given ' +
        'department. Only set assign_to_department after the user has confirmed it — never set it on the first call.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          assignee_name: { type: 'string', description: 'Full name of the person to assign to; omit for self.' },
          assign_to_department: {
            type: 'string',
            description:
              'Set only after the user confirms — auto-assigns to someone in this department instead of a named person.',
          },
          due_date: { type: 'string', description: 'YYYY-MM-DD' },
          due_time: { type: 'string', description: 'Optional HH:MM in 24-hour time, e.g. "by 2 PM" -> "14:00".' },
          priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
        },
        required: ['title', 'due_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task_status',
      description: "Update a task's status. Match the task by its title (partial match ok).",
      parameters: {
        type: 'object',
        properties: {
          task_title: { type: 'string' },
          new_status: { type: 'string', enum: ['Pending', 'In Progress', 'Done'] },
        },
        required: ['task_title', 'new_status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_meetings',
      description: "List the caller's meetings.",
      parameters: {
        type: 'object',
        properties: { range: { type: 'string', enum: ['today', 'week', 'all'] } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_meeting',
      description: 'Schedule a new meeting and add attendees by name.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          time: { type: 'string', description: 'HH:MM in 24-hour time' },
          duration_minutes: { type: 'number' },
          platform: { type: 'string', enum: ['Google Meet', 'Zoom', 'Webex'] },
          attendee_names: { type: 'array', items: { type: 'string' } },
          agenda: { type: 'string' },
          meeting_link: { type: 'string', description: 'Optional video call URL, if the user provides one.' },
        },
        required: ['title', 'date', 'time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_notifications',
      description: "List the caller's notifications.",
      parameters: {
        type: 'object',
        properties: { unread_only: { type: 'boolean' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_notification_read',
      description: 'Mark one notification as read, matched by a snippet of its title.',
      parameters: {
        type: 'object',
        properties: { title_snippet: { type: 'string' } },
        required: ['title_snippet'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_message',
      description: 'Send a direct chat message to a named colleague.',
      parameters: {
        type: 'object',
        properties: {
          recipient_name: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['recipient_name', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task_summary',
      description: "Summarize the caller's task counts by status, including overdue count.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_leave_balance',
      description:
        "Get the caller's own personal leave balance (entitled, used, remaining days), by leave type. " +
        'Use for personal balance questions, not general policy entitlement questions.',
      parameters: {
        type: 'object',
        properties: {
          leave_type: { type: 'string', description: 'e.g. Casual, Sick, Annual. Omit to return all types.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_team_tasks',
      description:
        "For Managers/Team Leads/Admins only: list tasks belonging to the caller's direct reports (not their own), " +
        'optionally filtered by status. Use for "what is my team working on" type questions.',
      parameters: {
        type: 'object',
        properties: { status: { type: 'string', enum: ['Pending', 'In Progress', 'Done'] } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tasks_by_department',
      description:
        'For Managers/Admins only: summarize task counts (total, done, overdue) grouped by department, or for one ' +
        'named department show the individual team members and their task status. Use for cross-department ' +
        'questions like "which department has the most overdue tasks".',
      parameters: {
        type: 'object',
        properties: { department: { type: 'string', description: 'Optional — drill into one department by name.' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_meeting_availability',
      description:
        'Checks for scheduling conflicts among named attendees (or everyone in a named department) within a date ' +
        'and time window, using meetings already in this system. Proposes a free slot. Does NOT book anything or ' +
        'check external calendars — always confirm the proposed slot with the user before calling create_meeting.',
      parameters: {
        type: 'object',
        properties: {
          attendee_names: { type: 'array', items: { type: 'string' } },
          department: { type: 'string', description: 'Optional — include everyone in this department as attendees.' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          window_start: { type: 'string', description: 'HH:MM 24-hour, start of the search window' },
          window_end: { type: 'string', description: 'HH:MM 24-hour, end of the search window' },
          duration_minutes: { type: 'number' },
        },
        required: ['date', 'window_start', 'window_end'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_meeting',
      description:
        "Reschedules a meeting the caller organized, matched by its title (partial match ok), to a new date/time. " +
        'Updates the existing meeting in place — never creates a duplicate.',
      parameters: {
        type: 'object',
        properties: {
          meeting_title: { type: 'string' },
          new_date: { type: 'string', description: 'YYYY-MM-DD' },
          new_time: { type: 'string', description: 'HH:MM 24-hour' },
        },
        required: ['meeting_title', 'new_date', 'new_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_onboarding_checklist',
      description:
        'Creates the standard set of onboarding tasks (IT setup, policy acknowledgement, induction module, meet ' +
        'your buddy) assigned to a named new employee.',
      parameters: {
        type: 'object',
        properties: { employee_name: { type: 'string' } },
        required: ['employee_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_policy',
      description:
        'Search approved organizational policy documents (HR, Finance, IT, Admin, Plant Operations — e.g. leave, WFH, expenses, security, safety, conduct) for the answer to a policy question. Only use for genuine policy questions, never for tasks/meetings/notifications/chat.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The policy question or topic to search for.' },
          department: { type: 'string', enum: ['HR', 'Finance', 'IT', 'Admin', 'Plant Operations'] },
          policy_type: { type: 'string', description: 'Optional narrower category, e.g. Leave, WFH, Travel, Security, Safety.' },
        },
        required: ['query'],
      },
    },
  },
]

// ---------- Tool execution (all queries run as the calling user; RLS applies) ----------
// Business logic for every tool is unchanged from the existing implementation.
// Only defensive null/array handling was added — no tool's behavior changed.

async function findProfileByName(supabase: any, name: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, initials, department, manager_id')
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ?? null
}

async function getOrCreateDirectConversation(supabase: any, myId: string, otherId: string): Promise<string> {
  const { data: myConvos } = await supabase.from('chat_members').select('conversation_id').eq('user_id', myId)
  const myConvoIds = (myConvos || []).map((r: any) => r.conversation_id)

  if (myConvoIds.length) {
    const { data: theirConvos } = await supabase
      .from('chat_members')
      .select('conversation_id')
      .eq('user_id', otherId)
      .in('conversation_id', myConvoIds)
    const sharedIds = (theirConvos || []).map((r: any) => r.conversation_id)
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
  const { error } = await supabase.from('chat_conversations').insert({ id: newId, is_group: false, created_by: myId })
  if (error) throw new Error(error.message)
  const { error: selfErr } = await supabase.from('chat_members').insert({ conversation_id: newId, user_id: myId })
  if (selfErr) throw new Error(selfErr.message)
  const { error: otherErr } = await supabase.from('chat_members').insert({ conversation_id: newId, user_id: otherId })
  if (otherErr) throw new Error(otherErr.message)
  return newId
}

async function executeTool(supabase: any, me: any, name: string, args: any): Promise<any> {
  switch (name) {
    case 'list_tasks': {
      let q = supabase.from('tasks').select('title, due_date, status, priority').eq('assignee_id', me.id)
      if (args.status) q = q.eq('status', args.status)
      if (args.overdue_only) q = q.lt('due_date', new Date().toISOString().slice(0, 10)).neq('status', 'Done')
      const { data, error } = await q.order('due_date', { ascending: true })
      if (error) return { error: error.message }
      return { tasks: data ?? [] }
    }

    case 'create_task': {
      let assigneeId = me.id
      let taskDepartment = me.department
      let fyiPersonId: string | null = null // notified but not the actual assignee (see dual-assignment note below)

      let namedPerson: { id: string; name: string; department?: string } | null = null
      if (args.assignee_name) {
        namedPerson = await findProfileByName(supabase, args.assignee_name)
        if (!namedPerson) return { error: `No employee found matching "${args.assignee_name}".` }
      }

      if (args.assign_to_department) {
        const { data: deptProfiles, error: deptErr } = await supabase
          .from('profiles')
          .select('id, name, role')
          .eq('department', args.assign_to_department)
        if (deptErr) return { error: deptErr.message }
        if (!deptProfiles || deptProfiles.length === 0) {
          return {
            error:
              `No employees found with department "${args.assign_to_department}". ` +
              `Ask the user who to assign it to instead.`,
          }
        }
        const rolePriority: Record<string, number> = { Manager: 0, 'Team Lead': 1, Admin: 2 }
        deptProfiles.sort((a: any, b: any) => (rolePriority[a.role] ?? 9) - (rolePriority[b.role] ?? 9))

        // Dual-assignment rule: a department-relevant task always goes to
        // someone in that department by default. If the user also named a
        // specific person, honor that name as the actual assignee ONLY if
        // they're genuinely in that department; otherwise the department
        // pick becomes the assignee and the named person is kept in the
        // loop via a separate notification instead (tasks have one
        // assignee, so this is how both intents get satisfied).
        if (namedPerson && (namedPerson as any).department === args.assign_to_department) {
          assigneeId = namedPerson.id
        } else {
          assigneeId = deptProfiles[0].id
          if (namedPerson) fyiPersonId = namedPerson.id
        }
        taskDepartment = args.assign_to_department
      } else if (namedPerson) {
        assigneeId = namedPerson.id
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: args.title,
          description: args.description ?? '',
          assignee_id: assigneeId,
          due_date: args.due_date,
          due_time: args.due_time ?? null,
          priority: args.priority ?? 'Medium',
          department: taskDepartment,
          created_by: me.id,
        })
        .select('id, title, due_date, due_time, priority, status, assignee:assignee_id(name)')
        .single()
      if (error) return { error: error.message }
      if (!data) return { error: 'Task was not created.' }

      // Notify the assignee (if it's not the caller creating it for themself).
      if (assigneeId !== me.id) {
        await supabase.from('notifications').insert({
          user_id: assigneeId,
          type: 'task',
          title: 'New task assigned to you',
          detail: `${me.name} assigned you: "${data.title}"`,
        })
      }
      // Keep the originally-named person informed if the task actually went
      // to a department pick instead of them.
      if (fyiPersonId) {
        await supabase.from('notifications').insert({
          user_id: fyiPersonId,
          type: 'task',
          title: 'Task routed to a colleague',
          detail: `"${data.title}" was routed to someone in ${taskDepartment} instead of you, since that's who handles this.`,
        })
      }

      return {
        created: data,
        assigned_to: (data as any).assignee?.name ?? 'Unassigned',
        reference: (data as any).id.slice(0, 8).toUpperCase(),
      }
    }

    case 'update_task_status': {
      const { data: match, error: findErr } = await supabase
        .from('tasks')
        .select('id, title')
        .ilike('title', `%${args.task_title}%`)
        .or(`assignee_id.eq.${me.id},created_by.eq.${me.id}`)
        .limit(1)
        .maybeSingle()
      if (findErr) return { error: findErr.message }
      if (!match) return { error: `No task found matching "${args.task_title}".` }
      const { error } = await supabase.from('tasks').update({ status: args.new_status }).eq('id', match.id)
      if (error) return { error: error.message }
      return { updated: match.title, new_status: args.new_status }
    }

    case 'list_meetings': {
      const { data: attendeeRows, error: attendeeErr } = await supabase
        .from('meeting_attendees')
        .select('meeting_id')
        .eq('user_id', me.id)
      if (attendeeErr) return { error: attendeeErr.message }
      const meetingIds = (attendeeRows || []).map((r: any) => r.meeting_id)
      if (!meetingIds.length) return { meetings: [] }
      let q = supabase
        .from('meetings')
        .select('title, meeting_date, meeting_time, duration_minutes, platform, status')
        .in('id', meetingIds)
      const today = new Date().toISOString().slice(0, 10)
      if (args.range === 'today') q = q.eq('meeting_date', today)
      if (args.range === 'week') {
        const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
        q = q.gte('meeting_date', today).lte('meeting_date', weekAhead)
      }
      const { data, error } = await q.order('meeting_date', { ascending: true })
      if (error) return { error: error.message }
      return { meetings: data ?? [] }
    }

    case 'create_meeting': {
      const newId = crypto.randomUUID()
      const { error } = await supabase.from('meetings').insert({
        id: newId,
        title: args.title,
        meeting_date: args.date,
        meeting_time: `${args.time}:00`,
        duration_minutes: args.duration_minutes ?? 30,
        platform: args.platform ?? 'Google Meet',
        agenda: args.agenda ?? '',
        meeting_link: args.meeting_link ?? null,
        status: 'Scheduled',
        created_by: me.id,
      })
      if (error) return { error: error.message }

      const attendeeIds = new Set<string>([me.id])
      for (const name of args.attendee_names ?? []) {
        const p = await findProfileByName(supabase, name)
        if (p) attendeeIds.add(p.id)
      }
      for (const id of attendeeIds) {
        const { error: attendeeErr } = await supabase.from('meeting_attendees').insert({ meeting_id: newId, user_id: id })
        if (attendeeErr) {
          // Meeting row already exists at this point; surface the attendee
          // failure but don't roll back — the meeting itself did get created.
          return { error: `Meeting created, but adding an attendee failed: ${attendeeErr.message}` }
        }
      }
      return { created: args.title, date: args.date, time: args.time, attendees: attendeeIds.size }
    }

    case 'list_notifications': {
      let q = supabase.from('notifications').select('title, detail, type, read, created_at').eq('user_id', me.id)
      if (args.unread_only !== false) q = q.eq('read', false)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(10)
      if (error) return { error: error.message }
      return { notifications: data ?? [] }
    }

    case 'mark_notification_read': {
      const { data: match, error: findErr } = await supabase
        .from('notifications')
        .select('id, title')
        .eq('user_id', me.id)
        .ilike('title', `%${args.title_snippet}%`)
        .limit(1)
        .maybeSingle()
      if (findErr) return { error: findErr.message }
      if (!match) return { error: `No notification found matching "${args.title_snippet}".` }
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', match.id)
      if (error) return { error: error.message }
      return { marked_read: match.title }
    }

    case 'send_message': {
      const p = await findProfileByName(supabase, args.recipient_name)
      if (!p) return { error: `No employee found matching "${args.recipient_name}".` }
      const conversationId = await getOrCreateDirectConversation(supabase, me.id, p.id)
      const { error } = await supabase
        .from('chat_messages')
        .insert({ conversation_id: conversationId, sender_id: me.id, text: args.text, status: 'sent' })
      if (error) return { error: error.message }
      return { sent_to: p.name, text: args.text }
    }

    case 'task_summary': {
      const { data, error } = await supabase.from('tasks').select('status, due_date').eq('assignee_id', me.id)
      if (error) return { error: error.message }
      const rows = data ?? []
      const today = new Date().toISOString().slice(0, 10)
      const summary = {
        pending: rows.filter((t: any) => t.status === 'Pending').length,
        in_progress: rows.filter((t: any) => t.status === 'In Progress').length,
        done: rows.filter((t: any) => t.status === 'Done').length,
        overdue: rows.filter((t: any) => t.status !== 'Done' && t.due_date < today).length,
      }
      return { summary }
    }

    case 'get_leave_balance': {
      let q = supabase
        .from('leave_balances')
        .select('leave_type, year, entitled_days, used_days')
        .eq('user_id', me.id)
      if (args.leave_type) q = q.ilike('leave_type', args.leave_type)
      const { data, error } = await q
      if (error) return { error: error.message }
      const rows = data ?? []
      if (rows.length === 0) {
        return {
          balances: [],
          note: 'No leave balance records found for you yet. Contact HR to have your balance set up.',
        }
      }
      return {
        balances: rows.map((b: any) => ({
          leave_type: b.leave_type,
          year: b.year,
          entitled: b.entitled_days,
          used: b.used_days,
          remaining: b.entitled_days - b.used_days,
        })),
      }
    }

    case 'list_team_tasks': {
      // Relies entirely on RLS: a Manager/Team Lead's tasks SELECT policy
      // already includes their direct reports' rows. No assignee_id filter
      // here is what makes "team" tasks visible instead of just "mine".
      let q = supabase
        .from('tasks')
        .select('title, status, priority, due_date, due_time, assignee:assignee_id(name)')
        .neq('assignee_id', me.id)
      if (args.status) q = q.eq('status', args.status)
      const { data, error } = await q.order('due_date', { ascending: true })
      if (error) return { error: error.message }
      return {
        tasks: (data ?? []).map((t: any) => ({
          title: t.title,
          assignee: t.assignee?.name ?? 'Unknown',
          status: t.status,
          priority: t.priority,
          due_date: t.due_date,
          due_time: t.due_time,
        })),
      }
    }

    case 'list_tasks_by_department': {
      // Relies on RLS: only Admins (or a Manager for their own reports)
      // see rows outside their own — this naturally scopes to what the
      // caller is actually allowed to see.
      let q = supabase.from('tasks').select('department, status, due_date, assignee:assignee_id(name)')
      if (args.department) q = q.eq('department', args.department)
      const { data, error } = await q
      if (error) return { error: error.message }
      const rows = data ?? []
      const today = new Date().toISOString().slice(0, 10)

      if (args.department) {
        return {
          department: args.department,
          members: rows.map((r: any) => ({
            name: r.assignee?.name ?? 'Unknown',
            status: r.status,
            overdue: r.status !== 'Done' && r.due_date < today,
          })),
        }
      }

      const byDept: Record<string, { total: number; done: number; overdue: number }> = {}
      for (const r of rows) {
        const d = r.department ?? 'Unassigned'
        byDept[d] ??= { total: 0, done: 0, overdue: 0 }
        byDept[d].total++
        if (r.status === 'Done') byDept[d].done++
        else if (r.due_date < today) byDept[d].overdue++
      }
      return { departments: byDept }
    }

    case 'check_meeting_availability': {
      let attendeeIds: string[] = []
      for (const name of args.attendee_names ?? []) {
        const p = await findProfileByName(supabase, name)
        if (p) attendeeIds.push(p.id)
      }
      if (args.department) {
        const { data: deptPeople } = await supabase.from('profiles').select('id').eq('department', args.department)
        attendeeIds.push(...(deptPeople ?? []).map((p: any) => p.id))
      }
      attendeeIds = Array.from(new Set(attendeeIds))
      if (attendeeIds.length === 0) return { error: 'No matching attendees found to check availability for.' }

      const { data: attendeeRows, error: attErr } = await supabase
        .from('meeting_attendees')
        .select('meeting_id')
        .in('user_id', attendeeIds)
      if (attErr) return { error: attErr.message }
      const meetingIds = Array.from(new Set((attendeeRows ?? []).map((r: any) => r.meeting_id)))

      let existing: any[] = []
      if (meetingIds.length) {
        const { data, error } = await supabase
          .from('meetings')
          .select('meeting_time, duration_minutes')
          .in('id', meetingIds)
          .eq('meeting_date', args.date)
          .neq('status', 'Cancelled')
        if (error) return { error: error.message }
        existing = data ?? []
      }

      const duration = args.duration_minutes ?? 30
      const toMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number)
        return h * 60 + m
      }
      const windowStart = toMinutes(args.window_start)
      const windowEnd = toMinutes(args.window_end)
      const busy = existing.map((m: any) => {
        const start = toMinutes(m.meeting_time.slice(0, 5))
        return { start, end: start + m.duration_minutes }
      })

      for (let slot = windowStart; slot + duration <= windowEnd; slot += 15) {
        const conflict = busy.some((b) => slot < b.end && slot + duration > b.start)
        if (!conflict) {
          const h = Math.floor(slot / 60)
          const m = slot % 60
          return {
            available: true,
            proposed_time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
            date: args.date,
            note: 'This only checks meetings already in this system, not any external calendar.',
          }
        }
      }
      return {
        available: false,
        note: 'No free slot found in that window based on meetings already in this system. Try a different window or day.',
      }
    }

    case 'reschedule_meeting': {
      const { data: match, error: findErr } = await supabase
        .from('meetings')
        .select('id, title')
        .ilike('title', `%${args.meeting_title}%`)
        .eq('created_by', me.id)
        .limit(1)
        .maybeSingle()
      if (findErr) return { error: findErr.message }
      if (!match) return { error: `No meeting you organized matches "${args.meeting_title}".` }
      const { error } = await supabase
        .from('meetings')
        .update({ meeting_date: args.new_date, meeting_time: `${args.new_time}:00`, status: 'Rescheduled' })
        .eq('id', match.id)
      if (error) return { error: error.message }
      return { rescheduled: match.title, new_date: args.new_date, new_time: args.new_time }
    }

    case 'create_onboarding_checklist': {
      const person = await findProfileByName(supabase, args.employee_name)
      if (!person) return { error: `No employee found matching "${args.employee_name}".` }
      const dueDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      const standardTasks = [
        'Complete IT setup and system access',
        'Acknowledge company policies',
        'Complete induction module',
        'Meet your assigned buddy / HR contact',
      ]
      const { error } = await supabase.from('tasks').insert(
        standardTasks.map((title) => ({
          title,
          description: 'Standard onboarding task.',
          assignee_id: person.id,
          due_date: dueDate,
          priority: 'Medium',
          department: person.department,
          created_by: me.id,
        })),
      )
      if (error) return { error: error.message }
      return { created_for: person.name, task_count: standardTasks.length, due_date: dueDate }
    }

    case 'search_policy': {
      if (!args.query || typeof args.query !== 'string' || !args.query.trim()) {
        return { error: 'A search query is required to look up policy information.' }
      }

      let queryEmbedding: number[]
      try {
        queryEmbedding = await generateEmbedding(args.query)
      } catch (embedErr) {
        return { error: `Policy search is temporarily unavailable: ${String(embedErr)}` }
      }

      const { data, error } = await supabase.rpc('match_policy_chunks', {
        query_embedding: queryEmbedding,
        match_count: 5,
        filter_department: args.department ?? null,
        filter_policy_type: args.policy_type ?? null,
      })
      if (error) return { error: error.message }

      const rows = data ?? []
      if (rows.length === 0) {
        // Escalate to the relevant department's Manager/Admin so unanswered
        // questions don't just disappear. Best-effort — a failure here
        // never blocks the (already-determined) "not found" answer.
        try {
          const escalateDept = args.department ?? 'HR'
          const { data: escalateTo } = await supabase
            .from('profiles')
            .select('id')
            .eq('department', escalateDept)
            .in('role', ['Manager', 'Admin'])
          for (const person of escalateTo ?? []) {
            await supabase.from('notifications').insert({
              user_id: person.id,
              type: 'system',
              title: 'Unanswered policy question',
              detail: `${me.name} asked: "${args.query}" — no matching policy content was found.`,
            })
          }
        } catch (escErr) {
          console.error('search_policy escalation failed:', String(escErr))
        }

        return {
          results: [],
          note: 'No matching active policy content was found for this question.',
        }
      }

      return {
        results: rows.map((r: any) => ({
          policy_title: r.title,
          version: r.version,
          section: r.section_name,
          page: r.page_number,
          text: r.chunk_text,
        })),
      }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// Wraps executeTool so a THROWN error (e.g. from getOrCreateDirectConversation,
// or findProfileByName's own Supabase error) can never crash the whole request —
// it always becomes a structured tool result the model can react to in plain
// language, instead of a 500 that kills the entire assistant turn.
async function safeExecuteTool(supabase: any, me: any, name: string, args: any, requestId: string): Promise<any> {
  log(requestId, `TOOL_CALL ${name}`)
  try {
    const result = await executeTool(supabase, me, name, args)
    if (result && typeof result === 'object' && 'error' in result) {
      logError(requestId, `TOOL_FAILURE ${name}`, result.error)
      return { success: false, error: 'TOOL_EXECUTION_FAILED', message: String(result.error) }
    }
    log(requestId, `TOOL_SUCCESS ${name}`)
    return { success: true, ...result }
  } catch (err) {
    logError(requestId, `TOOL_FAILURE ${name}`, String(err))
    return { success: false, error: 'TOOL_EXECUTION_FAILED', message: `Unable to complete "${name}".` }
  }
}

// ---------- Reusable Groq request function with retry + timeout ----------

interface GroqResult {
  ok: boolean
  data?: any
  status?: number
  errorCode?: string
  errorMessage?: string
}

async function callGroq(apiKey: string, body: unknown, requestId: string): Promise<GroqResult> {
  let last: { errorCode: string; errorMessage: string; status?: number } | null = null

  for (let attempt = 1; attempt <= MAX_GROQ_RETRIES; attempt++) {
    if (attempt > 1) {
      const delay = attempt === 2 ? 500 : 1000
      log(requestId, `GROQ_RETRY_DELAY_${delay}MS`)
      await new Promise((r) => setTimeout(r, delay))
    }
    log(requestId, `GROQ_ATTEMPT_${attempt}`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS)

    try {
      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      log(requestId, `GROQ_STATUS_${response.status}`)

      let data: any
      try {
        data = await response.json()
      } catch (parseErr) {
        last = { errorCode: 'GROQ_API_ERROR', errorMessage: 'Groq returned a non-JSON response', status: response.status }
        logError(requestId, 'GROQ_RESPONSE_PARSE_FAILED', String(parseErr))
        if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_GROQ_RETRIES) continue
        return { ok: false, status: response.status, errorCode: last.errorCode, errorMessage: last.errorMessage }
      }

      if (response.ok) {
        return { ok: true, status: response.status, data }
      }

      const isRateLimit = response.status === 429
      const errorCode = isRateLimit ? 'GROQ_RATE_LIMIT' : 'GROQ_API_ERROR'
      const errorMessage = typeof data === 'object' ? JSON.stringify(data).slice(0, 500) : String(data)
      last = { errorCode, errorMessage, status: response.status }

      if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_GROQ_RETRIES) {
        log(requestId, `GROQ_RETRYABLE_ERROR_${response.status}`)
        continue
      }
      // Not retryable (400/401/403/404/etc.) or out of attempts — stop now.
      return { ok: false, status: response.status, errorCode, errorMessage }
    } catch (err) {
      clearTimeout(timeoutId)
      const isAbort = err instanceof Error && err.name === 'AbortError'
      const errorCode = isAbort ? 'GROQ_TIMEOUT' : 'GROQ_NETWORK_ERROR'
      last = { errorCode, errorMessage: String(err) }
      logError(requestId, `${errorCode}_ATTEMPT_${attempt}`, String(err))
      if (attempt < MAX_GROQ_RETRIES) continue
      return { ok: false, errorCode, errorMessage: last.errorMessage }
    }
  }

  return {
    ok: false,
    errorCode: last?.errorCode ?? 'GROQ_NETWORK_ERROR',
    errorMessage: last?.errorMessage ?? 'Unknown error after retries',
  }
}

// Validates the full chain before anything touches .content / .tool_calls.
function validateGroqData(data: any): { valid: boolean; message?: any } {
  if (!data || !Array.isArray(data.choices) || data.choices.length === 0) return { valid: false }
  const choice = data.choices[0]
  if (!choice || typeof choice !== 'object' || !choice.message) return { valid: false }
  return { valid: true, message: choice.message }
}

// ---------- Grounding guards: keep answers inside the database ----------

// Questions about live data or company policy must be answered from a tool
// result. When one of these appears in the user's latest message, the first
// model call is forced to use a tool instead of answering from thin air.
const DATA_INTENT =
  /\b(tasks?|meetings?|calendar|schedule|notifications?|leaves?|balance|overdue|pending|assigned|team|policy|policies|wfh|work from home|reimburse\w*|entitle\w*|allowed|safety|sop|procedure)\b|कार्य|टास्क|मीटिंग|छुट्टी|अवकाश|नीति|టాస్క్|మీటింగ్|సెలవు|విధానం/i

const LIST_TOOLS = new Set(['list_tasks', 'list_team_tasks', 'list_meetings', 'list_notifications'])

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v.length >= 3) out.push(v)
  } else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out))
  else if (value && typeof value === 'object') Object.values(value as object).forEach((v) => collectStrings(v, out))
  return out
}

// Returns the bullet/numbered lines in `answer` that match nothing a tool returned.
function findUngroundedItems(answer: string, toolResults: { name: string; result: any }[]): string[] {
  const known = collectStrings(toolResults.map((t) => t.result))
  const bad: string[] = []
  for (const line of answer.split('\n')) {
    const m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (!m) continue
    const item = m[1].replace(/[*_`]/g, '').toLowerCase().trim()
    if (item.length < 4) continue
    const grounded = known.some((k) => k.length >= 4 && (item.includes(k) || k.includes(item)))
    if (!grounded) bad.push(m[1])
  }
  return bad
}

// Plain, deterministic rendering of tool results — used when the model's own
// wording can't be trusted. Contains only what the database returned.
function renderFromResults(toolResults: { name: string; result: any }[]): string {
  const parts: string[] = []
  for (const { name, result } of toolResults) {
    if (!LIST_TOOLS.has(name) || !result) continue
    if (name === 'list_tasks' || name === 'list_team_tasks') {
      const rows = result.tasks ?? []
      if (rows.length === 0) parts.push('No tasks found.')
      else
        parts.push(
          rows
            .map(
              (t: any) =>
                `- ${t.title}${t.assignee ? ` (${t.assignee})` : ''} — ${t.status ?? ''} — due ${t.due_date ?? '?'}${
                  t.due_time ? ' ' + String(t.due_time).slice(0, 5) : ''
                }`,
            )
            .join('\n'),
        )
    } else if (name === 'list_meetings') {
      const rows = result.meetings ?? []
      if (rows.length === 0) parts.push('No meetings found.')
      else
        parts.push(
          rows
            .map((m: any) => `- ${m.title} — ${m.meeting_date} ${String(m.meeting_time ?? '').slice(0, 5)} — ${m.platform} (${m.status})`)
            .join('\n'),
        )
    } else if (name === 'list_notifications') {
      const rows = result.notifications ?? []
      if (rows.length === 0) parts.push('No notifications found.')
      else parts.push(rows.map((n: any) => `- ${n.title}${n.detail ? ': ' + n.detail : ''}`).join('\n'))
    }
  }
  return parts.join('\n\n') || 'No matching records were found.'
}

// ---------- Main handler ----------

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID()

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  log(requestId, 'REQUEST_RECEIVED')

  try {
    let messages: any[]
    let language: string | undefined
    try {
      const body = await req.json()
      messages = Array.isArray(body?.messages) ? body.messages.slice(-10) : []
      while (messages.length > 1 && messages[0]?.role === 'assistant') messages.shift()
      language = body?.language
      log(requestId, 'REQUEST_BODY_PARSED')
    } catch (err) {
      logError(requestId, 'REQUEST_BODY_PARSE_FAILED', String(err))
      return jsonResponse({ error: 'INVALID_REQUEST', reply: friendlyMessageFor('INVALID_REQUEST') }, 200, requestId)
    }

    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) {
      logError(requestId, 'MISSING_GROQ_API_KEY')
      return jsonResponse({ error: 'CONFIG_ERROR', reply: friendlyMessageFor('CONFIG_ERROR') }, 200, requestId)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !supabaseAnonKey) {
      logError(requestId, 'MISSING_SUPABASE_ENV')
      return jsonResponse({ error: 'CONFIG_ERROR', reply: friendlyMessageFor('CONFIG_ERROR') }, 200, requestId)
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })

    let userId: string
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data?.user) {
        logError(requestId, 'AUTH_FAILURE', error?.message)
        return jsonResponse({ error: 'AUTH_ERROR', reply: friendlyMessageFor('AUTH_ERROR') }, 200, requestId)
      }
      userId = data.user.id
      log(requestId, 'AUTH_SUCCESS')
    } catch (err) {
      logError(requestId, 'AUTH_FAILURE', String(err))
      return jsonResponse({ error: 'AUTH_ERROR', reply: friendlyMessageFor('AUTH_ERROR') }, 200, requestId)
    }

    let me: any
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error || !data) {
        logError(requestId, 'PROFILE_FAILURE', error?.message)
        return jsonResponse({ error: 'PROFILE_ERROR', reply: friendlyMessageFor('PROFILE_ERROR') }, 200, requestId)
      }
      me = data
      log(requestId, 'PROFILE_SUCCESS')
    } catch (err) {
      logError(requestId, 'PROFILE_FAILURE', String(err))
      return jsonResponse({ error: 'PROFILE_ERROR', reply: friendlyMessageFor('PROFILE_ERROR') }, 200, requestId)
    }

    const today = new Date().toISOString().slice(0, 10)
    const systemPrompt =
      `You are the Innodatatics Workplace Assistant for a manufacturing company. The caller is ${me.name}, ` +
      `a ${me.role} in ${me.department}, employee id ${me.employee_id}. Today's date is ${today}. ` +
      `Use the provided tools to answer questions and take actions on tasks, meetings, notifications, and chat. ` +
      `Always resolve relative dates ("tomorrow", "next Tuesday") against today's date. ` +
      `If required details are missing (e.g. no due date, no time), ask a concise follow-up question instead of guessing. ` +
      `Keep replies short and practical. Respond in ${language || 'English'}. ` +
      `Format with real line breaks between sections and list items (not run-on text) — put each bullet on its own ` +
      `line starting with "- ", and put each heading on its own line.\n\n` +
      `POLICY RULES: For genuine organizational-policy questions (HR, Finance, IT, Admin, or Plant Operations — ` +
      `e.g. leave, WFH, expenses, security, safety, conduct), call search_policy before answering; never rely on ` +
      `general knowledge for these. Answer ONLY from what search_policy returns, and mention the policy title ` +
      `and section (and page, if given) — e.g. "Source: Leave Policy v3.2 — Section 3.2". If the results don't ` +
      `cover the question, say plainly that the available policies don't specify this and suggest contacting the ` +
      `relevant department — never guess or invent a rule. If multiple results conflict, tell the user there may ` +
      `be a policy conflict rather than picking one yourself. If asked for the caller's own personal balance/usage ` +
      `(e.g. "how many leaves do I have left"), state you cannot access their personal balance, then share the ` +
      `general policy rule if relevant. Never mention tool names, database details, similarity scores, or other ` +
      `internal implementation details. Do not call search_policy for task, meeting, notification, or chat requests.\n\n` +
      `TASK ROUTING: When asked to create a task, if its title/description clearly belongs to a specific ` +
      `department rather than the caller (e.g. "apply for annual leave" is HR, "fix my laptop" is IT), first ask ` +
      `the user to confirm before routing it — e.g. "This looks like an HR matter — want me to assign it to HR ` +
      `instead of you?". Only call create_task with assign_to_department set after they say yes; never set it on ` +
      `the first attempt. If they decline or it's not department-specific, create it for the caller as normal. ` +
      `EXCEPTION: if the user already named a specific person to assign it to AND the task clearly belongs to a ` +
      `different department, do not ask — call create_task with BOTH assignee_name and assign_to_department ` +
      `set; the system assigns it to the right person in that department and keeps the named person informed ` +
      `by notification. Then explain plainly who it went to and who was notified. ` +
      `After creating any task, always tell the user exactly who it was assigned to by name. When a created task ` +
      `has a reference, mention it so they can refer back to it later.\n\n` +
      `LEAVE QUESTIONS: For general entitlement/rule questions (e.g. "how many casual leaves are employees ` +
      `allowed") use search_policy. For the caller's own remaining balance (e.g. "how many leaves do I have ` +
      `left") use get_leave_balance. If the question could mean either (e.g. "how many annual leaves can I ` +
      `take"), use BOTH tools and give one complete answer covering the policy limit and their personal ` +
      `remaining/used days.\n\n` +
      `MAINTENANCE/SAFETY REPORTS: If the message reports an equipment/machine fault, unusual noise, breakdown, ` +
      `or safety hazard, create the task immediately with assign_to_department="Maintenance" — do NOT ask for ` +
      `confirmation first, this is time-critical and different from the routine department-routing case above. ` +
      `Confirm receipt, state who it's assigned to, and give the task's reference number. If asked about the ` +
      `status of something they reported earlier (e.g. "what happened to my complaint/report"), call list_tasks ` +
      `and match it by title/description, then report its current status.\n\n` +
      `TEAM & DEPARTMENT VIEWS: If the caller is a Team Lead/Manager/Admin and asks about their team's work (e.g. ` +
      `"what's pending on my team"), use list_team_tasks, not list_tasks (which only covers the caller's own). ` +
      `For cross-department questions (e.g. "which department has the most overdue tasks"), use ` +
      `list_tasks_by_department. These tools only return what the caller's actual access permits — if they get ` +
      `an empty or partial result, that reflects their real permissions, not a bug.\n\n` +
      `MEETING AVAILABILITY: Before scheduling a meeting with multiple people, call check_meeting_availability ` +
      `first, propose the slot it returns, and WAIT for the user to confirm before calling create_meeting — never ` +
      `book directly off an availability check. This only checks meetings already in this system, not any real ` +
      `external calendar — say so if asked, don't imply it checked Google/Outlook calendars. If a slot has a ` +
      `conflict, suggest the next available one automatically rather than just reporting the conflict. To move an ` +
      `existing meeting, use reschedule_meeting (it updates in place — never creates a duplicate).\n\n` +
      `ONBOARDING: If asked to set up onboarding for a named new employee, use create_onboarding_checklist.\n\n` +
      `ACCURACY: Never invent information — for policy questions this means ONLY using what search_policy ` +
      `returns, and for task/meeting/people questions this means ONLY using what the tools return, never filling ` +
      `in plausible-sounding details. If a tool returns nothing useful, say so plainly rather than guessing.\n\n` +
      `LIVE DATA: Tasks, meetings, notifications and leave balances change constantly. Every time the user ` +
      `asks about them, call the relevant tool again — never answer from earlier messages in this ` +
      `conversation. If the tool returns an empty list, tell the user there are none.`

    let convo: any[] = [{ role: 'system', content: systemPrompt }, ...messages]
    let lastFailureCode: string | null = null
    let toolCallsMade = 0
    const toolResults: { name: string; result: any }[] = []
    const lastUserText = [...messages].reverse().find((m: any) => m?.role === 'user')?.content ?? ''

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const forceTool = i === 0 && toolCallsMade === 0 && DATA_INTENT.test(String(lastUserText))
      const buildBody = (force: boolean) => ({
        model: GROQ_MODEL,
        messages: convo,
        tools,
        max_tokens: 600,
        temperature: 0.1,
        ...(force ? { tool_choice: 'required' } : {}),
      })
      if (forceTool) log(requestId, 'TOOL_USE_FORCED')
      let groqResult = await callGroq(apiKey, buildBody(forceTool), requestId)
      if (!groqResult.ok && forceTool && groqResult.status === 400) {
        // Some model/endpoint combos reject tool_choice — fall back rather than fail the request.
        logError(requestId, 'TOOL_CHOICE_REJECTED_RETRYING_AUTO')
        groqResult = await callGroq(apiKey, buildBody(false), requestId)
      }

      if (!groqResult.ok) {
        logError(requestId, 'REQUEST_FAILURE', `${groqResult.errorCode}: ${groqResult.errorMessage}`)
        return jsonResponse(
          { error: groqResult.errorCode, reply: friendlyMessageFor(groqResult.errorCode ?? 'GROQ_API_ERROR') },
          200,
          requestId,
        )
      }

      const validated = validateGroqData(groqResult.data)
      if (!validated.valid) {
        logError(requestId, 'INVALID_AI_RESPONSE', JSON.stringify(groqResult.data)?.slice(0, 500))
        return jsonResponse(
          { error: 'INVALID_AI_RESPONSE', reply: friendlyMessageFor('INVALID_AI_RESPONSE') },
          200,
          requestId,
        )
      }

      const msg = validated.message

      if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
        convo.push(msg)
        for (const call of msg.tool_calls) {
          let args: any = {}
          try {
            args = call?.function?.arguments ? JSON.parse(call.function.arguments) : {}
          } catch (err) {
            logError(requestId, `TOOL_ARGS_PARSE_FAILED ${call?.function?.name}`, String(err))
          }
          toolCallsMade++
          const result = await safeExecuteTool(supabase, me, call?.function?.name, args, requestId)
          toolResults.push({ name: call?.function?.name, result })
          convo.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
        }
        continue
      }

      // Final turn — no more tool calls.
      const content = typeof msg.content === 'string' ? msg.content.trim() : ''
      if (content.length > 0) {
        // Grounding check: if the answer lists items that no tool returned, discard it
        // and show what the database actually returned instead.
        if (toolResults.some((t) => LIST_TOOLS.has(t.name))) {
          const ungrounded = findUngroundedItems(content, toolResults)
          if (ungrounded.length > 0) {
            logError(requestId, 'UNGROUNDED_ANSWER_REPLACED', JSON.stringify(ungrounded).slice(0, 300))
            return jsonResponse({ reply: renderFromResults(toolResults) }, 200, requestId)
          }
        }
        log(requestId, `FINAL_RESPONSE_LENGTH ${content.length} TOOL_CALLS_MADE ${toolCallsMade}`)
        log(requestId, 'REQUEST_SUCCESS')
        return jsonResponse({ reply: content }, 200, requestId)
      }

      // Empty content on a final turn — this is the "blank response" bug.
      // Nudge the model once more (bounded by the same MAX_ITERATIONS budget)
      // instead of ever shipping "" to the frontend.
      lastFailureCode = 'EMPTY_AI_RESPONSE'
      logError(requestId, 'EMPTY_AI_RESPONSE_RETRY', `iteration=${i}`)
      convo.push({ role: 'user', content: 'Please provide a short confirmation or answer in plain text.' })
    }

    const finalCode = lastFailureCode ?? 'MAX_TOOL_ITERATIONS'
    logError(requestId, finalCode)
    return jsonResponse({ error: finalCode, reply: friendlyMessageFor(finalCode) }, 200, requestId)
  } catch (err) {
    // Last-resort safety net — should rarely, if ever, be reached given the
    // validation above, but guarantees the frontend never sees a raw crash.
    logError(requestId, 'UNHANDLED_EXCEPTION', String(err))
    return jsonResponse({ error: 'UNHANDLED_EXCEPTION', reply: friendlyMessageFor('DEFAULT') }, 200, requestId)
  }
})

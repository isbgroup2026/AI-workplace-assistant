// Supabase Edge Function: ai-assistant
// Real AI Assistant backed by Grok (xAI), with function-calling over your
// actual tasks / meetings / notifications / chat tables. All queries run as
// the calling user (their JWT is forwarded), so existing RLS policies apply
// automatically — this function never bypasses your row-level security.
//
// Deploy:
//   supabase functions deploy ai-assistant
// Set the secret (once):
//   supabase secrets set GROK_API_KEY=your_key_here
//
// Called from the frontend via:
//   supabase.functions.invoke('ai-assistant', { body: { messages, language } })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// ---------- Tool schema (OpenAI-style function calling, xAI is compatible) ----------

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
      description: 'Create a new task, optionally assigned to a named colleague.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          assignee_name: { type: 'string', description: 'Full name of the person to assign to; omit for self.' },
          due_date: { type: 'string', description: 'YYYY-MM-DD' },
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
]

// ---------- Tool execution (all queries run as the calling user; RLS applies) ----------

async function findProfileByName(supabase: any, name: string) {
  const { data } = await supabase.from('profiles').select('id, name, initials').ilike('name', `%${name}%`).limit(1).maybeSingle()
  return data
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
      return { tasks: data }
    }

    case 'create_task': {
      let assigneeId = me.id
      if (args.assignee_name) {
        const p = await findProfileByName(supabase, args.assignee_name)
        if (!p) return { error: `No employee found matching "${args.assignee_name}".` }
        assigneeId = p.id
      }
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: args.title,
          description: args.description ?? '',
          assignee_id: assigneeId,
          due_date: args.due_date,
          priority: args.priority ?? 'Medium',
          department: me.department,
          created_by: me.id,
        })
        .select('title, due_date, priority, status')
        .single()
      if (error) return { error: error.message }
      return { created: data }
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
      const { data: attendeeRows } = await supabase.from('meeting_attendees').select('meeting_id').eq('user_id', me.id)
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
      return { meetings: data }
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
        await supabase.from('meeting_attendees').insert({ meeting_id: newId, user_id: id })
      }
      return { created: args.title, date: args.date, time: args.time, attendees: attendeeIds.size }
    }

    case 'list_notifications': {
      let q = supabase.from('notifications').select('title, detail, type, read, created_at').eq('user_id', me.id)
      if (args.unread_only !== false) q = q.eq('read', false)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(10)
      if (error) return { error: error.message }
      return { notifications: data }
    }

    case 'mark_notification_read': {
      const { data: match } = await supabase
        .from('notifications')
        .select('id, title')
        .eq('user_id', me.id)
        .ilike('title', `%${args.title_snippet}%`)
        .limit(1)
        .maybeSingle()
      if (!match) return { error: `No notification found matching "${args.title_snippet}".` }
      await supabase.from('notifications').update({ read: true }).eq('id', match.id)
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
      const today = new Date().toISOString().slice(0, 10)
      const summary = {
        pending: data.filter((t: any) => t.status === 'Pending').length,
        in_progress: data.filter((t: any) => t.status === 'In Progress').length,
        done: data.filter((t: any) => t.status === 'Done').length,
        overdue: data.filter((t: any) => t.status !== 'Done' && t.due_date < today).length,
      }
      return { summary }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ---------- Main handler ----------

// ---------- Main handler ----------

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID()

  console.log('========================================')
  console.log('AI ASSISTANT REQUEST RECEIVED')
  console.log('REQUEST ID:', requestId)
  console.log('========================================')

  try {
    // --------------------------------------------------
    // 1. Request received
    // --------------------------------------------------
    console.log('STEP 1: Request received')
    console.log('METHOD:', req.method)
    console.log('URL:', req.url)

    if (req.method === 'OPTIONS') {
      console.log('OPTIONS request received')
      return new Response('ok', { headers: corsHeaders })
    }

    // --------------------------------------------------
    // 2. Request body parsed
    // --------------------------------------------------
    console.log('STEP 2: Parsing request body')

    const { messages, language } = await req.json()

    console.log('STEP 2: Request body parsed successfully')
    console.log(
      'MESSAGE COUNT:',
      Array.isArray(messages) ? messages.length : 'INVALID'
    )
    console.log('LANGUAGE:', language || 'English')

    // --------------------------------------------------
    // 3. API key exists
    // --------------------------------------------------
    console.log('STEP 3: Checking GROQ_API_KEY')

    const apiKey = Deno.env.get('GROQ_API_KEY')

    console.log('API KEY EXISTS:', !!apiKey)
    console.log('API KEY LENGTH:', apiKey ? apiKey.length : 0)

    // NEVER log the actual API key.

    if (!apiKey) {
      console.error('STEP 3 ERROR: GROQ_API_KEY not configured')

      return new Response(
        JSON.stringify({
          error: 'GROQ_API_KEY not configured',
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    console.log('STEP 3: API key exists')

    // --------------------------------------------------
    // 4. Authorization header exists
    // --------------------------------------------------
    console.log('STEP 4: Checking Authorization header')

    const authHeader = req.headers.get('Authorization') ?? ''

    console.log('AUTHORIZATION HEADER EXISTS:', !!authHeader)

    if (!authHeader) {
      console.error('STEP 4 ERROR: Authorization header missing')

      return new Response(
        JSON.stringify({
          error: 'Authorization header missing',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    console.log('STEP 4: Authorization header exists')

    // --------------------------------------------------
    // Supabase client
    // --------------------------------------------------
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    console.log('SUPABASE URL EXISTS:', !!supabaseUrl)
    console.log('SUPABASE ANON KEY EXISTS:', !!supabaseAnonKey)

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    // --------------------------------------------------
    // 5. User authentication
    // --------------------------------------------------
    console.log('STEP 5: Authenticating user')

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    console.log('AUTH USER EXISTS:', !!user)
    console.log(
      'AUTH ERROR:',
      authError ? authError.message : 'NONE'
    )

    if (!user) {
      console.error('STEP 5 ERROR: User authentication failed')

      return new Response(
        JSON.stringify({
          error: 'Not authenticated',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    console.log('STEP 5: User authentication successful')
    console.log('USER ID:', user.id)

    // --------------------------------------------------
    // 6. Profile lookup
    // --------------------------------------------------
    console.log('STEP 6: Looking up profile')

    const {
      data: me,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    console.log('PROFILE FOUND:', !!me)
    console.log(
      'PROFILE ERROR:',
      profileError ? profileError.message : 'NONE'
    )

    if (!me) {
      console.error('STEP 6 ERROR: Profile not found')

      return new Response(
        JSON.stringify({
          error: 'Profile not found',
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    console.log('STEP 6: Profile lookup successful')
    console.log('PROFILE NAME:', me.name)
    console.log('PROFILE ROLE:', me.role)
    console.log('PROFILE DEPARTMENT:', me.department)

    // --------------------------------------------------
    // System prompt
    // --------------------------------------------------
    const today = new Date().toISOString().slice(0, 10)

    const systemPrompt =
      `You are the ABCCorp Workplace Assistant for a manufacturing company. The caller is ${me.name}, ` +
      `a ${me.role} in ${me.department}, employee id ${me.employee_id}. Today's date is ${today}. ` +
      `Use the provided tools to answer questions and take actions on tasks, meetings, notifications, and chat. ` +
      `Always resolve relative dates ("tomorrow", "next Tuesday") against today's date. ` +
      `If required details are missing (e.g. no due date, no time), ask a concise follow-up question instead of guessing. ` +
      `Keep replies short and practical. Respond in ${language || 'English'}.`

    let convo: any[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...messages,
    ]

    console.log('SYSTEM PROMPT CREATED')
    console.log('CONVERSATION MESSAGE COUNT:', convo.length)

    // --------------------------------------------------
    // 7. Groq / AI request
    // --------------------------------------------------
    console.log('STEP 7: Starting AI conversation')

    for (let i = 0; i < 5; i++) {
      console.log('----------------------------------------')
      console.log(`AI ITERATION: ${i + 1}`)
      console.log('----------------------------------------')

      console.log('STEP 7: Groq request')
      console.log('PROVIDER: Groq')
      console.log('MODEL: llama-3.3-70b-versatile')
      console.log(
        'ENDPOINT: https://api.groq.com/openai/v1/chat/completions'
      )
      console.log(
        'CONVERSATION MESSAGE COUNT:',
        convo.length
      )
      console.log('TOOLS AVAILABLE:', tools.length)

      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'qwen/qwen3.6-27b',
            messages: convo,
            tools,
            max_tokens: 600,
          }),
        }
      )

      console.log('STEP 7: Groq request completed')

      // --------------------------------------------------
      // 8. Groq status
      // --------------------------------------------------
      console.log('STEP 8: Groq HTTP STATUS:', response.status)
      console.log(
        'STEP 8: Groq STATUS TEXT:',
        response.statusText
      )
      console.log('STEP 8: Groq RESPONSE OK:', response.ok)

      const rawResponse = await response.text()

      // --------------------------------------------------
      // 9. Exact Groq response
      // --------------------------------------------------
      console.log('STEP 9: EXACT GROQ RESPONSE:')
      console.log(rawResponse)

      let data: any

      try {
        data = JSON.parse(rawResponse)
      } catch (jsonError) {
        console.error('STEP 9 ERROR: Groq response is not JSON')
        console.error('JSON ERROR:', String(jsonError))

        return new Response(
          JSON.stringify({
            error: 'Invalid response from Groq',
          }),
          {
            status: 502,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        )
      }

      // --------------------------------------------------
      // Exact AI error response
      // --------------------------------------------------
      if (!response.ok) {
        console.error('========================================')
        console.error('GROQ API ERROR')
        console.error('REQUEST ID:', requestId)
        console.error('HTTP STATUS:', response.status)
        console.error('STATUS TEXT:', response.statusText)
        console.error('EXACT GROQ ERROR RESPONSE:')
        console.error(JSON.stringify(data))
        console.error('========================================')

        return new Response(
          JSON.stringify({
            error: data,
          }),
          {
            status: response.status,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        )
      }

      // --------------------------------------------------
      // Validate response
      // --------------------------------------------------
      if (!data?.choices?.[0]?.message) {
        console.error('INVALID GROQ RESPONSE STRUCTURE')
        console.error(
          'FULL GROQ RESPONSE:',
          JSON.stringify(data)
        )

        return new Response(
          JSON.stringify({
            error: 'Invalid Groq response structure',
          }),
          {
            status: 502,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        )
      }

      const msg = data.choices[0].message

      console.log('AI MESSAGE RECEIVED')
      console.log('MESSAGE ROLE:', msg.role)
      console.log(
        'MESSAGE CONTENT EXISTS:',
        !!msg.content
      )
      console.log(
        'TOOL CALL COUNT:',
        msg.tool_calls?.length || 0
      )

      // --------------------------------------------------
      // 10. Tool calls
      // --------------------------------------------------
      if (msg.tool_calls?.length) {
        console.log('========================================')
        console.log('STEP 10: TOOL CALLS DETECTED')
        console.log('TOOL CALL COUNT:', msg.tool_calls.length)
        console.log('========================================')

        convo.push(msg)

        for (const call of msg.tool_calls) {
          console.log('----------------------------------------')
          console.log('TOOL CALL')
          console.log('TOOL ID:', call.id)
          console.log('TOOL NAME:', call.function?.name)

          let args: any = {}

          try {
            args = JSON.parse(
              call.function?.arguments || '{}'
            )

            console.log(
              'TOOL ARGUMENTS:',
              JSON.stringify(args)
            )
          } catch (parseError) {
            console.error('TOOL ARGUMENT PARSE ERROR')
            console.error(
              'RAW ARGUMENTS:',
              call.function?.arguments
            )
            console.error(
              'PARSE ERROR:',
              String(parseError)
            )
          }

          // --------------------------------------------------
          // 11. Tool execution
          // --------------------------------------------------
          console.log('STEP 11: Executing tool')
          console.log(
            'TOOL:',
            call.function?.name
          )

          try {
            const result = await executeTool(
              supabase,
              me,
              call.function.name,
              args
            )

            console.log('TOOL EXECUTION COMPLETED')
            console.log(
              'TOOL RESULT:',
              JSON.stringify(result)
            )

            if (result?.error) {
              console.error(
                'TOOL EXECUTION ERROR:',
                result.error
              )
            }

            convo.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(result),
            })
          } catch (toolError) {
            console.error('========================================')
            console.error('TOOL EXECUTION EXCEPTION')
            console.error(
              'TOOL:',
              call.function?.name
            )
            console.error(
              'ERROR:',
              String(toolError)
            )
            console.error(
              'STACK:',
              toolError?.stack
            )
            console.error('========================================')

            convo.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({
                error: String(toolError),
              }),
            })
          }
        }

        console.log('TOOL PROCESSING COMPLETE')
        console.log('CONTINUING AI CONVERSATION')

        continue
      }

      // --------------------------------------------------
      // 12. Final response
      // --------------------------------------------------
      console.log('========================================')
      console.log('STEP 12: FINAL RESPONSE')
      console.log('REQUEST ID:', requestId)
      console.log('FINAL RESPONSE:')
      console.log(msg.content)
      console.log('========================================')

      return new Response(
        JSON.stringify({
          reply: msg.content,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // --------------------------------------------------
    // Maximum iterations
    // --------------------------------------------------
    console.error(
      'MAXIMUM AI ITERATIONS REACHED'
    )

    return new Response(
      JSON.stringify({
        reply:
          "I wasn't able to finish that request — could you rephrase it?",
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )

  } catch (err) {
    // --------------------------------------------------
    // 13. Unexpected errors
    // --------------------------------------------------
    console.error('========================================')
    console.error('UNEXPECTED ERROR')
    console.error('REQUEST ID:', requestId)
    console.error('ERROR:', String(err))
    console.error('STACK:', err?.stack)
    console.error('========================================')

    return new Response(
      JSON.stringify({
        error: String(err),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
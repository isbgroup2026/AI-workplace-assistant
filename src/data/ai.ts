import { AIMessage } from '../types'

export const suggestedPrompts: Record<string, string[]> = {
  English: [
    'Show my pending tasks',
    "What's on my calendar today?",
    'Summarize this week\'s downtime',
    'Draft an approval reminder',
  ],
  Hindi: [
    'मेरे लंबित कार्य दिखाएं',
    'आज मेरी मीटिंग्स क्या हैं?',
    'इस सप्ताह का डाउनटाइम सारांश दें',
    'अनुमोदन रिमाइंडर तैयार करें',
  ],
  Telugu: [
    'నా పెండింగ్ టాస్క్‌లు చూపించు',
    'ఈరోజు నా మీటింగ్‌లు ఏమిటి?',
    'ఈ వారం డౌన్‌టైమ్ సారాంశం ఇవ్వండి',
    'ఆమోద రిమైండర్ డ్రాఫ్ట్ చేయండి',
  ],
}

export const initialConversation: Record<string, AIMessage[]> = {
  English: [
    {
      id: 'a0',
      role: 'assistant',
      text: "Good morning! I'm your workplace assistant. I can help with tasks, meetings, approvals, and quick reports. What do you need?",
      timestamp: '8:30 AM',
    },
  ],
  Hindi: [
    {
      id: 'a0',
      role: 'assistant',
      text: 'सुप्रभात! मैं आपका वर्कप्लेस असिस्टेंट हूं। मैं टास्क, मीटिंग्स, अनुमोदन और त्वरित रिपोर्ट में मदद कर सकता हूं। आपको क्या चाहिए?',
      timestamp: '8:30 AM',
    },
  ],
  Telugu: [
    {
      id: 'a0',
      role: 'assistant',
      text: 'శుభోదయం! నేను మీ వర్క్‌ప్లేస్ అసిస్టెంట్‌ని. టాస్క్‌లు, మీటింగ్‌లు, ఆమోదాలు మరియు త్వరిత నివేదికలలో సహాయం చేయగలను. మీకు ఏమి కావాలి?',
      timestamp: '8:30 AM',
    },
  ],
}

interface MockRule {
  keywords: string[]
  response: string
}

const rules: MockRule[] = [
  {
    keywords: ['pending task', 'my task', 'tasks'],
    response:
      'You have 3 pending tasks: "Inspect Line 3 conveyor belt tension" (due today), "Update SOP for CNC machine changeover" (due Aug 27), and 1 more. Want me to open your Tasks board?',
  },
  {
    keywords: ['meeting', 'calendar', 'schedule'],
    response:
      'You have 2 meetings today: "Shift handover - Line 3 & Line 4" at 9:00 AM, and "Weekly production review" at 2:00 PM. Would you like me to open Meetings?',
  },
  {
    keywords: ['downtime', 'report'],
    response:
      'This week\'s downtime totaled 4.2 hours, mostly from a Line 3 conveyor stoppage on Tuesday. I can draft the full report for your approval.',
  },
  {
    keywords: ['approval', 'reminder', 'approve'],
    response:
      "I've drafted a reminder for the pending purchase order approval (PO #4471). You can review and send it from Notifications > Approvals.",
  },
  {
    keywords: ['notification'],
    response: 'You have 4 unread notifications: 2 approvals, 1 task reminder, and 1 meeting alert.',
  },
  {
    keywords: ['hello', 'hi', 'hey'],
    response: 'Hello! How can I help with your tasks, meetings, or approvals today?',
  },
]

const fallback =
  "I've noted that. For this demo, I can help with pending tasks, today's meetings, downtime summaries, and approval reminders — try asking about one of those."

export function getMockAIResponse(input: string): string {
  const lower = input.toLowerCase()
  for (const rule of rules) {
    if (rule.keywords.some((k) => lower.includes(k))) {
      return rule.response
    }
  }
  return fallback
}

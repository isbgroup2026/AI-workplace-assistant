# Innodatatics Inc. Workplace Assistant — Frontend Prototype

A frontend-only demo prototype of an enterprise AI Workplace Assistant for a manufacturing company. Built with React, TypeScript, Tailwind CSS, and Vite. All data is mocked/static — there is no backend, database, authentication, or real AI integration.

## Run locally

```
npm install
npm run dev
```

Then open the printed local URL (typically http://localhost:5173).

Sign in with any username/password (e.g. leave the pre-filled username and type anything in the password field) — authentication is simulated.

## What's included

- **Login** — corporate sign-in screen (simulated)
- **Home** — KPI cards, recent activity, quick actions, task/meeting/notification previews
- **AI Assistant** — chat UI with English/Hindi/Telugu language selector, suggested prompts, and keyword-based mock responses
- **Chat** — Teams-like 1:1 and group messaging with mock conversations, search, attachments, and read/delivered indicators
- **Tasks** — task board with status/priority, filters, search, create-task modal, and a team view for leads/managers
- **Meetings** — list and calendar views, schedule/reschedule/cancel flows across Google Meet, Zoom, and Webex
- **Notifications** — task, meeting, approval, and system notifications with read/unread state and filters
- **Analytics** — KPI cards and lightweight custom SVG charts (line, bar, donut, progress bars) — no charting library required
- **Profile & Settings** — employee details, language preference, notification toggles, logout

## Architecture

```
src/
  components/   Sidebar, TopBar, shared UI primitives, SVG charts
  data/         Mock/static data per domain (tasks, meetings, chat, AI, analytics, user)
  pages/        One file per screen
  types/        Shared TypeScript types
  App.tsx       State-based navigation between screens (no router dependency)
```

## Next phase (out of scope for this prototype)

Backend APIs, authentication, a real database, LLM integration (RAG/LangChain/LangGraph), and live third-party integrations (calendar, chat, ERP) are intentionally not implemented here and would be built in a follow-up phase.

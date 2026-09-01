# WorkAI LangGraph Development Contract

This document defines ownership boundaries and development rules for the WorkAI PoC/MVP backend.

**Goal:** Enable parallel development of Chat orchestration, Knowledge/RAG, Tasks, Meetings, People Search, and Messaging without architectural drift.

---

## Architecture overview

```text
React Frontend
      |
      v
FastAPI  POST /api/chat
      |
      v
LangGraph (single WorkAI graph)
      |
      v
load_context → router → capability node → build_response → END
```

LangGraph owns **orchestration only**. Business logic lives in **services**. Database access goes through services, not nodes.

---

## Workstream ownership

### Core Orchestration

**Owns:**

```text
backend/app/graph/state.py
backend/app/graph/intents.py
backend/app/graph/router.py
backend/app/graph/graph.py
backend/app/api/chat.py
backend/app/nodes/context.py
backend/app/nodes/router_node.py
backend/app/nodes/response.py
backend/app/main.py
```

**Responsibilities:**

- Shared `WorkAIState` contract
- Intent taxonomy (`WorkAIIntent`)
- Graph routing and compilation
- `POST /api/chat` API
- Response formatting node

Feature developers must **not** change graph contracts without coordination with Core Orchestration.

---

### Knowledge / RAG

**Owns:**

```text
backend/app/nodes/knowledge.py
backend/app/services/knowledge_service.py
```

**Eventually responsible for:**

- Document ingestion
- Embeddings
- Retrieval
- Citations in responses

Must implement the shared contract:

```python
async def search_knowledge(query, user_id, top_k=5) -> KnowledgeResult
```

---

### Tasks

**Owns:**

```text
backend/app/nodes/task.py
backend/app/services/task_service.py
```

Reuses existing Supabase `tasks` table (same schema as frontend `src/lib/api.ts`).

---

### Meetings

**Owns:**

```text
backend/app/nodes/meeting.py
backend/app/services/meeting_service.py
```

Reuses Supabase `meetings` and `meeting_attendees` tables. External Meet/Zoom/Webex APIs are out of scope for PoC.

---

### People

**Owns:**

```text
backend/app/nodes/people.py
backend/app/services/people_service.py
```

Reuses Supabase `profiles` table. **Vertical slice implemented:** employee lookup ("Who is Rajesh?").

---

### Messaging

**Owns:**

```text
backend/app/nodes/messaging.py
backend/app/services/messaging_service.py
```

Reuses Supabase `chat_messages` / team chat infrastructure — do not create a parallel messaging system.

---

### Frontend

**Owns:** existing React UI under `src/`.

Eventually replaces mock AI in `src/pages/AIAssistant.tsx` with `POST /api/chat`.

Frontend must **not** contain LangGraph logic, intent routing, or direct LLM calls.

---

## Critical development rules

### Rule 1

Do not access Supabase directly from LangGraph nodes if a corresponding service exists.

### Rule 2

Do not instantiate LLM providers independently inside feature nodes. Use `app/services/llm_service.py`.

### Rule 3

Do not invent new intent names. Update `WorkAIIntent` in `graph/intents.py`.

### Rule 4

Do not create another LangGraph graph for individual features. There is **one** primary WorkAI graph in `graph/graph.py`.

### Rule 5

Keep nodes small:

```text
state → interpret request → call service → update state
```

### Rule 6

Do not build autonomous agent-to-agent conversations. Use graph routing.

### Rule 7

Reuse existing Supabase functionality wherever practical (mirror frontend `src/lib/api.ts`).

### Rule 8 — PoC first

Do **not** introduce unless genuinely required:

- Microservices
- Event buses / Kafka
- Elaborate dependency injection frameworks
- Generic plugin systems
- Complex repository abstractions
- Full MLOps
- Advanced memory infrastructure
- Full enterprise observability
- Multi-agent planning

---

## Shared state contract

See `backend/app/graph/state.py` — fields include:

- `user_id`, `conversation_id`, `message`, `language`
- `intent`, `confidence`
- `context`, `result`
- `requires_confirmation`, `pending_action`
- `response`, `error`

Keep this schema small. Propose additions via Core Orchestration.

---

## Intent contract

See `WorkAIIntent` in `backend/app/graph/intents.py`:

```text
GENERAL_CHAT
KNOWLEDGE_QUERY
EMPLOYEE_LOOKUP
TASK_CREATE, TASK_QUERY, TASK_UPDATE
MEETING_CREATE, MEETING_QUERY
MESSAGE_SEND, MESSAGE_QUERY
UNKNOWN
```

---

## LangGraph flow

```text
START
  → load_context
  → router
  → [conditional by intent]
        → general_chat | knowledge | people | task | meeting | messaging
  → build_response
  → END
```

---

## Frontend integration (mock → API)

**Current mock:** `src/pages/AIAssistant.tsx` calls `getMockAIResponse()` from `src/data/ai.ts`.

**Target integration:**

1. Add `VITE_API_URL=http://localhost:8000` to frontend `.env`.
2. Create `src/lib/workai-api.ts`:

```typescript
export async function sendChatMessage(
  message: string,
  token: string,
  conversationId?: string,
): Promise<{ response: string; intent: string; data: Record<string, unknown> }> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message, conversation_id: conversationId }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
```

3. In `AIAssistant.tsx`, replace the `setTimeout` + `getMockAIResponse` block with `sendChatMessage`.
4. Obtain Supabase session token: `const { data } = await supabase.auth.getSession()` → `data.session?.access_token`.
5. Keep `src/data/ai.ts` as fallback behind a feature flag until backend is verified in all environments.

**Do not remove the mock** until Supabase + backend `.env` are configured in dev/staging.

---

## Running the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in Supabase credentials
uvicorn app.main:app --reload --port 8000
```

Run tests:

```bash
pytest
```

---

## HITL / confirmation (minimal)

State supports `requires_confirmation` and `pending_action`.

Task create, meeting create, and message send nodes set confirmation flags. A future turn handling `"Yes"` will execute the pending action — not fully implemented in this skeleton.

---

## Out of scope (intentionally not built yet)

- Full RAG ingestion pipeline
- LLM provider integration (stub only)
- Real task/meeting parsing from natural language
- Confirmation execution flow
- Multi-conversation AI threads
- Translation service (handle as preprocessing later)
- Notifications service (normal Python service, outside graph)
- Analytics / Admin in conversational graph

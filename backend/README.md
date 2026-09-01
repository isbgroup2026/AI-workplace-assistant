# WorkAI Backend (LangGraph PoC)

Python FastAPI + LangGraph orchestration layer for the Enterprise Workplace Assistant.

## Quick start

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # configure Supabase + optional OpenAI
uvicorn app.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health`

Chat: `POST http://localhost:8000/api/chat`

```json
{
  "message": "Who is Rajesh?"
}
```

Headers (PoC):

- `Authorization: Bearer <supabase-access-token>` — preferred
- `X-User-Id: <uuid>` — dev bypass

## Architecture

See [docs/langgraph-development-contract.md](../docs/langgraph-development-contract.md).

## Tests

```bash
pytest
```

// Supabase Edge Function: generate-policy-embeddings
//
// One-off / repeatable maintenance task: finds any policy_chunks row with
// a NULL embedding and computes it using Supabase's built-in gte-small
// model (runs inside the Edge Runtime — no external API key needed).
//
// This is intentionally a SEPARATE function from ai-assistant. It uses the
// service role key because backfilling embeddings is an administrative
// maintenance task, not a per-user request — it is never called from the
// frontend and never runs on a user's behalf.
//
// Deploy:
//   supabase functions deploy generate-policy-embeddings
// Run it (from a terminal, or Supabase's dashboard "Invoke" button) any
// time after inserting new policy_chunks rows:
//   curl -X POST https://<project-ref>.functions.supabase.co/generate-policy-embeddings \
//     -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
//
// Isolation note (Phase 10): all embedding-generation logic lives in the
// single generateEmbedding() function below. Swapping to a different
// provider later (OpenAI, Cohere, etc.) only means changing this one
// function — nothing else in the schema/tool/RAG architecture changes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

declare const Supabase: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function generateEmbedding(text: string): Promise<number[]> {
  const model = new Supabase.ai.Session('gte-small')
  const embedding = await model.run(text, { mean_pool: true, normalize: true })
  return embedding as number[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: chunks, error } = await supabase
      .from('policy_chunks')
      .select('id, chunk_text')
      .is('embedding', null)
      .limit(200)

    if (error) throw new Error(error.message)

    if (!chunks || chunks.length === 0) {
      return new Response(JSON.stringify({ message: 'No chunks need embeddings.', updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let updated = 0
    const failures: string[] = []

    for (const chunk of chunks) {
      try {
        const embedding = await generateEmbedding(chunk.chunk_text)
        const { error: updateErr } = await supabase.from('policy_chunks').update({ embedding }).eq('id', chunk.id)
        if (updateErr) {
          failures.push(`${chunk.id}: ${updateErr.message}`)
          continue
        }
        updated++
      } catch (embedErr) {
        failures.push(`${chunk.id}: ${String(embedErr)}`)
      }
    }

    if (failures.length) console.error('generate-policy-embeddings failures:', failures)

    return new Response(
      JSON.stringify({ message: 'Embedding backfill complete.', updated, total: chunks.length, failures }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('generate-policy-embeddings error:', String(err))
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

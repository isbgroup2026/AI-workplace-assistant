// supabase/functions/ingest-policy-document/index.ts
// Admin-only. Downloads a .txt/.md file already uploaded to the
// 'policy-documents' storage bucket, splits it into paragraph chunks,
// embeds each chunk (gte-small, same as generate-policy-embeddings),
// and inserts policy_documents + policy_chunks rows in one call.
//
// Called from the frontend via:
//   supabase.functions.invoke('ingest-policy-document', { body: {...} })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
declare const Supabase: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function generateEmbedding(text: string): Promise<number[]> {
  const model = new Supabase.ai.Session('gte-small')
  return (await model.run(text, { mean_pool: true, normalize: true })) as number[]
}

// Simple paragraph-based chunker: split on blank lines, drop empties/too-short,
// hard-cap length so a huge paragraph still becomes a reasonable chunk.
function chunkText(raw: string): string[] {
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20)
  const MAX = 1500
  const chunks: string[] = []
  for (const p of paragraphs) {
    if (p.length <= MAX) chunks.push(p)
    else for (let i = 0; i < p.length; i += MAX) chunks.push(p.slice(i, i + MAX))
  }
  return chunks
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { storage_path, title, department, policy_type, version, effective_date } = body

    if (!storage_path || !title || !department || !policy_type || !version || !effective_date) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization') ?? ''
    // Runs as the calling user — RLS enforces Admin-only on both the
    // storage bucket and the policy_documents/policy_chunks inserts
    // need to be allowed for Admins (see insert policies required below).
    const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })

    const { data: userData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: me } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single()
    if (!me || me.role !== 'Admin') {
      return new Response(JSON.stringify({ error: 'Only Admins can upload policy documents.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: fileBlob, error: downloadErr } = await supabase.storage.from('policy-documents').download(storage_path)
    if (downloadErr || !fileBlob) {
      return new Response(JSON.stringify({ error: `Could not read uploaded file: ${downloadErr?.message}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawText = await fileBlob.text()
    const chunks = chunkText(rawText)
    if (chunks.length === 0) {
      return new Response(JSON.stringify({ error: 'No readable text content found in the file.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: doc, error: docErr } = await supabase
      .from('policy_documents')
      .insert({
        title,
        department,
        policy_type,
        version,
        effective_date,
        status: 'active',
        file_name: storage_path.split('/').pop(),
      })
      .select('id')
      .single()
    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: `Could not create policy document: ${docErr?.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let inserted = 0
    const failures: string[] = []
    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await generateEmbedding(chunks[i])
        const { error: chunkErr } = await supabase.from('policy_chunks').insert({
          document_id: doc.id,
          chunk_text: chunks[i],
          chunk_index: i,
          embedding,
        })
        if (chunkErr) failures.push(`chunk ${i}: ${chunkErr.message}`)
        else inserted++
      } catch (embedErr) {
        failures.push(`chunk ${i}: ${String(embedErr)}`)
      }
    }

    if (failures.length) console.error('ingest-policy-document chunk failures:', failures)

    return new Response(
      JSON.stringify({ document_id: doc.id, chunks_total: chunks.length, chunks_inserted: inserted, failures }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('ingest-policy-document error:', String(err))
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

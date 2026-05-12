import { NextResponse } from 'next/server'

export async function GET() {
  const apiUrl = process.env.NEXT_PUBLIC_OLLAMA_API_URL || process.env.OLLAMA_API_URL
  const model = process.env.OLLAMA_MODEL || 'neural-chat:7b'

  const debug = {
    NEXT_PUBLIC_OLLAMA_API_URL: process.env.NEXT_PUBLIC_OLLAMA_API_URL || 'NOT SET',
    OLLAMA_API_URL: process.env.OLLAMA_API_URL || 'NOT SET',
    OLLAMA_MODEL: model,
    resolvedUrl: apiUrl || 'NOT RESOLVED',
  }

  // Test 1: Health check
  let healthCheck = { status: 'unknown', error: null as string | null }
  try {
    const res = await fetch(`${apiUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
    healthCheck = {
      status: res.ok ? 'ok' : `error ${res.status}`,
      error: res.ok ? null : await res.text().catch(() => 'Could not read error'),
    }
  } catch (e) {
    healthCheck = {
      status: 'failed',
      error: e instanceof Error ? e.message : String(e),
    }
  }

  // Test 2: Simple skill extraction
  let skillTest = { status: 'unknown', response: null as string | null, error: null as string | null }
  try {
    const res = await fetch(`${apiUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: 'List three programming skills: ',
        stream: false,
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const data = await res.json()
      skillTest = {
        status: 'ok',
        response: data.response?.slice(0, 200) || 'No response',
        error: null,
      }
    } else {
      skillTest = {
        status: `error ${res.status}`,
        response: null,
        error: await res.text().catch(() => 'Could not read error'),
      }
    }
  } catch (e) {
    skillTest = {
      status: 'failed',
      response: null,
      error: e instanceof Error ? e.message : String(e),
    }
  }

  return NextResponse.json({
    debug,
    healthCheck,
    skillTest,
    timestamp: new Date().toISOString(),
  })
}

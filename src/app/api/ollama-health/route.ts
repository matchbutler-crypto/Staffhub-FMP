import { NextResponse } from 'next/server'
import { isOllamaAvailable } from '@/lib/ollama'

export async function GET() {
  const apiUrl = process.env.NEXT_PUBLIC_OLLAMA_API_URL || process.env.OLLAMA_API_URL

  if (!apiUrl) {
    return NextResponse.json({
      status: 'unconfigured',
      message: 'OLLAMA_API_URL ist nicht gesetzt (Vercel ENV prüfen)',
    }, { status: 503 })
  }

  const available = await isOllamaAvailable()

  return NextResponse.json({
    status: available ? 'ok' : 'unreachable',
    url: apiUrl,
    model: process.env.OLLAMA_MODEL || 'mistral:7b',
  }, { status: available ? 200 : 503 })
}

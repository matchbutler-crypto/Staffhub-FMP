import { NextRequest, NextResponse } from 'next/server'

export function validateExternalApiKey(request: NextRequest): NextResponse | null {
  const key = request.headers.get('x-api-key')
  if (!key || key !== process.env.EXTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 })
  }
  return null
}

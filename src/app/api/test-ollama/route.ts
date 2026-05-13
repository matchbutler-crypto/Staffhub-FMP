import { NextResponse } from 'next/server'
import { extractAndNormalizeFromText } from '@/lib/skillNormalization'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

const SAMPLE_CV = `John Doe | Senior Software Engineer | john@example.com

EXPERIENCE
Senior Full-Stack Developer at TechCorp GmbH (2022-2026)
- Built scalable microservices using Node.js, TypeScript, and PostgreSQL
- Led React/Next.js frontend platform with Docker and Kubernetes on AWS

Software Engineer at StartupXYZ (2019-2022)
- Developed Python Django backend with REST API and GraphQL
- Data pipelines with Redis and SQL databases

SKILLS
Python, TypeScript, JavaScript, React, Node.js, Docker, AWS, Kubernetes, SQL, GraphQL, REST API`

export async function GET() {
  const t0 = Date.now()
  let skillTest = {
    status: 'unknown',
    duration_ms: 0,
    skill_count: 0,
    skills: [] as string[],
    error: null as string | null,
  }

  try {
    const supabase = await createClient()
    const skills = await extractAndNormalizeFromText(SAMPLE_CV, supabase)
    skillTest = {
      status: 'ok',
      duration_ms: Date.now() - t0,
      skill_count: skills.length,
      skills: skills.map(s => s.name),
      error: null,
    }
  } catch (e) {
    skillTest = {
      status: 'failed',
      duration_ms: Date.now() - t0,
      skill_count: 0,
      skills: [],
      error: e instanceof Error ? e.message : String(e),
    }
  }

  return NextResponse.json({ skillTest, timestamp: new Date().toISOString() })
}

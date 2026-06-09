export interface FeedbackAnnotation {
  x: number
  y: number
  width: number
  height: number
}

export interface Feedback {
  id: string
  user_id: string
  beschreibung: string
  kategorie: 'Bug' | 'Idee' | 'Sonstiges'
  status: 'backlog' | 'in_progress' | 'review' | 'done'
  screenshot_url: string | null
  annotations: FeedbackAnnotation[]
  seite_url: string | null
  created_at: string
  profiles?: { name: string; email: string } | null
}

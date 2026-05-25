import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    // Fetch zeitnachweise for this resource
    const { data: zeitnachweise, error } = await supabase
      .from("zeitnachweise")
      .select(`
        id,
        datum,
        stunden,
        beschreibung,
        hochgeladen_von,
        created_at
      `)
      .eq("ressource_id", id)
      .order("datum", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "Fehler beim Laden der Zeitnachweise" },
        { status: 400 }
      )
    }

    return NextResponse.json(zeitnachweise || [])
  } catch (error) {
    console.error("Error fetching zeitnachweise:", error)
    return NextResponse.json(
      { error: "Fehler beim Laden der Zeitnachweise" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const body = await request.json()

    const { data, error } = await supabase
      .from("zeitnachweise")
      .insert({
        ressource_id: id,
        datum: body.datum,
        stunden: body.stunden,
        beschreibung: body.beschreibung,
        hochgeladen_von: body.hochgeladen_von,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Fehler beim Speichern des Zeitnachweises" },
        { status: 400 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Error creating zeitnachweis:", error)
    return NextResponse.json(
      { error: "Fehler beim Speichern des Zeitnachweises" },
      { status: 500 }
    )
  }
}

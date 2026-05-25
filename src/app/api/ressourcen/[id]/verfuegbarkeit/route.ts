import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    const { data, error } = await supabase
      .from("ressource_vakanz_links")
      .update({
        verfuegbarkeit: body.verfuegbarkeit,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Fehler beim Aktualisieren des Status" },
        { status: 400 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error updating availability:", error)
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Status" },
      { status: 500 }
    )
  }
}

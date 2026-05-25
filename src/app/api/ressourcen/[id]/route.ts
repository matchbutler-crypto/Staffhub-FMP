import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Fetch resource details from ressource_vakanz_links table
    const { data: ressource, error } = await supabase
      .from("ressource_vakanz_links")
      .select(`
        id,
        name,
        vorname,
        nachname,
        geburtsdatum,
        email,
        telefon,
        wohnort,
        erfahrungslevel,
        skills,
        notizen,
        agentur_id,
        verfuegbarkeit,
        verfuegbar_ab,
        created_at,
        updated_at,
        agenturen (id, name)
      `)
      .eq("id", id)
      .single()

    if (error || !ressource) {
      return NextResponse.json(
        { error: "Ressource nicht gefunden" },
        { status: 404 }
      )
    }

    // Fetch beauftragungen for this resource
    const { data: beauftragungen } = await supabase
      .from("beauftragungen")
      .select(`
        id,
        vakanz_id,
        status,
        startdatum,
        enddatum,
        ressource_link_id,
        profil_id,
        vakanzen_data (id, vakanz_nr, titel, agenturen (name))
      `)
      .or(`ressource_link_id.eq.${id},profil_id.eq.${id}`)

    // Map beauftragungen to response format
    const mappedBeauftragungen = (beauftragungen || []).map((b: any) => ({
      id: b.id,
      vakanz_nr: b.vakanzen_data?.vakanz_nr || "—",
      vakanz_titel: b.vakanzen_data?.titel || "—",
      status: b.status,
      startdatum: b.startdatum,
      enddatum: b.enddatum,
      agentur_name: b.vakanzen_data?.agenturen?.name || "—",
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agenturName = (ressource.agenturen as any)?.[0]?.name ?? (ressource.agenturen as any)?.name ?? null

    return NextResponse.json({
      ...ressource,
      agentur_name: agenturName,
      beauftragungen: mappedBeauftragungen,
    })
  } catch (error) {
    console.error("Error fetching resource:", error)
    return NextResponse.json(
      { error: "Fehler beim Laden der Ressource" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    // Update resource
    const { data, error } = await supabase
      .from("ressource_vakanz_links")
      .update({
        vorname: body.vorname,
        nachname: body.nachname,
        geburtsdatum: body.geburtsdatum,
        email: body.email,
        telefon: body.telefon,
        wohnort: body.adresse,
        notizen: body.notizen,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Fehler beim Aktualisieren" },
        { status: 400 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error updating resource:", error)
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren der Ressource" },
      { status: 500 }
    )
  }
}

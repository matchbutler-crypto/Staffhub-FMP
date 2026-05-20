export interface Beauftragung {
  id: string
  ressource_id: string
  ressource_link_id?: string | null
  start_date: string
  end_date: string
}

export function isResourceUnavailable(
  ressourceId: string,
  beauftragungen: Beauftragung[],
  ressourceStatus: string | null
): boolean {
  // Check if status is "nicht_verfügbar"
  if (ressourceStatus === 'nicht_verfügbar') {
    return true
  }

  // Check if resource has active beauftragung
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return beauftragungen.some((b) => {
    if (b.ressource_id !== ressourceId) {
      return false
    }

    const startDate = new Date(b.start_date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(b.end_date)
    endDate.setHours(0, 0, 0, 0)

    // Inclusive range check: today >= start_date AND today <= end_date
    return today >= startDate && today <= endDate
  })
}

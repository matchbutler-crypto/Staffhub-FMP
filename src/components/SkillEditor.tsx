'use client'

import * as React from 'react'
import { useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { IconX, IconCheck, IconLoader } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Skill {
  id: string
  name: string
  verified: boolean
  added_by: 'extraction' | 'manual'
}

interface ScoreResult {
  matched: number
  required: number
  percentage: number
}

interface SkillEditorProps {
  profileId: string
  onSave?: (skills: Skill[], score: ScoreResult) => void
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SkillEditor({ profileId, onSave }: SkillEditorProps) {
  // ── State ──────────────────────────────────────────────────────────────────

  const [profileSkills, setProfileSkills] = useState<Skill[]>([])
  const [allSkills, setAllSkills] = useState<Skill[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [score, setScore] = useState<ScoreResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Load Initial Data ──────────────────────────────────────────────────────

  React.useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Load profile skills
        const profileResponse = await fetch(`/api/profiles/${profileId}`)
        if (!profileResponse.ok) {
          throw new Error('Fehler beim Laden des Profils')
        }
        const profileData = await profileResponse.json()
        setProfileSkills(profileData.skills || [])

        // Load all available skills
        const skillsResponse = await fetch('/api/skills')
        if (!skillsResponse.ok) {
          throw new Error('Fehler beim Laden der verfügbaren Skills')
        }
        const skillsData = await skillsResponse.json()
        setAllSkills(skillsData.skills || [])
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unbekannter Fehler'
        setError(errorMsg)
        console.error('Failed to load data:', err)
        toast.error(errorMsg)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [profileId])

  // ── Search & Filter Logic ──────────────────────────────────────────────────

  const filteredSkills = useMemo(() => {
    if (!searchInput.trim()) {
      return []
    }

    const query = searchInput.toLowerCase().trim()
    const addedSkillIds = new Set(profileSkills.map((s) => s.id))

    return allSkills
      .filter((skill) => {
        // Exclude already added skills
        if (addedSkillIds.has(skill.id)) {
          return false
        }
        // Match skill name case-insensitively
        return skill.name.toLowerCase().includes(query)
      })
      .slice(0, 8) // Limit dropdown to 8 items
  }, [searchInput, allSkills, profileSkills])

  // ── Add Skill ──────────────────────────────────────────────────────────────

  const handleAddSkill = useCallback(
    (skill: Skill) => {
      // Check if already added
      if (profileSkills.some((s) => s.id === skill.id)) {
        toast.info('Dieser Skill wurde bereits hinzugefügt')
        return
      }

      setProfileSkills((prev) => [...prev, skill])
      setSearchInput('')
    },
    [profileSkills]
  )

  // ── Add Skill from Search Input ────────────────────────────────────────────

  const handleAddFromSearch = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return

      e.preventDefault()

      const query = searchInput.toLowerCase().trim()
      if (!query) return

      // Check if a matching skill exists in filtered results
      const matchingSkill = filteredSkills[0]
      if (matchingSkill) {
        handleAddSkill(matchingSkill)
        return
      }

      // If no exact match, create a new skill dynamically
      // This matches the API's findOrCreateSkillByName behavior
      const newSkill: Skill = {
        id: `temp-${Date.now()}`, // Temporary ID will be resolved by API
        name: searchInput,
        verified: false,
        added_by: 'manual',
      }

      setProfileSkills((prev) => [...prev, newSkill])
      setSearchInput('')
    },
    [searchInput, filteredSkills, handleAddSkill]
  )

  // ── Remove Skill ───────────────────────────────────────────────────────────

  const handleRemoveSkill = useCallback((skillId: string) => {
    setProfileSkills((prev) => prev.filter((s) => s.id !== skillId))
  }, [])

  // ── Save Changes ───────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (profileSkills.length === 0) {
      toast.error('Bitte fügen Sie mindestens einen Skill hinzu')
      return
    }

    try {
      setIsSaving(true)
      setError(null)

      // Prepare request body
      const tempSkills = profileSkills
        .filter((skill) => skill.id.startsWith('temp-'))
        .map((skill) => ({ skill_name: skill.name }))

      const existingSkills = profileSkills
        .filter((skill) => !skill.id.startsWith('temp-'))
        .map((skill) => ({ skill_id: skill.id }))

      const requestBody = {
        skills_to_add: [...tempSkills, ...existingSkills] as Array<
          { skill_name: string } | { skill_id: string }
        >,
        skills_to_remove: [],
      }

      // Call PATCH endpoint
      const response = await fetch(`/api/profiles/${profileId}/skills`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Fehler beim Speichern der Skills')
      }

      const result = await response.json()

      // Update local state with confirmed data
      setProfileSkills(result.skills)
      setScore(result.score)

      toast.success('Skills erfolgreich gespeichert!')

      // Call onSave callback
      if (onSave) {
        onSave(result.skills, result.score)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Fehler beim Speichern'
      setError(errorMsg)
      console.error('Failed to save skills:', err)
      toast.error(errorMsg)
    } finally {
      setIsSaving(false)
    }
  }, [profileId, profileSkills, onSave])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Skills bearbeiten</CardTitle>
          <CardDescription>Laden Sie die verfügbaren Skills...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <IconLoader className="size-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Skills bearbeiten</CardTitle>
        <CardDescription>
          Verwalten Sie die Skills für dieses Profil und sehen Sie die KI-Score-Änderungen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="rounded-md border border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Current Skills Section */}
        <div className="space-y-3">
          <Label>Aktuelle Skills ({profileSkills.length})</Label>
          <div className="min-h-10 rounded-md border border-input bg-muted/30 px-3 py-2">
            {profileSkills.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Skills hinzugefügt</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profileSkills.map((skill) => (
                  <Badge
                    key={skill.id}
                    variant={skill.verified ? 'default' : 'secondary'}
                    className="flex items-center gap-1 py-1"
                  >
                    {skill.verified && <IconCheck className="size-3" />}
                    <span>{skill.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill.id)}
                      className="ml-1 text-xs hover:opacity-70"
                    >
                      <IconX className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search & Add Skills Section */}
        <div className="space-y-3">
          <Label htmlFor="skill-search">Skill hinzufügen</Label>
          <div className="space-y-2">
            <Input
              id="skill-search"
              placeholder="Skill-Name eingeben oder suchen..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleAddFromSearch}
              disabled={isSaving}
              className="focus-visible:ring-1"
            />
            <p className="text-xs text-muted-foreground">
              Geben Sie einen Skill ein und drücken Sie Enter, um ihn hinzuzufügen.
            </p>
          </div>

          {/* Autocomplete Dropdown */}
          {filteredSkills.length > 0 && (
            <div className="rounded-md border border-input bg-background shadow-sm">
              {filteredSkills.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => handleAddSkill(skill)}
                  disabled={isSaving}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span>{skill.name}</span>
                    {skill.verified && <IconCheck className="size-3 text-green-600" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Score Display Section */}
        {score && (
          <div className="rounded-md bg-blue-50 px-4 py-4 dark:bg-blue-950">
            <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">KI-Score</p>
            <div className="mt-3 flex items-end gap-4">
              <div>
                <p className="text-4xl font-bold text-blue-600 dark:text-blue-300">{score.percentage}%</p>
                <p className="text-xs text-blue-700 dark:text-blue-200">
                  {score.matched} von {score.required} Skills
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={isSaving || profileSkills.length === 0}
            className="flex-1"
          >
            {isSaving ? (
              <>
                <IconLoader className="mr-2 size-4 animate-spin" />
                Wird gespeichert...
              </>
            ) : (
              'Skills speichern'
            )}
          </Button>
        </div>

        {/* Info Box */}
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-medium">Tipp:</p>
          <p className="mt-0.5">
            Fügen Sie relevante Skills hinzu, um die Passung zu dieser Vakanz zu verbessern. Der
            KI-Score wird nach dem Speichern neu berechnet.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

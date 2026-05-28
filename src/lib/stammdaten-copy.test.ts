import { describe, it, expect } from 'vitest'
import { buildStammdatenText } from './stammdaten-copy'

describe('buildStammdatenText', () => {
  it('formats all fields when fully populated', () => {
    const result = buildStammdatenText({
      vorname: 'Max',
      nachname: 'Mustermann',
      geburtsdatum: '1990-01-15',
      email: 'max@example.com',
      telefon: '+49 123 456789',
      wohnort: 'Berlin',
    })
    expect(result).toBe(
      'Vorname: Max\nNachname: Mustermann\nGeburtsdatum: 15.1.1990\nE-Mail: max@example.com\nTelefon: +49 123 456789\nWohnort: Berlin'
    )
  })

  it('renders null fields as —', () => {
    const result = buildStammdatenText({
      vorname: null,
      nachname: 'Mustermann',
      geburtsdatum: null,
      email: null,
      telefon: null,
      wohnort: null,
    })
    expect(result).toContain('Vorname: —')
    expect(result).toContain('Geburtsdatum: —')
    expect(result).toContain('E-Mail: —')
    expect(result).toContain('Telefon: —')
    expect(result).toContain('Wohnort: —')
  })

  it('renders undefined fields as —', () => {
    const result = buildStammdatenText({})
    expect(result).toContain('Vorname: —')
    expect(result).toContain('Nachname: —')
    expect(result).toContain('Geburtsdatum: —')
  })

  it('renders empty string fields as —', () => {
    const result = buildStammdatenText({ vorname: '', nachname: '  ' })
    expect(result).toContain('Vorname: —')
    expect(result).toContain('Nachname: —')
  })

  it('preserves field order: Vorname first, Wohnort last', () => {
    const result = buildStammdatenText({
      vorname: 'A',
      nachname: 'B',
      geburtsdatum: '2000-06-01',
      email: 'a@b.de',
      telefon: '123',
      wohnort: 'München',
    })
    const lines = result.split('\n')
    expect(lines[0]).toMatch(/^Vorname:/)
    expect(lines[5]).toMatch(/^Wohnort:/)
  })

  it('formats Geburtsdatum as de-DE locale', () => {
    const result = buildStammdatenText({ geburtsdatum: '2000-06-01' })
    expect(result).toContain('Geburtsdatum: 1.6.2000')
  })
})

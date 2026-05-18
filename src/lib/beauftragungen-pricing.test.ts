import { describe, it, expect } from 'vitest'
import { computePreise } from './beauftragungen-pricing'

describe('computePreise', () => {
  it('Marge nicht enthalten: EK = Rohpreis, VK = Rohpreis + Marge', () => {
    const result = computePreise(500, 75, false)
    expect(result.einkaufspreis).toBe(500)
    expect(result.verkaufspreis).toBe(575)
  })

  it('Marge enthalten: VK = Rohpreis, EK = Rohpreis - Marge', () => {
    const result = computePreise(600, 75, true)
    expect(result.einkaufspreis).toBe(525)
    expect(result.verkaufspreis).toBe(600)
  })

  it('Marge = 0: EK = VK = Rohpreis (beide Modi)', () => {
    expect(computePreise(500, 0, false)).toEqual({ einkaufspreis: 500, verkaufspreis: 500 })
    expect(computePreise(500, 0, true)).toEqual({ einkaufspreis: 500, verkaufspreis: 500 })
  })

  it('Beispiel aus Spec: 550€ EK + 50€ Marge', () => {
    const result = computePreise(550, 50, false)
    expect(result.einkaufspreis).toBe(550)
    expect(result.verkaufspreis).toBe(600)
  })

  it('Beispiel aus Spec: 600€ VK inkl. 50€ Marge', () => {
    const result = computePreise(600, 50, true)
    expect(result.einkaufspreis).toBe(550)
    expect(result.verkaufspreis).toBe(600)
  })
})

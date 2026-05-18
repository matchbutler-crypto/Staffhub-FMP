export interface Preise {
  einkaufspreis: number
  verkaufspreis: number
}

export function computePreise(
  agenturRohpreis: number,
  margenaufschlag: number,
  margeInkludiert: boolean
): Preise {
  if (margeInkludiert) {
    return {
      verkaufspreis: agenturRohpreis,
      einkaufspreis: agenturRohpreis - margenaufschlag,
    }
  }
  return {
    einkaufspreis: agenturRohpreis,
    verkaufspreis: agenturRohpreis + margenaufschlag,
  }
}

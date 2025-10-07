import { describe, it, expect } from 'vitest'
import { mapUserTextToIntent } from '../lib/ai/gemini'

describe('mapUserTextToIntent - edge cases', () => {
  it('handles empty instruction gracefully', () => {
    const r = mapUserTextToIntent('', 'es')
    // fallback behavior should provide defaults and preserveIdentity
    expect(r.preserveIdentity).toBe(true)
    expect(r.change.length).toBeGreaterThan(0)
  })

  it('extracts color mentions', () => {
    const r = mapUserTextToIntent('Quiero el pelo castaño oscuro y un fade', 'es')
    expect(r.change.some(c => c.type === 'hair_color' && /casta[nñ]o|dark/.test(String(c.value)))).toBe(true)
    expect(r.change.some(c => c.type === 'hair_style')).toBe(true)
  })

  it('defaults to reasonable changes on ambiguous text', () => {
    const r = mapUserTextToIntent('Me gusta algo diferente', 'es')
    // should fallback to stubble + fade medio
    expect(r.change.some(c => c.type === 'beard_style')).toBe(true)
    expect(r.change.some(c => c.type === 'hair_style')).toBe(true)
  })

  it('handles long advisory LLM-like input by extracting defaults', () => {
    const llmText = 'Recomendaciones: haz un fade medio con textura arriba, mantener identidad facial, sugerir stubble para definir mandíbula.'
    const r = mapUserTextToIntent(llmText, 'es')
    expect(r.change.some(c => c.type === 'hair_style' && String(c.value).includes('fade'))).toBe(true)
    expect(r.change.some(c => c.type === 'beard_style')).toBe(true)
  })
})

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
    const r = mapUserTextToIntent('Quiero colores más neutros y una chaqueta azul', 'es')
    expect(r.change.some(c => c.type === 'clothing_color' && /neutro|neutral|azul|blue/i.test(String(c.value)))).toBe(true)
    expect(r.change.some(c => c.type === 'clothing_item' && /chaqueta|jacket/i.test(String(c.value)))).toBe(true)
  })

  it('defaults to reasonable changes on ambiguous text', () => {
    const r = mapUserTextToIntent('Me gusta algo diferente', 'es')
    // should fallback to reasonable clothing suggestions
    expect(r.change.some(c => c.type === 'clothing_item')).toBe(true)
    // clothing_fit may or may not be present depending on the default suggestions
    expect(r.change.length).toBeGreaterThan(0)
  })

  it('handles long advisory LLM-like input by extracting defaults', () => {
    const llmText = 'Recomendaciones: usar una chaqueta estructurada, paleta neutra, mantener identidad y sugerir pantalón recto para alargar la silueta.'
    const r = mapUserTextToIntent(llmText, 'es')
    expect(r.change.some(c => c.type === 'clothing_item' && /chaqueta|jacket|pantal|trousers/i.test(String(c.value)))).toBe(true)
    expect(r.change.some(c => c.type === 'clothing_fit')).toBe(true)
  })
})

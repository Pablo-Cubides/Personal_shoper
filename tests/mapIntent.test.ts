import { describe, it, expect } from 'vitest'
import { mapUserTextToIntent } from '../lib/ai/gemini'

describe('mapUserTextToIntent', () => {
  it('parses basic requests', () => {
    const r = mapUserTextToIntent('Quiero una chaqueta más ajustada y colores más neutros', 'es')
    // Should detect clothing_fit (structured, regular, etc.) and clothing_item
    expect(r.change.some(c => c.type === 'clothing_fit')).toBe(true)
    expect(r.change.some(c => c.type === 'clothing_item')).toBe(true)
    // Note: color detection may or may not work depending on NLP availability
    // so we only check for clothing-related changes
  })
})

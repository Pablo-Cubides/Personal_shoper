import { describe, it, expect } from 'vitest'
import { mapUserTextToIntent } from '../lib/ai/gemini'

describe('mapUserTextToIntent', () => {
  it('parses basic requests', () => {
    const r = mapUserTextToIntent('Quiero el cabello más corto y una barba stubble', 'es')
    expect(r.change.some(c => c.type === 'hair_length' && c.value === 'short')).toBe(true)
    expect(r.change.some(c => c.type === 'beard_style' && c.value === 'stubble')).toBe(true)
  })
})

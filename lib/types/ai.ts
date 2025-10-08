// Recommended clothing item
export type RecommendedItem = {
  category: 'top' | 'bottom' | 'outer' | 'shoes' | 'accessory'
  recommendation: string
  colors?: string[]
  reason?: string
  confidence?: number
}

export type BodyAnalysis = {
  // Whether the photo is suitable for a full-body analysis
  bodyOk: boolean
  // Pose / framing
  pose: 'frontal' | 'side' | 'partial' | 'incomplete'
  // High level body type classification (e.g. rectangle, inverted_triangle, hourglass)
  bodyType?: string
  // Proportions summary (shoulders/waist/hips)
  proportions?: { shoulders?: string; waist?: string; hips?: string }
  // Rough height or camera distance hint
  heightHint?: string
  // Clothing detected on the person (descriptive)
  clothing?: { top?: string; bottom?: string; outer?: string; fit?: string; colors?: string[] }
  // Skin tone / undertone description
  skinTone?: string
  // Accessories (glasses, hat, bag...)
  accessories?: Record<string, boolean>
  lighting: 'good' | 'fair' | 'poor'
  // Short summary and long advisory
  suggestedText: string
  advisoryText?: string
  // Generated outfit recommendations
  recommended?: RecommendedItem[]
}

export type EditChange = { type: string; value: string }

export type EditIntent = {
  locale: 'es' | 'en'
  change: EditChange[]
  instruction: string
  preserveIdentity: boolean
  outputSize?: number
  watermark?: boolean
}

export type IteratePayload = {
  sessionId?: string | null
  originalImageUrl: string
  userText: string
  prevPublicId?: string | null
  analysis?: BodyAnalysis
}

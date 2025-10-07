export type HairLength = 'short' | 'medium' | 'long'
export type Density = 'low' | 'medium' | 'high'

export type FaceAnalysis = {
  faceOk: boolean
  pose: 'frontal' | 'ladeado' | 'incompleto'
  hair: { length: HairLength; color: string; density: Density }
  beard: { present: boolean; style?: string; density?: Density }
  accessories: Record<string, boolean>
  lighting: 'good' | 'fair' | 'poor'
  suggestedText: string
  advisoryText?: string
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
  analysis?: FaceAnalysis
}

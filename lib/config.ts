import fs from 'fs'
import path from 'path'

export function getAiConfig() {
  try {
    const p = path.join(process.cwd(), 'ai_config.json')
    if (!fs.existsSync(p)) return {}
    const txt = fs.readFileSync(p, 'utf8')
    return JSON.parse(txt)
  } catch {
    return {}
  }
}

export function getDefaultLocale(): 'es' | 'en' {
  try {
    const cfg = getAiConfig() as { locale?: string }
    const env = process.env.DEFAULT_LOCALE
    const locale = (env || cfg.locale || 'es').toString().toLowerCase()
    return locale === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

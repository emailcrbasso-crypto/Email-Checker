import { SPAM_DOMAINS, FREE_PROVIDERS, SYSTEM_PREFIXES } from '../data/spamDomains'
import type { EmailRecord, EmailStatus, MXCacheEntry } from '../types'

// Cache de resultados MX por domínio (evita repetir consultas)
const mxCache = new Map<string, MXCacheEntry>()

// Fila de domínios aguardando verificação MX
let mxQueueRunning = false
const mxQueue: Array<{ dominio: string; resolve: (val: boolean) => void }> = []

// Regex RFC 5322 simplificado
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/

export function validarSintaxe(email: string): boolean {
  return EMAIL_REGEX.test(email.trim())
}

export function extrairDominio(email: string): string {
  return email.split('@')[1]?.toLowerCase().trim() ?? ''
}

export function extrairPrefixo(email: string): string {
  return email.split('@')[0]?.toLowerCase().trim() ?? ''
}

export function classificarDominio(dominio: string): 'corporativo' | 'gratuito' | 'temporario' | 'desconhecido' {
  if (SPAM_DOMAINS.has(dominio)) return 'temporario'
  if (FREE_PROVIDERS.has(dominio)) return 'gratuito'
  if (dominio) return 'corporativo'
  return 'desconhecido'
}

export function isSpamTrap(prefixo: string): boolean {
  return SYSTEM_PREFIXES.some(p => prefixo === p || prefixo.startsWith(p + '.') || prefixo.startsWith(p + '_') || prefixo.startsWith(p + '-'))
}

// Consulta MX via Google DNS over HTTPS (sem backend, funciona no browser)
async function verificarMX(dominio: string): Promise<boolean> {
  const cached = mxCache.get(dominio)
  if (cached) return cached.valido

  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(dominio)}&type=MX`, {
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) return false
    const data = await res.json()
    const valido = Array.isArray(data.Answer) && data.Answer.length > 0
    mxCache.set(dominio, { valido, checkedAt: Date.now() })
    return valido
  } catch {
    // fallback: se DNS falhar, verifica A record
    try {
      const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(dominio)}&type=A`, {
        signal: AbortSignal.timeout(5000)
      })
      const data = await res.json()
      const valido = Array.isArray(data.Answer) && data.Answer.length > 0
      mxCache.set(dominio, { valido, checkedAt: Date.now() })
      return valido
    } catch {
      mxCache.set(dominio, { valido: false, checkedAt: Date.now() })
      return false
    }
  }
}

// Processa fila de MX com rate limit (10 req/s)
async function processarFilaMX() {
  if (mxQueueRunning) return
  mxQueueRunning = true

  while (mxQueue.length > 0) {
    const lote = mxQueue.splice(0, 10) // 10 por vez
    await Promise.all(lote.map(async ({ dominio, resolve }) => {
      const resultado = await verificarMX(dominio)
      resolve(resultado)
    }))
    if (mxQueue.length > 0) {
      await new Promise(r => setTimeout(r, 1000)) // espera 1s entre lotes
    }
  }

  mxQueueRunning = false
}

export function enfileirarMX(dominio: string): Promise<boolean> {
  // Se já está no cache, retorna imediatamente
  const cached = mxCache.get(dominio)
  if (cached) return Promise.resolve(cached.valido)

  return new Promise((resolve) => {
    mxQueue.push({ dominio, resolve })
    processarFilaMX()
  })
}

// Calcula status e score de risco
export function calcularStatus(record: Omit<EmailRecord, 'status' | 'score'>): { status: EmailStatus; score: number; motivos: string[] } {
  const motivos: string[] = []
  let score = 0

  if (!validarSintaxe(record.email)) {
    motivos.push('Sintaxe inválida')
    score += 50
  }

  if (record.dominioTipo === 'temporario') {
    motivos.push('Domínio de email descartável')
    score += 40
  }

  if (record.mxValido === false) {
    motivos.push('Domínio sem registro MX (não recebe emails)')
    score += 40
  }

  const prefixo = extrairPrefixo(record.email)
  if (isSpamTrap(prefixo)) {
    motivos.push(`Prefixo de sistema (${prefixo}@...)`)
    score += 20
  }

  if (record.dominioTipo === 'gratuito') {
    motivos.push('Provedor gratuito (pessoa física)')
    score += 5
  }

  // Determina status final — spam_trap checado antes de suspeito (score 20 seria capturado errado)
  let status: EmailStatus
  if (score >= 50) status = 'inválido'
  else if (motivos.some(m => m.includes('Prefixo de sistema'))) status = 'spam_trap'
  else if (score >= 20) status = 'suspeito'
  else status = 'válido'

  return { status, score: Math.min(score, 100), motivos }
}

import { SPAM_DOMAINS, FREE_PROVIDERS, SYSTEM_PREFIXES } from '../data/spamDomains'
import type { EmailRecord, EmailStatus, MXCacheEntry } from '../types'

// Cache de resultados MX por domínio (evita repetir consultas)
const mxCache = new Map<string, MXCacheEntry>()

// Pré-popula cache: provedores gratuitos têm MX válido por definição
FREE_PROVIDERS.forEach(d => mxCache.set(d, { valido: true, checkedAt: Date.now() }))
// Domínios descartáveis: não precisam de consulta DNS (já serão penalizados pelo dominioTipo)
SPAM_DOMAINS.forEach(d => mxCache.set(d, { valido: false, checkedAt: Date.now() }))

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

// Faz uma consulta DNS com retry em caso de rate limit (429)
async function fetchDNS(url: string, tentativas = 3): Promise<boolean> {
  for (let i = 0; i < tentativas; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
      if (res.status === 429) {
        // Rate limited — espera exponencial antes de tentar de novo
        await new Promise(r => setTimeout(r, 800 * (i + 1)))
        continue
      }
      if (!res.ok) return false
      const data = await res.json()
      return Array.isArray(data.Answer) && data.Answer.length > 0
    } catch {
      if (i < tentativas - 1) await new Promise(r => setTimeout(r, 400))
    }
  }
  // Falha total após retries: assume válido para não gerar falso negativo
  return true
}

// Consulta MX via Google DNS over HTTPS (sem backend, funciona no browser)
async function verificarMX(dominio: string): Promise<boolean> {
  const cached = mxCache.get(dominio)
  if (cached) return cached.valido

  // Tenta MX primeiro, depois A record como fallback
  let valido = await fetchDNS(
    `https://dns.google/resolve?name=${encodeURIComponent(dominio)}&type=MX`
  )
  if (!valido) {
    valido = await fetchDNS(
      `https://dns.google/resolve?name=${encodeURIComponent(dominio)}&type=A`
    )
  }

  mxCache.set(dominio, { valido, checkedAt: Date.now() })
  return valido
}

// Processa fila de MX com rate limit (5 req/s — mais conservador para evitar 429)
async function processarFilaMX() {
  if (mxQueueRunning) return
  mxQueueRunning = true

  while (mxQueue.length > 0) {
    const lote = mxQueue.splice(0, 5)
    await Promise.all(lote.map(async ({ dominio, resolve }) => {
      const resultado = await verificarMX(dominio)
      resolve(resultado)
    }))
    if (mxQueue.length > 0) {
      await new Promise(r => setTimeout(r, 1000))
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

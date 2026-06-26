import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as net from 'net'
import * as dns from 'dns/promises'

const SMTP_TIMEOUT_MS = 5000
const HELO_DOMAIN = 'email-checker-theta.vercel.app'
const FROM_EMAIL = 'check@email-checker-theta.vercel.app'

export type SmtpResult = 'valido' | 'invalido' | 'catch_all' | 'timeout' | 'bloqueado' | 'erro'

async function getMxHost(domain: string): Promise<string | null> {
  try {
    const records = await dns.resolveMx(domain)
    if (!records.length) return null
    records.sort((a, b) => a.priority - b.priority)
    return records[0].exchange
  } catch {
    return null
  }
}

function checkSmtp(mxHost: string, email: string): Promise<SmtpResult> {
  return new Promise((resolve) => {
    let resolved = false
    const done = (result: SmtpResult) => {
      if (resolved) return
      resolved = true
      clearTimeout(timer)
      try { socket.destroy() } catch {}
      resolve(result)
    }

    const timer = setTimeout(() => done('timeout'), SMTP_TIMEOUT_MS)
    const socket = net.createConnection({ host: mxHost, port: 25 })
    socket.setTimeout(SMTP_TIMEOUT_MS)

    let buffer = ''
    let step = 0

    const send = (cmd: string) => {
      try { socket.write(cmd + '\r\n') } catch { done('erro') }
    }

    socket.on('error', () => done('bloqueado'))
    socket.on('timeout', () => done('timeout'))

    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('ascii')

      let pos: number
      while ((pos = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, pos)
        buffer = buffer.slice(pos + 2)

        // Pula linhas de continuação multi-linha (ex: "250-SIZE 10240000")
        if (line.length >= 4 && line[3] === '-') continue

        const code = parseInt(line.slice(0, 3), 10)
        if (isNaN(code)) continue

        switch (step) {
          case 0: // Banner do servidor
            if (code === 220) { send(`EHLO ${HELO_DOMAIN}`); step = 1 }
            else done('erro')
            break

          case 1: // Resposta ao EHLO
            if (code === 250) { send(`MAIL FROM:<${FROM_EMAIL}>`); step = 2 }
            else if (code === 500 || code === 502) {
              // Servidor não suporta EHLO, tenta HELO
              send(`HELO ${HELO_DOMAIN}`)
            }
            else done('erro')
            break

          case 2: // Resposta ao MAIL FROM
            if (code === 250) { send(`RCPT TO:<${email}>`); step = 3 }
            else done('erro')
            break

          case 3: // Resposta ao RCPT TO — resultado final
            send('QUIT')
            if (code === 250 || code === 251) done('valido')
            else if (code >= 550 && code <= 559) done('invalido')
            else done('catch_all') // 4xx = greylisting / inconclusivo
            break
        }
      }
    })
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { emails } = req.body as { emails?: unknown }
  if (!Array.isArray(emails) || emails.length === 0 || emails.length > 10) {
    return res.status(400).json({ error: 'Envie entre 1 e 10 emails por chamada.' })
  }

  const lista = emails as string[]
  const results: Record<string, SmtpResult> = {}

  // Agrupa por domínio para reutilizar o lookup MX e a detecção de catch-all
  const byDomain = new Map<string, string[]>()
  for (const email of lista) {
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) { results[email] = 'erro'; continue }
    const bucket = byDomain.get(domain) ?? []
    bucket.push(email)
    byDomain.set(domain, bucket)
  }

  await Promise.all(
    Array.from(byDomain.entries()).map(async ([domain, domainEmails]) => {
      const mxHost = await getMxHost(domain)
      if (!mxHost) {
        domainEmails.forEach(e => { results[e] = 'invalido' })
        return
      }

      // Detecta catch-all com endereço garantidamente inexistente
      const fake = `zzverify_notexist_${Date.now()}@${domain}`
      const catchAllTest = await checkSmtp(mxHost, fake)

      if (catchAllTest === 'bloqueado' || catchAllTest === 'timeout') {
        domainEmails.forEach(e => { results[e] = catchAllTest })
        return
      }

      if (catchAllTest === 'valido') {
        // Servidor aceita qualquer endereço = catch-all, não dá para verificar individualmente
        domainEmails.forEach(e => { results[e] = 'catch_all' })
        return
      }

      // Servidor rejeita desconhecidos — verifica cada email individualmente
      await Promise.all(
        domainEmails.map(async email => {
          results[email] = await checkSmtp(mxHost, email)
        })
      )
    })
  )

  return res.json({ results })
}

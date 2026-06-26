import { useState, useCallback } from 'react'
import { UploadZone } from './components/UploadZone'
import { Dashboard } from './components/Dashboard'
import { EmailTable } from './components/EmailTable'
import { ExportPanel } from './components/ExportPanel'
import { parseCSVRDStation } from './utils/parseCSV'
import { calcularStatus, enfileirarMX, extrairDominio, validarSintaxe } from './utils/validateEmail'
import type { EmailRecord, ParsedCSV, SmtpStatus } from './types'

type Tela = 'upload' | 'processando' | 'dashboard'

type Etapa = 'csv' | 'sintaxe' | 'mx' | 'smtp' | 'concluido'

const ETAPA_LABEL: Record<Etapa, string> = {
  csv:      'Lendo o CSV...',
  sintaxe:  'Verificando sintaxe dos emails...',
  mx:       'Verificando registros MX...',
  smtp:     'Verificando caixas de entrada (SMTP)...',
  concluido: 'Análise concluída!',
}

const SMTP_BATCH = 10      // emails por chamada à API
const SMTP_CONCORRENCIA = 15 // chamadas simultâneas

// Provedores gratuitos — SMTP bloqueado por eles; pula verificação
const FREE_PROVIDERS_SMTP = new Set([
  'gmail.com','googlemail.com','hotmail.com','hotmail.com.br',
  'outlook.com','outlook.com.br','live.com','live.com.br',
  'yahoo.com','yahoo.com.br','bol.com.br','terra.com.br',
  'ig.com.br','uol.com.br','globo.com','msn.com',
  'icloud.com','me.com','protonmail.com','pm.me','zoho.com',
])

async function verificarSmtpLote(emails: string[]): Promise<Record<string, SmtpStatus>> {
  try {
    const res = await fetch('/api/verify-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    })
    if (!res.ok) return Object.fromEntries(emails.map(e => [e, 'erro' as SmtpStatus]))
    const data = await res.json() as { results: Record<string, SmtpStatus> }
    return data.results
  } catch {
    return Object.fromEntries(emails.map(e => [e, 'erro' as SmtpStatus]))
  }
}

export default function App() {
  const [tela, setTela] = useState<Tela>('upload')
  const [registros, setRegistros] = useState<EmailRecord[]>([])
  const [parsed, setParsed] = useState<ParsedCSV | null>(null)
  const [progresso, setProgresso] = useState(0)
  const [etapa, setEtapa] = useState<Etapa>('csv')
  const [erroUpload, setErroUpload] = useState<string | null>(null)

  const processarArquivo = useCallback(async (arquivo: File) => {
    setErroUpload(null)
    setTela('processando')
    setProgresso(0)

    try {
      // Etapa 1 — Parse do CSV
      setEtapa('csv')
      const resultado = await parseCSVRDStation(arquivo)
      setParsed(resultado)
      setProgresso(5)

      // Etapa 2 — Validação de sintaxe (síncrono)
      setEtapa('sintaxe')
      const registrosIniciais = resultado.registros.map(r => {
        if (r.status === 'duplicata') return r
        if (!validarSintaxe(r.email)) {
          return { ...r, status: 'inválido' as const, score: 50, motivos: ['Sintaxe inválida'] }
        }
        return r
      })
      setRegistros(registrosIniciais)
      setProgresso(10)

      // Etapa 3 — Verificação de MX por domínio único
      setEtapa('mx')
      const dominiosUnicos = [
        ...new Set(
          registrosIniciais
            .filter(r => r.status !== 'inválido' && r.status !== 'duplicata')
            .map(r => extrairDominio(r.email))
            .filter(Boolean)
        ),
      ]

      const mxResultados = new Map<string, boolean>()
      let mxVerificados = 0
      await Promise.all(
        dominiosUnicos.map(async (dominio) => {
          const valido = await enfileirarMX(dominio)
          mxResultados.set(dominio, valido)
          mxVerificados++
          setProgresso(10 + Math.floor((mxVerificados / dominiosUnicos.length) * 40))
        })
      )

      const registrosPosMX = registrosIniciais.map(r => {
        if (r.status === 'duplicata' || r.status === 'inválido') return r
        const dominio = extrairDominio(r.email)
        const mxValido = mxResultados.get(dominio) ?? null
        const { status, score, motivos } = calcularStatus({ ...r, mxValido })
        return { ...r, status, score, motivos, mxValido }
      })

      setRegistros(registrosPosMX)
      setProgresso(50)

      // Etapa 4 — Verificação SMTP individual
      setEtapa('smtp')

      // Só verifica emails que não são inválidos/duplicatas e cujo domínio não é free provider
      const emailsParaSmtp = registrosPosMX
        .filter(r => {
          if (r.status === 'inválido' || r.status === 'duplicata') return false
          const dominio = extrairDominio(r.email)
          return !FREE_PROVIDERS_SMTP.has(dominio)
        })
        .map(r => r.email)

      const smtpResultados = new Map<string, SmtpStatus>()

      // Marca provedores gratuitos como 'bloqueado' direto (não passa pela API)
      registrosPosMX.forEach(r => {
        const dominio = extrairDominio(r.email)
        if (FREE_PROVIDERS_SMTP.has(dominio)) smtpResultados.set(r.email, 'bloqueado')
      })

      // Processa em batches com concorrência limitada
      const batches: string[][] = []
      for (let i = 0; i < emailsParaSmtp.length; i += SMTP_BATCH) {
        batches.push(emailsParaSmtp.slice(i, i + SMTP_BATCH))
      }

      let smtpVerificados = 0

      // Processa batches com concorrência máxima
      for (let i = 0; i < batches.length; i += SMTP_CONCORRENCIA) {
        const grupo = batches.slice(i, i + SMTP_CONCORRENCIA)
        await Promise.all(
          grupo.map(async (batch) => {
            const resultado = await verificarSmtpLote(batch)
            Object.entries(resultado).forEach(([email, status]) => {
              smtpResultados.set(email, status)
            })
            smtpVerificados += batch.length
            const pct = emailsParaSmtp.length > 0
              ? Math.floor((smtpVerificados / emailsParaSmtp.length) * 45)
              : 45
            setProgresso(50 + pct)
          })
        )
      }

      // Aplica resultados SMTP aos registros
      const registrosFinais = registrosPosMX.map(r => ({
        ...r,
        smtpStatus: smtpResultados.get(r.email) ?? null,
      }))

      setRegistros(registrosFinais)
      setEtapa('concluido')
      setProgresso(100)
      setTimeout(() => setTela('dashboard'), 500)

    } catch (err) {
      setErroUpload(err instanceof Error ? err.message : 'Erro ao processar o arquivo.')
      setTela('upload')
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-emerald-500 flex items-center justify-center text-slate-950 font-bold text-sm">
            EH
          </div>
          <div>
            <span className="font-semibold text-slate-100 text-sm">Email Health Checker</span>
            <span className="ml-2 text-xs text-slate-500">CR BASSO · uso interno</span>
          </div>
        </div>
        {tela === 'dashboard' && (
          <button
            onClick={() => { setTela('upload'); setRegistros([]); setParsed(null) }}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors border border-slate-700 hover:border-slate-500 rounded px-3 py-1.5"
          >
            Nova análise
          </button>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {tela === 'upload' && (
          <UploadZone onUpload={processarArquivo} erro={erroUpload} />
        )}

        {tela === 'processando' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="text-center">
              <p className="text-slate-300 font-medium mb-1">{ETAPA_LABEL[etapa]}</p>
              <p className="text-slate-500 text-sm">
                {etapa === 'smtp'
                  ? 'Conectando nos servidores de email. Isso pode levar alguns minutos para bases grandes.'
                  : 'Aguarde...'}
              </p>
            </div>
            <div className="w-80 bg-slate-800 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <p className="text-emerald-400 text-sm font-mono">{progresso}%</p>
            {/* Indicador das etapas */}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {(['csv','sintaxe','mx','smtp'] as Etapa[]).map((e, i) => {
                const steps = ['csv','sintaxe','mx','smtp','concluido'] as Etapa[]
                const currentIdx = steps.indexOf(etapa)
                const stepIdx = steps.indexOf(e)
                const done = stepIdx < currentIdx
                const active = stepIdx === currentIdx
                return (
                  <span key={e} className={`flex items-center gap-1 ${done ? 'text-emerald-500' : active ? 'text-slate-300' : 'text-slate-600'}`}>
                    {i > 0 && <span className="text-slate-700">›</span>}
                    {done ? '✓' : ''} {['CSV','Sintaxe','MX','SMTP'][i]}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {tela === 'dashboard' && parsed && (
          <div className="space-y-8">
            <Dashboard registros={registros} parsed={parsed} />
            <ExportPanel registros={registros} />
            <EmailTable registros={registros} />
          </div>
        )}
      </main>
    </div>
  )
}

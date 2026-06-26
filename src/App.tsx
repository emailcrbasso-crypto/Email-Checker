import { useState, useCallback } from 'react'
import { UploadZone } from './components/UploadZone'
import { Dashboard } from './components/Dashboard'
import { EmailTable } from './components/EmailTable'
import { ExportPanel } from './components/ExportPanel'
import { parseCSVRDStation } from './utils/parseCSV'
import { calcularStatus, enfileirarMX, extrairDominio, extrairPrefixo, validarSintaxe } from './utils/validateEmail'
import type { EmailRecord, ParsedCSV } from './types'

type Tela = 'upload' | 'processando' | 'dashboard'

export default function App() {
  const [tela, setTela] = useState<Tela>('upload')
  const [registros, setRegistros] = useState<EmailRecord[]>([])
  const [parsed, setParsed] = useState<ParsedCSV | null>(null)
  const [progresso, setProgresso] = useState(0)
  const [erroUpload, setErroUpload] = useState<string | null>(null)

  const processarArquivo = useCallback(async (arquivo: File) => {
    setErroUpload(null)
    setTela('processando')
    setProgresso(0)

    try {
      // 1. Parse do CSV
      const resultado = await parseCSVRDStation(arquivo)
      setParsed(resultado)
      setProgresso(10)

      // 2. Validação de sintaxe e domínio (síncrono)
      const registrosIniciais = resultado.registros.map(r => {
        if (r.status === 'duplicata') return r
        const sintatico = validarSintaxe(r.email)
        if (!sintatico) {
          return {
            ...r,
            status: 'inválido' as const,
            score: 50,
            motivos: ['Sintaxe inválida'],
          }
        }
        return r
      })

      setRegistros(registrosIniciais)
      setProgresso(20)

      // 3. Verificação de MX por domínio único (assíncrono com progresso)
      const dominiosUnicos = [
        ...new Set(
          registrosIniciais
            .filter(r => r.status !== 'inválido' && r.status !== 'duplicata')
            .map(r => extrairDominio(r.email))
            .filter(Boolean)
        )
      ]

      const mxResultados = new Map<string, boolean>()
      let verificados = 0

      await Promise.all(
        dominiosUnicos.map(async (dominio) => {
          const valido = await enfileirarMX(dominio)
          mxResultados.set(dominio, valido)
          verificados++
          setProgresso(20 + Math.floor((verificados / dominiosUnicos.length) * 70))
        })
      )

      // 4. Calcula status final com MX
      const registrosFinais = registrosIniciais.map(r => {
        if (r.status === 'duplicata' || r.status === 'inválido') return r

        const dominio = extrairDominio(r.email)
        const mxValido = mxResultados.get(dominio) ?? null

        const { status, score, motivos } = calcularStatus({
          ...r,
          mxValido,
        })

        return { ...r, status, score, motivos, mxValido }
      })

      setRegistros(registrosFinais)
      setProgresso(100)

      setTimeout(() => setTela('dashboard'), 500)
    } catch (err) {
      setErroUpload(err instanceof Error ? err.message : 'Erro ao processar o arquivo.')
      setTela('upload')
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
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

      {/* Conteúdo */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {tela === 'upload' && (
          <UploadZone onUpload={processarArquivo} erro={erroUpload} />
        )}

        {tela === 'processando' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="text-center">
              <p className="text-slate-300 font-medium mb-1">Analisando a base...</p>
              <p className="text-slate-500 text-sm">Verificando registros MX. Isso pode levar alguns segundos.</p>
            </div>
            <div className="w-80 bg-slate-800 rounded-full h-2">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progresso}%` }}
              />
            </div>
            <p className="text-emerald-400 text-sm font-mono">{progresso}%</p>
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

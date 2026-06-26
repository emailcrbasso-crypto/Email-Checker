import { useState, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown } from 'lucide-react'
import type { EmailRecord, EmailStatus, SmtpStatus } from '../types'

const SMTP_CONFIG: Record<NonNullable<SmtpStatus>, { label: string; classe: string }> = {
  valido:    { label: 'Confirmado',  classe: 'bg-emerald-500/20 text-emerald-300' },
  invalido:  { label: 'Inexistente', classe: 'bg-red-500/20 text-red-300' },
  catch_all: { label: 'Catch-all',   classe: 'bg-sky-500/20 text-sky-300' },
  timeout:   { label: 'Timeout',     classe: 'bg-slate-700 text-slate-400' },
  bloqueado: { label: 'Bloqueado',   classe: 'bg-slate-700 text-slate-400' },
  erro:      { label: 'Erro',        classe: 'bg-slate-700 text-slate-400' },
}

interface Props {
  registros: EmailRecord[]
}

const STATUS_LABELS: Record<EmailStatus, string> = {
  'válido': 'Válido',
  'inválido': 'Inválido',
  'suspeito': 'Suspeito',
  'spam_trap': 'Spam trap',
  'duplicata': 'Duplicata',
  'pendente': 'Pendente',
}

const STATUS_CORES: Record<EmailStatus, string> = {
  'válido':    'bg-emerald-500/20 text-emerald-300',
  'inválido':  'bg-red-500/20 text-red-300',
  'suspeito':  'bg-amber-500/20 text-amber-300',
  'spam_trap': 'bg-violet-500/20 text-violet-300',
  'duplicata': 'bg-slate-700 text-slate-400',
  'pendente':  'bg-slate-800 text-slate-500',
}

type Coluna = 'email' | 'empresa' | 'score' | 'status'

export function EmailTable({ registros }: Props) {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<EmailStatus | 'todos'>('todos')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; dir: 'asc' | 'desc' }>({ coluna: 'score', dir: 'desc' })

  const POR_PAGINA = 50

  const filtrados = useMemo(() => {
    return registros
      .filter(r => {
        if (filtroStatus !== 'todos' && r.status !== filtroStatus) return false
        if (busca && !r.email.includes(busca.toLowerCase()) && !r.empresa.toLowerCase().includes(busca.toLowerCase())) return false
        return true
      })
      .sort((a, b) => {
        const dir = ordenacao.dir === 'asc' ? 1 : -1
        if (ordenacao.coluna === 'email') return a.email.localeCompare(b.email) * dir
        if (ordenacao.coluna === 'empresa') return a.empresa.localeCompare(b.empresa) * dir
        if (ordenacao.coluna === 'score') return (a.score - b.score) * dir
        if (ordenacao.coluna === 'status') return a.status.localeCompare(b.status) * dir
        return 0
      })
  }, [registros, busca, filtroStatus, ordenacao])

  const totalPaginas = Math.ceil(filtrados.length / POR_PAGINA)
  const paginados = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)

  const toggleOrdenacao = (coluna: Coluna) => {
    setOrdenacao(prev => prev.coluna === coluna
      ? { coluna, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { coluna, dir: 'desc' }
    )
    setPaginaAtual(1)
  }

  const SortIcon = ({ coluna }: { coluna: Coluna }) => {
    if (ordenacao.coluna !== coluna) return <span className="w-3 h-3 text-slate-600">↕</span>
    return ordenacao.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
  }

  const statusOptions: (EmailStatus | 'todos')[] = ['todos', 'válido', 'inválido', 'suspeito', 'spam_trap', 'duplicata']

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por email ou empresa..."
            value={busca}
            onChange={e => { setBusca(e.target.value); setPaginaAtual(1) }}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statusOptions.map(s => (
            <button
              key={s}
              onClick={() => { setFiltroStatus(s); setPaginaAtual(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filtroStatus === s
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {s === 'todos' ? 'Todos' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Contagem */}
      <div className="px-4 py-2 border-b border-slate-800">
        <p className="text-slate-500 text-xs">{filtrados.length.toLocaleString('pt-BR')} registros encontrados</p>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {([
                { key: 'email', label: 'Email' },
                { key: 'empresa', label: 'Empresa' },
                { key: 'status', label: 'Status' },
                { key: 'score', label: 'Score de risco' },
              ] as { key: Coluna; label: string }[]).map(col => (
                <th
                  key={col.key}
                  onClick={() => toggleOrdenacao(col.key)}
                  className="text-left px-4 py-3 text-slate-500 text-xs font-medium cursor-pointer hover:text-slate-300 select-none"
                >
                  <span className="flex items-center gap-1">
                    {col.label} <SortIcon coluna={col.key} />
                  </span>
                </th>
              ))}
              <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium">SMTP</th>
              <th className="text-left px-4 py-3 text-slate-500 text-xs font-medium">Motivos</th>
            </tr>
          </thead>
          <tbody>
            {paginados.map(r => (
              <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{r.email}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{r.empresa || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_CORES[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full">
                      <div
                        className={`h-1.5 rounded-full ${r.score >= 50 ? 'bg-red-500' : r.score >= 20 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${r.score}%` }}
                      />
                    </div>
                    <span className="text-slate-500 text-xs">{r.score}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {r.smtpStatus ? (
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${SMTP_CONFIG[r.smtpStatus].classe}`}>
                      {SMTP_CONFIG[r.smtpStatus].label}
                    </span>
                  ) : <span className="text-slate-600 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{r.motivos.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between">
          <p className="text-slate-500 text-xs">
            Página {paginaAtual} de {totalPaginas}
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
              disabled={paginaAtual === 1}
              className="px-3 py-1.5 bg-slate-800 rounded text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual === totalPaginas}
              className="px-3 py-1.5 bg-slate-800 rounded text-xs text-slate-400 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

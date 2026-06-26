import { Download, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import { exportarCSV } from '../utils/parseCSV'
import type { EmailRecord } from '../types'

interface Props {
  registros: EmailRecord[]
}

export function ExportPanel({ registros }: Props) {
  const validos = registros.filter(r => r.status === 'válido')
  const suspeitos = registros.filter(r => r.status === 'suspeito')
  const remover = registros.filter(r => ['inválido', 'spam_trap', 'duplicata'].includes(r.status))

  const opcoes = [
    {
      label: 'Base válida',
      descricao: 'Pronto para disparo — emails com MX ativo e sem problemas',
      icon: CheckCircle,
      cor: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60',
      lista: validos,
      arquivo: 'base_valida.csv',
    },
    {
      label: 'Base suspeita',
      descricao: 'Tentar reengajar com campanha específica antes de descartar',
      icon: AlertTriangle,
      cor: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60',
      lista: suspeitos,
      arquivo: 'base_suspeita.csv',
    },
    {
      label: 'Remover / Suprimir',
      descricao: 'Arquivar ou suprimir no RD Station — não enviar',
      icon: XCircle,
      cor: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/30 hover:border-red-500/60',
      lista: remover,
      arquivo: 'base_remover.csv',
    },
  ]

  return (
    <div>
      <h3 className="text-slate-300 text-sm font-medium mb-3">Exportar sublistas</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {opcoes.map(opcao => {
          const Icon = opcao.icon
          return (
            <button
              key={opcao.arquivo}
              onClick={() => exportarCSV(opcao.lista, opcao.arquivo)}
              disabled={opcao.lista.length === 0}
              className={`
                flex items-start gap-3 p-4 rounded-xl border text-left transition-all
                ${opcao.bg}
                disabled:opacity-40 disabled:cursor-not-allowed
              `}
            >
              <Icon className={`w-5 h-5 ${opcao.cor} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${opcao.cor}`}>{opcao.label}</p>
                <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{opcao.descricao}</p>
                <p className="text-slate-400 text-xs mt-2 font-mono">
                  {opcao.lista.length.toLocaleString('pt-BR')} registros
                </p>
              </div>
              <Download className="w-4 h-4 text-slate-500 flex-shrink-0" />
            </button>
          )
        })}
      </div>
      <p className="text-slate-600 text-xs mt-3">
        Os arquivos exportados mantêm nome, empresa e cargo para facilitar a importação de supressão no RD Station.
      </p>
    </div>
  )
}

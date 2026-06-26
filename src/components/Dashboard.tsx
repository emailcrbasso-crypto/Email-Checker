import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { CheckCircle, XCircle, AlertTriangle, Copy, ShieldAlert, Clock } from 'lucide-react'
import type { EmailRecord, ParsedCSV } from '../types'

interface Props {
  registros: EmailRecord[]
  parsed: ParsedCSV
}

const STATUS_CONFIG = {
  'válido':    { label: 'Válidos',     cor: '#10b981', icon: CheckCircle,  bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  'inválido':  { label: 'Inválidos',   cor: '#ef4444', icon: XCircle,      bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-400' },
  'suspeito':  { label: 'Suspeitos',   cor: '#f59e0b', icon: AlertTriangle, bg: 'bg-amber-500/10',  border: 'border-amber-500/30',   text: 'text-amber-400' },
  'spam_trap': { label: 'Spam traps',  cor: '#8b5cf6', icon: ShieldAlert,  bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  text: 'text-violet-400' },
  'duplicata': { label: 'Duplicatas',  cor: '#64748b', icon: Copy,         bg: 'bg-slate-700/50',   border: 'border-slate-600',      text: 'text-slate-400' },
  'pendente':  { label: 'Pendentes',   cor: '#334155', icon: Clock,        bg: 'bg-slate-800',      border: 'border-slate-700',      text: 'text-slate-500' },
}

export function Dashboard({ registros, parsed }: Props) {
  const contagem = registros.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const total = registros.length
  const problemáticos = (contagem['inválido'] ?? 0) + (contagem['suspeito'] ?? 0) + (contagem['spam_trap'] ?? 0) + (contagem['duplicata'] ?? 0)
  const taxaRisco = total > 0 ? Math.round((problemáticos / total) * 100) : 0

  // Top domínios
  const dominios = registros.reduce((acc, r) => {
    const d = r.email.split('@')[1] ?? 'desconhecido'
    acc[d] = (acc[d] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const topDominios = Object.entries(dominios).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const pieData = Object.entries(contagem)
    .filter(([, v]) => v > 0)
    .map(([status, value]) => ({
      name: STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label ?? status,
      value,
      cor: STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.cor ?? '#64748b',
    }))

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Resultado da análise</h2>
          <p className="text-slate-500 text-sm mt-0.5">{total.toLocaleString('pt-BR')} registros processados</p>
        </div>
        <div className={`text-right px-4 py-2 rounded-lg border ${taxaRisco > 50 ? 'bg-red-500/10 border-red-500/30' : taxaRisco > 25 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
          <p className={`text-2xl font-bold ${taxaRisco > 50 ? 'text-red-400' : taxaRisco > 25 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {taxaRisco}%
          </p>
          <p className="text-slate-500 text-xs">taxa de risco</p>
        </div>
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {(Object.keys(STATUS_CONFIG) as (keyof typeof STATUS_CONFIG)[])
          .filter(s => s !== 'pendente')
          .map(status => {
            const cfg = STATUS_CONFIG[status]
            const Icon = cfg.icon
            const qtd = contagem[status] ?? 0
            const pct = total > 0 ? Math.round((qtd / total) * 100) : 0
            return (
              <div key={status} className={`${cfg.bg} border ${cfg.border} rounded-xl p-4`}>
                <Icon className={`w-4 h-4 ${cfg.text} mb-3`} />
                <p className={`text-2xl font-bold ${cfg.text}`}>{qtd.toLocaleString('pt-BR')}</p>
                <p className="text-slate-400 text-xs mt-0.5">{cfg.label}</p>
                <p className="text-slate-600 text-xs">{pct}% do total</p>
              </div>
            )
          })}
      </div>

      {/* Gráfico + Top domínios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pizza */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <p className="text-slate-300 text-sm font-medium mb-4">Distribuição por status</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={2}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.cor} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, name: string) => [`${value.toLocaleString('pt-BR')} emails`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Legenda */}
          <div className="flex flex-wrap gap-2 mt-2">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.cor }} />
                <span className="text-slate-400 text-xs">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top domínios */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <p className="text-slate-300 text-sm font-medium mb-4">Top domínios na base</p>
          <div className="space-y-2">
            {topDominios.map(([dominio, count]) => (
              <div key={dominio} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-slate-300 text-xs font-mono truncate">{dominio}</span>
                    <span className="text-slate-500 text-xs ml-2 flex-shrink-0">{count}</span>
                  </div>
                  <div className="h-1 bg-slate-800 rounded-full">
                    <div
                      className="h-1 bg-emerald-500/60 rounded-full"
                      style={{ width: `${Math.round((count / topDominios[0][1]) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerta de ação */}
      {taxaRisco > 30 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-medium text-sm">Base com risco elevado de entregabilidade</p>
            <p className="text-amber-400/70 text-xs mt-1">
              {taxaRisco}% dos emails apresentam problemas. Recomendamos exportar a lista "válidos" e suprimir os demais no RD Station antes do próximo disparo.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

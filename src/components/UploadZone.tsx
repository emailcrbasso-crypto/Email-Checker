import { useCallback, useState } from 'react'
import { Upload, FileText, AlertCircle } from 'lucide-react'

interface Props {
  onUpload: (arquivo: File) => void
  erro: string | null
}

export function UploadZone({ onUpload, erro }: Props) {
  const [arrastando, setArrastando] = useState(false)

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Por favor, selecione um arquivo CSV exportado do RD Station.')
      return
    }
    onUpload(file)
  }, [onUpload])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setArrastando(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8">
      <div className="text-center max-w-lg">
        <h1 className="text-2xl font-semibold text-slate-100 mb-3">
          Diagnóstico de base de emails
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Importe um CSV exportado do RD Station. A ferramenta valida sintaxe,
          verifica registros MX dos domínios e identifica spam traps, duplicatas
          e emails inválidos.
        </p>
      </div>

      <label
        className={`
          w-full max-w-lg border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
          ${arrastando
            ? 'border-emerald-400 bg-emerald-500/10'
            : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'
          }
        `}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
        onDragLeave={() => setArrastando(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        <Upload className="w-10 h-10 text-slate-500 mx-auto mb-4" />
        <p className="text-slate-300 font-medium mb-1">
          Arraste o CSV aqui ou clique para selecionar
        </p>
        <p className="text-slate-500 text-xs">
          Exportação padrão do RD Station · arquivo .csv
        </p>
      </label>

      {erro && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 max-w-lg w-full">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-red-300 text-sm">{erro}</p>
        </div>
      )}

      <div className="text-center max-w-md">
        <p className="text-slate-600 text-xs mb-3">Como exportar do RD Station:</p>
        <div className="flex gap-2 text-xs text-slate-500">
          {['Leads → Todos os leads', 'Filtrar segmento', 'Exportar → CSV'].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-slate-700">→</span>}
              <span className="bg-slate-800 border border-slate-700 rounded px-2 py-1">{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

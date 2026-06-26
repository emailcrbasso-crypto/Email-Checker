// Tipos centrais do Email Health Checker

export type EmailStatus = 'válido' | 'inválido' | 'suspeito' | 'spam_trap' | 'duplicata' | 'pendente'

export interface EmailRecord {
  id: string
  email: string
  nome: string
  empresa: string
  cargo: string
  // Resultado da validação
  status: EmailStatus
  score: number // 0–100, quanto maior mais arriscado
  motivos: string[] // lista de problemas encontrados
  dominioTipo: 'corporativo' | 'gratuito' | 'temporario' | 'desconhecido'
  mxValido: boolean | null // null = ainda verificando
}

export interface ParsedCSV {
  registros: EmailRecord[]
  totalLinhas: number
  errosDeFormato: number
  colunasMapeadas: Record<string, string>
}

export interface DashboardStats {
  total: number
  validos: number
  invalidos: number
  suspeitos: number
  spamTraps: number
  duplicatas: number
  pendentes: number
  topDominios: { dominio: string; count: number; tipo: string }[]
  taxaRisco: number // % de emails problemáticos
}

export interface MXCacheEntry {
  valido: boolean
  checkedAt: number
}

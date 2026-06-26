import Papa from 'papaparse'
import type { EmailRecord, ParsedCSV } from '../types'
import { extrairDominio, classificarDominio, validarSintaxe } from './validateEmail'

// Mapeamento tolerante de colunas do RD Station
const COLUNA_EMAIL = ['e-mail', 'email', 'e_mail', 'Email', 'E-mail', 'E-Mail']
const COLUNA_NOME = ['nome', 'Nome', 'name', 'Name', 'primeiro nome', 'Primeiro nome']
const COLUNA_EMPRESA = ['empresa', 'Empresa', 'company', 'Company', 'organização']
const COLUNA_CARGO = ['cargo', 'Cargo', 'job title', 'Job title', 'função']

function encontrarColuna(headers: string[], candidatas: string[]): string | null {
  const headersLower = headers.map(h => h?.toLowerCase().trim())
  for (const candidata of candidatas) {
    const idx = headersLower.indexOf(candidata.toLowerCase())
    if (idx !== -1) return headers[idx]
  }
  return null
}

function gerarId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export async function parseCSVRDStation(arquivo: File): Promise<ParsedCSV> {
  return new Promise((resolve, reject) => {
    Papa.parse(arquivo, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const headers = results.meta.fields ?? []

        // Mapear colunas
        const colEmail = encontrarColuna(headers, COLUNA_EMAIL)
        const colNome = encontrarColuna(headers, COLUNA_NOME)
        const colEmpresa = encontrarColuna(headers, COLUNA_EMPRESA)
        const colCargo = encontrarColuna(headers, COLUNA_CARGO)

        if (!colEmail) {
          reject(new Error('Coluna de email não encontrada. Verifique se o CSV é uma exportação do RD Station.'))
          return
        }

        const colunasMapeadas: Record<string, string> = {
          email: colEmail,
          nome: colNome ?? '(não encontrada)',
          empresa: colEmpresa ?? '(não encontrada)',
          cargo: colCargo ?? '(não encontrada)',
        }

        const emailsVistos = new Set<string>()
        const registros: EmailRecord[] = []
        let errosDeFormato = 0

        for (const row of results.data as Record<string, string>[]) {
          const emailRaw = colEmail ? row[colEmail]?.trim() : ''
          if (!emailRaw) {
            errosDeFormato++
            continue
          }

          const email = emailRaw.toLowerCase()
          const isDuplicata = emailsVistos.has(email)
          emailsVistos.add(email)

          const dominio = extrairDominio(email)
          const dominioTipo = classificarDominio(dominio)

          const record: EmailRecord = {
            id: gerarId(),
            email,
            nome: colNome ? (row[colNome] ?? '') : '',
            empresa: colEmpresa ? (row[colEmpresa] ?? '') : '',
            cargo: colCargo ? (row[colCargo] ?? '') : '',
            status: isDuplicata ? 'duplicata' : 'pendente',
            score: isDuplicata ? 10 : 0,
            motivos: isDuplicata ? ['Email duplicado na lista'] : [],
            dominioTipo,
            mxValido: null,
          }

          registros.push(record)
        }

        resolve({
          registros,
          totalLinhas: results.data.length,
          errosDeFormato,
          colunasMapeadas,
        })
      },
      error: (error) => reject(error),
    })
  })
}

// Exporta sublistas como CSV para download (usa PapaParse para escapar corretamente)
export function exportarCSV(registros: EmailRecord[], nomeArquivo: string): void {
  const csv = Papa.unparse(
    registros.map(r => ({
      email: r.email,
      nome: r.nome,
      empresa: r.empresa,
      cargo: r.cargo,
      status: r.status,
      score: r.score,
      motivos: r.motivos.join('; '),
    }))
  )

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  link.click()
  URL.revokeObjectURL(url)
}

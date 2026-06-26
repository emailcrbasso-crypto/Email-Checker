# Email Health Checker — CR BASSO

## O que é esse projeto
Ferramenta interna para diagnóstico e limpeza de base de emails do RD Station.
Importa um CSV exportado do RD Station, valida cada email e gera um relatório de ação.

## Stack
- React + Vite + TypeScript
- Tailwind CSS
- Biblioteca `dns` via worker (Node) ou validação via API pública de MX
- Papa Parse — leitura de CSV
- Recharts — gráficos do dashboard

## Estrutura de pastas
```
email-health-checker/
├── CLAUDE.md
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── types.ts
    ├── components/
    │   ├── UploadZone.tsx       # drop de CSV
    │   ├── Dashboard.tsx        # visão geral com gráficos
    │   ├── EmailTable.tsx       # tabela com filtros por status
    │   └── ExportPanel.tsx      # exportar listas limpas
    ├── utils/
    │   ├── parseCSV.ts          # lê e normaliza CSV do RD Station
    │   ├── validateEmail.ts     # validações de sintaxe, domínio e padrões
    │   └── classifyEmail.ts     # aplica score e classifica o email
    └── data/
        └── spamDomains.ts       # lista de domínios temporários conhecidos
```

## Fluxo principal
1. Usuário faz upload do CSV exportado do RD Station
2. Papa Parse lê e normaliza as colunas
3. Cada email passa pelo pipeline de validação:
   - Sintaxe (regex RFC 5322 simplificado)
   - Domínio temporário (lista negra local)
   - MX record (via api.mxlookup ou similar — fetch público)
   - Padrões de spam trap (noreply@, postmaster@, abuse@, etc.)
   - Duplicata na própria lista
4. Cada email recebe um status: `válido` | `inválido` | `suspeito` | `duplicata` | `spam_trap`
5. Dashboard exibe distribuição + top domínios + ações recomendadas
6. Usuário pode exportar sublistas: só válidos, só suspeitos, etc.

## Regras de negócio

### Status de email
| Status | Critério |
|--------|----------|
| `válido` | Sintaxe ok + domínio com MX ativo + não é temporário |
| `inválido` | Sintaxe quebrada OU domínio sem MX |
| `suspeito` | MX ok mas domínio temporário ou padrão incomum |
| `spam_trap` | Prefixo de sistema (noreply, postmaster, abuse, info, contato, admin) |
| `duplicata` | Email já apareceu antes na lista (case-insensitive) |

### Score de risco (0–100)
Cada email recebe um score para ordenação:
- Sintaxe inválida: +50
- Domínio temporário: +40
- Sem MX: +40
- Prefixo de sistema: +20
- Duplicata: +10
- Domínio de provedor gratuito (gmail, hotmail, yahoo, outlook): +5 (risco menor, mas sinaliza pessoa física, não empresa)

### Exportação
Gera 3 arquivos CSV ao final:
- `base_valida.csv` — só enviar para esses
- `base_suspeita.csv` — tentar reengajar com campanha específica
- `base_remover.csv` — arquivar ou suprimir no RD Station

## Coluna esperada no CSV do RD Station
O RD Station exporta com cabeçalho em português. Colunas relevantes:
- `E-mail` ou `email` — endereço principal
- `Nome` — primeiro nome
- `Empresa` — empresa do lead
- `Cargo` — cargo
- `Estágio no funil` — (opcional, para diagnóstico)
- `Última conversão` — (opcional)

O parser deve ser tolerante a variações de capitalização nos cabeçalhos.

## Verificação de MX
Usar a API pública `https://dns.google/resolve?name=DOMINIO&type=MX` (Google DNS over HTTPS).
- Não requer autenticação
- Retorna JSON com registros MX
- Fazer com rate limit suave (máx 10 req/s) para não travar o browser
- Resultado deve ser cacheado por domínio para não repetir consulta

## Comandos úteis
```bash
npm install
npm run dev
npm run build
```

## Convenções de código
- TypeScript estrito — sem `any`
- Componentes funcionais com hooks
- Tailwind para estilo — sem CSS modules
- Sem dependências desnecessárias
- Comentários em português (projeto interno)

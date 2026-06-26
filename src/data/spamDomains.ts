// Domínios de email temporário (descartáveis)
export const SPAM_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwam.com',
  'sharklasers.com', 'guerrillamailblock.com', 'grr.la', 'guerrillamail.info',
  'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org',
  'spam4.me', 'trashmail.com', 'trashmail.me', 'trashmail.net', 'trashmail.org',
  'trashmail.at', 'trashmail.io', 'dispostable.com', 'yopmail.com',
  'yopmail.fr', 'cool.fr.nf', 'jetable.fr.nf', 'nospam.ze.tc',
  'nomail.xl.cx', 'mega.zik.dj', 'speed.1s.fr', 'courriel.fr.nf',
  'moncourrier.fr.nf', 'monemail.fr.nf', 'monmail.fr.nf',
  'fakeinbox.com', 'maildrop.cc', 'getairmail.com', 'filzmail.com',
  'throwam.com', 'spamgourmet.com', 'spamgourmet.net', 'spamgourmet.org',
  'tempr.email', 'discard.email', 'crazymailing.com', 'mailnull.com',
  'spamspot.com', 'spamthisplease.com', 'mailexpire.com', '10minutemail.com',
  '10minutemail.net', 'minutemail.com', 'temp-mail.org', 'emailondeck.com',
  'mohmal.com', 'mailnesia.com', 'mailnull.com',
])

// Provedores de email gratuito (pessoa física — risco baixo mas sinaliza não-corporativo)
export const FREE_PROVIDERS = new Set([
  'gmail.com', 'googlemail.com',
  'hotmail.com', 'hotmail.com.br',
  'outlook.com', 'outlook.com.br',
  'live.com', 'live.com.br',
  'yahoo.com', 'yahoo.com.br',
  'bol.com.br', 'terra.com.br',
  'ig.com.br', 'uol.com.br',
  'globo.com', 'msn.com',
  'icloud.com', 'me.com',
  'protonmail.com', 'pm.me',
  'zoho.com',
])

// Prefixos de sistema que indicam spam trap ou caixa não monitorada
export const SYSTEM_PREFIXES = [
  'noreply', 'no-reply', 'no_reply', 'donotreply', 'do-not-reply',
  'postmaster', 'abuse', 'mailer-daemon', 'mailer_daemon',
  'bounce', 'bounces', 'return', 'returns',
  'admin', 'administrator', 'root',
  'info', 'contato', 'contact', 'faleconosco',
  'suporte', 'support', 'helpdesk', 'help',
  'vendas', 'comercial', 'marketing', 'financeiro',
  // rh/recrutamento removidos — são personas-alvo da CR BASSO (treinamento corporativo)
  'teste', 'test', 'demo', 'example',
]

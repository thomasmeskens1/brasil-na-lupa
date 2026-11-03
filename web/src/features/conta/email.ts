import "server-only";

/**
 * Envio de e-mail pelo Resend (operador). Só e-mails transacionais da conta: código de login,
 * código de troca de e-mail e aviso antes da exclusão por inatividade. Nada de marketing.
 */

export function escapar(t: string): string {
  return t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export async function enviarEmail(para: string, assunto: string, texto: string, html: string): Promise<void> {
  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: para, subject: assunto, text: texto, html }),
  });
  if (!resposta.ok) throw new Error(`Falha no envio do e-mail (HTTP ${resposta.status}).`);
}

/** Código em destaque (com espaço no meio para ler melhor; o formulário aceita com ou sem). */
export function codigoLegivel(codigo: string): string {
  return `${codigo.slice(0, 3)} ${codigo.slice(3)}`;
}

export function htmlCodigo(codigo: string): string {
  return `<p style="font-size:28px;font-weight:700;letter-spacing:4px;font-family:monospace">${escapar(codigoLegivel(codigo))}</p>`;
}

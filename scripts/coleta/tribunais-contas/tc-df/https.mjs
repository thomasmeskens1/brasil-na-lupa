// HTTPS para o site do TCDF. O servidor www2.tc.df.gov.br envia só o certificado final, sem o intermediário da
// autoridade certificadora (verificado em 06/11/2026: "unable to verify the first certificate"). Como fazem os
// navegadores, o coletor busca os intermediários no endereço "CA Issuers" (AIA) gravado no próprio certificado e
// verifica a cadeia inteira contra as autoridades raiz do Node; a verificação TLS continua ligada.
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';

const MAX_SALTOS = 4;
let agente = null;

function aiaDe(x509) {
  return String(x509.infoAccess || '').split('\n').map((l) => l.match(/^CA Issuers - URI:(\S+)/)?.[1]).filter(Boolean);
}

function baixarCertificado(url) {
  return new Promise((ok, falha) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); falha(new Error(`AIA ${url}: HTTP ${res.statusCode}`)); return; }
      const partes = [];
      let total = 0;
      res.on('data', (p) => { total += p.length; if (total > 64 * 1024) req.destroy(new Error('certificado grande demais')); else partes.push(p); });
      res.on('end', () => { try { ok(new crypto.X509Certificate(Buffer.concat(partes))); } catch (e) { falha(e); } });
    });
    req.on('timeout', () => req.destroy(new Error(`AIA ${url}: tempo esgotado`)));
    req.on('error', falha);
  });
}

function certificadoDoServidor(host) {
  return new Promise((ok, falha) => {
    // Só lê o certificado apresentado (nenhum dado é trocado); a cadeia é verificada depois, com a verificação ligada.
    const s = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 30000 }, () => {
      const c = s.getPeerX509Certificate();
      s.end();
      c ? ok(c) : falha(new Error('servidor sem certificado'));
    });
    s.on('timeout', () => s.destroy(new Error('tempo esgotado no TLS')));
    s.on('error', falha);
  });
}

/** Agente HTTPS com as raízes do Node + intermediários obtidos pelo AIA do certificado do host. */
export async function agentePara(host) {
  if (agente) return agente;
  const raizes = tls.rootCertificates.map((p) => new crypto.X509Certificate(p));
  const extras = [];
  let atual = await certificadoDoServidor(host);
  for (let i = 0; i < MAX_SALTOS; i++) {
    if (raizes.some((r) => atual.checkIssued(r) && atual.verify(r.publicKey))) break;
    const url = aiaDe(atual)[0];
    if (!url) break;
    const emissor = await baixarCertificado(url);
    if (!atual.checkIssued(emissor) || !atual.verify(emissor.publicKey)) throw new Error(`certificado em ${url} não é o emissor de ${atual.subject.replace(/\n/g, ', ')}`);
    extras.push(emissor.toString());
    atual = emissor;
  }
  agente = new https.Agent({ keepAlive: true, maxSockets: 1, ca: [...tls.rootCertificates, ...extras] });
  agente.intermediarios = extras.length;
  return agente;
}

/** GET com resposta parecida com a do fetch: status, ok, headers.get, text(), body (iterável), cancelar(). */
export async function get(url, { headers = {}, timeoutMs = 120000 } = {}) {
  const u = new URL(url);
  const agent = await agentePara(u.hostname);
  return new Promise((ok, falha) => {
    const req = https.get(u, { agent, headers, timeout: timeoutMs }, (res) => {
      ok({
        status: res.statusCode,
        ok: res.statusCode >= 200 && res.statusCode < 300,
        headers: { get: (n) => { const v = res.headers[String(n).toLowerCase()]; return Array.isArray(v) ? v.join(', ') : v ?? null; } },
        body: res,
        text: async () => { const partes = []; for await (const p of res) partes.push(p); return Buffer.concat(partes).toString('utf8'); },
        cancelar: () => res.resume(),
      });
    });
    req.on('timeout', () => req.destroy(new Error(`tempo esgotado em ${url}`)));
    req.on('error', falha);
  });
}

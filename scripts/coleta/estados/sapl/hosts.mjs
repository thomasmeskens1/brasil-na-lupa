// Casas legislativas estaduais com SAPL 3 (Interlegis) cobertas por este coletor.
// Para incluir outra casa com SAPL, basta acrescentar uma entrada (uf → host, sigla e nome oficial).
// AC, AL, RR e TO (incluídos em 03/11/2026): robots.txt lido antes, igual ao das demais (Crawl-delay: 60;
// Disallow só em /materia/docacessorio/pdf|zip/*). Nessas casas há pouco ou nenhum voto nominal no SAPL:
// AC só em vetos; AL só 2018–2019 (fora da legislatura atual); RR e TO nenhum.
export const CASAS = {
  am: {
    uf: 'AM',
    host: 'sapl.al.am.leg.br',
    casa: 'aleam',
    nome: 'Assembleia Legislativa do Estado do Amazonas (ALEAM)',
    dominios_email: ['aleam.gov.br', 'al.am.leg.br'],
  },
  pi: {
    uf: 'PI',
    host: 'sapl.al.pi.leg.br',
    casa: 'alepi',
    nome: 'Assembleia Legislativa do Estado do Piauí (Alepi)',
    dominios_email: ['al.pi.leg.br', 'alepi.pi.gov.br'],
  },
  pb: {
    uf: 'PB',
    host: 'sapl.al.pb.leg.br',
    casa: 'alpb',
    nome: 'Assembleia Legislativa do Estado da Paraíba (ALPB)',
    dominios_email: ['al.pb.leg.br', 'al.pb.gov.br'],
  },
  ro: {
    uf: 'RO',
    host: 'sapl.al.ro.leg.br',
    casa: 'alero',
    nome: 'Assembleia Legislativa do Estado de Rondônia (ALE-RO)',
    dominios_email: ['al.ro.leg.br', 'ale.ro.gov.br'],
  },
  ac: {
    uf: 'AC',
    host: 'sapl.al.ac.leg.br',
    casa: 'aleac',
    nome: 'Assembleia Legislativa do Estado do Acre (ALEAC)',
    dominios_email: ['al.ac.leg.br'],
  },
  al: {
    uf: 'AL',
    host: 'sapl.al.al.leg.br',
    casa: 'aleal',
    nome: 'Assembleia Legislativa do Estado de Alagoas (ALE-AL)',
    dominios_email: ['al.al.leg.br'],
  },
  rr: {
    uf: 'RR',
    host: 'sapl.al.rr.leg.br',
    casa: 'alerr',
    nome: 'Assembleia Legislativa do Estado de Roraima (ALE-RR)',
    dominios_email: ['al.rr.leg.br'],
  },
  to: {
    uf: 'TO',
    host: 'sapl.al.to.leg.br',
    casa: 'alto',
    nome: 'Assembleia Legislativa do Estado do Tocantins (AL-TO)',
    dominios_email: ['al.to.leg.br'],
  },
};

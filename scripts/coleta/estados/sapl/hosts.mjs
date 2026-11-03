// Casas legislativas estaduais com SAPL 3 (Interlegis) cobertas por este coletor.
// Para incluir outra casa com SAPL, basta acrescentar uma entrada (uf → host, sigla e nome oficial).
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
};

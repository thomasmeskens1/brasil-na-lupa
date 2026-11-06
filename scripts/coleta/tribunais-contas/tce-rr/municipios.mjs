// Municípios de Roraima pela lista oficial do Siconfi (Tesouro Nacional) em dados/municipios/entes.json.
// O nome escrito pelo TCE-RR é comparado com o nome oficial só por igualdade exata depois de tirar acentos,
// maiúsculas e espaços repetidos; grafias diferentes não são casadas e ficam registradas no meta.json.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, normalizar } from './lib.mjs';

export const ARQ_ENTES = path.join(RAIZ, 'dados', 'municipios', 'entes.json');

export function carregarMunicipiosRR(arquivo = ARQ_ENTES) {
  const d = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const idx = Object.fromEntries(d.campos.map((c, i) => [c, i]));
  const lista = d.itens
    .filter((x) => x[idx.uf] === 'rr')
    .map((x) => ({ id: x[idx.slug], nome: x[idx.nome], codigo_ibge: String(x[idx.cod_ibge]) }));
  if (lista.length !== 15) throw new Error(`lista de municípios de RR com ${lista.length} itens (esperado: 15)`);
  const porNome = new Map();
  for (const m of lista) {
    const k = normalizar(m.nome);
    if (porNome.has(k)) throw new Error(`nome de município repetido em RR: ${m.nome}`);
    porNome.set(k, m);
  }
  return { lista, porNome, fonte: d.fonte };
}

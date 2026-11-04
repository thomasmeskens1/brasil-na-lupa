/** Contexto de uma UF para os componentes cliente (dados serializáveis, sem acesso a arquivos). */
import type { ContextoCasa } from "./componentes/BuscaVotacoes";
import type { ContextoGoverno } from "./componentes/BuscaNormas";
import { SIGLAS_PADRAO } from "./rotulos";
import type { IndiceEstado } from "./tipos";
import { baseUf, caminhoCasa, caminhoGoverno, nomeCompleto, nomeGoverno, type UfInfo } from "./ufs";

export function contextoCasa(u: UfInfo, ind: IndiceEstado | null): ContextoCasa {
  const c = caminhoCasa(u);
  return {
    uf: u.uf,
    base: baseUf(u.uf),
    casaSigla: u.casa.sigla,
    casaNome: u.casa.nome,
    caminho: c.caminho,
    rotuloCaminho: c.rotulo,
    membros: u.membros,
    siglas: { ...SIGLAS_PADRAO, ...(ind?.siglas ?? {}) },
  };
}

export function nomeDiario(u: UfInfo): string {
  return u.uf === "df" ? "Diário Oficial do Distrito Federal" : `Diário Oficial do ${nomeCompleto(u)}`;
}

export function contextoGoverno(u: UfInfo, ind?: IndiceEstado | null): ContextoGoverno {
  const c = caminhoGoverno(u);
  return {
    uf: u.uf,
    base: baseUf(u.uf),
    caminho: c.caminho,
    rotuloCaminho: c.rotulo,
    governo: nomeGoverno(u),
    diario: nomeDiario(u),
    casaSigla: u.casa.sigla,
    casaNome: u.casa.nome,
    registroCasa: !!ind?.normas?.registro_casa,
  };
}

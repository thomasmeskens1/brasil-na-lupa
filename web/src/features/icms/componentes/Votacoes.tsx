import Link from "next/link";
import { FonteLink } from "@/components/FonteLink";
import { TextoComSiglas } from "@/components/glossario";
import { BlocoDadoChave } from "@/components/decisao/DadoChave";
import { placarOficial } from "@/components/decisao/rotulos";
import { TabelaFiltravel } from "@/components/tabela/TabelaFiltravel";
import { getVotacaoColetada } from "../dados";
import { CASA, NAO_DISPONIVEL, TIPO_VOTACAO, formatarData } from "../rotulos";
import type { Votacao } from "../tipos";

const ORDEM_VOTO = ["Sim", "Não", "Abstenção", "Obstrução"];

/**
 * Uma votação: tipo, casa, data, descrição oficial e placar. Votos individuais (só votação
 * nominal, diretriz 5): quando a votação já tem página na seção Congresso, só o link (evita
 * repetir centenas de linhas); senão, tabela com busca e "Mostrar mais", recolhida.
 */
function UmaVotacao({ v, n }: { v: Votacao; n: number }) {
  const base = TIPO_VOTACAO[v.tipo] ?? { rotulo: "Tipo de votação não informado", explicacao: "" };
  // No CONFAZ, "sem votação" é decisão do colegiado, não ato individual (diretriz 5).
  const tipo =
    v.casa === "confaz" && v.tipo === "sem-votacao"
      ? { ...base, explicacao: "Decisão do colegiado do CONFAZ, tomada pelos representantes dos estados e do Distrito Federal, sem votação de parlamentares." }
      : base;
  const coletada = v.casa === "camara" || v.casa === "senado" ? getVotacaoColetada(v.casa, v.votacao_ref) : null;
  const linkCongresso = coletada ? `/congresso/votacoes/${v.casa}/${encodeURIComponent(coletada.id)}` : null;
  const nominal = v.tipo === "nominal";
  const votos = nominal && !linkCongresso ? (v.votos_individuais ?? []) : [];
  const totalColetado = coletada?.votos?.length ?? 0;
  const casa = CASA[v.casa] ?? NAO_DISPONIVEL;
  const placar = v.placar ? placarOficial({ ...v.placar }) : [];

  return (
    <article className="cartao" aria-labelledby={`votacao-${n}`}>
      <p className="flex flex-wrap items-center gap-2 text-[var(--cor-secundaria)]">
        <span className="selo selo-escuro">{tipo.rotulo}</span>
        <span>{casa}</span>
        <span>· {formatarData(v.data)}</span>
      </p>
      <h3 id={`votacao-${n}`} className="mt-2 text-base font-semibold leading-snug text-gray-900">
        {v.descricao ? <TextoComSiglas>{v.descricao}</TextoComSiglas> : "Descrição não disponível em fonte oficial"}
      </h3>
      {tipo.explicacao ? <p className="mt-1 text-gray-800">{tipo.explicacao}</p> : null}
      {nominal && placar.length ? <BlocoDadoChave dado={{ tipo: "placar", itens: placar }} className="mt-3" /> : null}
      {!nominal && placar.length ? (
        <p className="mt-3 text-gray-800">
          Números registrados no documento: {placar.map((i) => `${i.rotulo} ${i.valor}`).join(", ")}.
        </p>
      ) : null}
      {v.tipo === "simbolica" ? <p className="mt-3 text-gray-800">Não há voto individual a atribuir nesta votação.</p> : null}
      {linkCongresso ? (
        <p className="mt-3">
          <Link href={linkCongresso} className="botao">
            Ver como votou cada {v.casa === "senado" ? "senador" : "deputado"}
            {totalColetado ? ` (${totalColetado} votos)` : ""}
          </Link>
        </p>
      ) : null}
      {votos.length ? (
        <details className="mt-3 rounded-md border border-borda bg-white">
          <summary className="pr-3">
            Ver os votos individuais <span className="font-normal text-[var(--cor-secundaria)]">({votos.length})</span>
          </summary>
          <div className="border-t border-borda px-3 pb-3 pt-2">
            <TabelaFiltravel
              legenda={`Votos individuais (ordem alfabética): ${casa}, ${formatarData(v.data)}`}
              chave="id"
              linhas={[...votos]
                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                .map((x, i) => ({ id: `${i}-${x.nome}`, nome: x.nome, partido: x.partido ?? "Não informado", voto: x.voto }))}
              colunas={[
                { chave: "nome", rotulo: "Nome", principal: true },
                { chave: "partido", rotulo: "Partido" },
                { chave: "voto", rotulo: "Voto" },
              ]}
              busca={{ chaves: ["nome"], rotulo: "Buscar pelo nome" }}
              filtros={[
                { chave: "voto", rotulo: "Voto", ordem: ORDEM_VOTO },
                { chave: "partido", rotulo: "Partido" },
              ]}
              itens={{ singular: "voto", plural: "votos" }}
              porPagina={20}
            />
          </div>
        </details>
      ) : nominal && !linkCongresso ? (
        <p className="lacuna mt-3">Lista de votos individuais não disponível em fonte oficial coletada.</p>
      ) : null}
      {v.url ? (
        <p className="mt-2">
          <FonteLink href={v.url} tipo={/\.pdf($|\?)/i.test(v.url) ? "pdf" : "oficial"} className="inline-flex min-h-11 items-center text-base!">
            Registro oficial da votação
          </FonteLink>
        </p>
      ) : null}
    </article>
  );
}

/** Votações registradas para a decisão (ou a indicação de que não houve votação). */
export function Votacoes({ votacoes }: { votacoes: Votacao[] }) {
  if (!votacoes.length) {
    return <p className="lacuna">Nenhuma votação registrada em fonte oficial para esta decisão.</p>;
  }
  return (
    <div className="space-y-4">
      {votacoes.map((v, i) => (
        <UmaVotacao key={i} v={v} n={i} />
      ))}
    </div>
  );
}

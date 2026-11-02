import Link from "next/link";
import { FonteLink } from "@/components/FonteLink";
import { getVotacaoColetada } from "../dados";
import { CASA, NAO_DISPONIVEL, TIPO_VOTACAO, formatarData } from "../rotulos";
import type { Placar, Votacao } from "../tipos";
import { VotosIndividuais, type LinhaVoto } from "./VotosIndividuais";

const ROTULO_PLACAR: [keyof Placar, string][] = [
  ["sim", "Sim"],
  ["nao", "Não"],
  ["abstencao", "Abstenção"],
  ["obstrucao", "Obstrução"],
  ["outros", "Outros"],
];

function PlacarOficial({ placar }: { placar: Placar }) {
  const itens = ROTULO_PLACAR.filter(([k]) => typeof placar[k] === "number");
  if (!itens.length) return null;
  return (
    <dl className="mt-3 flex flex-wrap gap-2" aria-label="Placar oficial">
      {itens.map(([k, rotulo]) => (
        <div key={k} className="min-w-[5.5rem] rounded border border-borda bg-superficie px-3 py-2 text-center">
          <dt className="text-xs font-medium text-[#3e4c59]">{rotulo}</dt>
          <dd className="text-xl font-bold text-gray-900">{placar[k]}</dd>
        </div>
      ))}
    </dl>
  );
}

function UmaVotacao({ v, n }: { v: Votacao; n: number }) {
  const tipo = TIPO_VOTACAO[v.tipo] ?? { rotulo: "Tipo de votação não informado", explicacao: "" };
  const coletada =
    v.casa === "camara" || v.casa === "senado" ? getVotacaoColetada(v.casa, v.votacao_ref) : null;
  const linkCongresso = coletada ? `/congresso/votacoes/${v.casa}/${encodeURIComponent(coletada.id)}` : null;
  const votos: LinhaVoto[] = v.votos_individuais?.length
    ? v.votos_individuais.map((x) => ({ nome: x.nome, partido: x.partido ?? null, uf: null, voto: x.voto }))
    : (v.tipo === "nominal" ? (coletada?.votos ?? []) : []).map((x) => ({ nome: x.nome, partido: x.partido ?? null, uf: x.uf ?? null, voto: x.voto }));
  const casa = CASA[v.casa] ?? NAO_DISPONIVEL;

  return (
    <article className="cartao" aria-labelledby={`votacao-${n}`}>
      <p className="meta flex flex-wrap items-center gap-2">
        <span className="selo selo-escuro">{tipo.rotulo}</span>
        <span>{casa}</span>
        <span>· {formatarData(v.data)}</span>
      </p>
      <h3 id={`votacao-${n}`} className="mt-2 text-base font-semibold text-gray-900">
        {v.descricao ?? "Descrição não disponível em fonte oficial"}
      </h3>
      {tipo.explicacao ? <p className="mt-1 text-sm text-gray-800">{tipo.explicacao}</p> : null}
      {v.placar ? <PlacarOficial placar={v.placar} /> : null}
      {v.tipo === "nominal" && !votos.length ? (
        <p className="lacuna mt-3 text-sm">
          {linkCongresso
            ? "A lista de votos individuais está na página da votação, na seção Congresso."
            : "Lista de votos individuais não disponível em fonte oficial coletada."}
        </p>
      ) : null}
      {v.tipo === "simbolica" ? (
        <p className="mt-3 text-sm text-gray-800">Não há voto individual a atribuir nesta votação.</p>
      ) : null}
      {votos.length ? <VotosIndividuais votos={votos} legenda={`Votos individuais: ${v.descricao ?? casa}`} /> : null}
      {linkCongresso ? (
        <p className="mt-3 text-sm">
          <Link href={linkCongresso} className="lk font-medium">
            Ver a votação completa na seção Congresso
          </Link>{" "}
          <span className="meta">(placar, orientações de bancada e votos, com busca e filtros)</span>
        </p>
      ) : null}
      {v.url ? (
        <p className="mt-3">
          <FonteLink href={v.url} tipo="oficial" className="text-xs">
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
    return <p className="lacuna text-sm">Nenhuma votação registrada em fonte oficial para esta decisão.</p>;
  }
  return (
    <div className="space-y-4">
      {votacoes.map((v, i) => (
        <UmaVotacao key={i} v={v} n={i} />
      ))}
    </div>
  );
}

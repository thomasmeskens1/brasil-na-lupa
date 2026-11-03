import Link from "next/link";
import { FonteLink } from "@/components/FonteLink";
import { NAO_DISPONIVEL, formatarData } from "@/components/decisao";
import type { ItemPauta, SessaoAgenda } from "./dados";

/** Linha de sessão (agenda): data, hora, casa, tipo e situação oficiais, link da casa. */

const CURTO = { camara: "Câmara", senado: "Senado", congresso: "Congresso" } as const;

const DIA_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export function diaDaSemana(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : DIA_SEMANA[d.getUTCDay()];
}

export function ItemSessao({ s, compacto = false }: { s: SessaoAgenda; compacto?: boolean }) {
  return (
    <div className="cartao">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--cor-secundaria)]">
        <span className="selo selo-escuro">
          {CURTO[s.casa] ?? s.casa_nome}
          <span className="sr-only"> ({s.casa_nome})</span>
        </span>
        <span>
          <time dateTime={s.data}>{formatarData(s.data)}</time> ({diaDaSemana(s.data)}){s.hora ? `, ${s.hora}` : ""}
        </span>
      </p>
      <p className="mt-2 font-semibold">{s.descricao_oficial ?? s.tipo_oficial ?? s.tipo ?? NAO_DISPONIVEL}</p>
      <p className="text-sm">
        Situação na fonte: {s.situacao_oficial ?? NAO_DISPONIVEL}
        {!compacto && s.itens_pauta ? ` · ${s.itens_pauta} ${s.itens_pauta === 1 ? "item" : "itens"} na pauta` : ""}
      </p>
      {s.link_oficial ? (
        <p className="mt-1">
          <FonteLink href={s.link_oficial} tipo="oficial" className="inline-flex min-h-11 items-center">
            Página da sessão ({s.casa_nome})
          </FonteLink>
        </p>
      ) : null}
      {!compacto && s.fonte?.acessado_em ? <p className="meta">Coletado em {formatarData(s.fonte.acessado_em)}.</p> : null}
    </div>
  );
}

const DESFECHO: Record<string, string> = {
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  "não votado": "Não votado",
  adiado: "Adiado",
  retirado: "Retirado de pauta",
  "não informado": "Não informado pela fonte",
};

export function ItemDaPauta({ i }: { i: ItemPauta }) {
  return (
    <li className="cartao">
      <p className="font-semibold">
        {i.url ? (
          <a href={i.url} className="lk" target="_blank" rel="noopener noreferrer">
            {i.titulo ?? NAO_DISPONIVEL}
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        ) : (
          (i.titulo ?? NAO_DISPONIVEL)
        )}
      </p>
      {i.ementa ? <p className="mt-1 text-sm">{i.ementa}</p> : null}
      <p className="mt-2 text-sm">
        <span className="font-semibold">Relator:</span> {i.relatores.length ? i.relatores.join("; ") : NAO_DISPONIVEL}
      </p>
      <div className="mt-2 rounded border border-[var(--cor-borda)] bg-[var(--cor-superficie)] p-2 text-sm">
        <p>
          <span className="font-semibold">Desfecho:</span> {DESFECHO[i.desfecho] ?? i.desfecho}
        </p>
        <p className="mt-1">
          <span className="font-semibold">Texto oficial:</span>{" "}
          {i.desfecho_texto_oficial ? <q>{i.desfecho_texto_oficial}</q> : "não informado pela fonte"}
        </p>
      </div>
      {i.votacoes.length ? (
        <p className="mt-2 text-sm">
          Votações coletadas:{" "}
          {i.votacoes.map((v, k) => (
            <span key={v.id}>
              {k ? ", " : ""}
              <Link href={`/congresso/votacoes/${v.casa}/${v.id}`} className="lk inline-flex min-h-11 items-center">
                votação {k + 1}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
      {i.fonte?.url ? (
        <p className="mt-1">
          <FonteLink href={i.fonte.url} tipo="oficial" className="inline-flex min-h-11 items-center">
            {i.fonte.orgao ?? "Fonte oficial"}
          </FonteLink>
          {i.fonte.acessado_em ? <span className="meta"> · coletado em {formatarData(i.fonte.acessado_em)}</span> : null}
        </p>
      ) : null}
    </li>
  );
}

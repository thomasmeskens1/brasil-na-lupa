import { FonteLink } from "@/components/FonteLink";
import type { FonteCongresso, PlacarCongresso } from "../tipos";
import { ROTULO_PLACAR, formatarData } from "../rotulos";

/** Placar oficial em caixas (só os campos que a fonte informa). */
export function Placar({ placar, rotulo = "Placar oficial" }: { placar: PlacarCongresso; rotulo?: string }) {
  const itens = ROTULO_PLACAR.filter(([k]) => typeof placar[k] === "number");
  if (!itens.length) return <p className="lacuna text-sm">Placar não disponível em fonte oficial.</p>;
  return (
    <dl className="flex flex-wrap gap-2" aria-label={rotulo}>
      {itens.map(([k, r]) => (
        <div key={k} className="min-w-[5.5rem] rounded border border-borda bg-superficie px-3 py-2 text-center">
          <dt className="text-xs font-medium text-[#3e4c59]">{r}</dt>
          <dd className="text-xl font-bold text-gray-900">{placar[k]}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface Termo {
  termo: string;
  explicacao: string;
}

/** Lista de termos técnicos explicados (diretriz 9). */
export function TermosExplicados({ termos }: { termos: readonly Termo[] }) {
  return (
    <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
      {termos.map((t) => (
        <div key={t.termo} className="rounded border border-borda bg-superficie px-3 py-2">
          <dt className="font-semibold text-gray-900">{t.termo}</dt>
          <dd className="mt-1 leading-relaxed text-gray-800">{t.explicacao}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Nome legível de uma fonte, sem identificadores técnicos (o título da fonte pode trazer códigos). */
function nomeFonte(f: FonteCongresso): string {
  const t = (f.titulo ?? "")
    .replace(/^Votação\s+\d+(?:-\d+)?\s+—\s+/, "Registro da votação nos ")
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, "$3/$2/$1")
    .trim();
  return `${t || f.orgao || "Fonte oficial"}${detalheFonte(f.url)}`;
}

/** Os títulos de várias fontes da Câmara se repetem; o endereço diz qual conjunto de dados é. */
const CONJUNTO: Record<string, string> = {
  deputados: "deputados",
  votacoes: "votações",
  votacoesOrientacoes: "orientações de bancada",
  votacoesProposicoes: "proposições votadas",
  votacoesVotos: "votos",
};

function detalheFonte(url: string): string {
  const arq = /\/arquivos\/[^/]+\/[^/]+\/([A-Za-z]+)(?:-(\d{4}))?\.[a-z]+$/.exec(url);
  if (arq && CONJUNTO[arq[1]]) return ` — ${CONJUNTO[arq[1]]}${arq[2] ? ` de ${arq[2]}` : ""}`;
  if (/\/api\/v2\/deputados\b/.test(url)) return " — lista de deputados";
  if (/\/api\/v2\/proposicoes\/\d+\/votacoes/.test(url)) return " — votações de uma proposição acompanhada";
  return "";
}

/** Fontes oficiais, com a data de coleta. */
export function ListaFontes({ fontes }: { fontes: FonteCongresso[] }) {
  if (!fontes.length) return <p className="lacuna text-sm">Fonte não informada.</p>;
  return (
    <ul className="space-y-2">
      {fontes.map((f, i) => (
        <li key={`${f.url}-${i}`}>
          <FonteLink href={f.url} tipo="oficial">
            {nomeFonte(f)}
          </FonteLink>
          <span className="meta block">
            {f.orgao ? `${f.orgao} · ` : ""}coletado em {formatarData(f.acessado_em)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Lacunas registradas pela coleta (o que a fonte oficial não traz). */
export function ListaLacunas({ lacunas }: { lacunas: (string | Record<string, unknown>)[] }) {
  const textos = lacunas.map((l) => (typeof l === "string" ? l : typeof l.descricao === "string" ? l.descricao : null)).filter(
    (t): t is string => !!t,
  );
  if (!textos.length) return <p className="text-sm text-gray-800">Nenhuma lacuna registrada pela coleta.</p>;
  return (
    <ul className="space-y-2">
      {textos.map((t) => (
        <li key={t} className="lacuna text-sm">
          {t}
        </li>
      ))}
    </ul>
  );
}

import { FonteLink } from "@/components/FonteLink";

const CF = "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm";
const LC24 = "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp24.htm";
const LC192 = "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp192.htm";

interface Caminho {
  n: number;
  titulo: string;
  quem: string;
  como: string;
  votacao: string;
  fontes: { titulo: string; url: string }[];
}

const CAMINHOS: Caminho[] = [
  {
    n: 1,
    titulo: "CONFAZ (Conselho Nacional de Política Fazendária)",
    quem: "Representantes das secretarias de Fazenda dos 26 estados e do Distrito Federal, em reunião presidida por representante do Governo federal.",
    como: "Aprovam convênios. Um convênio pode fixar o valor do ICMS de combustíveis como gasolina, diesel e gás de cozinha, igual em todo o país, ou autorizar isenções e outros benefícios fiscais.",
    votacao: "Não há votação de deputados nem de senadores.",
    fontes: [
      { titulo: "Lei Complementar 24/1975, art. 2º", url: LC24 },
      { titulo: "Lei Complementar 192/2022, art. 3º", url: LC192 },
    ],
  },
  {
    n: 2,
    titulo: "Assembleia Legislativa do Estado de São Paulo (ALESP)",
    quem: "Os deputados estaduais e, depois, o governador, que sanciona (aprova) ou veta (recusa) a lei.",
    como: "Votam leis estaduais sobre o ICMS cobrado em São Paulo, como as alíquotas (percentuais) do imposto e a parte da arrecadação que vai para os municípios.",
    votacao: "Há votação de deputados estaduais; o voto de cada um só aparece quando a votação é nominal.",
    fontes: [{ titulo: "Constituição Federal, art. 155", url: CF }],
  },
  {
    n: 3,
    titulo: "Governador do Estado de São Paulo",
    quem: "O governador, em conjunto com secretários de Estado que assinam o ato.",
    como: "Publica decretos que regulamentam o ICMS em São Paulo e que aplicam no estado os benefícios autorizados por convênios do CONFAZ.",
    votacao: "Não há votação: é um ato individual.",
    fontes: [{ titulo: "Constituição Federal, art. 155", url: CF }],
  },
  {
    n: 4,
    titulo: "Congresso Nacional e Presidência da República",
    quem: "Os deputados federais e os senadores; depois, o presidente da República, que sanciona ou veta.",
    como: "Aprovam leis complementares e emendas à Constituição com as regras gerais do ICMS válidas para todos os estados, como as leis da reforma tributária, que tratam da transição do ICMS para o novo Imposto sobre Bens e Serviços (IBS).",
    votacao: "Há votação de deputados federais e senadores; o voto de cada um só aparece quando a votação é nominal.",
    fontes: [{ titulo: "Constituição Federal, art. 155, § 2º, XII", url: CF }],
  },
];

/**
 * Explicação dos quatro caminhos pelos quais o ICMS pode mudar, recolhida num bloco curto
 * (a lista de decisões vem primeiro na página; auditoria mobile, item 4).
 */
export function QuemPodeMudar() {
  return (
    <details id="quem-pode-mudar" className="scroll-mt-20 rounded-md border border-borda bg-white">
      <summary className="pr-3">
        Quem pode mudar o ICMS <span className="font-normal text-[var(--cor-secundaria)]">(4 caminhos)</span>
      </summary>
      <div className="border-t border-borda px-3 pb-3 pt-2">
        <p className="leading-relaxed text-gray-800">
          Nos convênios do CONFAZ e nos decretos do governador não há votação de deputados nem de senadores.
        </p>
        <ol className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {CAMINHOS.map((c) => (
            <li key={c.n} className="rounded-md border border-borda bg-superficie px-3 py-3">
              <h3 className="text-base font-semibold text-gray-900">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-acento text-sm text-white" aria-hidden="true">
                  {c.n}
                </span>
                {c.titulo}
              </h3>
              <dl className="mt-2 space-y-2 leading-relaxed text-gray-800">
                <div>
                  <dt className="font-semibold text-gray-900">Quem decide</dt>
                  <dd>{c.quem}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">O que pode fazer</dt>
                  <dd>{c.como}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">Votação</dt>
                  <dd>{c.votacao}</dd>
                </div>
              </dl>
              <ul className="mt-2 flex flex-wrap gap-x-3">
                {c.fontes.map((f) => (
                  <li key={f.titulo} className="inline-flex min-h-11 items-center">
                    <FonteLink href={f.url} tipo="oficial" className="inline-flex min-h-11 items-center text-base!">
                      {f.titulo}
                    </FonteLink>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

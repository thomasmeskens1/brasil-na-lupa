/**
 * Justificativas oficiais da Reforma Tributária do consumo (diretriz 4): a do autor e, quando
 * existe em documento oficial, a posição contrária registrada. Trechos copiados literalmente
 * dos documentos; nenhuma avaliação do site.
 */
import { LinkFonte } from "./LinkFonte";
import { Termo } from "@/components/glossario";
import { TERMOS_IMPOSTOS } from "../termos";

const TRECHOS_EM38 = [
  {
    item: "início do texto",
    texto:
      "o Projeto institui também o Imposto Seletivo – IS, de competência da União, com natureza regulatória, para desestimular o consumo de bens prejudiciais à saúde e ao meio ambiente.",
  },
  {
    item: "sobre o modelo de imposto sobre valor adicionado",
    texto:
      "creditamento do tributo pago nas aquisições realizadas no meio da cadeia, de modo que o ônus econômico recaia sobre o consumidor final",
  },
  {
    item: "item 101",
    texto:
      "A literatura vem considerando ineficaz o mecanismo tradicionalmente utilizado para mitigar a regressividade dos tributos sobre o consumo, de submeter determinados bens e serviços considerados essenciais a alíquotas zeradas ou reduzidas.",
  },
  {
    item: "sobre a devolução",
    texto:
      "As devoluções dos tributos serão destinadas às famílias com renda per capita de até meio salário-mínimo, integrando-se ao Cadastro Único das políticas sociais",
  },
];

export function Justificativas() {
  return (
    <div className="space-y-4">
      <article className="cartao space-y-3">
        <h3 className="text-lg font-bold text-gray-900">Lei Complementar nº 214/2025: justificativa do autor</h3>
        <p className="text-gray-800">
          O Projeto de Lei Complementar nº 68/2024 foi enviado pelo Poder Executivo, com a{" "}
          <Termo termo="Exposição de motivos">exposição de motivos</Termo> nº 38/2024 do Ministério da Fazenda (24/4/2024),
          assinada pelo ministro Fernando Haddad. Trechos:
        </p>
        <ul className="space-y-3">
          {TRECHOS_EM38.map((t) => (
            <li key={t.item}>
              <blockquote className="border-l-4 border-[var(--cor-borda-forte)] pl-3 italic text-gray-800">
                “{t.texto}”
              </blockquote>
              <p className="meta mt-1">Exposição de motivos nº 38/2024 ({t.item}).</p>
            </li>
          ))}
        </ul>
        <LinkFonte chave="em38" />
        <p className="text-sm text-gray-800">
          <Termo termo="Voto em separado" glossario={TERMOS_IMPOSTOS}>Votos em separado</Termo> sobre o projeto: não
          localizados nas páginas oficiais de tramitação da Câmara dos Deputados e do Senado Federal consultadas em 3/11/2026. O voto de cada
          parlamentar e a orientação de cada bancada estão nas páginas das votações, abaixo.
        </p>
      </article>

      <article className="cartao space-y-3">
        <h3 className="text-lg font-bold text-gray-900">Emenda Constitucional nº 132/2023: documentos registrados</h3>
        <p className="text-gray-800">
          A emenda teve origem na Proposta de Emenda à Constituição nº 45/2019, apresentada na Câmara dos Deputados pelo
          deputado Baleia Rossi (MDB-SP) em 3/4/2019. Na Comissão de Constituição e Justiça e de Cidadania da Câmara, em
          2019, ficaram registrados:
        </p>
        <ul className="space-y-3">
          <li>
            <p className="font-semibold text-gray-900">Parecer do relator, deputado João Roma (PRB-BA)</p>
            <p className="text-gray-800">Pela admissibilidade da proposta.</p>
            <LinkFonte chave="pec45Parecer" />
          </li>
          <li>
            <p className="font-semibold text-gray-900">
              Voto em separado da deputada Talíria Petrone (PSOL-RJ) e do deputado Marcelo Freixo
            </p>
            <p className="text-gray-800">Pela inadmissibilidade da proposta. Trecho:</p>
            <blockquote className="mt-1 border-l-4 border-[var(--cor-borda-forte)] pl-3 italic text-gray-800">
              “entendemos que a presente PEC caminha de encontro aos primados constitucionais ao a) retirar a autonomia fiscal
              dos Estados e Municípios, b) desrespeitar a capacidade contributiva dos cidadãos por meio da revogação do
              princípio da essencialidade tributária, c) centralizar a gestão orçamentária na União, d) priorizar a
              tributação regressiva causada pelos impostos indiretos, e e) violar o princípio da vedação ao retrocesso
              social.”
            </blockquote>
            <LinkFonte chave="pec45Vs" />
          </li>
        </ul>
        <p className="text-sm text-gray-800">
          A justificação do autor está no texto original da proposta: <LinkFonte chave="pec45Texto" />
        </p>
        <LinkFonte chave="pec45" />
      </article>
    </div>
  );
}

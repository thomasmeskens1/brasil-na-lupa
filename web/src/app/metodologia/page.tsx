import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Metodologia",
  description:
    "Fontes oficiais, caminhos de decisão, critérios de neutralidade, lacunas, atualização diária e correções.",
};

const FONTES: [string, string][] = [
  ["Congresso Nacional", "Câmara dos Deputados, Senado Federal e Congresso Nacional."],
  ["Governo federal", "Presidência da República, Diário Oficial da União, ministérios e Receita Federal."],
  ["Estados", "Conselho Nacional de Política Fazendária (CONFAZ)."],
  [
    "Estado de São Paulo",
    "Secretaria da Fazenda e Planejamento, Assembleia Legislativa do Estado de São Paulo (ALESP) e Diário Oficial do Estado.",
  ],
  ["Atibaia", "Câmara Municipal, Prefeitura e Diário Oficial do Município."],
  [
    "Controle e Justiça",
    "Tribunais, Tribunal de Contas da União (TCU), Tribunal de Contas do Estado de São Paulo (TCE-SP), Controladoria-Geral da União (CGU) e Ministérios Públicos.",
  ],
];

const CAMINHOS: [string, string][] = [
  [
    "Votação nominal",
    "O voto de cada parlamentar fica registrado oficialmente. É o único caso em que o site mostra como cada pessoa votou.",
  ],
  [
    "Votação simbólica",
    "O presidente da sessão anuncia o resultado sem registrar o voto de cada um. O site informa o resultado e não atribui voto a ninguém.",
  ],
  [
    "Decisão de órgão colegiado",
    "Decisão tomada em conjunto por um conselho, como o CONFAZ, em que os representantes dos estados aprovam convênios. O site mostra quem assinou e o que o documento registra sobre a votação.",
  ],
  [
    "Ato individual",
    "Decreto, medida provisória, sanção ou veto, assinados por quem tem a competência (presidente, governador ou prefeito, com os ministros ou secretários que também assinam). Não há votação.",
  ],
];

function Bloco({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-20">
      <h2 id={`${id}-t`} className="text-lg font-bold text-gray-900">
        {titulo}
      </h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-gray-800">{children}</div>
    </section>
  );
}

export default function MetodologiaPage() {
  return (
    <article className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Metodologia</h1>
        <p className="mt-2 text-gray-800">
          Como as informações deste site são reunidas, organizadas e atualizadas.
        </p>
      </header>

      <Bloco id="fontes" titulo="1. Somente fontes oficiais">
        <p>
          Tudo o que o site apresenta vem de documento publicado por órgão público. Cada informação
          traz o link para o documento de origem e a data em que o dado foi coletado. São usadas como
          fonte:
        </p>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[max-content_1fr]">
          {FONTES.map(([t, d]) => (
            <div key={t} className="contents">
              <dt className="font-semibold text-gray-900">{t}</dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
        <p>
          Matérias de imprensa servem apenas como pista para encontrar o documento oficial. Quando
          aparecem, vêm marcadas como reportagem, com link, e nunca como fato comprovado.
        </p>
      </Bloco>

      <Bloco id="caminhos" titulo="2. Por qual caminho cada decisão foi tomada">
        <p>Toda decisão informa como foi tomada:</p>
        <ul className="space-y-2">
          {CAMINHOS.map(([t, d]) => (
            <li key={t} className="rounded border border-borda px-3 py-2">
              <strong className="text-gray-900">{t}.</strong> {d}
            </li>
          ))}
        </ul>
        <p>
          No caso do Imposto sobre Circulação de Mercadorias e Serviços (ICMS), a página{" "}
          <Link href="/impostos/icms" className="lk">
            ICMS: quem decidiu e por quê
          </Link>{" "}
          explica os quatro caminhos pelos quais o imposto pode mudar e destaca quando não houve
          votação de deputados nem de senadores.
        </p>
      </Bloco>

      <Bloco id="neutralidade" titulo="3. Sem juízo de valor">
        <p>
          O site nunca classifica um voto, uma lei ou um político como bom, ruim, &quot;a favor&quot; ou
          &quot;contra&quot; o país. Ele mostra o que foi decidido, o que mudou (antes e depois, com os
          números do documento), quem decidiu, como cada um votou e as justificativas oficiais
          registradas: a do autor e, quando existirem em documento oficial, as contrárias, como votos
          em separado, declarações de voto e razões de veto. Quem julga é o leitor.
        </p>
        <p>
          Partidos, políticos e governos recebem o mesmo tratamento, o mesmo nível de detalhe e a
          mesma ordem neutra: alfabética, cronológica ou pelo placar oficial. A interface usa tons
          neutros e não associa cores a partidos.
        </p>
      </Bloco>

      <Bloco id="analises" titulo="4. Leituras dos analistas">
        <p>
          Quando houver análises interpretativas, elas serão feitas por três analistas, com leituras
          de esquerda, de centro e de direita, que apenas interpretam trechos citados de documentos
          oficiais e não acrescentam fatos. As três leituras aparecem lado a lado, sempre
          identificadas:{" "}
          <span className="vt vt-esquerda">Leitura de esquerda</span>{" "}
          <span className="vt vt-centro">Leitura de centro</span>{" "}
          <span className="vt vt-direita">Leitura de direita</span>
        </p>
      </Bloco>

      <Bloco id="lacunas" titulo="5. Lacunas">
        <p>
          Nenhuma informação é deduzida ou suposta. Quando a fonte oficial não traz um dado, o site
          exibe &quot;Informação não disponível em fonte oficial&quot; e não preenche a lacuna. Quando
          o documento não registra justificativa, aparece &quot;Justificativa não disponível em fonte
          oficial&quot;. Cada decisão lista, ao final, o que a fonte oficial não informa.
        </p>
      </Bloco>

      <Bloco id="linguagem" titulo="6. Linguagem acessível">
        <p>
          Toda sigla aparece com o nome completo, e os termos técnicos, como alíquota, convênio e
          substituição tributária, têm uma explicação breve e neutra na página em que aparecem.
        </p>
      </Bloco>

      <Bloco id="atualizacao" titulo="7. Atualização diária">
        <p>
          Os dados são coletados automaticamente das fontes oficiais, em rotina diária, e guardados
          com a data de coleta. Cada página informa quando seus dados foram atualizados.
        </p>
      </Bloco>

      <Bloco id="correcoes" titulo="8. Correções">
        <p>
          Erros encontrados são corrigidos, e a correção é registrada e informada na própria página
          afetada, com a data. Para apontar um erro, escreva para{" "}
          <a href="mailto:thomas.meskense@gmail.com" className="lk">
            thomas.meskense@gmail.com
          </a>
          .
        </p>
      </Bloco>

      <Bloco id="dados-pessoais" titulo="9. Dados pessoais">
        <p>
          Dados de agentes públicos são exibidos somente no que se refere ao exercício da função
          pública. Sobre os visitantes, o site faz apenas medição de audiência sem identificação; veja
          a{" "}
          <Link href="/privacidade" className="lk">
            Política de Privacidade
          </Link>
          .
        </p>
      </Bloco>
    </article>
  );
}

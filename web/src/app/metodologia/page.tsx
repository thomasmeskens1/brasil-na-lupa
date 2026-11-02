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
    "Secretaria da Fazenda e Planejamento; Assembleia Legislativa do Estado de São Paulo (ALESP): Portal Legislativo (deputados, proposições e votações em comissões) e Relatórios de Verificação de Votação do Plenário (PDF); Diário Oficial do Estado (leis, decretos e vetos do governador).",
  ],
  [
    "Atibaia",
    "Imprensa Oficial Eletrônica da Prefeitura (leis, decretos e atas da Câmara Municipal), Câmara Municipal e Portal da Transparência Municipal do TCE-SP (receitas e despesas).",
  ],
  [
    "Tribunais superiores",
    "Superior Tribunal de Justiça (STJ): dados abertos e página pública de cada tema; Supremo Tribunal Federal (STF): repercussão geral, Plenário Virtual e súmulas vinculantes.",
  ],
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

      <Bloco id="executivo" titulo="8. Executivo federal">
        <p>
          Medidas provisórias, vetos, leis e decretos vêm da Presidência da República (Portal da Legislação do Planalto) e
          dos dados abertos do Congresso Nacional, do Senado Federal e da Câmara dos Deputados. A justificativa de cada
          medida provisória é a exposição de motivos publicada pelo Planalto: o site mostra trechos copiados literalmente,
          com o número do parágrafo, e o link para o documento completo, sem resumo.
        </p>
        <p>
          Nos vetos, cada trecho vetado aparece com a razão oficial do veto e a situação registrada pelo Congresso
          (mantido, derrubado, não apreciado ou prejudicado). Os votos dos parlamentares na sessão conjunta aparecem como
          registrados pelo Congresso Nacional; o site não interpreta o que significa votar &quot;Sim&quot; ou &quot;Não&quot;
          em cada dispositivo quando a fonte oficial não o informa.
        </p>
      </Bloco>

      <Bloco id="tribunais" titulo="9. Tribunais: STJ e STF">
        <p>
          De cada tema, o site mostra a questão julgada e a tese em texto oficial, o relator, o órgão julgador, as datas e
          o resultado de cada julgamento como escrito na decisão (unanimidade ou maioria, só quando a expressão está no
          texto).
        </p>
        <p>
          O voto de um ministro só é exibido quando foi conferido nome a nome contra o texto oficial da decisão ou quando o
          próprio tribunal publica os votos de forma estruturada, como no Plenário Virtual do STF. Registros extraídos
          automaticamente e ainda não conferidos nunca são exibidos como voto. Quando o texto oficial deixa dúvida, o site
          mostra só o resultado literal e explica a dúvida. Quem presidia a sessão aparece em separado e não é contado como
          voto. Divergências entre arquivos oficiais do mesmo tribunal são mostradas como foram encontradas.
        </p>
      </Bloco>

      <Bloco id="sao-paulo-atibaia" titulo="10. Estado de São Paulo e Atibaia">
        <p>
          No Plenário da ALESP, o voto de cada deputado só existe quando há verificação de votação, e o registro oficial é um
          documento em PDF, o Relatório de Verificação de Votação. O site lê esse documento e só publica os votos individuais
          quando a contagem confere com os totais impressos no rodapé (votos Sim, votos Não, abstenção, em branco, presidente
          e total) e cada nome tem a mesma cor de impressão do seu voto. Se a conferência falha, a página mostra só o placar
          oficial, explica a lacuna e traz o link para o documento.
        </p>
        <p>
          Nomes são reproduzidos como impressos. Um voto só é ligado ao perfil de um deputado quando o nome impresso é idêntico
          ao da lista oficial; nomes abreviados ficam sem link. Símbolos impressos sem legenda no documento (como “---” no
          lugar do voto e letras antes de alguns nomes) são reproduzidos e identificados como “sem legenda no documento”, sem
          interpretação. Nas comissões, o voto é o texto oficial registrado pela ALESP (por exemplo, “Favorável ao voto do
          relator”), sem conversão para sim ou não.
        </p>
        <p>
          Em Atibaia, leis e decretos são lidos das edições da Imprensa Oficial Eletrônica: só entram atos com número, data e
          ementa identificados sem dúvida ou conferidos pela curadoria. Os votos dos vereadores ainda não são publicados em
          formato aberto; por isso, a seção mostra a composição da Câmara lida da ata oficial e não atribui votos. As finanças
          vêm do Tribunal de Contas do Estado de São Paulo (TCE-SP), que publica os dados enviados pelo município com atraso de
          alguns meses.
        </p>
      </Bloco>

      <Bloco id="tribunais-de-contas" titulo="11. Tribunais de contas">
        <p>
          O parecer prévio de um tribunal de contas é uma opinião técnica; o julgamento das contas do Presidente, do
          Governador e do Prefeito é feito pelo Poder Legislativo. Por isso, o site mostra as duas etapas separadas: a
          conclusão do parecer, as ressalvas, os alertas, as determinações e as recomendações copiadas literalmente do
          documento oficial, e a situação do julgamento político registrada pelo Congresso Nacional, pela ALESP ou pela
          Câmara Municipal. Os títulos em linguagem simples (por exemplo, “parecer favorável com ressalvas”) são formados só a
          partir das palavras do texto oficial.
        </p>
        <p>
          Quando documentos oficiais registram o relator de formas diferentes, todos os registros aparecem lado a lado, sem
          correção. O resultado (unanimidade ou maioria) e o voto de cada ministro ou conselheiro só aparecem quando estão
          escritos no documento; a fonte de dados abertos do TCU não traz esses dados.
        </p>
        <p>
          Do TCU, a coleta usa somente a API de dados abertos e o inteiro teor indicado por ela; o endereço sites.tcu.gov.br não
          é acessado, porque suas regras de acesso automático proíbem robôs de inteligência artificial. Do TCE-SP, a pesquisa
          de pareceres municipais (www10.tce.sp.gov.br) não é acessada, pelo mesmo motivo; as contas das prefeituras sem
          publicação em formato aberto foram pedidas pela Lei de Acesso à Informação. As listas de responsáveis por contas
          julgadas irregulares não são publicadas no site, porque trazem CPF e nomes de cidadãos comuns.
        </p>
        <p>
          Os demais tribunais de contas do país aparecem com ficha e situação “em breve” até que a coleta de cada um seja
          implantada no mesmo formato.
        </p>
      </Bloco>

      <Bloco id="coleta" titulo="12. Coleta automática e regras de acesso">
        <p>
          A coleta respeita as regras que cada órgão publica para acesso automático (o arquivo robots.txt do site): páginas
          que essas regras não permitem acessar não são coletadas, e o site guarda apenas o link público. Quando uma página
          oficial recusa o acesso automático, a informação fica registrada como lacuna, sem outra tentativa de contornar a
          recusa.
        </p>
      </Bloco>

      <Bloco id="correcoes" titulo="13. Correções">
        <p>
          Erros encontrados são corrigidos, e a correção é registrada e informada na própria página
          afetada, com a data. Para apontar um erro, escreva para{" "}
          <a href="mailto:thomas.meskense@gmail.com" className="lk">
            thomas.meskense@gmail.com
          </a>
          .
        </p>
      </Bloco>

      <Bloco id="dados-pessoais" titulo="14. Dados pessoais">
        <p>
          Dados de agentes públicos são exibidos somente no que se refere ao exercício da função
          pública. Nomes de cidadãos comuns citados em atos oficiais, como permissionários e
          beneficiários, aparecem como &quot;[nome de particular omitido]&quot;, com link para o documento
          oficial completo; CPF, RG e outros documentos pessoais nunca são exibidos. Sobre os visitantes, o site faz apenas medição de audiência sem identificação; veja
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

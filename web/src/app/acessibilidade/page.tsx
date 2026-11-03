import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Acessibilidade",
  description:
    "Recursos de acessibilidade do Brasil na Lupa: atalhos de teclado, leitura em voz alta, leitores de tela e como relatar uma barreira.",
};

const ATALHOS_PAGINA: [string, string][] = [
  ["Alt + 1", "Ir para o conteúdo principal"],
  ["Alt + 2", "Ir para o menu de navegação"],
  ["Alt + 4", "Ir para o rodapé"],
];

const ATALHOS_OUVIR: [string, string][] = [
  ["Alt + Shift + O", "Ouvir a página; durante a leitura, pausar ou continuar"],
  ["Alt + Shift + X", "Parar a leitura (ou Esc, com o foco nos controles)"],
  ["Alt + Shift + seta para a direita", "Próximo trecho"],
  ["Alt + Shift + seta para a esquerda", "Trecho anterior (ou início do trecho atual)"],
  ["Alt + Shift + seta para cima", "Ler mais rápido"],
  ["Alt + Shift + seta para baixo", "Ler mais devagar"],
];

function TabelaAtalhos({ legenda, linhas }: { legenda: string; linhas: [string, string][] }) {
  return (
    <table className="tabela mt-3">
      <caption className="pb-2 text-left font-semibold text-foreground">{legenda}</caption>
      <thead>
        <tr>
          <th scope="col">Atalho</th>
          <th scope="col">O que faz</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map(([k, v]) => (
          <tr key={k}>
            <th scope="row" className="font-medium">
              <kbd>{k}</kbd>
            </th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Acessibilidade() {
  return (
    <article className="space-y-8">
      <header>
        <h1 className="text-3xl md:text-4xl">Acessibilidade</h1>
        <p className="mt-3 text-lg text-[var(--cor-secundaria)]">
          O site busca seguir as Diretrizes de Acessibilidade para Conteúdo Web (WCAG 2.2, nível AA), o Modelo de
          Acessibilidade em Governo Eletrônico (eMAG 3.1) e a Lei Brasileira de Inclusão da Pessoa com Deficiência (Lei
          13.146/2015, artigo 63).
        </p>
      </header>

      <section aria-labelledby="atalhos" className="max-w-3xl space-y-2">
        <h2 id="atalhos" className="text-2xl">
          Atalhos de teclado
        </h2>
        <p>
          No Chrome e no Edge, use <kbd>Alt</kbd> com o número; no Firefox, <kbd>Alt</kbd> + <kbd>Shift</kbd> com o número; no
          Safari (Mac), <kbd>Control</kbd> + <kbd>Option</kbd> com o número. Os mesmos destinos aparecem como links no início de
          cada página, ao apertar <kbd>Tab</kbd>.
        </p>
        <TabelaAtalhos legenda="Atalhos de navegação (em todas as páginas)" linhas={ATALHOS_PAGINA} />
      </section>

      <section aria-labelledby="ouvir" className="max-w-3xl space-y-2">
        <h2 id="ouvir" className="text-2xl">
          Ouvir esta página
        </h2>
        <p>
          O botão “Ouvir esta página”, no topo, lê em voz alta só o conteúdo principal, na ordem da página, com a voz em
          português do Brasil do seu próprio aparelho (nada é enviado a outro serviço). Os títulos são anunciados; siglas,
          valores em reais, datas e números de leis são falados por extenso; o trecho em leitura fica destacado na tela. A
          velocidade vai de 0,75× a 1,5×, e a leitura para ao trocar de página.
        </p>
        <TabelaAtalhos legenda="Atalhos da leitura em voz alta" linhas={ATALHOS_OUVIR} />
        <p className="meta">
          Se você já usa um leitor de tela (NVDA, JAWS, VoiceOver, TalkBack), prefira ele: o site tem títulos em ordem, regiões
          nomeadas, tabelas com cabeçalhos e textos alternativos.
        </p>
      </section>

      <section aria-labelledby="recursos" className="max-w-3xl space-y-2">
        <h2 id="recursos" className="text-2xl">
          O que o site faz para ser acessível
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Funciona só com o teclado, com foco sempre visível e alvos de toque de pelo menos 44 pixels nos controles.</li>
          <li>Um título principal por página e títulos de seção em ordem, para navegar pelos títulos com o leitor de tela.</li>
          <li>Placares e gráficos de barras sempre acompanhados dos números em texto.</li>
          <li>Tabelas com cabeçalhos; no celular, cada linha vira um cartão sem perder a relação com as colunas.</li>
          <li>Buscas e filtros anunciam quantos resultados foram encontrados; “Mostrar mais” leva o foco ao primeiro item novo.</li>
          <li>Siglas com o nome por extenso na primeira vez e termos técnicos com explicação (toque ou Enter no termo; Esc fecha).</li>
          <li>Contraste de cores no nível AA e animações desligadas para quem pede movimento reduzido no sistema.</li>
        </ul>
      </section>

      <section aria-labelledby="barreira" className="max-w-3xl space-y-2">
        <h2 id="barreira" className="text-2xl">
          Encontrou uma barreira?
        </h2>
        <p>
          Escreva para{" "}
          <a href="mailto:thomas.meskense@gmail.com" className="lk">
            thomas.meskense@gmail.com
          </a>{" "}
          com o endereço da página e o que aconteceu (navegador, leitor de tela e aparelho ajudam). As correções são
          registradas como as demais, conforme a{" "}
          <Link href="/metodologia#correcoes" className="lk">
            metodologia
          </Link>
          .
        </p>
      </section>
    </article>
  );
}

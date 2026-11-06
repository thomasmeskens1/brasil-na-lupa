import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { FonteLink } from "@/components/FonteLink";

export const metadata: Metadata = {
  title: "Como participar pelos canais oficiais",
  description:
    "Ideia Legislativa, consultas públicas e eventos interativos do Senado (e-Cidadania) e enquetes e debates da Câmara dos Deputados, segundo as páginas oficiais.",
};

/** Data em que as páginas oficiais citadas abaixo foram consultadas (docs/pesquisa/participacao-oficial.md). */
const CONSULTADO_EM = "03/11/2026";

function Bloco({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-20">
      <h2 id={`${id}-t`} className="text-lg font-bold">
        {titulo}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Citacao({ children }: { children: ReactNode }) {
  return <blockquote className="border-l-2 border-borda pl-3 text-[var(--cor-secundaria)]">{children}</blockquote>;
}

function Fonte({ href, children }: { href: string; children: ReactNode }) {
  return (
    <p className="meta">
      <FonteLink href={href} tipo="oficial">
        {children}
      </FonteLink>{" "}
      · consultado em {CONSULTADO_EM}
    </p>
  );
}

function Botao({ href, children }: { href: string; children: ReactNode }) {
  return (
    <p>
      <a href={href} target="_blank" rel="noopener noreferrer" className="botao botao-escuro">
        {children}
        <span className="sr-only"> (abre em nova aba)</span>
      </a>
    </p>
  );
}

export default function ParticiparPage() {
  return (
    <article className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Como participar pelos canais oficiais</h1>
        <p className="mt-2">
          Para apoiar, criticar ou propor mudanças em leis, o caminho é o canal oficial do Senado Federal ou da Câmara
          dos Deputados. Esta página resume como cada um funciona, com as palavras e os links das páginas oficiais. O
          Brasil na Lupa não recebe nem conta essas participações: ele só leva até o canal e mostra os números
          publicados pelo próprio Congresso.
        </p>
      </header>

      <Bloco id="no-site" titulo="No Brasil na Lupa: reações, estados e contatos">
        <p>
          Nas páginas de votações, medidas provisórias e vetos, além dos canais oficiais abaixo, você encontra o bloco
          “Fale com seus parlamentares”, com o e-mail institucional de cada deputado e senador do seu estado, e, se tiver
          conta, os totais das reações de curtir e não curtir por estado. Esses totais são opinião de usuários do site,
          não pesquisa nem dado oficial.
        </p>
        <p>
          <Link href="/participar/mais-manifestacoes" className="botao">
            Ver as propostas com mais manifestações
          </Link>
        </p>
      </Bloco>

      <Bloco id="ideia" titulo="Tem uma ideia de lei? Ideia Legislativa (Senado)">
        <p>
          No Portal e-Cidadania do Senado, quem tem cadastro gov.br (a partir de 12 anos, segundo os Termos de Uso do
          portal) pode sugerir uma lei nova ou uma mudança numa lei que já existe, e apoiar as ideias de outras
          pessoas. Segundo o Senado:
        </p>
        <Citacao>
          “As ideias que receberem 20 mil apoios no prazo de quatro meses serão encaminhadas para a Comissão de Direitos
          Humanos e Legislação Participativa (CDH), onde receberão parecer. Além disso, qualquer ideia legislativa pode
          ser adotada por senadores ou deputados e transformada em projetos de lei.”
        </Citacao>
        <p>
          Parecer é a opinião formal da comissão sobre a proposta. O Senado publica a lista das Sugestões Legislativas
          que vieram de ideias do e-Cidadania. Na página de cada ideia aparecem os apoios confirmados, a meta de 20 mil
          apoios e o prazo para apoiar.
        </p>
        <Botao href="https://www12.senado.leg.br/ecidadania/principalideia">Proponha no e-Cidadania</Botao>
        <Fonte href="https://www12.senado.leg.br/ecidadania/sobre">Sobre o Portal e-Cidadania (Senado Federal)</Fonte>
        <Fonte href="https://www12.senado.leg.br/ecidadania/termo">Termos de Uso do Portal e-Cidadania (Senado Federal)</Fonte>
        <Fonte href="https://www12.senado.leg.br/ecidadania/documentos/home/resultados/sugestoes-legislativas-sug">
          Sugestões legislativas originadas de ideias (Senado Federal)
        </Fonte>
      </Bloco>

      <Bloco id="consulta" titulo="Consulta Pública (Senado)">
        <p>
          Cada proposição do Senado tem uma página de Consulta Pública no e-Cidadania, onde se responde “Você apoia
          essa proposição?” com Sim ou Não. Segundo o Senado, a ferramenta
        </p>
        <Citacao>
          “permite opinar sobre projetos de lei, propostas de emenda à Constituição, medidas provisórias e outras
          proposições em tramitação no Senado Federal até a sanção, promulgação, envio à Câmara dos Deputados ou
          arquivamento.”
        </Citacao>
        <p>
          O resultado mostra só a opinião de quem quis participar: não é votação dos senadores nem pesquisa de
          opinião com amostra da população. Nas páginas de votação do Senado, o Brasil na Lupa mostra o link da
          consulta e os números publicados pelo e-Cidadania, com a data da coleta. Algumas matérias, como mensagens,
          aparecem no portal como “não passível de votação” e não têm consulta.
        </p>
        <Botao href="https://www12.senado.leg.br/ecidadania/principalmateria">Ver as consultas públicas</Botao>
        <Fonte href="https://www12.senado.leg.br/ecidadania/documentos/home/resultados">
          Relatórios e dados abertos do e-Cidadania (Senado Federal)
        </Fonte>
      </Bloco>

      <Bloco id="eventos" titulo="Eventos interativos (Senado)">
        <p>Segundo o Senado, o Evento Interativo</p>
        <Citacao>
          “permite participar de audiências públicas, sabatinas e outros eventos abertos. Para cada
          audiência/sabatina/evento, é criada uma página específica onde haverá transmissão ao vivo, espaço para
          publicação de comentários por usuários cadastrados, apresentações, notícias e documentos referentes ao
          evento.”
        </Citacao>
        <p>
          Audiência pública é a reunião de uma comissão para ouvir convidados sobre um tema; sabatina é a arguição de
          uma pessoa indicada para um cargo antes da votação dos senadores.
        </p>
        <Botao href="https://www12.senado.leg.br/ecidadania/principalaudiencia">Ver os eventos interativos</Botao>
      </Bloco>

      <Bloco id="enquetes" titulo="Enquetes (Câmara dos Deputados)">
        <p>
          No portal da Câmara, a enquete de uma proposição traz a pergunta “Qual sua opinião sobre…?” e cinco respostas:
          concordo totalmente, concordo na maior parte, estou indeciso, discordo na maior parte e discordo totalmente.
          Segundo a Câmara:
        </p>
        <Citacao>
          “As enquetes não têm rigor científico, pois não representam uma amostra da sociedade. Por isso, cabe ao
          relator decidir se vai considerar as opiniões dos participantes ao sugerir mudanças no texto da proposta. Há
          enquetes específicas para o texto original da proposta e para cada mudança no texto, como substitutivo e
          emenda.”
        </Citacao>
        <p>
          Relator é o deputado encarregado de dar o parecer sobre a proposta; substitutivo é um texto que substitui o
          original por inteiro; emenda é uma mudança em parte do texto. Nas páginas de votação da Câmara, o Brasil na
          Lupa mostra o link da enquete e os números publicados pela Câmara, com a data da coleta.
        </p>
        <Botao href="https://www.camara.leg.br/enquetes/">Ver as enquetes da Câmara</Botao>
        <Fonte href="https://www.camara.leg.br/participe">Participe (Câmara dos Deputados)</Fonte>
      </Bloco>

      <Bloco id="debates" titulo="Debates interativos e sugestões de entidades (Câmara dos Deputados)">
        <p>Segundo a Câmara, as comissões temáticas promovem debates interativos:</p>
        <Citacao>
          “Na página de cada reunião, você pode mandar perguntas para os convidados e também votar nas perguntas feitas
          por outros usuários.”
        </Citacao>
        <p>
          Na Câmara, a sugestão de lei não é feita por cidadão individual, e sim por entidades. Segundo a Câmara,
          “entidades da sociedade civil organizada podem apresentar sugestões de lei para a Comissão de Legislação
          Participativa (CLP)”; se os deputados aprovarem, a sugestão passa a tramitar como proposta de autoria da
          comissão. Podem enviar organizações não governamentais (ONGs), associações de classe, sindicatos e outras
          entidades, com cadastro e documentos da associação.
        </p>
        <Botao href="https://www.camara.leg.br/participe">Participar na Câmara</Botao>
        <Fonte href="https://www2.camara.leg.br/atividade-legislativa/participe/sugira-um-projeto">
          Sugestão legislativa (Câmara dos Deputados)
        </Fonte>
      </Bloco>

      <Bloco id="numeros" titulo="Como o site mostra os números">
        <p>
          Os números de consultas e enquetes são copiados das páginas oficiais, com link e data de coleta, e sempre
          aparecem com o aviso de que não são votação nem pesquisa. Todas as respostas têm o mesmo destaque visual.
          Quando a página oficial não traz o número, o site mostra “Informação não disponível em fonte oficial”. O
          site não lê nem guarda nomes ou comentários de quem participou.
        </p>
      </Bloco>
    </article>
  );
}

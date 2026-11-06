import Link from "next/link";
import { VERSAO_POLITICA } from "@/features/conta/regras";
import { Bloco } from "./Bloco";
import { SecaoCadastro } from "./SecaoCadastro";
import { SecaoCookies } from "./SecaoCookies";

/**
 * Política de Privacidade.
 * - Versão 1 (02/11/2026): site sem cadastro. Arquivada em /privacidade/versao-1.
 * - Versão 2 (02/11/2026): acrescentava o cadastro opcional; nunca entrou em vigor (o cadastro não
 *   foi ligado enquanto ela existiu) e foi substituída pela versão 4.
 * - Versão 3 (03/11/2026): vale enquanto o cadastro estiver desligado. Item 4 "Cookies" com a lista
 *   dos cookies e o aviso do rodapé; encarregado indicado; histórico de versões.
 * - Versão 4 (03/11/2026): vale com o cadastro ligado. Versão 3 + item 9 (cadastro, favoritos,
 *   reações, tabela de finalidades e bases legais, operadoras e países, incidentes, 18 anos).
 */
export const VERSAO_1 = { numero: "1", data: "02/11/2026" } as const;
export const VERSAO_2 = { numero: "2", data: "02/11/2026" } as const;
export const VERSAO_3 = { numero: "3", data: "03/11/2026" } as const;
export const VERSAO_4 = { numero: "4", data: "03/11/2026" } as const;
export const VERSAO_5 = { numero: "5", data: "06/11/2026" } as const;

const EMAIL = "thomas.meskense@gmail.com";

export function Politica({ comCadastro, arquivada = false }: { comCadastro: boolean; arquivada?: boolean }) {
  // Arquivada = versão 1. Em vigor: 4 com o cadastro ligado, 3 sem ele.
  const versao = arquivada ? VERSAO_1 : comCadastro ? VERSAO_5 : VERSAO_3;
  const atual = !arquivada;
  return (
    <article className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Política de Privacidade</h1>
        {arquivada ? (
          <p className="aviso mt-2 text-sm text-gray-900">
            Versão arquivada, que valia antes do cadastro opcional. A versão em vigor está em{" "}
            <Link href="/privacidade" className="lk">
              Política de Privacidade
            </Link>
            .
          </p>
        ) : null}
        <p className="mt-2 text-sm text-gray-800">
          Esta política explica, de acordo com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei
          nº 13.709/2018), quais dados são tratados quando você visita este site, para quê e quais
          são os seus direitos.
        </p>
        {atual ? (
          <p className="meta mt-2">
            Versão {versao.numero}, de {versao.data}.{" "}
            {comCadastro
              ? "Novidades: totais das reações por estado, lista de propostas com mais manifestações e o estado onde você vota, opcional e com consentimento próprio (itens 9.1 a 9.3)."
              : "Novidades: a lista de cookies e o aviso do rodapé (item 4) e o encarregado de dados (item 1)."}{" "}
            Veja o <a href="#historico" className="lk">histórico de versões</a>.
          </p>
        ) : (
          <p className="meta mt-2">Versão {versao.numero}, de {versao.data}.</p>
        )}
      </header>

      <Bloco id="responsavel" titulo="1. Responsável e contato">
        <p>
          O responsável pelo site Brasil na Lupa é Thomas Alcantara Meskens, que atua como controlador
          dos dados descritos nesta política. Para dúvidas, solicitações ou exercício de direitos, use
          o canal abaixo:
        </p>
        <p className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900">
          E-mail:{" "}
          <a href={`mailto:${EMAIL}`} className="lk font-semibold">
            {EMAIL}
          </a>
        </p>
        {atual ? (
          <p>
            <strong>Encarregado pelo tratamento de dados pessoais</strong> (LGPD, art. 41), de forma provisória:
            Thomas Alcantara Meskens, no mesmo e-mail acima.
          </p>
        ) : null}
      </Bloco>

      <Bloco id="dados" titulo="2. Quais dados são tratados">
        {comCadastro ? (
          <p>
            <strong>Para navegar, o site não pede cadastro, login nem qualquer dado pessoal.</strong> Todo o
            conteúdo é aberto. O cadastro é opcional e serve só para guardar favoritos e reações; ele é descrito no item 9. Fora do cadastro, não há formulários de contato, comentários ou envio de
            informações pelo visitante.
          </p>
        ) : (
          <p>
            <strong>O site não pede cadastro, login nem qualquer dado pessoal.</strong> Não há
            formulários de contato, comentários ou envio de informações pelo visitante.
          </p>
        )}
        <p>
          <strong>Medição de audiência.</strong> Usamos o Vercel Web Analytics para saber, de forma
          agregada, quais páginas são visitadas, de onde vêm os acessos (site de origem), o país e o
          tipo de dispositivo e navegador. Essa ferramenta não usa cookies e não identifica visitantes
          individualmente: os dados são contados em conjunto e não permitem saber quem você é.
          {comCadastro ? " A medição nunca é ligada à sua conta." : null}
        </p>
        <p>
          <strong>Medição de desempenho.</strong> Usamos o Vercel Speed Insights para saber quanto tempo as páginas
          levam para carregar e responder (por exemplo, o tempo até o conteúdo principal aparecer), junto com a
          página visitada, o tipo de dispositivo e o país. Também não usa cookies e não identifica visitantes: os
          dados servem só para deixar o site mais rápido.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Finalidade:</strong> entender como o site é usado, para manter e melhorar o
            conteúdo e o funcionamento.
          </li>
          <li>
            <strong>Base legal:</strong> legítimo interesse do controlador (art. 7º, IX, da LGPD),
            limitado ao mínimo necessário e sem identificação do visitante.
          </li>
        </ul>
        <p>
          <strong>Registros técnicos.</strong> Como qualquer serviço na internet, a infraestrutura de
          hospedagem pode registrar dados técnicos de acesso (como endereço IP e horário) para
          segurança e funcionamento. Esses registros não são usados pelo site para identificar
          visitantes nem para outra finalidade.
        </p>
      </Bloco>

      <Bloco id="hospedagem" titulo="3. Hospedagem e transferência internacional">
        <p>
          O site é hospedado pela Vercel Inc., que atua como operadora, tratando dados técnicos em nome
          do controlador e conforme as instruções dele. A Vercel mantém servidores e infraestrutura
          fora do Brasil, o que pode envolver transferência internacional de dados técnicos de acesso.
          Essa transferência ocorre nas hipóteses do art. 33 da LGPD, com as garantias contratuais
          oferecidas pelo provedor.
        </p>
      </Bloco>

      {atual ? (
        <SecaoCookies comCadastro={comCadastro} />
      ) : (
        <Bloco id="armazenamento-local" titulo="4. Cookies e armazenamento no seu navegador">
          {comCadastro ? (
            <>
              <p>
                <strong>Sem conta:</strong> o site não usa cookies e não grava informações no armazenamento do seu
                navegador.
              </p>
              <p>
                <strong>Com conta:</strong> ao entrar, o site grava um cookie de sessão, que mantém você conectado
                por até 30 dias ou até você sair. Durante o login também são gravados cookies técnicos temporários
                (proteção contra falsificação de pedidos e endereço de retorno; no login com o Google, verificação
                da resposta do Google). Todos são estritamente necessários, protegidos contra leitura por scripts
                (httpOnly), enviados só por conexão segura (HTTPS) e restritos ao próprio site (SameSite=Lax). Não
                há cookies de publicidade, de rastreamento ou de terceiros.
              </p>
            </>
          ) : (
            <p>
              O site não usa cookies e não grava informações no armazenamento do seu navegador.
            </p>
          )}
        </Bloco>
      )}

      <Bloco id="opiniao-politica" titulo="5. Opinião política">
        {comCadastro ? (
          <p>
            Opinião política é dado pessoal sensível (art. 5º, II, da LGPD). Para quem navega sem conta, o site
            não coleta esse tipo de informação: ele apenas apresenta decisões e votações registradas em documentos
            oficiais. No cadastro opcional, os favoritos (políticos, temas, propostas) e as reações (curtir e não curtir) podem revelar opinião política; por isso só são guardados com o seu consentimento específico e destacado (art. 11, I), os totais de reações são só agregados e nunca mostram quem reagiu, com as proteções do item 9.
          </p>
        ) : (
          <p>
            Opinião política é dado pessoal sensível (art. 5º, II, da LGPD). O site não coleta esse
            tipo de informação: ele apenas apresenta decisões e votações registradas em documentos
            oficiais e não pede ao visitante nenhuma resposta ou preferência.
          </p>
        )}
      </Bloco>

      <Bloco id="compartilhamento" titulo="6. Compartilhamento">
        {comCadastro ? (
          <p>
            O site não vende, aluga nem compartilha dados pessoais. Os únicos terceiros envolvidos são as empresas
            que prestam o serviço em nome do controlador (operadoras): a provedora de hospedagem e a ferramenta
            de medição de audiência descritas acima e, para quem tem conta, as operadoras listadas no item 9.
          </p>
        ) : (
          <p>
            O site não vende, aluga nem compartilha dados pessoais. Os únicos terceiros envolvidos são a
            provedora de hospedagem e a ferramenta de medição de audiência descritas acima.
          </p>
        )}
      </Bloco>

      <Bloco id="direitos" titulo="7. Seus direitos">
        <p>Pelo art. 18 da LGPD, você pode solicitar, a qualquer momento:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>confirmação da existência de tratamento de dados;</li>
          <li>acesso aos dados;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade com a lei;</li>
          <li>portabilidade dos dados a outro fornecedor de serviço;</li>
          <li>eliminação dos dados tratados com base no consentimento;</li>
          <li>informação sobre as entidades com as quais os dados foram compartilhados;</li>
          <li>informação sobre a possibilidade de não fornecer consentimento e suas consequências;</li>
          <li>revogação do consentimento;</li>
          <li>oposição a tratamento realizado com base em outra hipótese legal, em caso de descumprimento da lei.</li>
        </ul>
        <p>
          {comCadastro
            ? "Sem conta, em muitos casos não haverá dado pessoal associado a você. Quem tem conta pode exercer boa parte desses direitos sozinho, na página Minha conta (item 9). "
            : "Como o site não identifica visitantes, em muitos casos não haverá dado pessoal associado a você. "}
          Para exercer seus direitos, escreva para o e-mail indicado no item 1; a resposta será
          enviada no prazo previsto em lei. Você também pode apresentar reclamação à Autoridade
          Nacional de Proteção de Dados (ANPD), em{" "}
          <a href="https://www.gov.br/anpd" className="lk" target="_blank" rel="noopener noreferrer">
            gov.br/anpd
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
          .
        </p>
      </Bloco>

      <Bloco id="alteracoes" titulo="8. Alterações desta política">
        <p>
          Esta política pode ser atualizada para refletir mudanças no site ou na legislação. A data da
          última atualização aparece no início da página.
          {comCadastro
            ? " Quando uma mudança afetar o cadastro, quem tem conta verá a nova versão e precisará dar um novo consentimento antes de continuar usando as preferências."
            : null}{" "}
          Veja também a{" "}
          <Link href="/metodologia" className="lk">
            Metodologia
          </Link>
          .
        </p>
      </Bloco>

      {comCadastro && atual ? <SecaoCadastro versao={VERSAO_POLITICA} /> : null}

      {atual ? (
        <Bloco id="historico" titulo={comCadastro ? "10. Histórico de versões" : "9. Histórico de versões"}>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Versão {VERSAO_1.numero}, de {VERSAO_1.data}: site sem cadastro.{" "}
              <Link href="/privacidade/versao-1" className="lk">
                Ler a versão {VERSAO_1.numero}
              </Link>
              .
            </li>
            <li>
              Versão {VERSAO_2.numero}, de {VERSAO_2.data}: previa o cadastro opcional; não chegou a valer, porque o
              cadastro não foi ligado, e foi substituída pela versão {VERSAO_4.numero}.
            </li>
            <li>
              Versão {VERSAO_3.numero}, de {VERSAO_3.data}: lista de cookies e aviso do rodapé, encarregado de dados e
              este histórico. Vale enquanto o cadastro não estiver disponível.
            </li>
            <li>
              Versão {VERSAO_4.numero}, de {VERSAO_4.data}: versão {VERSAO_3.numero} mais o cadastro opcional com
              favoritos e reações (item 9). Valeu até 06/11/2026.
            </li>
            <li>
              Versão {VERSAO_5.numero}, de {VERSAO_5.data}: as reações passam a entrar, só para quem tem conta e só a
              partir de 10 pessoas, nos totais por estado e na lista de propostas com mais manifestações; o estado onde
              você vota passa a ser um dado opcional, com consentimento próprio. Reações dadas sob a versão{" "}
              {VERSAO_4.numero} só entram nesses totais se você der de novo o consentimento das reações. Vale quando o
              cadastro está disponível.
            </li>
            <li>
              Atualização de 04/11/2026 (versões {VERSAO_3.numero} e {VERSAO_4.numero}): inclusão da medição de
              desempenho (Vercel Speed Insights), sem cookies e sem identificação de visitantes.
            </li>
          </ul>
        </Bloco>
      ) : null}
    </article>
  );
}

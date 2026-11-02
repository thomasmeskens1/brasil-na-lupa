import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como o site trata dados, de acordo com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).",
};

const ATUALIZADO_EM = "02/11/2026";

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

export default function PrivacidadePage() {
  return (
    <article className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-gray-800">
          Esta política explica, de acordo com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei
          nº 13.709/2018), quais dados são tratados quando você visita este site, para quê e quais
          são os seus direitos.
        </p>
        <p className="meta mt-2">Última atualização: {ATUALIZADO_EM}.</p>
      </header>

      <Bloco id="responsavel" titulo="1. Responsável e contato">
        <p>
          O responsável pelo site Voto em Quem é Thomas Alcantara Meskens, que atua como controlador
          dos dados descritos nesta política. Para dúvidas, solicitações ou exercício de direitos, use
          o canal abaixo:
        </p>
        <p className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-gray-900">
          E-mail:{" "}
          <a href="mailto:thomas.meskense@gmail.com" className="lk font-semibold">
            thomas.meskense@gmail.com
          </a>
        </p>
      </Bloco>

      <Bloco id="dados" titulo="2. Quais dados são tratados">
        <p>
          <strong>O site não pede cadastro, login nem qualquer dado pessoal.</strong> Não há
          formulários de contato, comentários ou envio de informações pelo visitante.
        </p>
        <p>
          <strong>Medição de audiência.</strong> Usamos o Vercel Web Analytics para saber, de forma
          agregada, quais páginas são visitadas, de onde vêm os acessos (site de origem), o país e o
          tipo de dispositivo e navegador. Essa ferramenta não usa cookies e não identifica visitantes
          individualmente: os dados são contados em conjunto e não permitem saber quem você é.
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

      <Bloco id="armazenamento-local" titulo="4. Cookies e armazenamento no seu navegador">
        <p>
          O site não usa cookies e não grava informações no armazenamento do seu navegador.
        </p>
      </Bloco>

      <Bloco id="opiniao-politica" titulo="5. Opinião política">
        <p>
          Opinião política é dado pessoal sensível (art. 5º, II, da LGPD). O site não coleta esse
          tipo de informação: ele apenas apresenta decisões e votações registradas em documentos
          oficiais e não pede ao visitante nenhuma resposta ou preferência.
        </p>
      </Bloco>

      <Bloco id="compartilhamento" titulo="6. Compartilhamento">
        <p>
          O site não vende, aluga nem compartilha dados pessoais. Os únicos terceiros envolvidos são a
          provedora de hospedagem e a ferramenta de medição de audiência descritas acima.
        </p>
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
          Como o site não identifica visitantes, em muitos casos não haverá dado pessoal associado a
          você. Para exercer seus direitos, escreva para o e-mail indicado no item 1; a resposta será
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
          última atualização aparece no início da página. Veja também a{" "}
          <Link href="/metodologia" className="lk">
            Metodologia
          </Link>
          .
        </p>
      </Bloco>
    </article>
  );
}

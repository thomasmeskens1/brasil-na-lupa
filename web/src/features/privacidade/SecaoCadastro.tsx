import Link from "next/link";
import { Bloco } from "./Bloco";

/** Item 9 da Política de Privacidade (versão 2): cadastro opcional. */
export function SecaoCadastro({ versao }: { versao: string }) {
  return (
    <Bloco id="cadastro" titulo="9. Cadastro (opcional)">
      <p>
        O cadastro é opcional e não é necessário para ver nenhum conteúdo. Ele permite guardar os estados, temas,
        políticos e itens que você quer acompanhar. O consentimento registrado na conta se refere à versão{" "}
        {versao} desta política.
      </p>

      <h3 className="pt-2 font-semibold text-gray-900">9.1 Dados coletados</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>E-mail</strong>, para identificar a conta e enviar o link de acesso (não há senha).
        </li>
        <li>
          <strong>Nome</strong>, somente se você entrar com o Google (é o nome que o Google informa). Do Google
          recebemos apenas e-mail, nome e um identificador da conta; não guardamos foto nem as chaves de acesso à
          sua conta Google.
        </li>
        <li>
          <strong>Registro do consentimento</strong>: data e hora e a versão desta política que você aceitou.
        </li>
        <li>
          <strong>Preferências</strong>: estados, municípios, temas, políticos e itens acompanhados (votações,
          propostas, decisões) e se você quer receber alertas por e-mail. Os alertas vêm desligados e, por
          enquanto, não são enviados: a opção só registra a sua preferência.
        </li>
        <li>
          <strong>Dados técnicos da conta</strong>: data de criação, data do último acesso e as sessões abertas
          (data de validade).
        </li>
        <li>
          <strong>Proteção contra abuso</strong>: para limitar pedidos repetidos de link de acesso, guardamos
          por até 24 horas um código cifrado (resumo criptográfico) do e-mail e do endereço IP, que não permite
          recuperar o e-mail ou o IP.
        </li>
      </ul>

      <h3 className="pt-2 font-semibold text-gray-900">9.2 Finalidade</h3>
      <p>
        Somente manter a sua conta, mostrar a você o que escolheu acompanhar e, no futuro, se você ligar os
        alertas, avisar por e-mail sobre novidades desses assuntos. Não fazemos perfil, publicidade, rastreamento
        ou análise das preferências, e elas nunca são usadas para escolher o conteúdo exibido a outras pessoas.
      </p>

      <h3 className="pt-2 font-semibold text-gray-900">9.3 Base legal</h3>
      <p>
        <strong>Consentimento</strong> (LGPD, art. 7º, I, e, para as preferências que podem revelar opinião
        política, art. 11, I — consentimento específico e destacado). Ele é pedido numa tela própria no primeiro
        acesso, sem caixa pré-marcada, e nada é guardado além do e-mail antes dele. A proteção contra abuso do
        envio de links se apoia no legítimo interesse (art. 7º, IX) e na segurança do serviço. Você pode revogar o
        consentimento a qualquer momento (art. 8º, § 5º), sem custo.
      </p>

      <h3 className="pt-2 font-semibold text-gray-900">9.4 Por quanto tempo guardamos</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Conta e preferências: enquanto a conta existir. A exclusão pedida por você é imediata.</li>
        <li>Contas sem nenhum acesso por 24 meses são excluídas automaticamente.</li>
        <li>
          Contas sem consentimento válido (que não aceitaram ou que revogaram) guardam só o e-mail e são
          excluídas automaticamente depois de 7 dias.
        </li>
        <li>Link de acesso: vale por 1 hora e é apagado depois de usado ou vencido.</li>
        <li>Sessão: até 30 dias, ou até você sair.</li>
        <li>Códigos da proteção contra abuso: 24 horas.</li>
        <li>
          O histórico de restauração do banco de dados mantido pela operadora pode conter dados excluídos por até 7
          dias, até ser substituído.
        </li>
      </ul>
      <p className="meta">
        As exclusões automáticas são feitas sempre que alguém entra ou pede um link de acesso.
      </p>

      <h3 className="pt-2 font-semibold text-gray-900">9.5 Quem trata os dados (operadoras) e onde</h3>
      <p>
        Estas empresas prestam o serviço em nome do controlador, seguindo as instruções dele, e não podem usar os
        dados para outros fins. Algumas ficam fora do Brasil; nesses casos há transferência internacional, feita nas
        hipóteses do art. 33 da LGPD, com as garantias contratuais oferecidas por cada empresa.
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Vercel Inc.</strong> (Estados Unidos) — hospedagem do site e execução das páginas da conta.
          Processa os dados em trânsito, em servidores que podem estar fora do Brasil.
        </li>
        <li>
          <strong>Neon</strong> (empresa dos Estados Unidos) — banco de dados onde a conta e as preferências
          ficam guardadas, contratado por meio da Vercel. O banco fica na região de São Paulo (Brasil), na
          infraestrutura da Amazon Web Services; a empresa responsável fica nos Estados Unidos.
        </li>
        <li>
          <strong>Resend, Inc.</strong> (Estados Unidos) — envio do e-mail com o link de acesso (e, no futuro, dos
          alertas, se você ligar). Recebe o seu e-mail e o conteúdo da mensagem; o processamento pode ocorrer nos
          Estados Unidos.
        </li>
        <li>
          <strong>Google LLC</strong> (Estados Unidos) — somente se você escolher &quot;Entrar com Google&quot;. O
          Google confirma a sua identidade e informa ao site o seu e-mail e nome; o uso da sua conta Google segue a
          política de privacidade do próprio Google.
        </li>
      </ul>

      <h3 className="pt-2 font-semibold text-gray-900">9.6 Segurança</h3>
      <p>
        Conexão sempre cifrada (HTTPS), cookies de sessão protegidos, links de acesso de uso único guardados
        apenas na forma de resumo criptográfico e acesso ao banco restrito ao controlador. Nenhuma senha é criada
        ou guardada.
      </p>

      <h3 className="pt-2 font-semibold text-gray-900">9.7 Como exercer seus direitos</h3>
      <p>
        Na página{" "}
        <Link href="/minha-conta" className="lk" prefetch={false}>
          Minha conta
        </Link>{" "}
        você pode, sozinho e a qualquer momento:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>ver e corrigir as suas preferências;</li>
        <li>baixar todos os seus dados num arquivo (formato JSON), para acesso e portabilidade;</li>
        <li>revogar o consentimento, o que apaga na hora todas as preferências;</li>
        <li>excluir a conta, com exclusão real e imediata do banco de dados.</li>
      </ul>
      <p>
        Para qualquer outro pedido, ou se não conseguir entrar na conta, escreva ao encarregado (item 1). Se não
        der o consentimento, a única consequência é não poder guardar preferências: todo o conteúdo do site
        continua disponível.
      </p>
    </Bloco>
  );
}

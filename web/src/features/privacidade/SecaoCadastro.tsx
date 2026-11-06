import Link from "next/link";
import { Bloco } from "./Bloco";

const th = "py-2 pr-3 text-left font-semibold text-gray-900";
const td = "py-2 pr-3 align-top";

/** Finalidade × dado × base legal × prazo (LGPD, art. 6º, 7º, 9º e 11). */
const TRATAMENTOS: { finalidade: string; dados: string; base: string; prazo: string }[] = [
  {
    finalidade: "Entrar na conta (código ou link por e-mail; Google, se você escolher)",
    dados: "E-mail; código de acesso guardado só como resumo criptográfico; sessão; vínculo com o Google (sem nome, foto ou chaves)",
    base: "Execução do serviço que você pediu (art. 7º, V)",
    prazo: "Conta: enquanto existir. Código: 10 minutos ou até o uso. Sessão: até 30 dias ou até sair",
  },
  {
    finalidade: "Guardar e mostrar seus favoritos (estados, temas, políticos e propostas) e preferências",
    dados: "Favoritos; municípios; escolha de alertas por e-mail",
    base: "Execução do serviço (art. 7º, V) e, como podem revelar opinião política, consentimento específico e destacado (art. 11, I)",
    prazo: "Enquanto a conta existir ou até você apagar ou revogar",
  },
  {
    finalidade:
      "Registrar suas reações (curtir e não curtir) e mostrar, a quem tem conta, os totais de cada proposta, os totais por estado e a lista de propostas com mais manifestações",
    dados: "Proposta e reação, ligadas à conta",
    base: "Consentimento específico e destacado, pedido na primeira reação (art. 11, I)",
    prazo: "Até você trocar, retirar, apagar as reações ou revogar o consentimento delas",
  },
  {
    finalidade: "Contar as reações por estado (opcional)",
    dados: "Sigla do estado onde você vota, declarada por você, e a data do consentimento",
    base: "Consentimento específico e destacado, dado em Minha conta (art. 11, I)",
    prazo: "Até você apagar o estado, revogar o consentimento geral ou excluir a conta",
  },
  {
    finalidade: "Provar o consentimento e a declaração de idade",
    dados: "Data, versão da política aceita, declaração de 18 anos ou mais, datas dos consentimentos das reações e do estado",
    base: "Cumprimento de obrigação legal (art. 7º, II, e art. 8º, § 2º)",
    prazo: "Enquanto a conta existir",
  },
  {
    finalidade: "Segurança: limitar pedidos repetidos e tentativas de código",
    dados: "Resumo criptográfico (com chave secreta) do e-mail, do IP ou da conta; nunca o valor em claro",
    base: "Legítimo interesse (art. 7º, IX)",
    prazo: "24 horas",
  },
  {
    finalidade: "Avisar antes de excluir conta sem acesso",
    dados: "E-mail; data do último acesso; data do aviso",
    base: "Execução do serviço (art. 7º, V)",
    prazo: "Aviso aos 23 meses sem acesso; exclusão 30 dias depois",
  },
];

/** Item 9 da Política de Privacidade (versão 5): cadastro opcional, favoritos, reações e estado onde vota. */
export function SecaoCadastro({ versao }: { versao: string }) {
  return (
    <Bloco id="cadastro" titulo="9. Cadastro (opcional), favoritos e reações">
      <p>
        O cadastro é opcional e não é necessário para ver nenhum conteúdo. Ele permite marcar estados, temas, políticos e
        propostas como favoritos e reagir às propostas (curtir ou não curtir). O consentimento registrado na conta se
        refere à versão {versao} desta política. A conta é destinada a pessoas com <strong>18 anos ou mais</strong>: no
        primeiro acesso pedimos essa declaração (art. 14), e não tratamos dados de crianças e adolescentes.
      </p>

      <h3 className="pt-2 font-semibold text-gray-900">9.1 O que guardamos, para quê, com que base e por quanto tempo</h3>
      <p>
        Só o mínimo necessário (art. 6º, III): <strong>não guardamos nome, CPF, telefone, foto nem endereço IP em
        claro</strong>.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <caption className="sr-only">Finalidade, dados, base legal e prazo de cada tratamento do cadastro</caption>
          <thead>
            <tr className="border-b border-borda">
              <th scope="col" className={th}>Finalidade</th>
              <th scope="col" className={th}>Dados</th>
              <th scope="col" className={th}>Base legal (LGPD)</th>
              <th scope="col" className={th}>Prazo</th>
            </tr>
          </thead>
          <tbody>
            {TRATAMENTOS.map((t) => (
              <tr key={t.finalidade} className="border-b border-borda">
                <th scope="row" className={`${td} font-medium text-gray-900`}>
                  {t.finalidade}
                </th>
                <td className={td}>{t.dados}</td>
                <td className={td}>{t.base}</td>
                <td className={td}>{t.prazo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Também ficam as datas de criação da conta e do último acesso. Não fazemos perfil, publicidade, rastreamento ou
        análise dos favoritos e reações, e eles nunca são usados para escolher o conteúdo exibido a outras pessoas.
      </p>

      <h3 className="pt-2 font-semibold text-gray-900">9.2 Reações: só totais, nunca quem reagiu</h3>
      <p>
        Cada conta tem no máximo uma reação por proposta, que pode ser trocada ou retirada. O site mostra só totais, e só
        a quem tem conta, sempre com o aviso de que são opinião de usuários do site, não pesquisa nem dado oficial.
        Nenhuma tela, arquivo ou pessoa externa vê quem reagiu. Os totais aparecem de três formas:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>o total de cada proposta, na página dela;</li>
        <li>
          o total por estado, só com as reações de quem informou o estado onde vota (item 9.1) e só nos estados com 10
          pessoas ou mais naquela proposta;
        </li>
        <li>
          a lista “Propostas com mais manifestações”, no Brasil ou num estado, ordenada por um critério único e público:
          o número de reações (curtir e não curtir somados, sem peso para um lado); só entram propostas com 10 pessoas ou
          mais.
        </li>
      </ul>
      <p>
        Os totais por estado e a lista usam só as reações de quem deu o consentimento das reações nesta versão da
        política. Os totais nunca são usados para dar notas ou comparar políticos.
      </p>

      <h3 className="pt-2 font-semibold text-gray-900">9.3 Consentimento</h3>
      <p>
        Há três consentimentos, específicos e destacados, sem caixa pré-marcada: o dos favoritos e preferências, numa
        tela própria no primeiro acesso; o das reações, pedido na primeira vez que você curtir ou não curtir uma proposta
        (e de novo na primeira reação depois desta versão); e o do estado onde você vota, em Minha conta, opcional.
        Antes deles nada é guardado além do e-mail. Você pode revogar cada um a qualquer momento, sem custo (art. 8º,
        § 5º): revogar o das reações apaga as reações; apagar o estado o tira das contagens; revogar o geral apaga
        favoritos, preferências, reações e o estado. Se não
        der o consentimento, a única consequência é não poder usar esses recursos: todo o conteúdo continua disponível.
      </p>

      <h3 className="pt-2 font-semibold text-gray-900">9.4 Exclusão e retenção</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>A exclusão da conta pedida por você apaga na hora, do banco de dados, a conta, os favoritos e as reações.</li>
        <li>
          Em até 15 dias não resta cópia: o histórico de restauração do banco é mantido por no máximo 7 dias, e os
          registros técnicos da hospedagem, guardados por prazo menor, não incluem favoritos, reações nem códigos.
        </li>
        <li>
          Contas sem acesso por 24 meses: avisamos por e-mail aos 23 meses e excluímos 30 dias depois do aviso, se você
          não entrar de novo.
        </li>
        <li>Contas sem consentimento válido guardam só o e-mail e são excluídas depois de 7 dias.</li>
        <li>Códigos de acesso: apagados depois de usados, vencidos (10 minutos) ou após 5 tentativas erradas.</li>
      </ul>
      <p className="meta">As exclusões automáticas são feitas sempre que alguém entra ou pede um código de acesso.</p>

      <h3 className="pt-2 font-semibold text-gray-900">9.5 Quem trata os dados (operadoras), onde e transferência internacional</h3>
      <p>
        Estas empresas prestam o serviço em nome do controlador, seguindo as instruções dele, e não podem usar os dados
        para outros fins. Como todas são dos Estados Unidos, há transferência internacional de dados, feita nas hipóteses
        do art. 33 da LGPD, com as garantias contratuais (cláusulas de proteção de dados) oferecidas por cada uma.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <caption className="sr-only">Operadoras, função e país de tratamento</caption>
          <thead>
            <tr className="border-b border-borda">
              <th scope="col" className={th}>Operadora</th>
              <th scope="col" className={th}>Função</th>
              <th scope="col" className={th}>País de tratamento</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-borda">
              <th scope="row" className={`${td} font-medium text-gray-900`}>Vercel Inc.</th>
              <td className={td}>Hospedagem do site e execução das páginas e rotas da conta</td>
              <td className={td}>Estados Unidos e outros países onde a Vercel tem servidores (dados em trânsito)</td>
            </tr>
            <tr className="border-b border-borda">
              <th scope="row" className={`${td} font-medium text-gray-900`}>Neon (contratado por meio da Vercel)</th>
              <td className={td}>Banco de dados da conta, dos favoritos e das reações</td>
              <td className={td}>Brasil (região de São Paulo, na Amazon Web Services); empresa nos Estados Unidos</td>
            </tr>
            <tr className="border-b border-borda">
              <th scope="row" className={`${td} font-medium text-gray-900`}>Resend, Inc.</th>
              <td className={td}>Envio dos e-mails da conta (código de acesso, troca de e-mail, aviso de inatividade)</td>
              <td className={td}>Estados Unidos (e Brasil, se a região de São Paulo estiver disponível)</td>
            </tr>
            <tr className="border-b border-borda">
              <th scope="row" className={`${td} font-medium text-gray-900`}>Google LLC</th>
              <td className={td}>Só se você escolher “Entrar com Google”: confirma a identidade e informa o e-mail</td>
              <td className={td}>Estados Unidos</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="pt-2 font-semibold text-gray-900">9.6 Segurança</h3>
      <p>
        Conexão sempre cifrada (HTTPS); cookies de sessão HttpOnly, Secure e SameSite=Lax; nenhum cookie não essencial
        (item 4); códigos de acesso de uso único guardados só como resumo criptográfico; limites de tentativas por conta e
        por conexão; pedidos que alteram dados só aceitos a partir do próprio site; acesso ao banco restrito ao
        controlador. Nenhuma senha é criada ou guardada.
      </p>

      <h3 className="pt-2 font-semibold text-gray-900">9.7 Incidentes de segurança</h3>
      <p>
        Todo incidente de segurança que envolva dados pessoais é registrado (o que aconteceu, quando, quais dados, quantas
        pessoas, as medidas tomadas). Se puder causar risco ou dano relevante, comunicamos a Autoridade Nacional de
        Proteção de Dados (ANPD) e as pessoas afetadas, por e-mail, no prazo da regulamentação da ANPD, com a descrição
        dos dados envolvidos, os riscos e as medidas adotadas (art. 48).
      </p>

      <h3 className="pt-2 font-semibold text-gray-900">9.8 Como exercer seus direitos</h3>
      <p>
        Na página{" "}
        <Link href="/minha-conta" className="lk" prefetch={false}>
          Minha conta
        </Link>{" "}
        você pode, sozinho e a qualquer momento (art. 18):
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>confirmar que tratamos seus dados e ver o que está guardado;</li>
        <li>baixar todos os seus dados num arquivo (formato JSON), para acesso e portabilidade;</li>
        <li>corrigir o e-mail (com código enviado ao endereço novo) e editar favoritos e preferências;</li>
        <li>apagar só os favoritos, só as reações, só o estado onde vota, ou cada favorito separadamente;</li>
        <li>revogar o consentimento das reações, o do estado ou o consentimento geral;</li>
        <li>excluir a conta inteira, com exclusão real e imediata do banco de dados;</li>
        <li>saber com quem os dados são compartilhados (as operadoras do item 9.5, e mais ninguém).</li>
      </ul>
      <p>
        Para qualquer outro pedido, ou se não conseguir entrar na conta, escreva ao encarregado (item 1); a resposta é
        enviada no prazo legal.
      </p>
    </Bloco>
  );
}

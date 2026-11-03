import { Bloco } from "./Bloco";
import { CHAVE_AVISO, COOKIES_ESSENCIAIS, COOKIES_NAO_ESSENCIAIS } from "./cookies";

/**
 * Item 4 da Política (a partir da versão 3): Cookies. A tabela vem de cookies.ts, a mesma lista
 * usada pelo aviso do rodapé. A âncora #cookies é o destino do link "Política de cookies".
 */
export function SecaoCookies({ comCadastro }: { comCadastro: boolean }) {
  const lista = COOKIES_ESSENCIAIS.filter((c) => comCadastro || !c.soComCadastro);
  return (
    <Bloco id="cookies" titulo="4. Cookies e armazenamento no seu navegador">
      <span id="armazenamento-local" aria-hidden="true" />
      <p>
        <strong>O site usa apenas cookies essenciais</strong>, necessários para o funcionamento do login que você pede.
        Não há cookies de publicidade, de rastreamento, de redes sociais ou de terceiros, e{" "}
        {COOKIES_NAO_ESSENCIAIS.length === 0 ? "nenhum cookie não essencial." : "os não essenciais só com o seu aceite."}
      </p>
      {comCadastro ? (
        <>
          <p>
            <strong>Sem conta</strong>, nenhum cookie é gravado. <strong>Com conta</strong>, ao entrar, são gravados os
            cookies abaixo. Todos são protegidos contra leitura por scripts (HttpOnly), enviados só por conexão segura
            (Secure, HTTPS) e restritos ao próprio site (SameSite=Lax).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <caption className="sr-only">Cookies essenciais do login</caption>
              <thead>
                <tr className="border-b border-borda">
                  <th scope="col" className="py-2 pr-3 font-semibold text-gray-900">Cookie</th>
                  <th scope="col" className="py-2 pr-3 font-semibold text-gray-900">Para que serve</th>
                  <th scope="col" className="py-2 font-semibold text-gray-900">Duração</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.nome} className="border-b border-borda align-top">
                    <td className="py-2 pr-3">{c.nome}</td>
                    <td className="py-2 pr-3">{c.finalidade}</td>
                    <td className="py-2">{c.duracao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="meta">
            Em conexão segura, os nomes dos cookies do login começam com __Secure- ou __Host-, que obrigam o navegador a
            usá-los só em HTTPS.
          </p>
        </>
      ) : (
        <p>O cadastro não está disponível, por isso hoje nenhum cookie é gravado.</p>
      )}
      <p>
        <strong>Base legal:</strong> os cookies essenciais servem à execução do serviço que você pediu (entrar na conta;
        LGPD, art. 7º, V) e à segurança do login (legítimo interesse, art. 7º, IX). Por serem estritamente necessários,
        não dependem de consentimento; se você os bloquear no navegador, o login deixa de funcionar e o resto do site
        continua igual.
      </p>
      <p>
        <strong>Medição de audiência:</strong> o Vercel Web Analytics não usa cookies e não identifica visitantes (item
        2).
      </p>
      <p>
        <strong>Armazenamento local:</strong> ao fechar o aviso sobre cookies, o navegador guarda o item “{CHAVE_AVISO}”
        (só a versão do aviso que você viu), para não mostrar o aviso de novo. Ele não sai do seu aparelho, não é enviado
        ao site e pode ser apagado limpando os dados do site no navegador.
      </p>
      <p>
        <strong>Se um dia</strong> o site passar a usar algum cookie não essencial, esta política ganhará nova versão e o
        aviso passará a pedir o seu consentimento antes de gravá-lo, com as opções “Aceitar” e “Recusar” com o mesmo
        destaque. Recusar não muda nada no acesso ao conteúdo.
      </p>
    </Bloco>
  );
}

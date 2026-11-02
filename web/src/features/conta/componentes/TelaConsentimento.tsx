"use client";

import Link from "next/link";
import { useActionState } from "react";
import { aceitarConsentimentoAcao, recusarConsentimentoAcao, type EstadoFormulario } from "../acoes";
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO } from "./estilos";
import { Mensagem } from "./Mensagem";

/**
 * Consentimento explícito e destacado (LGPD, art. 8º e art. 11, I). A caixa nunca vem marcada.
 * Sem o consentimento, nenhuma preferência é gravada.
 */
export function TelaConsentimento({ versao, revogado }: { versao: string; revogado: boolean }) {
  const [estado, acao, enviando] = useActionState<EstadoFormulario, FormData>(aceitarConsentimentoAcao, {});
  return (
    <section aria-labelledby="consentimento-t" className="space-y-4">
      {revogado ? (
        <p role="status" className="aviso text-sm text-gray-900">
          Consentimento revogado. Suas preferências foram apagadas. A conta agora guarda só o seu e-mail e
          será excluída automaticamente em 7 dias se você não der um novo consentimento.
        </p>
      ) : null}
      <h2 id="consentimento-t" className="text-xl font-bold text-gray-900">
        Antes de continuar: seu consentimento
      </h2>

      <div className="aviso space-y-3 text-sm leading-relaxed text-gray-900">
        <p>
          <strong>Atenção: a lista de políticos, temas e assuntos que você acompanha pode revelar a sua opinião
          política</strong>, que é um dado pessoal sensível pela Lei Geral de Proteção de Dados Pessoais (LGPD —
          Lei nº 13.709/2018, art. 5º, II). Por isso pedimos o seu consentimento específico antes de guardar
          qualquer preferência.
        </p>
        <dl className="space-y-2">
          <div>
            <dt className="font-semibold">O que fica guardado</dt>
            <dd>
              Seu e-mail (e o nome, se você entrou com o Google); a data deste consentimento e a versão da
              política aceita; as preferências que você escolher — estados, municípios, temas, políticos e itens
              acompanhados — e se quer receber alertas por e-mail (desligado até você ligar; os alertas ainda não
              são enviados).
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Para quê</dt>
            <dd>
              Somente para mostrar a você o que escolheu acompanhar e, no futuro, se você ligar os alertas, avisar
              por e-mail sobre novidades desses assuntos. Não fazemos perfil, publicidade nem rastreamento, e não
              vendemos nem compartilhamos as suas preferências.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Base legal</dt>
            <dd>O seu consentimento, específico e destacado (LGPD, art. 11, I).</dd>
          </div>
          <div>
            <dt className="font-semibold">Por quanto tempo</dt>
            <dd>
              Enquanto a conta existir. Você pode excluí-la quando quiser, com efeito imediato. Contas sem acesso
              por 24 meses são excluídas automaticamente.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Seus direitos</dt>
            <dd>
              Nesta página você pode, a qualquer momento: ver e corrigir as preferências, baixar todos os seus
              dados, revogar este consentimento (o que apaga as preferências) e excluir a conta. Também pode
              escrever ao encarregado de dados ou reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
            </dd>
          </div>
        </dl>
        <p>
          Detalhes, empresas que prestam o serviço (hospedagem, banco de dados e envio de e-mail) e onde os dados
          ficam:{" "}
          <Link href="/privacidade#cadastro" className="lk">
            Política de Privacidade, versão {versao}
          </Link>
          .
        </p>
      </div>

      <form action={acao} className="space-y-3">
        <div className="flex items-start gap-3">
          <input
            id="aceito"
            name="aceito"
            type="checkbox"
            value="sim"
            required
            className="mt-1 h-5 w-5 shrink-0"
            aria-describedby="consentimento-t"
          />
          <label htmlFor="aceito" className="text-sm font-medium text-gray-900">
            Li as informações acima e concordo que o Placar do Poder guarde as minhas preferências, inclusive as que
            podem revelar opinião política, somente para as finalidades descritas.
          </label>
        </div>
        <Mensagem estado={estado} />
        <button type="submit" className={BOTAO_PRIMARIO} disabled={enviando}>
          Concordo e quero continuar
        </button>
      </form>

      <form action={recusarConsentimentoAcao} className="space-y-1 border-t border-borda pt-4">
        <p className="text-sm text-gray-800">
          Se não concordar, a sua conta (que hoje guarda só o e-mail) é excluída agora mesmo.
        </p>
        <button type="submit" className={BOTAO_SECUNDARIO}>
          Não concordo — excluir minha conta
        </button>
      </form>
    </section>
  );
}

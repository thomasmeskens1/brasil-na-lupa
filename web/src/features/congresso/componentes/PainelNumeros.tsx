/**
 * Painel inicial de /congresso: quatro números grandes (contam ao aparecer na tela), cada um com
 * o período, a fonte oficial e a data da coleta. Só contagens de registros oficiais: nenhuma
 * média, nota ou estimativa (diretrizes 1 e 4). Presença média não aparece porque as casas não
 * publicam esse número.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { SeloFonte } from "@/components/decisao/Selos";
import { ContadorAnimado } from "@/components/marca/ContadorAnimado";
import type { FonteCongresso, PainelCongresso } from "../tipos";
import { CASA_NOME, formatarData } from "../rotulos";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function nomeMes(d: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(d);
  return m ? `${MESES[+m[2] - 1]} de ${m[1]}` : d;
}

function n(v: number): string {
  return v.toLocaleString("pt-BR");
}

function Bloco({
  valor,
  rotulo,
  detalhe,
  periodo,
  fontes,
  link,
}: {
  valor: number;
  rotulo: string;
  detalhe: ReactNode;
  periodo: string;
  fontes: (FonteCongresso & { orgao: string })[];
  link: { href: string; texto: string };
}) {
  return (
    <li className="flex flex-col rounded-2xl border border-borda bg-superficie p-4 sm:p-5">
      <p className="font-titulo text-5xl font-extrabold leading-none text-white-puro md:text-6xl">
        <ContadorAnimado valor={valor} />
      </p>
      <p className="mt-2 font-titulo text-lg font-extrabold leading-snug text-foreground">{rotulo}</p>
      <p className="mt-1 text-sm leading-relaxed text-[var(--cor-secundaria)]">{detalhe}</p>
      <p className="mt-2 text-sm text-[var(--cor-texto-apoio)]">{periodo}</p>
      <div className="mt-auto pt-2">
        <ul className="flex flex-wrap gap-x-3" aria-label="Fontes">
          {fontes.map((f) => (
            <li key={f.url}>
              <SeloFonte fonte={{ url: f.url, titulo: f.titulo ?? null, orgao: f.orgao, acessado_em: f.acessado_em ?? null }} compacto />
            </li>
          ))}
        </ul>
        <Link href={link.href} className="lk inline-flex min-h-11 items-center text-sm font-semibold">
          {link.texto} <span aria-hidden="true">&nbsp;→</span>
        </Link>
      </div>
    </li>
  );
}

export interface PainelNumerosProps {
  painel: PainelCongresso;
  /** Fonte principal das votações de cada casa (com a data da coleta). */
  fontesVotacoes: (FonteCongresso & { orgao: string })[];
}

export function PainelNumeros({ painel, fontesVotacoes }: PainelNumerosProps) {
  const { mes, leis, mps, parlamentares } = painel;
  const cam = parlamentares.camara;
  const sen = parlamentares.senado;
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {mes ? (
        <Bloco
          valor={mes.total}
          rotulo={`Votações coletadas em ${nomeMes(mes.inicio)}`}
          detalhe={
            <>
              {CASA_NOME.camara}: {n(mes.camara)} · {CASA_NOME.senado}: {n(mes.senado)}. Destas, {n(mes.muda_lei)} podem criar ou
              mudar leis e {n(mes.nominais)} foram nominais (com o voto de cada um). No Senado, a coleta traz só as votações
              nominais e secretas.
            </>
          }
          periodo={`De ${formatarData(mes.inicio)} a ${formatarData(mes.fim)}, data da última votação coletada.`}
          fontes={fontesVotacoes}
          link={{ href: "#votacoes", texto: "Ver as votações" }}
        />
      ) : null}
      {leis ? (
        <Bloco
          valor={leis.total}
          rotulo={`Propostas que viraram lei em ${leis.ano}`}
          detalhe={`${n(leis.ordinarias)} leis e ${n(leis.complementares)} leis complementares aprovadas pelo Congresso Nacional e assinadas (sancionadas ou promulgadas).`}
          periodo={`Assinadas de ${formatarData(leis.primeira)} a ${formatarData(leis.ultima)}. Lista coletada em ${formatarData(leis.atualizado_em)}.`}
          fontes={leis.fontes.map((f) => ({ ...f, orgao: f.orgao ?? CASA_NOME.senado, acessado_em: leis.atualizado_em }))}
          link={{ href: "/executivo/leis-e-decretos", texto: "Ver as leis" }}
        />
      ) : null}
      {mps ? (
        <Bloco
          valor={mps.em_tramitacao}
          rotulo="Medidas provisórias em tramitação"
          detalhe={
            <>
              Medida provisória (MP): ato do presidente da República que vale como lei na hora, mas perde a validade se o
              Congresso não a aprovar em 60 dias, prorrogáveis por mais 60 (artigo 62 da Constituição).
              {mps.enviadas_a_sancao ? ` Outras ${n(mps.enviadas_a_sancao)} já foram aprovadas e aguardam sanção.` : ""}
            </>
          }
          periodo={`Situação registrada em ${formatarData(mps.atualizado_em)}, entre as ${n(mps.editadas)} MPs editadas em ${mps.anos.join(" e ")}.`}
          fontes={[{ ...mps.fonte, orgao: "Congresso Nacional", acessado_em: mps.atualizado_em }]}
          link={{ href: "/executivo/medidas-provisorias", texto: "Ver as medidas provisórias" }}
        />
      ) : null}
      {cam || sen ? (
        <Bloco
          valor={(cam?.em_exercicio ?? 0) + (sen?.em_exercicio ?? 0)}
          rotulo="Parlamentares em exercício"
          detalhe={`${n(cam?.em_exercicio ?? 0)} deputados federais e ${n(sen?.em_exercicio ?? 0)} senadores, segundo as listas oficiais das casas.`}
          periodo={`Listas coletadas em ${formatarData(cam?.lista_atualizada_em ?? sen?.lista_atualizada_em)}.`}
          fontes={[
            ...(cam?.fonte ? [{ ...cam.fonte, orgao: CASA_NOME.camara, acessado_em: cam.lista_atualizada_em }] : []),
            ...(sen?.fonte ? [{ ...sen.fonte, orgao: CASA_NOME.senado, acessado_em: sen.lista_atualizada_em }] : []),
          ]}
          link={{ href: "/congresso/composicao", texto: "Ver a composição" }}
        />
      ) : null}
    </ul>
  );
}

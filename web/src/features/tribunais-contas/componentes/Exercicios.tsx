import Link from "next/link";
import type { ReactNode } from "react";
import { FonteLink } from "@/components/FonteLink";
import { TextoComSiglas } from "@/components/glossario";
import { CartaoDecisao } from "@/components/decisao/CartaoDecisao";
import {
  cartaoJulgamentoAlesp,
  cartaoJulgamentoCongresso,
  cartaoParecerPresidente,
  cartaoParecerTce,
  tituloGovernador,
  tituloPrefeito,
  tituloPresidente,
  type DadosCartaoTc,
} from "../cartoes";
import type { ExercicioPresidente, OrgaoTc, ParecerPrevioTce } from "../tipos";
import { BASE_TC, NAO_DISPONIVEL, deUf, formatarDataTc, nomeProprio, plural } from "../rotulos";
import { Fontes, Ficha, Lacunas, Literal, Recolhivel } from "./Basicos";
import { JulgamentoAlespBloco, JulgamentoCongressoBloco } from "./JulgamentoPolitico";
import { ListaLiteral, RegistrosRelator } from "./Literais";
import { tituloSimplesTc } from "../dados";
import { getUf } from "@/features/estados/ufs";

export { tituloGovernador, tituloPrefeito, tituloPresidente };

/** Item da linha do tempo (um exercício), com âncora própria e os cartões no topo. */
function ItemLinha({ id, titulo, cartoes, children }: { id: string; titulo: string; cartoes: DadosCartaoTc[]; children: ReactNode }) {
  return (
    <li id={id} className="relative scroll-mt-20 border-l-4 border-[var(--cor-borda-forte)] pb-2 pl-4 md:pl-6">
      <span aria-hidden="true" className="absolute -left-[0.6rem] top-1.5 h-4 w-4 rounded-full border-4 border-white bg-acento" />
      <article aria-labelledby={`${id}-t`} className="space-y-4">
        <h2 id={`${id}-t`} className="text-xl font-bold text-gray-900">
          {titulo}
        </h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {cartoes.map((c) => (
            <CartaoDecisao
              key={c.chave}
              href={c.href}
              tituloOficial={c.tituloOficial}
              simples={c.simples}
              subtituloOficial={c.subtitulo}
              caminho={c.caminho}
              rotuloCaminho={c.rotuloCaminho}
              data={c.data}
              forma={c.forma}
              dado={c.dado}
              quemDecidiu={c.quem}
              fonte={c.fonte}
              nivelTitulo={3}
            />
          ))}
        </div>
        {children}
      </article>
    </li>
  );
}

/** Detalhe recolhido (nível 2), com âncora: o link do cartão abre o bloco. */
function Sub({ id, titulo, children, aberto = false }: { id?: string; titulo: string; children: ReactNode; aberto?: boolean }) {
  return (
    <details id={id} className="scroll-mt-20 rounded-md border border-borda bg-white" open={aberto || undefined}>
      <summary className="pr-3">{titulo}</summary>
      <div className="space-y-3 border-t border-borda px-3 pb-3 pt-3">{children}</div>
    </details>
  );
}

/* ---------- Contas do Presidente (TCU + Congresso) ---------- */

export function ExercicioPresidenteItem({ e, orgao }: { e: ExercicioPresidente; orgao: string }) {
  const c = e.curadoria;
  const a = e.acordao;
  return (
    <ItemLinha
      id={`exercicio-${e.exercicio}`}
      titulo={`Exercício de ${e.exercicio}`}
      cartoes={[{ ...cartaoParecerPresidente(e, orgao, tituloPresidente(e)), simples: tituloSimplesTc(e.acordao?.id, `${orgao}-contas-presidente-${e.exercicio}`) }, cartaoJulgamentoCongresso(e.exercicio, e.julgamento_politico)]}
    >
      <Sub id={`exercicio-${e.exercicio}-parecer`} titulo="Detalhes do parecer prévio do TCU: ressalvas, alertas e relator">
        {a ? (
          <>
            <Ficha
              itens={[
                [
                  "Acórdão",
                  <Link key="a" href={`${BASE_TC}/${orgao}/acordaos/${a.id}`} className="lk">
                    {`Acórdão ${a.numero} — ${a.orgao}`}
                  </Link>,
                ],
                ["Data do julgamento", formatarDataTc(a.data_julgamento)],
                ["Relator", nomeProprio(a.relator)],
                ["Processo (segundo o documento)", c?.processo_no_documento ?? NAO_DISPONIVEL],
                ["Resultado (unanimidade ou maioria)", NAO_DISPONIVEL],
              ]}
            />
            {c ? (
              <div className="space-y-3">
                <ListaLiteral
                  itens={c.ressalvas}
                  um="ressalva"
                  varios="ressalvas"
                  explicacao="Problemas apontados que não impediram a conclusão do parecer, com os grupos e números do documento."
                />
                <ListaLiteral itens={c.alertas} um="alerta" varios="alertas" explicacao="Avisos formais do tribunal ao Poder Executivo federal." />
                <ListaLiteral itens={c.recomendacoes ?? []} um="recomendação" varios="recomendações" />
                <ListaLiteral itens={c.determinacoes ?? []} um="determinação" varios="determinações" />
                <p className="text-base text-[var(--cor-secundaria)]">
                  Texto copiado literalmente do inteiro teor oficial do acórdão
                  {c.documento?.acessado_em ? `, consultado em ${formatarDataTc(c.documento.acessado_em)}` : ""}.
                </p>
                {c.documento?.url ? (
                  <p>
                    <FonteLink href={c.documento.url} tipo="pdf" className="text-base!">
                      <TextoComSiglas explicar={false}>{c.documento.titulo}</TextoComSiglas>
                    </FonteLink>
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="lacuna text-base">Ressalvas e alertas literais deste parecer ainda não foram copiados do documento oficial.</p>
            )}
          </>
        ) : (
          <p className="lacuna text-base">Acórdão do TCU sobre este exercício: {NAO_DISPONIVEL.toLowerCase()} nos dados coletados.</p>
        )}
      </Sub>
      <Sub id={`exercicio-${e.exercicio}-julgamento`} titulo="Detalhes do julgamento político no Congresso Nacional">
        <JulgamentoCongressoBloco jp={e.julgamento_politico} />
      </Sub>
      <Sub titulo="O que a fonte oficial não informa">
        <Lacunas lacunas={[e.lacunas, c?.lacunas, e.julgamento_politico?.lacunas]} />
      </Sub>
      <Recolhivel resumo="Fontes deste exercício">
        <Fontes
          fontes={[
            e.julgamento_politico?.fonte,
            c?.documento ? { ...c.documento, orgao: "Tribunal de Contas da União" } : null,
            a
              ? {
                  titulo: `Acórdão ${a.numero} — pesquisa de jurisprudência do TCU`,
                  url: a.url,
                  orgao: "Tribunal de Contas da União",
                  acessado_em: e.julgamento_politico?.fonte?.acessado_em,
                }
              : null,
          ]}
        />
      </Recolhivel>
    </ItemLinha>
  );
}

/* ---------- Parecer de tribunal de contas estadual (Governador) ---------- */

function divergemRelator(p: ParecerPrevioTce): boolean {
  return p.lacunas.some((l) => typeof l === "string" && /relator diverge/i.test(l));
}

export function ExercicioGovernadorItem({ p, o }: { p: ParecerPrevioTce; o: OrgaoTc }) {
  const par = p.parecer;
  const det = p.determinacoes_e_recomendacoes;
  const votacao = p.votacoes?.[0];
  const docs = p.documentos ?? [];
  // Nome e sigla da Assembleia (ou da Câmara Legislativa do DF) pelo cadastro das UFs.
  const legislativo = getUf(o.uf)?.casa;
  const casa = legislativo?.nome ?? "Assembleia Legislativa";
  const siglaCasa = legislativo?.sigla ?? "Assembleia Legislativa";
  const contasDe = `do Governador${o.uf ? ` ${deUf(o.uf)}` : ""}`;
  const cartoes = [
    { ...cartaoParecerTce(p, o, tituloGovernador(p, o), contasDe), simples: tituloSimplesTc(p.id) },
    cartaoJulgamentoAlesp(par.exercicio, p.julgamento_politico, casa, siglaCasa),
  ];
  if (!p.data_julgamento && !par.conclusao) {
    // Parecer ainda não publicado: só o que a fonte registra, sem ficha vazia.
    return (
      <ItemLinha id={`exercicio-${par.exercicio}`} titulo={`Exercício de ${par.exercicio}`} cartoes={cartoes.slice(0, 1)}>
        <Lacunas lacunas={[p.lacunas, p.julgamento_politico?.lacunas]} />
        <Fontes fontes={[...p.fontes, p.julgamento_politico?.fonte]} />
      </ItemLinha>
    );
  }
  return (
    <ItemLinha id={`exercicio-${par.exercicio}`} titulo={`Exercício de ${par.exercicio}`} cartoes={cartoes}>
      <Sub
        id={`exercicio-${par.exercicio}-parecer`}
        titulo={`Detalhes do parecer prévio do ${o.id.toUpperCase()}: ressalvas, determinações e relator`}
      >
        <Ficha
          itens={[
            ["Data do julgamento", formatarDataTc(p.data_julgamento)],
            ["Colegiado", p.orgao ?? NAO_DISPONIVEL],
            ["Sessão", p.sessao_literal ?? NAO_DISPONIVEL],
            ["Processo", p.processo?.numero ?? NAO_DISPONIVEL],
            ["Relator", p.relator ?? NAO_DISPONIVEL],
            ["Presidente da sessão", votacao?.presidente ? nomeProprio(votacao.presidente) : NAO_DISPONIVEL],
            ["Resultado (unanimidade ou maioria)", NAO_DISPONIVEL],
            ["Publicação do parecer", formatarDataTc(p.data_publicacao)],
          ]}
        />
        <ListaLiteral
          itens={par.ressalvas}
          um="ressalva"
          varios="ressalvas"
          explicacao={par.ressalvas_fonte ? `Texto oficial do documento “${par.ressalvas_fonte.documento}”.` : undefined}
        />
        <ListaLiteral itens={par.alertas} um="alerta" varios="alertas" />
        {det?.itens.length ? (
          <ListaLiteral
            itens={det.itens}
            um="item de determinações e recomendações"
            varios="itens de determinações e recomendações"
            explicacao={`Lista numerada do documento “${det.documento}”, na ordem publicada (títulos de grupo incluídos).`}
          />
        ) : null}
        {votacao?.votantes_literal ? <Literal fonte="Quem votou, segundo a decisão (texto oficial)">{votacao.votantes_literal}</Literal> : null}
        {p.relator_registros?.length ? (
          <div>
            <h4 className="text-base font-semibold text-gray-900">Relator segundo cada documento oficial</h4>
            <RegistrosRelator registros={p.relator_registros} divergem={divergemRelator(p)} />
          </div>
        ) : null}
        {p.certidao_literal ? (
          <Recolhivel resumo="Texto completo da decisão">
            <p className="text-base leading-relaxed text-gray-900">{p.certidao_literal}</p>
          </Recolhivel>
        ) : null}
        {docs.length ? (
          <Recolhivel resumo={`${plural(docs.length, "documento oficial", "documentos oficiais")} do processo`}>
            <ul className="space-y-2">
              {docs.map((d) => (
                <li key={d.url} className="text-base">
                  <FonteLink href={d.url} tipo={/\.pdf($|\?)/i.test(d.url) ? "pdf" : "oficial"} className="text-base!">
                    <TextoComSiglas explicar={false}>{d.titulo}</TextoComSiglas>
                  </FonteLink>
                  {d.tamanho ? <span className="text-[var(--cor-secundaria)]"> ({d.tamanho})</span> : null}
                </li>
              ))}
            </ul>
          </Recolhivel>
        ) : null}
      </Sub>
      <Sub
        id={`exercicio-${par.exercicio}-julgamento`}
        titulo={`Detalhes do julgamento político na ${siglaCasa}`}
      >
        <JulgamentoAlespBloco jp={p.julgamento_politico} />
      </Sub>
      <Sub titulo="O que a fonte oficial não informa">
        <Lacunas lacunas={[p.lacunas, p.julgamento_politico?.lacunas]} />
      </Sub>
      <Recolhivel resumo="Fontes deste exercício">
        <Fontes fontes={[...p.fontes, p.julgamento_politico?.fonte]} />
      </Recolhivel>
    </ItemLinha>
  );
}

/* ---------- Parecer sobre as contas do Prefeito ---------- */

/**
 * Âncora de cada parecer na página do município. Quando dois pareceres dividem o exercício
 * (vários responsáveis ou novo julgamento), o segundo ganha sufixo: exercicio-2020-2.
 */
export function ancorasExercicio(itens: ParecerPrevioTce[]): Map<string, string> {
  const vistos = new Map<string, number>();
  const ancoras = new Map<string, string>();
  for (const p of itens) {
    const n = (vistos.get(p.parecer.exercicio) ?? 0) + 1;
    vistos.set(p.parecer.exercicio, n);
    ancoras.set(p.id, `exercicio-${p.parecer.exercicio}${n > 1 ? `-${n}` : ""}`);
  }
  return ancoras;
}

export function ExercicioPrefeitoItem({ p, o, municipio, ancora }: { p: ParecerPrevioTce; o: OrgaoTc; municipio: string; ancora?: string }) {
  const par = p.parecer;
  const id = ancora ?? `exercicio-${par.exercicio}`;
  const nLac = new Set(p.lacunas).size;
  const lacunasEFontes = (
    <Recolhivel resumo={`O que a fonte oficial não informa (${nLac}) e fontes`}>
      <div className="space-y-4">
        <Lacunas lacunas={[p.lacunas]} />
        <Fontes fontes={p.fontes} />
      </div>
    </Recolhivel>
  );
  if (!par.conclusao) {
    // Sem parecer em fonte aberta: a primeira lacuna explica o motivo; o resto fica recolhido.
    const motivo = p.lacunas.find((l): l is string => typeof l === "string");
    return (
      <ItemLinha
        id={id}
        titulo={`Exercício de ${par.exercicio}`}
        cartoes={[cartaoParecerTce(p, o, tituloPrefeito(p, municipio), `do Prefeito de ${municipio}`)]}
      >
        {motivo ? <p className="lacuna text-base">{motivo}</p> : null}
        {lacunasEFontes}
      </ItemLinha>
    );
  }
  return (
    <ItemLinha
      id={id}
      titulo={`Exercício de ${par.exercicio}`}
      cartoes={[cartaoParecerTce(p, o, tituloPrefeito(p, municipio), `do Prefeito de ${municipio}`)]}
    >
      <Sub id={`${id}-parecer`} titulo="Detalhes do parecer: processo, relator e ressalvas">
        <Ficha
          itens={[
            ["Parecer (texto da fonte oficial)", par.conclusao],
            ["Processo", p.processo?.numero ?? NAO_DISPONIVEL],
            ["Data do julgamento", formatarDataTc(p.data_julgamento)],
            ["Trânsito em julgado", formatarDataTc(p.data_transito_em_julgado)],
            ["Relator", p.relator ?? NAO_DISPONIVEL],
            ["Julgamento pela Câmara Municipal", p.julgamento_politico ? "Registrado nos dados coletados" : "Não localizado nos dados coletados"],
          ]}
        />
        <ListaLiteral itens={par.ressalvas} um="ressalva" varios="ressalvas" />
        {p.link_voto_na_fonte ? (
          <p className="text-base text-[var(--cor-secundaria)]">
            Link do voto informado pela fonte oficial:{" "}
            <FonteLink href={p.link_voto_na_fonte} tipo="pdf" className="text-base!">
              voto do relator
            </FonteLink>
          </p>
        ) : null}
      </Sub>
      {lacunasEFontes}
    </ItemLinha>
  );
}

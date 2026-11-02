import Link from "next/link";
import type { ReactNode } from "react";
import { FonteLink } from "@/components/FonteLink";
import type { ExercicioPresidente, OrgaoTc, ParecerPrevioTce } from "../tipos";
import { BASE_TC, NAO_DISPONIVEL, deUf, formatarDataTc, nomeProprio, plural, resumoParecerTce, resumoParecerTcu } from "../rotulos";
import { Fontes, Ficha, Lacunas, Literal, Recolhivel } from "./Basicos";
import { JulgamentoAlespBloco, JulgamentoCongressoBloco } from "./JulgamentoPolitico";
import { ListaLiteral, RegistrosRelator } from "./Literais";

export function tituloPresidente(e: ExercicioPresidente): string {
  const r = resumoParecerTcu(e.curadoria?.conclusao ?? e.conclusao_parecer);
  return `Contas do Presidente de ${e.exercicio}: ${r ?? "parecer prévio não disponível nos dados coletados"}`;
}

export function tituloGovernador(p: ParecerPrevioTce, o: Pick<OrgaoTc, "uf">): string {
  const r = resumoParecerTce(p.parecer);
  return `Contas do Governador ${deUf(o.uf)} de ${p.parecer.exercicio}: ${r ?? (p.data_julgamento ? "parecer prévio emitido" : "parecer prévio não publicado até a coleta")}`.replace(/\s+/g, " ");
}

export function tituloPrefeito(p: ParecerPrevioTce, municipio: string): string {
  const r = resumoParecerTce(p.parecer);
  return `Contas do Prefeito de ${municipio} de ${p.parecer.exercicio}: ${r ?? "parecer não disponível em fonte aberta"}`;
}

/** Item da linha do tempo (um exercício), com âncora própria. */
function ItemLinha({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <li id={id} className="relative scroll-mt-20 border-l-4 border-[#9aa5b1] pb-2 pl-4 md:pl-6">
      <span aria-hidden="true" className="absolute -left-[0.6rem] top-1.5 h-4 w-4 rounded-full border-4 border-white bg-acento" />
      <article aria-labelledby={`${id}-t`} className="space-y-5">
        <h2 id={`${id}-t`} className="text-xl font-bold text-gray-900">
          {titulo}
        </h2>
        {children}
      </article>
    </li>
  );
}

function Sub({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">{titulo}</h3>
      {children}
    </section>
  );
}

/* ---------- Contas do Presidente (TCU + Congresso) ---------- */

export function ExercicioPresidenteItem({ e, orgao }: { e: ExercicioPresidente; orgao: string }) {
  const c = e.curadoria;
  const a = e.acordao;
  const conclusao = c?.conclusao ?? e.conclusao_parecer;
  return (
    <ItemLinha id={`exercicio-${e.exercicio}`} titulo={tituloPresidente(e)}>
      <Sub titulo="Parecer prévio do Tribunal de Contas da União (TCU)">
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
            {conclusao ? <Literal fonte="Conclusão do parecer (texto oficial)">{conclusao}</Literal> : null}
            {c ? (
              <div className="space-y-3">
                <ListaLiteral itens={c.ressalvas} um="ressalva" varios="ressalvas" explicacao="Problemas apontados que não impediram a conclusão do parecer, com os grupos e números do documento." />
                <ListaLiteral itens={c.alertas} um="alerta" varios="alertas" explicacao="Avisos formais do tribunal ao Poder Executivo federal." />
                <ListaLiteral itens={c.recomendacoes ?? []} um="recomendação" varios="recomendações" />
                <ListaLiteral itens={c.determinacoes ?? []} um="determinação" varios="determinações" />
                <p className="text-base text-[#3e4c59]">
                  Texto copiado literalmente do inteiro teor oficial do acórdão
                  {c.documento?.acessado_em ? `, consultado em ${formatarDataTc(c.documento.acessado_em)}` : ""}.
                </p>
                {c.documento?.url ? (
                  <p>
                    <FonteLink href={c.documento.url} tipo="pdf" className="text-base!">
                      {c.documento.titulo}
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
      <Sub titulo="Julgamento político: Congresso Nacional">
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
            a ? { titulo: `Acórdão ${a.numero} — pesquisa de jurisprudência do TCU`, url: a.url, orgao: "Tribunal de Contas da União", acessado_em: e.julgamento_politico?.fonte?.acessado_em } : null,
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
  const casa = o.uf === "SP" ? "Assembleia Legislativa do Estado de São Paulo (ALESP)" : "Assembleia Legislativa";
  if (!p.data_julgamento && !par.conclusao) {
    // Parecer ainda não publicado: só o que a fonte registra, sem ficha vazia.
    return (
      <ItemLinha id={`exercicio-${par.exercicio}`} titulo={tituloGovernador(p, o)}>
        <Lacunas lacunas={[p.lacunas, p.julgamento_politico?.lacunas]} />
        <Fontes fontes={[...p.fontes, p.julgamento_politico?.fonte]} />
      </ItemLinha>
    );
  }
  return (
    <ItemLinha id={`exercicio-${par.exercicio}`} titulo={tituloGovernador(p, o)}>
      <Sub titulo={`Parecer prévio do ${o.nome} (${o.id.toUpperCase()})`}>
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
        {par.conclusao_literal ? <Literal fonte="Conclusão da decisão do Tribunal Pleno (texto oficial)">{par.conclusao_literal}</Literal> : null}
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
        {votacao?.votantes_literal ? (
          <Literal fonte="Quem votou, segundo a decisão (texto oficial)">{votacao.votantes_literal}</Literal>
        ) : null}
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
                    {d.titulo}
                  </FonteLink>
                  {d.tamanho ? <span className="text-[#3e4c59]"> ({d.tamanho})</span> : null}
                </li>
              ))}
            </ul>
          </Recolhivel>
        ) : null}
      </Sub>
      <Sub titulo={`Julgamento político: ${casa}`}>
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

export function ExercicioPrefeitoItem({ p, municipio }: { p: ParecerPrevioTce; municipio: string }) {
  const par = p.parecer;
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
      <ItemLinha id={`exercicio-${par.exercicio}`} titulo={tituloPrefeito(p, municipio)}>
        {motivo ? <p className="lacuna text-base">{motivo}</p> : null}
        {lacunasEFontes}
      </ItemLinha>
    );
  }
  return (
    <ItemLinha id={`exercicio-${par.exercicio}`} titulo={tituloPrefeito(p, municipio)}>
      <Ficha
        itens={[
          ["Parecer (texto do conjunto de dados oficial)", par.conclusao],
          ["Processo", p.processo?.numero ?? NAO_DISPONIVEL],
          ["Data do julgamento", formatarDataTc(p.data_julgamento)],
          ["Trânsito em julgado", formatarDataTc(p.data_transito_em_julgado)],
          ["Relator", p.relator ?? NAO_DISPONIVEL],
          ["Julgamento pela Câmara Municipal", p.julgamento_politico ? "Registrado nos dados coletados" : "Não localizado nos dados coletados"],
        ]}
      />
      <ListaLiteral itens={par.ressalvas} um="ressalva" varios="ressalvas" />
      {p.link_voto_na_fonte ? (
        <p className="text-base text-[#3e4c59]">
          Link do voto informado pelo conjunto de dados oficial:{" "}
          <FonteLink href={p.link_voto_na_fonte} tipo="pdf" className="text-base!">
            voto do relator
          </FonteLink>
        </p>
      ) : null}
      {lacunasEFontes}
    </ItemLinha>
  );
}

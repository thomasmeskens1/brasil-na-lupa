import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FonteLink } from "@/components/FonteLink";
import { Figurinha } from "@/components/marca/Figurinhas";
import { Secao } from "@/components/Secao";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { Migalhas } from "@/features/executivo/componentes/Migalhas";
import { formatarData } from "@/features/estados/rotulos";
import { getUf } from "@/features/estados/ufs";
import { BuscaCamara } from "@/features/municipios/componentes/BuscaCamara";
import { ConteudoAtibaia } from "@/features/municipios/componentes/ConteudoAtibaia";
import { FinancasSiconfi } from "@/features/municipios/componentes/FinancasSiconfi";
import { baseCidade, getCidade, getIndiceMunicipios, ouMarcador } from "@/features/municipios/dados";
import { TERMOS_MUNICIPIOS } from "@/features/municipios/termos";
import type { CidadeMun, FonteMunicipio } from "@/features/municipios/tipos";

const NAO = "Informação não disponível em fonte oficial";
const FORMA: Record<string, string> = { nominal: "Votação nominal", simbolica: "Votação simbólica", secreta: "Votação secreta" };

export function generateStaticParams() {
  return ouMarcador(
    getIndiceMunicipios().presentes.map((m) => ({ uf: m.uf, cidade: m.slug })),
    { uf: "xx", cidade: "sem-dados" },
  );
}

function nomeComUf(c: CidadeMun): string {
  return `${c.nome} (${c.uf.toUpperCase()})`;
}

export async function generateMetadata({ params }: PageProps<"/municipios/[uf]/[cidade]">): Promise<Metadata> {
  const { uf, cidade } = await params;
  const c = getCidade(uf, cidade);
  if (!c) return { title: "Município não encontrado" };
  return {
    title: nomeComUf(c),
    description: `${c.nome}: Câmara Municipal, leis e finanças do município com fonte oficial e data da coleta.`,
    alternates: { canonical: baseCidade(c.uf, c.slug) },
  };
}

function SecaoFinancas({ c, titulo }: { c: CidadeMun; titulo: string }) {
  return (
    <Secao
      id="financas-siconfi"
      titulo={titulo}
      descricao="Receitas e despesas que a própria prefeitura declara ao Tesouro Nacional no Relatório Resumido da Execução Orçamentária, copiadas sem cálculo. Os valores incluem Prefeitura e Câmara (o relatório é do município inteiro)."
    >
      <FinancasSiconfi relatorios={c.financas} />
    </Secao>
  );
}

export default async function CidadePage({ params }: PageProps<"/municipios/[uf]/[cidade]">) {
  const { uf, cidade } = await params;
  const c = getCidade(uf, cidade);
  if (!c) notFound();
  const u = getUf(c.uf);
  const migalhas = <Migalhas itens={[{ href: "/municipios", rotulo: "Municípios" }]} />;

  if (c.atibaia) return <ConteudoAtibaia antes={migalhas} depois={<SecaoFinancas c={c} titulo="Finanças declaradas ao Tesouro Nacional (Siconfi)" />} />;

  const cam = c.camara;
  const base = baseCidade(c.uf, c.slug);
  const casa = cam?.nome ?? c.sapl?.casa ?? `Câmara Municipal de ${c.nome}`;
  const nominais = cam?.votacoes.filter((v) => v.tipo === "nominal" && v.n_votos > 0).length ?? 0;
  const fontes: FonteMunicipio[] = [
    ...(cam?.fontes ?? []),
    ...(c.financas.length && c.financas_fonte ? [c.financas_fonte] : []),
    ...(c.registro_fonte ? [c.registro_fonte] : []),
    ...(c.populacao_fonte ? [c.populacao_fonte] : []),
  ];

  return (
    <div className="space-y-10">
      {migalhas}
      <header className="max-w-3xl">
        <Figurinha nome="cidade" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{nomeComUf(c)}</h1>
        <p>
          Município {u ? `do ${u.uf === "df" ? "Distrito Federal" : `estado ${u.de}`}` : ""}
          {c.capital ? ", capital do estado" : ""}
          {c.populacao ? `, com ${c.populacao.toLocaleString("pt-BR")} habitantes segundo o cadastro do Siconfi${c.populacao_exercicio ? ` para ${c.populacao_exercicio}` : ""}` : ""}. As leis são votadas
          pela {casa} e sancionadas ou vetadas pelo prefeito, que também decide sozinho, por decreto.
        </p>
      </header>

      <Secao id="camara" titulo="Câmara Municipal">
        {cam ? (
          <div className="space-y-6">
            <p className="text-sm">
              Dados da API pública do SAPL da {casa}, coletados aos poucos (no máximo uma consulta por minuto, respeitando as regras de acesso do site)
              {cam.periodo?.inicio ? `, a partir de ${formatarData(cam.periodo.inicio)}` : ""}. Última coleta em {formatarData(cam.atualizado_em)}.
              Enquanto a coleta não termina, as listas podem estar incompletas.
            </p>
            <dl className="flex flex-wrap gap-2" aria-label="Contagens coletadas">
              {[
                ["Vereadores na legislatura", cam.vereadores.length],
                ["Votações", cam.votacoes.length],
                ["Votações nominais com votos", nominais],
                ["Proposições", cam.proposicoes.total],
                ["Leis e normas", cam.normas.total],
              ].map(([r, v]) => (
                <div key={r} className="pilula-numero">
                  <dt>{r}</dt>
                  <dd className="font-bold text-foreground">{Number(v).toLocaleString("pt-BR")}</dd>
                </div>
              ))}
            </dl>

            <div>
              <h3 className="text-base font-semibold text-foreground">Vereadores, em ordem alfabética</h3>
              {cam.legislatura ? <p className="meta">{cam.legislatura.numero}ª legislatura, de {formatarData(cam.legislatura.inicio)} a {formatarData(cam.legislatura.fim)}, como registrado no SAPL.</p> : null}
              {cam.vereadores.length ? (
                <ul className="mt-2 divide-y divide-borda rounded border border-borda">
                  {cam.vereadores.map((v) => (
                    <li key={v.id} className="flex flex-wrap justify-between gap-x-3 px-3 py-2 text-sm">
                      {v.url_oficial ? (
                        <a href={v.url_oficial} className="lk font-medium" rel="noopener noreferrer" target="_blank">
                          {v.nome}
                        </a>
                      ) : (
                        <span className="font-medium text-foreground">{v.nome}</span>
                      )}
                      <span>
                        {v.partido ?? "Partido não informado no SAPL"}
                        {v.em_exercicio === false ? " · fora do exercício" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="lacuna mt-2 text-sm">Lista de vereadores ainda não coletada.</p>
              )}
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground">Votações mais recentes</h3>
              {cam.votacoes.length ? (
                <ul className="mt-2 space-y-3">
                  {cam.votacoes.slice(0, 5).map((v) => (
                    <li key={v.id} className="cartao space-y-1">
                      <p className="meta">
                        {formatarData(v.data)} · {v.tipo ? FORMA[v.tipo] : "Tipo de votação não informado"}
                      </p>
                      <p className="font-semibold text-foreground">{v.proposicao?.ementa ?? v.descricao ?? "Item sem descrição na fonte"}</p>
                      <p className="text-sm">Resultado (texto oficial): {v.resultado_oficial ?? NAO}</p>
                      <Link href={`${base}/votacoes/${v.id}`} className="lk inline-flex min-h-11 items-center">
                        {v.tipo === "nominal" && v.n_votos ? "Ver como votou cada vereador" : "Ver detalhes da votação"}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="lacuna mt-2 text-sm">Nenhuma votação coletada até agora.</p>
              )}
            </div>

            <div>
              <h3 className="text-base font-semibold text-foreground">Buscar proposições, votações e leis</h3>
              <p className="meta">Leis e outras normas cadastradas pela Câmara no SAPL (leis, resoluções e, quando a Câmara cadastra, decretos).</p>
              <div className="mt-3">
                <BuscaCamara uf={c.uf} cidade={c.slug} casa={casa} />
              </div>
            </div>
          </div>
        ) : c.sapl ? (
          <div className="cartao space-y-2">
            <p className="font-semibold text-foreground">Em breve.</p>
            <p>
              A {casa} usa o SAPL, segundo a lista oficial do Interlegis, e a coleta das votações e projetos ainda não começou.
              {c.sapl.verificacao?.em
                ? ` Na verificação de ${formatarData(c.sapl.verificacao.em)}, a consulta pública ${c.sapl.verificacao.api_responde ? "respondeu" : "não respondeu"}${c.sapl.verificacao.api_responde && c.sapl.verificacao.votos_nominais_publicados != null ? ` e ${c.sapl.verificacao.votos_nominais_publicados ? "há" : "não há"} votos de vereadores publicados` : ""}.`
                : ""}
            </p>
            <FonteLink href={c.sapl.url} tipo="oficial">
              SAPL da {casa}
            </FonteLink>
          </div>
        ) : (
          <p className="lacuna text-sm">
            Em breve. A Câmara Municipal não consta da lista oficial do Interlegis de Câmaras com SAPL; votações e projetos em
            formato aberto: {NAO}.
          </p>
        )}
      </Secao>

      <Secao id="prefeitura" titulo="Leis e decretos do prefeito">
        <p className="lacuna text-sm">Em breve. Ainda não coletamos o diário oficial deste município.</p>
      </Secao>

      <SecaoFinancas c={c} titulo="Finanças do município" />

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={TERMOS_MUNICIPIOS} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes fontes={fontes.map((f) => ({ ...f, titulo: f.titulo ?? f.url }))} />
      </Secao>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { metadadosCompartilhamento } from "@/components/compartilhar/metadados";
import { FichaTecnica } from "@/components/decisao/FichaTecnica";
import { resolverTitulo } from "@/components/decisao/rotulos";
import { Secao } from "@/components/Secao";
import { TabelaFiltravel, type LinhaDados } from "@/components/tabela/TabelaFiltravel";
import { getIndice, getParlamentar, votosDoParlamentar } from "@/features/congresso/dados";
import { ListaFontes, TermosExplicados } from "@/features/congresso/componentes/Basicos";
import { Cracha } from "@/features/congresso/componentes/Cracha";
import { GastosCota } from "@/features/congresso/componentes/GastosCota";
import { PresencaDeputado } from "@/features/congresso/componentes/PresencaDeputado";
import { cotaDoDeputado, presencaDoDeputado } from "@/features/congresso/dados-camara";
import { propPorExtenso, tituloOficialVotacao } from "@/features/congresso/lista";
import { contagemNominais, resumoGastos, resumoPresenca } from "@/features/congresso/resumo-parlamentar";
import {
  CASAS,
  CASA_MEMBROS,
  CASA_NOME,
  OPCOES_DE_VOTO,
  TERMOS,
  compararVotos,
  ehCasa,
  formatarData,
  rotaVotacao,
  rotuloResultadoCurto,
  rotuloVoto,
} from "@/features/congresso/rotulos";
import { tituloSimplesVotacao } from "@/features/congresso/titulos";
import { Favoritar } from "@/components/reacoes";
import { idParlamentar } from "@/features/conta/ids";
import { ouPrimeiro } from "@/features/comum/prerender";
import { fotoOficial } from "@/features/comum/fotos";

/**
 * Há perfil de todos os parlamentares da lista oficial e de quem aparece em votação nominal.
 * No build, só os em exercício (lista oficial atual); os demais são gerados na primeira visita.
 */
export function generateStaticParams() {
  return CASAS.flatMap((casa) => {
    const todos = getIndice(casa).parlamentares;
    const atuais = ouPrimeiro(todos.filter((p) => p.na_lista_atual || p.em_exercicio), todos);
    // Câmara: cada perfil tem centenas de votações (~780 KB); no build só o primeiro, os demais na
    // primeira visita (cache até o próximo deploy), para não multiplicar o armazenamento de cada deploy.
    return (casa === "camara" ? atuais.slice(0, 1) : atuais).map((p) => ({ casa, id: p.id }));
  });
}

/** Id fora do build: a primeira visita espera a página completa (e o 404 do id inexistente). */
export const ensureStatic = "navigation";

function carregar(casa: string, id: string) {
  if (!ehCasa(casa)) return null;
  const p = getParlamentar(casa, decodeURIComponent(id));
  return p ? { casa, p } : null;
}

export async function generateMetadata({ params }: PageProps<"/congresso/[casa]/parlamentares/[id]">): Promise<Metadata> {
  const { casa, id } = await params;
  const r = carregar(casa, id);
  if (!r) return { title: "Parlamentar não encontrado" };
  const ind = getIndice(r.casa);
  return metadadosCompartilhamento({
    titulo: `${r.p.nome} (${r.p.partido ?? "partido não informado"}-${r.p.uf ?? "UF não informada"}), ${CASA_MEMBROS[r.casa].singular.toLowerCase()}`,
    descricao: [
      `Votos nas votações nominais do ${CASA_NOME[r.casa]}${r.casa === "camara" ? ", presença em Plenário e gastos da cota parlamentar" : ""}`,
      `Fonte: ${CASA_NOME[r.casa]}`,
      `coletado em ${formatarData(ind.atualizado_em)}`,
    ],
    caminho: `/congresso/${r.casa}/parlamentares/${encodeURIComponent(r.p.id)}`,
  });
}

export default async function ParlamentarPage({ params }: PageProps<"/congresso/[casa]/parlamentares/[id]">) {
  const { casa: c, id } = await params;
  const r = carregar(c, id);
  if (!r) notFound();
  const { casa, p } = r;
  const ind = getIndice(casa);
  const m = CASA_MEMBROS[casa];
  const votos = votosDoParlamentar(casa, p.id);
  const nominais = contagemNominais(casa, p.id);

  const contagem = new Map<string, number>();
  for (const v of votos) {
    const k = v.voto ?? "Registro não informado";
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  const chaves = [...contagem.keys()].sort(compararVotos);

  const linhas: LinhaDados[] = votos.map(({ votacao: v, voto }) => ({
    k: v.id,
    titulo: resolverTitulo({
      tituloOficial: tituloOficialVotacao({ proposicao: v.proposicao?.titulo ?? null, descricao: v.descricao ?? "" }),
      simples: tituloSimplesVotacao(casa, v.id),
      subtituloOficial: propPorExtenso(v.proposicao?.titulo),
    }).titulo,
    href: rotaVotacao(casa, v.id),
    data: formatarData(v.data),
    ano: v.data?.slice(0, 4) ?? null,
    voto: rotuloVoto(voto),
    resultado: rotuloResultadoCurto(v.resultado),
  }));

  const termos = [
    TERMOS.abstencao,
    TERMOS.obstrucao,
    casa === "camara" ? TERMOS.artigo17 : TERMOS.artigo51,
    ...(casa === "camara" ? [TERMOS.sessaoDeliberativa, TERMOS.ceap] : []),
  ];
  const presenca = casa === "camara" ? presencaDoDeputado(p.id) : [];
  const cota = casa === "camara" ? cotaDoDeputado(p.id) : [];

  return (
    <div className="space-y-8">
      <nav aria-label="Você está em" className="meta">
        <Link href="/congresso" className="lk inline-flex min-h-11 items-center">
          Congresso
        </Link>
        {" › "}
        <Link href={m.rota} className="lk inline-flex min-h-11 items-center">
          {m.plural}
        </Link>
      </nav>

      <Cracha casa={casa} p={p} nominais={nominais} presenca={resumoPresenca(casa, p.id)} gastos={resumoGastos(casa, p.id)} foto={fotoOficial(casa, p.id)} />
      <Favoritar tipo="politico" valor={idParlamentar(casa, p.id)} nome={casa === "camara" ? "este deputado" : "este senador"} />

      <Secao
        id="votos"
        titulo="Como votou nas votações nominais"
        descricao={`Há registro em ${nominais.comRegistro} das ${nominais.total} votações nominais coletadas ${
          casa === "camara" ? "da Câmara" : "do Senado"
        }. Votações simbólicas e secretas não têm voto individual e não entram aqui.`}
      >
        {votos.length ? (
          <div className="space-y-4">
            <dl className="flex flex-wrap gap-2" aria-label="Registros por tipo">
              {chaves.map((k) => (
                <div key={k} className="min-w-[6rem] rounded border border-borda bg-superficie px-3 py-2 text-center">
                  <dt className="text-sm text-[var(--cor-secundaria)]">{rotuloVoto(k)}</dt>
                  <dd className="text-xl font-bold tabular-nums">{contagem.get(k)}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm">
              {chaves.some((k) => !OPCOES_DE_VOTO.has(k)) ? "Além de Sim, Não, Abstenção e Obstrução, aparecem os outros registros oficiais. " : ""}
              {casa === "camara"
                ? "A lista oficial de votos da Câmara traz só quem registrou voto: ausências não aparecem nela."
                : "A lista oficial do Senado traz também registros de ausência, licença, missão e presença sem voto."}
            </p>
            <TabelaFiltravel
              legenda={`Votos de ${p.nome}, da votação mais recente para a mais antiga`}
              chave="k"
              linhas={linhas}
              colunas={[
                { chave: "titulo", rotulo: "Votação", principal: true, link: "href" },
                { chave: "data", rotulo: "Data" },
                { chave: "voto", rotulo: "Voto" },
                { chave: "resultado", rotulo: "Resultado" },
              ]}
              busca={{ chaves: ["titulo"], rotulo: "Buscar pelo assunto da votação" }}
              filtros={[
                { chave: "voto", rotulo: "Voto", ordem: ["Sim", "Não", "Abstenção", "Obstrução"] },
                { chave: "ano", rotulo: "Ano" },
                { chave: "resultado", rotulo: "Resultado" },
              ]}
              itens={{ singular: "votação", plural: "votações" }}
              porPagina={25}
            />
          </div>
        ) : (
          <p className="lacuna">Nenhum registro em votação nominal coletada.</p>
        )}
      </Secao>

      {casa === "camara" ? (
        <>
          <Secao
            id="presenca"
            titulo="Presença em Plenário"
            descricao="Frequência nas sessões deliberativas do Plenário da Câmara dos Deputados, como registrada pela própria Câmara."
          >
            <PresencaDeputado registros={presenca} urlOficial={p.url_oficial} />
          </Secao>
          <Secao id="cota" titulo="Gastos da cota parlamentar" descricao={TERMOS.ceap.explicacao}>
            <GastosCota id={p.id} anos={cota} />
          </Secao>
        </>
      ) : null}

      <FichaTecnica
        titulo="Dados cadastrais"
        itens={[
          { rotulo: "Nome civil", valor: p.nome_civil },
          { rotulo: "Bloco parlamentar", valor: p.bloco },
          { rotulo: "Mandato", valor: p.participacao },
          { rotulo: "E-mail institucional", valor: p.email ? <span className="[overflow-wrap:anywhere]">{p.email}</span> : null },
          { rotulo: "Lista oficial de em exercício", valor: p.na_lista_atual ? `consta (coletada em ${formatarData(ind.lista_atualizada_em)})` : "não consta" },
        ]}
      />

      <Secao id="termos" titulo="Termos explicados">
        <TermosExplicados termos={termos} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ListaFontes
          fontes={[...(ind.lista_fonte ? [ind.lista_fonte] : []), ...ind.fontes.filter((f) => /vota/i.test(f.titulo ?? "") || /vota/i.test(f.url))]}
        />
      </Secao>
    </div>
  );
}

import Link from "next/link";
import { CartaoDecisao, formatarData, rotuloCaminho, type Caminho } from "@/components/decisao";
import { ListaRecolhivel } from "@/components/lista";
import { ContadorAnimado } from "@/components/marca/ContadorAnimado";
import { Figurinha, SetaRabisco, Sublinhado } from "@/components/marca/Figurinhas";
import { getAgenda, proximasSessoes } from "@/features/agenda/dados";
import { SeusFavoritos } from "@/features/conta/componentes/SeusFavoritos";
import { cadastroAtivo } from "@/features/conta/config";
import { ItemSessao } from "@/features/agenda/Sessoes";
import { BuscaUnica } from "@/features/inicio/BuscaUnica";
import { DestaquesInicio } from "@/features/inicio/Destaques";
import { getDecisoesSemana, simplesSeAtivo } from "@/features/inicio/dados";
import { ListaSecoes } from "@/features/inicio/Secoes";
import { BuscaLocal } from "@/features/representantes/BuscaLocal";

/** Contagem neutra por tipo de decisão (ordem: mais frequente primeiro; empate, alfabética). */
function contarPorTipo(itens: { caminho: string }[]): [string, number][] {
  const m = new Map<string, number>();
  for (const d of itens) {
    const r = rotuloCaminho(d.caminho as Caminho);
    m.set(r, (m.get(r) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
}

export default function Home() {
  const dec = getDecisoesSemana();
  const agenda = getAgenda();
  const proximas = agenda ? proximasSessoes(agenda).slice(0, 4) : [];

  return (
    <div className="space-y-10">
      {/* Só com o cadastro ligado e só para quem tem sessão (carregado no navegador). */}
      {cadastroAtivo() ? <SeusFavoritos /> : null}
      <section aria-labelledby="titulo-home" className="heroi entrada">
        <p className="etiqueta-heroi">Política sem complicação, com fonte oficial</p>
        <h1 id="titulo-home" className="manchete mt-3 text-[2rem] leading-[1.05] md:text-6xl">
          O que estão votando e como isso <span className="destaque-neon">afeta seu bolso</span>
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[var(--cor-secundaria)]">
          Quem decidiu, como cada um votou e por quê. Cada informação traz o link do documento oficial e a data da coleta. O
          site não classifica votos, leis ou políticos: quem julga é você.
        </p>
        <div className="relative mt-6 max-w-2xl">
          <SetaRabisco className="pointer-events-none absolute -top-12 right-2 hidden h-14 w-20 sm:block" />
          <BuscaUnica />
        </div>
      </section>

      <section aria-labelledby="titulo-atalhos">
        <h2 id="titulo-atalhos" className="text-2xl">
          Por onde começar
        </h2>
        <Sublinhado className="mt-1 h-3 w-44" />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="bloco-atalho">
            <Figurinha nome="pino" className="figurinha-flutua h-14 w-14" />
            <h3 className="mt-2 font-titulo text-xl font-extrabold">
              <Link href="/quem-me-representa" className="lk-titulo">
                Quem me representa?
              </Link>
            </h3>
            <BuscaLocal rotulo="Sua cidade ou estado" />
          </div>
          <Link href="/congresso/deputados" className="bloco-atalho group">
            <Figurinha nome="congresso" className="figurinha-flutua h-14 w-14" />
            <span className="mt-2 block font-titulo text-xl font-extrabold">Como votou meu deputado?</span>
            <span className="mt-1 block text-[var(--cor-secundaria)]">
              Deputados federais em exercício, por estado, com o voto em cada votação nominal. Também senadores e deputados
              estaduais de SP.
            </span>
            <span className="seta-atalho" aria-hidden="true">→</span>
          </Link>
          <Link href="/impostos/icms" className="bloco-atalho group">
            <Figurinha nome="dinheiro" className="figurinha-flutua h-14 w-14" />
            <span className="mt-2 block font-titulo text-xl font-extrabold">O que mudou no ICMS?</span>
            <span className="mt-1 block text-[var(--cor-secundaria)]">
              Cada mudança do imposto sobre mercadorias e serviços (ICMS) que afeta São Paulo, com os valores antes e depois e
              quem decidiu.
            </span>
            <span className="seta-atalho" aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <DestaquesInicio />

      <section aria-labelledby="titulo-semana">
        <h2 id="titulo-semana" className="text-2xl">
          Decidido esta semana
        </h2>
        {dec ? (
          <>
            <p className="meta mt-1">
              De {formatarData(dec.periodo.inicio)} a {formatarData(dec.periodo.fim)}, em todas as esferas coletadas, da decisão
              mais recente para a mais antiga (ordem só pela data, sem seleção).
            </p>
            {dec.itens.length ? (
              <>
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Decisões da semana por tipo">
                {contarPorTipo(dec.itens).map(([rotulo, n]) => (
                  <li key={rotulo} className="pilula-numero">
                    <ContadorAnimado valor={n} className="font-titulo text-xl font-extrabold text-white-puro" /> {rotulo}
                  </li>
                ))}
              </ul>
              <ListaRecolhivel
                rotulo={{ singular: "decisão", plural: "decisões" }}
                inicial={6}
                className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2"
                itens={dec.itens.map((d) => (
                  <CartaoDecisao
                    key={d.id}
                    as="div"
                    href={d.href}
                    tituloOficial={d.tituloOficial}
                    simples={simplesSeAtivo(d.simples)}
                    subtituloOficial={d.subtitulo}
                    caminho={d.caminho}
                    rotuloCaminho={d.rotuloCaminho}
                    data={d.data}
                    rotuloData={d.rotuloData}
                    forma={d.forma}
                    dado={d.dado}
                    quemDecidiu={d.quemDecidiu ?? undefined}
                    fonte={d.fonte}
                  />
                ))}
              />
              </>
            ) : (
              <p className="lacuna mt-3">Nenhuma decisão registrada nas fontes coletadas neste período.</p>
            )}
          </>
        ) : (
          <p className="lacuna mt-3">Informação não disponível: as decisões da semana ainda não foram reunidas.</p>
        )}
      </section>

      <section aria-labelledby="titulo-sessoes">
        <h2 id="titulo-sessoes" className="text-2xl">
          Próximas sessões
        </h2>
        <p className="meta mt-1">Plenário da Câmara, do Senado e do Congresso, como marcado pelas casas. Não é tempo real.</p>
        {proximas.length ? (
          <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {proximas.map((s) => (
              <li key={s.id}>
                <ItemSessao s={s} compacto />
              </li>
            ))}
          </ul>
        ) : (
          <p className="lacuna mt-3">Nenhuma sessão marcada na agenda coletada.</p>
        )}
        <p className="mt-3">
          <Link href="/agenda" className="botao">
            Ver a agenda completa e a última pauta
          </Link>
        </p>
      </section>

      <section aria-labelledby="titulo-secoes">
        <h2 id="titulo-secoes" className="text-2xl">
          Seções disponíveis
        </h2>
        <ListaSecoes />
      </section>

      <p className="text-sm text-gray-800">
        Como as informações são reunidas:{" "}
        <Link href="/metodologia" className="lk">
          Metodologia
        </Link>
        .
      </p>
    </div>
  );
}

import Link from "next/link";
import { CartaoDecisao, formatarData } from "@/components/decisao";
import { ListaRecolhivel } from "@/components/lista";
import { getAgenda, proximasSessoes } from "@/features/agenda/dados";
import { ItemSessao } from "@/features/agenda/Sessoes";
import { BuscaUnica } from "@/features/inicio/BuscaUnica";
import { getDecisoesSemana, simplesSeAtivo } from "@/features/inicio/dados";
import { ListaSecoes } from "@/features/inicio/Secoes";
import { BuscaLocal } from "@/features/representantes/BuscaLocal";

const ATALHO = "cartao flex min-h-11 flex-col gap-1 hover:bg-[var(--cor-superficie)]";

export default function Home() {
  const dec = getDecisoesSemana();
  const agenda = getAgenda();
  const proximas = agenda ? proximasSessoes(agenda).slice(0, 4) : [];

  return (
    <div className="space-y-10">
      <section aria-labelledby="titulo-home" className="max-w-3xl">
        <h1 id="titulo-home" className="text-2xl font-bold text-gray-900 md:text-3xl">
          O que foi decidido, quem decidiu e por quê
        </h1>
        <p className="mt-2 leading-relaxed text-gray-800">
          Com a fonte oficial e a data da coleta em cada informação. O site não classifica votos, leis ou políticos: quem
          julga é o leitor.
        </p>
        <div className="mt-5">
          <BuscaUnica />
        </div>
      </section>

      <section aria-labelledby="titulo-atalhos">
        <h2 id="titulo-atalhos" className="text-xl font-bold text-gray-900">
          Por onde começar
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="cartao">
            <h3 className="text-base font-semibold">
              <Link href="/quem-me-representa" className="lk inline-flex min-h-11 items-center">
                Quem me representa?
              </Link>
            </h3>
            <BuscaLocal rotulo="Sua cidade ou estado" />
          </div>
          <Link href="/congresso/deputados" className={ATALHO}>
            <span className="text-base font-semibold text-[var(--cor-link)] underline underline-offset-2">Como votou meu deputado?</span>
            <span className="text-sm text-gray-800">
              Deputados federais em exercício, por estado, com o voto em cada votação nominal. Também:{" "}
              <span className="whitespace-nowrap">senadores e deputados estaduais de SP.</span>
            </span>
          </Link>
          <Link href="/impostos/icms" className={ATALHO}>
            <span className="text-base font-semibold text-[var(--cor-link)] underline underline-offset-2">O que mudou no ICMS?</span>
            <span className="text-sm text-gray-800">
              Cada mudança do Imposto sobre Circulação de Mercadorias e Serviços (ICMS) que afeta São Paulo, com os valores antes
              e depois e quem decidiu.
            </span>
          </Link>
        </div>
      </section>

      <section aria-labelledby="titulo-semana">
        <h2 id="titulo-semana" className="text-xl font-bold text-gray-900">
          Decidido esta semana
        </h2>
        {dec ? (
          <>
            <p className="meta mt-1">
              De {formatarData(dec.periodo.inicio)} a {formatarData(dec.periodo.fim)}, em todas as esferas coletadas, da decisão
              mais recente para a mais antiga (ordem só pela data, sem seleção).
            </p>
            {dec.itens.length ? (
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
            ) : (
              <p className="lacuna mt-3">Nenhuma decisão registrada nas fontes coletadas neste período.</p>
            )}
          </>
        ) : (
          <p className="lacuna mt-3">Informação não disponível: as decisões da semana ainda não foram reunidas.</p>
        )}
      </section>

      <section aria-labelledby="titulo-sessoes">
        <h2 id="titulo-sessoes" className="text-xl font-bold text-gray-900">
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
        <h2 id="titulo-secoes" className="text-xl font-bold text-gray-900">
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

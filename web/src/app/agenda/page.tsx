import type { Metadata } from "next";
import Link from "next/link";
import { FonteLink } from "@/components/FonteLink";
import { Secao } from "@/components/Secao";
import { formatarData } from "@/components/decisao";
import { ListaRecolhivel } from "@/components/lista";
import { Calendario } from "@/features/agenda/Calendario";
import { NOME_CASA, ORDEM_CASAS, getAgenda, proximasSessoes } from "@/features/agenda/dados";
import { ItemDaPauta, ItemSessao } from "@/features/agenda/Sessoes";
import { dataHoraBrasilia } from "@/features/inicio/dados";
import { Figurinha } from "@/components/marca/Figurinhas";

export const metadata: Metadata = {
  title: "Agenda do Plenário",
  description:
    "Sessões do Plenário da Câmara dos Deputados, do Senado Federal e do Congresso Nacional: calendário, próximas sessões e o desfecho oficial de cada item da última pauta.",
};

function meses(inicio: string, fim: string): string[] {
  const r: string[] = [];
  let [a, m] = inicio.slice(0, 7).split("-").map(Number);
  const [af, mf] = fim.slice(0, 7).split("-").map(Number);
  while (a < af || (a === af && m <= mf)) {
    r.push(`${a}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return r;
}

export default function AgendaPage() {
  const a = getAgenda();
  if (!a) {
    return (
      <div className="max-w-3xl">
        <Figurinha nome="calendario" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold">Agenda do Plenário</h1>
        <p className="lacuna mt-4">Informação não disponível em fonte oficial: a agenda ainda não foi coletada.</p>
      </div>
    );
  }
  const ref = a.periodo?.referencia ?? a.atualizado_em?.slice(0, 10) ?? "";
  const lista = a.periodo ? meses(a.periodo.inicio, a.periodo.fim) : [ref.slice(0, 7)];
  const proximas = proximasSessoes(a);
  const quando = dataHoraBrasilia(a.atualizado_em);

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <Figurinha nome="calendario" className="heroi-figurinha figurinha-flutua" />
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Agenda do Plenário</h1>
        <p className="mt-3 leading-relaxed text-gray-800">
          Sessões do Plenário da Câmara dos Deputados, do Senado Federal e do Congresso Nacional (sessões conjuntas
          das duas casas), como publicadas nos dados abertos de cada casa, e o desfecho oficial de cada item votado.
        </p>
        <p className="aviso mt-4">
          <strong>Não é tempo real.</strong> {a.aviso}
          {quando ? ` Última coleta: ${quando.data}, ${quando.hora} (horário de Brasília).` : ""}
        </p>
        {a.periodo ? (
          <p className="meta mt-2">
            Período coberto: {formatarData(a.periodo.inicio)} a {formatarData(a.periodo.fim)}
            {a.periodo.regra ? ` (${a.periodo.regra})` : ""}.
          </p>
        ) : null}
      </header>

      <Secao
        id="calendario"
        titulo="Calendário"
        descricao={
          <>
            Número de votações do Plenário registradas em cada dia: na Câmara, votações simbólicas e nominais; no Senado,
            só as nominais e secretas, que são as que a fonte de votações do Senado publica. Sessão deliberativa é aquela em
            que o Plenário pode votar; sessões solenes e especiais são não deliberativas.
          </>
        }
      >
        <Calendario meses={lista} inicial={ref.slice(0, 7)} dias={a.dias} hoje={ref} />
      </Secao>

      <Secao id="proximas" titulo="Próximas sessões" descricao="Em ordem cronológica, como marcadas pelas casas.">
        {proximas.length ? (
          <ListaRecolhivel
            rotulo={{ singular: "sessão", plural: "sessões" }}
            inicial={8}
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            itens={proximas.map((s) => (
              <ItemSessao key={s.id} s={s} />
            ))}
          />
        ) : (
          <p className="lacuna">Nenhuma sessão marcada na agenda coletada.</p>
        )}
      </Secao>

      <Secao
        id="ultima-pauta"
        titulo="Pauta da última sessão"
        descricao="Última sessão encerrada com pauta, em cada casa. O desfecho de cada item é o texto oficial da fonte; quando a fonte não diz, aparece “não informado”."
      >
        <div className="space-y-8">
          {ORDEM_CASAS.map((c) => {
            const u = a.ultimas[c];
            return (
              <section key={c} aria-labelledby={`pauta-${c}`}>
                <h3 id={`pauta-${c}`} className="text-lg font-semibold">
                  {NOME_CASA[c]}
                </h3>
                {u ? (
                  <>
                    <div className="mt-2">
                      <ItemSessao s={u.sessao} />
                    </div>
                    <ListaRecolhivel
                      rotulo={{ singular: "item", plural: "itens" }}
                      inicial={6}
                      className="mt-3 space-y-3"
                      itens={u.itens.map((i, k) => (
                        <ItemDaPauta key={`${i.titulo}-${k}`} i={i} />
                      ))}
                    />
                  </>
                ) : (
                  <p className="lacuna mt-2">Nenhuma sessão encerrada com pauta no período coletado.</p>
                )}
              </section>
            );
          })}
        </div>
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <ul className="space-y-1">
          {a.fontes.map((f) => (
            <li key={f.url}>
              {f.url.includes("{") ? (
                <span className="text-sm">
                  {f.titulo ?? f.orgao ?? "Fonte oficial"} (um endereço por sessão; o link aparece em cada sessão e item)
                </span>
              ) : (
                <FonteLink href={f.url} tipo="oficial">
                  {f.titulo ?? f.orgao ?? "Fonte oficial"}
                </FonteLink>
              )}
              {f.acessado_em ? <span className="meta"> · coletado em {formatarData(f.acessado_em)}</span> : null}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          Votações de cada casa: <Link href="/congresso" className="lk">Congresso Nacional</Link>.
        </p>
      </Secao>
    </div>
  );
}

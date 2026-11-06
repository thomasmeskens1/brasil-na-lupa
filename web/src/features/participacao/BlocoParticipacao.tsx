import Link from "next/link";
import { FonteLink } from "@/components/FonteLink";
import { getParticipacao, type ParticipacaoCamara, type ParticipacaoSenado } from "./dados";

/**
 * "Participe pelo canal oficial": leva à Consulta Pública do e-Cidadania (Senado) e/ou à
 * enquete da Câmara da proposição e mostra os números oficiais desses canais, com fonte e data
 * de coleta. Todas as opções têm o mesmo tratamento visual (diretrizes 4.1 e 11): nada de verde
 * ou vermelho, nada de destaque para um lado. Componente de servidor (lê content/participacao).
 *
 * Uso: <BlocoParticipacao senado={v.proposicao?.codigo_materia} /> (votação do Senado) ou
 *      <BlocoParticipacao camara={v.proposicao?.id} /> (votação da Câmara).
 */
export interface BlocoParticipacaoProps {
  /** Código da matéria no Senado (proposicao.codigo_materia). */
  senado?: string | number | null;
  /** Id da proposição na Câmara (proposicao.id). */
  camara?: string | number | null;
}

const NAO_DISPONIVEL = "Informação não disponível em fonte oficial";
const AVISO = "não é votação nem pesquisa";

function numero(n: number): string {
  return n.toLocaleString("pt-BR");
}

function data(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function Fonte({ url, titulo, acessado }: { url: string; titulo: string; acessado: string }) {
  return (
    <p className="meta mt-3">
      <FonteLink href={url} tipo="oficial">
        {titulo}
      </FonteLink>{" "}
      · coletado em {data(acessado)}
    </p>
  );
}

function Senado({ p }: { p: ParticipacaoSenado }) {
  const c = p.consulta;
  const aberta = c?.situacao === "aberta";
  return (
    <div className="rounded-xl border border-borda bg-superficie p-4">
      <h3 className="font-semibold">Consulta Pública do Senado (Portal e-Cidadania)</h3>
      <p className="mt-1 text-sm text-[var(--cor-secundaria)]">
        No e-Cidadania, quem tem cadastro gov.br pode responder se apoia ou não a proposição.
      </p>
      <p className="mt-3">
        <a href={p.canal.url} target="_blank" rel="noopener noreferrer" className="botao botao-escuro">
          {aberta ? "Opinar na consulta do Senado" : "Ver a consulta no e-Cidadania"}
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      </p>
      {c ? (
        <div className="mt-4">
          <p className="text-sm font-semibold">
            {aberta ? "Resultado parcial" : c.situacao === "encerrada" ? "Resultado final" : "Resultado"} da consulta
            pública do Senado — {AVISO}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Respostas registradas na consulta">
            <li className="pilula-numero">
              <span>Sim</span> <strong>{numero(c.sim)}</strong>
            </li>
            <li className="pilula-numero">
              <span>Não</span> <strong>{numero(c.nao)}</strong>
            </li>
          </ul>
          {c.apurado_ate ? <p className="meta mt-2">Votos apurados até {c.apurado_ate}, segundo o e-Cidadania.</p> : null}
          {c.frase_oficial ? <p className="meta mt-2">Texto da página oficial: “{c.frase_oficial}”</p> : null}
        </div>
      ) : (
        <p className="mt-3 text-sm">
          {NAO_DISPONIVEL}
          {p.observacao_oficial ? <span className="meta"> (a página oficial informa: “{p.observacao_oficial}”)</span> : null}
        </p>
      )}
      <Fonte url={p.fonte.url} titulo="Consulta Pública no e-Cidadania (Senado Federal)" acessado={p.fonte.acessado_em} />
    </div>
  );
}

function Camara({ p }: { p: ParticipacaoCamara }) {
  const e = p.enquete;
  const aberta = e?.situacao === "aberta";
  return (
    <div className="rounded-xl border border-borda bg-superficie p-4">
      <h3 className="font-semibold">Enquete da Câmara dos Deputados</h3>
      <p className="mt-1 text-sm text-[var(--cor-secundaria)]">
        Segundo a Câmara, as enquetes “não têm rigor científico, pois não representam uma amostra da sociedade”, e cabe
        ao relator decidir se vai considerar as opiniões.
      </p>
      <p className="mt-3">
        <a href={p.canal.url} target="_blank" rel="noopener noreferrer" className="botao botao-escuro">
          {aberta ? "Opinar na enquete da Câmara" : "Ver a enquete na Câmara"}
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      </p>
      {e ? (
        <div className="mt-4">
          <p className="text-sm font-semibold">
            {aberta ? "Resultado parcial" : e.situacao === "encerrada" ? "Resultado final" : "Resultado"} da enquete da
            Câmara — {AVISO}
          </p>
          {e.rotulo_oficial ? <p className="meta mt-1">{e.rotulo_oficial}, segundo a Câmara.</p> : null}
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Participações registradas na enquete">
            {e.opcoes.map((o) => (
              <li key={o.opcao} className="pilula-numero">
                <span>{o.opcao}</span> <strong>{numero(o.participacoes)}</strong>
                {o.percentual ? <span className="meta">({o.percentual})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm">{NAO_DISPONIVEL}</p>
      )}
      <Fonte url={p.fonte.url} titulo="Resultados da enquete (Câmara dos Deputados)" acessado={p.fonte.acessado_em} />
    </div>
  );
}

const valido = (id: string | number | null | undefined) => (id !== null && id !== undefined && /^\d+$/.test(String(id)) ? String(id) : null);

/** Proposição ainda não visitada pelo coletor: só o link oficial (o endereço segue o código oficial). */
function AindaNaoColetado({ titulo, url, botao }: { titulo: string; url: string; botao: string }) {
  return (
    <div className="rounded-xl border border-borda bg-superficie p-4">
      <h3 className="font-semibold">{titulo}</h3>
      <p className="mt-3">
        <a href={url} target="_blank" rel="noopener noreferrer" className="botao botao-escuro">
          {botao}
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      </p>
      <p className="mt-3 text-sm">O resultado desta página oficial ainda não foi coletado pelo site.</p>
    </div>
  );
}

export function BlocoParticipacao({ senado, camara }: BlocoParticipacaoProps) {
  const ps = getParticipacao("senado", senado);
  const pc = getParticipacao("camara", camara);
  const idS = ps ? null : valido(senado);
  const idC = pc ? null : valido(camara);
  return (
    <section aria-labelledby="participe-t" className="space-y-3">
      <h2 id="participe-t" className="text-lg font-bold">
        Participe pelo canal oficial
      </h2>
      {ps || pc || idS || idC ? (
        <p className="text-sm text-[var(--cor-secundaria)]">
          Para apoiar, criticar ou sugerir mudanças, use os canais oficiais do Congresso. Os números abaixo são copiados
          das páginas oficiais e mostram só quem quis participar.
        </p>
      ) : null}
      {ps ? <Senado p={ps} /> : null}
      {idS ? (
        <AindaNaoColetado
          titulo="Consulta Pública do Senado (Portal e-Cidadania)"
          url={`https://www12.senado.leg.br/ecidadania/visualizacaomateria?id=${idS}`}
          botao="Ver a consulta no e-Cidadania"
        />
      ) : null}
      {pc ? <Camara p={pc} /> : null}
      {idC ? (
        <AindaNaoColetado titulo="Enquete da Câmara dos Deputados" url={`https://www.camara.leg.br/enquetes/${idC}`} botao="Ver a enquete na Câmara" />
      ) : null}
      <Link href="/participar" className="bloco-atalho">
        <span className="seta-atalho" aria-hidden="true">
          →
        </span>
        <span className="block pr-12 font-semibold">Tem uma ideia de lei? Proponha no e-Cidadania</span>
        <span className="mt-1 block pr-12 text-sm text-[var(--cor-secundaria)]">
          Como funcionam a Ideia Legislativa, as consultas públicas e as enquetes, segundo o Senado e a Câmara.
        </span>
      </Link>
    </section>
  );
}

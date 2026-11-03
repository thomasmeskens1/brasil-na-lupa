"use client";

import { useActionState } from "react";
import { salvarPreferenciasAcao, type EstadoFormulario } from "../acoes";
import Link from "next/link";
import { hrefDoId } from "../ids";
import { TEMAS, UFS, type Preferencias } from "../regras";
import { BOTAO_PRIMARIO } from "./estilos";
import { Mensagem } from "./Mensagem";

const ORIGENS: Record<string, string> = {
  camara: "Deputado federal",
  senado: "Senador",
  "camara-votacao": "Votação na Câmara dos Deputados",
  "senado-votacao": "Votação no Senado Federal",
  executivo: "Ato da Presidência da República",
  icms: "Decisão sobre o ICMS",
};

/** Rótulo legível do favorito (sem mostrar o formato técnico do identificador). */
function rotulo(id: string): string {
  const i = id.indexOf(":");
  const origem = id.slice(0, i);
  const resto = id.slice(i + 1);
  const m = /^([a-z]{2})-(votacao|deputado)$/.exec(origem);
  if (m) return `${m[2] === "votacao" ? "Votação na Assembleia Legislativa" : "Deputado estadual"} (${m[1].toUpperCase()}), registro ${resto}`;
  if (origem === "executivo") return `${resto.startsWith("mpv-") ? "Medida provisória" : "Veto"} ${resto.replace(/^(mpv|vet)-/, "").replace("-", "/")}`;
  return `${ORIGENS[origem] ?? "Registro"}, registro ${resto}`;
}

const legenda = "text-base font-bold text-gray-900";
const grade = "mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 md:grid-cols-3";
const opcao = "flex min-h-11 items-center gap-2 text-sm text-gray-900";

function ListaAcompanhados({ nome, ids, vazio }: { nome: "politicos" | "itens"; ids: string[]; vazio: string }) {
  if (ids.length === 0) return <p className="mt-1 text-sm text-gray-800">{vazio}</p>;
  return (
    <>
      <p className="meta mt-1">Desmarque e salve para tirar dos favoritos.</p>
      <ul className="mt-1 space-y-1">
        {ids.map((id) => (
          <li key={id}>
            <span className="flex flex-wrap items-center gap-x-2">
              <label className={opcao}>
                <input type="checkbox" name={nome} value={id} defaultChecked className="h-5 w-5" />
                {rotulo(id)}
              </label>
              {hrefDoId(id) ? (
                <Link href={hrefDoId(id)!} className="lk text-sm" prefetch={false}>
                  abrir<span className="sr-only"> a página de {rotulo(id)}</span>
                </Link>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function FormPreferencias({ inicial }: { inicial: Preferencias }) {
  const [estado, acao, enviando] = useActionState<EstadoFormulario, FormData>(salvarPreferenciasAcao, {});
  const ufs = new Set(inicial.ufs);
  const temas = new Set(inicial.temas);
  return (
    <form action={acao} className="space-y-6">
      <fieldset>
        <legend className={legenda}>Estados favoritos</legend>
        <div className={grade}>
          {UFS.map((u) => (
            <label key={u.sigla} className={opcao}>
              <input type="checkbox" name="ufs" value={u.sigla} defaultChecked={ufs.has(u.sigla)} className="h-5 w-5" />
              {u.nome} ({u.sigla})
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legenda}>Municípios</legend>
        {inicial.municipios.map((m) => (
          <input key={m} type="hidden" name="municipios" value={m} />
        ))}
        <p className="mt-1 text-sm text-gray-800">A escolha de municípios ainda não está disponível.</p>
      </fieldset>

      <fieldset>
        <legend className={legenda}>Temas favoritos</legend>
        <div className={grade}>
          {TEMAS.map((t) => (
            <label key={t.id} className={opcao}>
              <input type="checkbox" name="temas" value={t.id} defaultChecked={temas.has(t.id)} className="h-5 w-5" />
              {t.nome}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legenda}>Políticos favoritos</legend>
        <ListaAcompanhados
          nome="politicos"
          ids={inicial.politicos}
          vazio="Nenhum político favorito. Use o botão “Favoritar” na página do deputado ou senador."
        />
      </fieldset>

      <fieldset>
        <legend className={legenda}>Propostas favoritas</legend>
        <ListaAcompanhados
          nome="itens"
          ids={inicial.itens}
          vazio="Nenhuma proposta favorita. Use o botão “Favoritar” na página da votação ou da decisão."
        />
      </fieldset>

      <fieldset>
        <legend className={legenda}>Alertas por e-mail</legend>
        <label className={`${opcao} mt-1`}>
          <input
            type="checkbox"
            name="alertasEmail"
            value="sim"
            defaultChecked={inicial.alertasEmail}
            className="h-5 w-5"
          />
          Quero receber alertas por e-mail sobre os meus favoritos
        </label>
        <p className="meta">
          Desligado até você ligar. Os alertas ainda não são enviados: por enquanto, esta opção só registra a sua
          preferência.
        </p>
      </fieldset>

      <Mensagem estado={estado} />
      <button type="submit" className={BOTAO_PRIMARIO} disabled={enviando}>
        {enviando ? "Salvando…" : "Salvar preferências"}
      </button>
    </form>
  );
}

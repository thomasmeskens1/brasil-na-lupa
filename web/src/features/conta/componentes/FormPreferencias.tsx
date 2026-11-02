"use client";

import { useActionState } from "react";
import { salvarPreferenciasAcao, type EstadoFormulario } from "../acoes";
import { TEMAS, UFS, type Preferencias } from "../regras";
import { BOTAO_PRIMARIO } from "./estilos";
import { Mensagem } from "./Mensagem";

const ORIGENS: Record<string, string> = {
  camara: "Câmara dos Deputados",
  senado: "Senado Federal",
  congresso: "Congresso Nacional",
  executivo: "Presidência da República",
  alesp: "Assembleia Legislativa de São Paulo (ALESP)",
  "governo-sp": "Governo do Estado de São Paulo",
  atibaia: "Atibaia",
  stf: "Supremo Tribunal Federal (STF)",
  stj: "Superior Tribunal de Justiça (STJ)",
  tcu: "Tribunal de Contas da União (TCU)",
  "tce-sp": "Tribunal de Contas do Estado de São Paulo (TCE-SP)",
};

function rotulo(id: string): string {
  const i = id.indexOf(":");
  const origem = ORIGENS[id.slice(0, i)] ?? "Outra fonte";
  return `${origem} — registro ${id.slice(i + 1)}`;
}

const legenda = "text-base font-bold text-gray-900";
const grade = "mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 md:grid-cols-3";
const opcao = "flex min-h-11 items-center gap-2 text-sm text-gray-900";

function ListaAcompanhados({ nome, ids, vazio }: { nome: "politicos" | "itens"; ids: string[]; vazio: string }) {
  if (ids.length === 0) return <p className="mt-1 text-sm text-gray-800">{vazio}</p>;
  return (
    <>
      <p className="meta mt-1">Desmarque para deixar de acompanhar.</p>
      <ul className="mt-1 space-y-1">
        {ids.map((id) => (
          <li key={id}>
            <label className={opcao}>
              <input type="checkbox" name={nome} value={id} defaultChecked className="h-5 w-5" />
              {rotulo(id)}
            </label>
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
        <legend className={legenda}>Estados</legend>
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
        <legend className={legenda}>Temas</legend>
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
        <legend className={legenda}>Políticos acompanhados</legend>
        <ListaAcompanhados nome="politicos" ids={inicial.politicos} vazio="Você ainda não acompanha nenhum político." />
      </fieldset>

      <fieldset>
        <legend className={legenda}>Itens acompanhados</legend>
        <ListaAcompanhados
          nome="itens"
          ids={inicial.itens}
          vazio="Você ainda não acompanha nenhuma votação, proposta ou decisão."
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
          Quero receber alertas por e-mail sobre o que acompanho
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

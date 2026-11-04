"use client";

import { useActionState } from "react";
import { salvarPreferenciasAcao, type EstadoFormulario } from "../acoes";
import { TEMAS, UFS, type Preferencias } from "../regras";
import { BOTAO_PRIMARIO } from "./estilos";
import { Mensagem } from "./Mensagem";

const legenda = "text-base font-bold text-gray-900";
const grade = "mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 md:grid-cols-3";
const opcao = "flex min-h-11 items-center gap-2 text-sm text-gray-900";
const resumo = "inline-flex min-h-11 cursor-pointer items-center font-semibold text-foreground";

/**
 * Escolha de estados e temas favoritos e dos alertas por e-mail. Políticos e propostas não
 * entram aqui: são marcados pelo botão "Favoritar" das páginas e removidos na lista acima.
 */
export function FormPreferencias({ inicial }: { inicial: Preferencias }) {
  const [estado, acao, enviando] = useActionState<EstadoFormulario, FormData>(salvarPreferenciasAcao, {});
  const ufs = new Set(inicial.ufs);
  const temas = new Set(inicial.temas);
  return (
    <form action={acao} className="space-y-4">
      {inicial.municipios.map((m) => (
        <input key={m} type="hidden" name="municipios" value={m} />
      ))}
      <details className="rounded-md border border-borda px-3">
        <summary className={resumo}>Escolher estados ({ufs.size} escolhidos)</summary>
        <fieldset className="pb-3">
          <legend className="sr-only">Estados favoritos</legend>
          <div className={grade}>
            {UFS.map((u) => (
              <label key={u.sigla} className={opcao}>
                <input type="checkbox" name="ufs" value={u.sigla} defaultChecked={ufs.has(u.sigla)} className="h-5 w-5" />
                {u.nome} ({u.sigla})
              </label>
            ))}
          </div>
        </fieldset>
      </details>

      <details className="rounded-md border border-borda px-3">
        <summary className={resumo}>Escolher temas ({temas.size} escolhidos)</summary>
        <fieldset className="pb-3">
          <legend className="sr-only">Temas favoritos</legend>
          <div className={grade}>
            {TEMAS.map((t) => (
              <label key={t.id} className={opcao}>
                <input type="checkbox" name="temas" value={t.id} defaultChecked={temas.has(t.id)} className="h-5 w-5" />
                {t.nome}
              </label>
            ))}
          </div>
        </fieldset>
      </details>

      <fieldset>
        <legend className={legenda}>Alertas por e-mail</legend>
        <label className={`${opcao} mt-1`}>
          <input type="checkbox" name="alertasEmail" value="sim" defaultChecked={inicial.alertasEmail} className="h-5 w-5" />
          Quero receber alertas por e-mail sobre os meus favoritos
        </label>
        <p className="meta">
          Desligado até você ligar. Os alertas ainda não são enviados: por enquanto, esta opção só registra a sua preferência.
        </p>
      </fieldset>

      <Mensagem estado={estado} />
      <button type="submit" className={BOTAO_PRIMARIO} disabled={enviando}>
        {enviando ? "Salvando…" : "Salvar estados, temas e alertas"}
      </button>
    </form>
  );
}

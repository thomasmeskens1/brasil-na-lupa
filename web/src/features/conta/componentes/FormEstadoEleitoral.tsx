"use client";

import { useActionState } from "react";
import { salvarUfEleitoralAcao, type EstadoFormulario } from "../acoes";
import { UFS } from "../regras";
import { BOTAO_PRIMARIO } from "./estilos";
import { Mensagem } from "./Mensagem";

/**
 * "Estado onde você vota": opcional, com consentimento próprio (sem caixa pré-marcada). Serve só
 * para os totais por estado e para a lista do seu estado; nunca é conferido com outra base.
 */
export function FormEstadoEleitoral({ inicial }: { inicial: string | null }) {
  const [estado, acao, enviando] = useActionState<EstadoFormulario, FormData>(salvarUfEleitoralAcao, {});
  return (
    <form action={acao} className="space-y-3">
      <div>
        <label htmlFor="uf-eleitoral" className="block text-sm font-semibold text-gray-900">
          Estado onde você vota
        </label>
        <select
          id="uf-eleitoral"
          name="uf"
          defaultValue={inicial ?? ""}
          className="mt-1 min-h-11 w-full max-w-xs rounded-md border border-[var(--cor-borda-forte)] bg-white px-3 text-base"
        >
          <option value="">Escolha…</option>
          {UFS.map((u) => (
            <option key={u.sigla} value={u.sigla}>
              {u.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-start gap-3">
        <input id="uf-eleitoral-ac" name="aceito" type="checkbox" value="sim" className="mt-1 h-5 w-5 shrink-0" />
        <label htmlFor="uf-eleitoral-ac" className="text-sm text-gray-900">
          Concordo que o Brasil na Lupa guarde o estado onde eu voto e o use, junto com as minhas reações, só para os
          totais por estado e a lista de propostas com mais manifestações, sempre somados e a partir de 10 pessoas.
        </label>
      </div>
      <button type="submit" className={BOTAO_PRIMARIO} disabled={enviando}>
        {enviando ? "Salvando…" : inicial ? "Trocar o estado" : "Salvar o estado"}
      </button>
      <Mensagem estado={estado} />
    </form>
  );
}

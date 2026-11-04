"use client";

import { useState } from "react";
import { DialogoEmBreve } from "@/components/reacoes/Dialogo";
import { CLASSE_BOTAO_CONTA, IconeConta } from "./IconeConta";

/** Ícone de conta enquanto o cadastro não está ligado: o clique explica que as contas abrem em breve. */
export function BotaoContaEmBreve() {
  // Botão que abriu o aviso: o foco volta para ele ao fechar.
  const [origem, setOrigem] = useState<HTMLElement | null>(null);
  return (
    <>
      <button type="button" onClick={(e) => setOrigem(e.currentTarget)} className={CLASSE_BOTAO_CONTA} aria-label="Minha conta" title="Minha conta">
        <IconeConta />
      </button>
      {origem ? (
        <DialogoEmBreve
          origem={origem}
          aoFechar={() => setOrigem(null)}
          texto="Em breve você vai poder criar uma conta para salvar favoritos, acompanhar as novidades dos temas que escolher e curtir ou não curtir propostas. Todo o conteúdo do site continua aberto, sem cadastro."
        />
      ) : null}
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { aoMudar, avisarMudanca, enviarJson, mensagemDeErro, obterEstadoConta, pedirEntrada } from "@/features/conta/cliente";
import type { TipoFavorito } from "@/features/conta/ids";
import { Estrela } from "./Icones";
import estilos from "./reacoes.module.css";

/**
 * "Favoritar" (estrela) em páginas de político, de estado e de proposta. Visitante: abre o
 * convite para entrar. Com sessão: marca ou desmarca (aria-pressed) e anuncia o resultado.
 */
export function BotaoFavoritar({ tipo, valor, nome }: { tipo: TipoFavorito; valor: string; nome: string }) {
  const [logado, setLogado] = useState<boolean | null>(null);
  const [favorito, setFavorito] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pulso, setPulso] = useState(0);

  useEffect(() => {
    let vivo = true;
    const carregar = () =>
      obterEstadoConta().then((e) => {
        if (!vivo) return;
        setLogado(e.logado);
        setFavorito(!!e.favoritos?.[tipo]?.includes(valor));
      });
    void carregar();
    const parar = aoMudar(() => void carregar());
    return () => {
      vivo = false;
      parar();
    };
  }, [tipo, valor]);

  async function clicar(botao: HTMLButtonElement) {
    setPulso((n) => n + 1);
    if (!logado) {
      pedirEntrada(botao, `Para guardar ${nome} nos seus favoritos, entre na sua conta.`);
      return;
    }
    setEnviando(true);
    setAviso(null);
    const novo = !favorito;
    const r = await enviarJson<{ favorito?: boolean; erro?: string }>("/api/conta/favoritos", { tipo, ref: valor, favorito: novo });
    setEnviando(false);
    if (!r.ok) {
      setAviso(mensagemDeErro(r.dados?.erro));
      return;
    }
    setFavorito(novo);
    setAnuncio(novo ? `Adicionado aos favoritos: ${nome}.` : `Removido dos favoritos: ${nome}.`);
    avisarMudanca();
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={`botao botao-mini ${estilos.botao}`}
        aria-pressed={favorito}
        aria-label={`Favoritar ${nome}`}
        disabled={enviando}
        onClick={(e) => void clicar(e.currentTarget)}
      >
        <span key={pulso} className={pulso ? estilos.pulso : undefined}>
          <Estrela cheia={favorito} className={estilos.icone} />
        </span>
        <span aria-hidden="true">{favorito ? "Favorito" : "Favoritar"}</span>
      </button>
      <span aria-live="polite" className="sr-only">
        {anuncio}
      </span>
      {aviso ? (
        <span role="alert" className="text-sm text-[var(--cor-secundaria)]">
          {aviso}{" "}
          {aviso === mensagemDeErro("sem-consentimento") || aviso === mensagemDeErro("limite-favoritos") ? (
            <Link href="/minha-conta" className="lk">
              Ir para Minha conta
            </Link>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

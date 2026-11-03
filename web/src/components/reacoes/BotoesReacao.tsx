"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { aoMudar, avisarMudanca, enviarJson, mensagemDeErro, obterEstadoConta, pedirEntrada } from "@/features/conta/cliente";
import type { Contagem, ValorReacao } from "@/features/conta/reacoes";
import { Polegar } from "./Icones";
import estilos from "./reacoes.module.css";

type Fase = "carregando" | "visitante" | "logado";

const ROTULO = "Opinião de usuários do Brasil na Lupa — não é pesquisa nem dado oficial";
const PLURAL = (n: number, s: string, p: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? s : p}`;

/**
 * Curtir / não curtir uma proposta (diretriz 4.1). Mesmo estilo e mesma cor para os dois.
 * Visitante: botões sem números; o clique abre o convite para entrar. Com sessão: contadores
 * agregados ao lado, com o rótulo de que é opinião de usuários. A primeira reação pede o
 * consentimento específico (opinião política é dado sensível, LGPD art. 11, I).
 */
export function BotoesReacao({ proposta }: { proposta: string }) {
  const id = useId();
  const [fase, setFase] = useState<Fase>("carregando");
  const [consent, setConsent] = useState({ geral: false, reacoes: false });
  const [contagem, setContagem] = useState<Contagem | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const [pendente, setPendente] = useState<ValorReacao | null>(null);
  const [pulso, setPulso] = useState<{ valor: ValorReacao; n: number } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const tituloConsent = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let vivo = true;
    async function carregar() {
      const e = await obterEstadoConta();
      if (!vivo) return;
      if (!e.logado) {
        setFase("visitante");
        return;
      }
      setFase("logado");
      setConsent(e.consentimento ?? { geral: false, reacoes: false });
      try {
        const r = await fetch(`/api/conta/reacoes?ids=${encodeURIComponent(proposta)}`, { credentials: "same-origin", cache: "no-store" });
        const d = r.ok ? ((await r.json()) as { itens: Record<string, Contagem> }) : null;
        if (vivo && d) setContagem(d.itens[proposta] ?? null);
      } catch {
        /* sem contadores: os botões continuam */
      }
    }
    void carregar();
    const parar = aoMudar(() => void carregar());
    return () => {
      vivo = false;
      parar();
    };
  }, [proposta]);

  useEffect(() => {
    if (pendente !== null) tituloConsent.current?.focus();
  }, [pendente]);

  async function registrar(valor: ValorReacao) {
    setEnviando(true);
    setAviso(null);
    const novo: ValorReacao = contagem?.minha === valor ? 0 : valor;
    const r = await enviarJson<{ itens?: Record<string, Contagem>; erro?: string }>("/api/conta/reacoes", { proposta, valor: novo });
    setEnviando(false);
    const c = r.dados?.itens?.[proposta];
    if (!r.ok || !c) {
      if (r.dados?.erro === "sem-consentimento-reacoes") {
        setPendente(valor);
        return;
      }
      setAviso(mensagemDeErro(r.dados?.erro));
      return;
    }
    setContagem(c);
    const feito = novo === 0 ? "Reação retirada." : novo === 1 ? "Reação registrada: curti." : "Reação registrada: não curti.";
    setAnuncio(`${feito} ${PLURAL(c.curtidas, "curtida", "curtidas")} e ${PLURAL(c.naoCurtidas, "não curtida", "não curtidas")}.`);
  }

  function clicar(valor: ValorReacao, botao: HTMLButtonElement) {
    setPulso({ valor, n: (pulso?.n ?? 0) + 1 });
    if (fase !== "logado") {
      pedirEntrada(botao, "Para curtir ou não curtir uma proposta, entre na sua conta.");
      return;
    }
    if (!consent.geral) {
      setAviso(mensagemDeErro("sem-consentimento"));
      return;
    }
    if (!consent.reacoes) {
      setPendente(valor);
      return;
    }
    void registrar(valor);
  }

  async function aceitar(form: HTMLFormElement) {
    const marcado = (form.elements.namedItem("aceito") as HTMLInputElement | null)?.checked;
    if (!marcado) {
      setAviso("Para reagir, marque a caixa de consentimento.");
      return;
    }
    setEnviando(true);
    const r = await enviarJson<{ ok?: boolean; erro?: string }>("/api/conta/reacoes/consentimento", { aceito: true });
    setEnviando(false);
    if (!r.ok) {
      setAviso(mensagemDeErro(r.dados?.erro));
      return;
    }
    const valor = pendente ?? 1;
    setPendente(null);
    setConsent({ geral: true, reacoes: true });
    avisarMudanca();
    await registrar(valor);
  }

  const logado = fase === "logado" && contagem;
  const botoes: { valor: 1 | -1; nome: string; texto: string; n: number | undefined }[] = [
    { valor: 1, nome: "Curtir esta proposta", texto: "Curtir", n: contagem?.curtidas },
    { valor: -1, nome: "Não curtir esta proposta", texto: "Não curtir", n: contagem?.naoCurtidas },
  ];

  return (
    <div role="group" aria-labelledby={`${id}-g`} className="space-y-2">
      <p id={`${id}-g`} className="sr-only">
        Reação à proposta
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {botoes.map((b) => (
          <span key={b.valor} className="inline-flex items-center gap-1.5">
            <button
              type="button"
              className={`botao botao-mini ${estilos.botao}`}
              aria-pressed={contagem?.minha === b.valor}
              aria-label={b.nome}
              disabled={enviando}
              onClick={(e) => clicar(b.valor, e.currentTarget)}
            >
              <span key={pulso?.valor === b.valor ? pulso.n : 0} className={pulso?.valor === b.valor ? estilos.pulso : undefined}>
                <Polegar para={b.valor === 1 ? "cima" : "baixo"} cheio={contagem?.minha === b.valor} className={estilos.icone} />
              </span>
              <span aria-hidden="true">{b.texto}</span>
            </button>
            {logado && b.n !== undefined ? (
              <span className={estilos.contador}>
                {b.n.toLocaleString("pt-BR")}
                <span className="sr-only"> {b.valor === 1 ? (b.n === 1 ? "curtida" : "curtidas") : b.n === 1 ? "não curtida" : "não curtidas"}</span>
              </span>
            ) : null}
          </span>
        ))}
      </div>
      {logado ? <p className="meta">{ROTULO}</p> : null}
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
      {aviso ? (
        <p role="alert" className="text-sm text-[var(--cor-secundaria)]">
          {aviso}{" "}
          {aviso === mensagemDeErro("sem-consentimento") ? (
            <Link href="/minha-conta" className="lk">
              Ir para Minha conta
            </Link>
          ) : null}
        </p>
      ) : null}
      {pendente !== null ? (
        <form
          className="aviso space-y-3 text-sm"
          aria-labelledby={`${id}-ct`}
          onSubmit={(e) => {
            e.preventDefault();
            void aceitar(e.currentTarget);
          }}
        >
          <h3 id={`${id}-ct`} ref={tituloConsent} tabIndex={-1} className="text-base font-bold text-foreground">
            Antes da sua primeira reação: consentimento
          </h3>
          <p className="leading-relaxed text-foreground">
            <strong>Curtir ou não curtir uma proposta pode revelar a sua opinião política</strong>, que é dado pessoal
            sensível pela Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018, art. 5º, II, e art. 11, I).
            Guardamos só qual proposta e qual reação, ligadas à sua conta, para mostrar e contar a sua reação. Os
            contadores mostram apenas totais: ninguém vê quem reagiu. Você pode apagar as reações ou revogar este
            consentimento a qualquer momento em Minha conta.
          </p>
          <div className="flex items-start gap-3">
            <input id={`${id}-ac`} name="aceito" type="checkbox" value="sim" className="mt-1 h-5 w-5 shrink-0" />
            <label htmlFor={`${id}-ac`} className="font-medium text-foreground">
              Concordo que o Brasil na Lupa guarde as minhas reações, que podem revelar opinião política, somente para
              essa finalidade.
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="botao" disabled={enviando}>
              Concordo e quero reagir
            </button>
            <button type="button" className="botao" onClick={() => setPendente(null)}>
              Agora não
            </button>
          </div>
          <p className="meta">
            Detalhes na{" "}
            <Link href="/privacidade#cadastro" className="lk">
              Política de Privacidade
            </Link>
            .
          </p>
        </form>
      ) : null}
    </div>
  );
}

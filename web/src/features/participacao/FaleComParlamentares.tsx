"use client";

/**
 * "Fale com seus parlamentares": a pessoa escolhe o estado e vê o e-mail institucional de cada
 * deputado federal e/ou senador em exercício (publicado pela Câmara e pelo Senado), com o voto
 * registrado nesta votação quando houver. O botão abre o programa de e-mail da própria pessoa com
 * uma mensagem sem posição pronta, para ela completar. O site não envia nem guarda nada; o estado
 * escolhido fica só neste aparelho. Lista em ordem alfabética (mesmo critério para todos).
 */
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { UFS } from "@/features/conta/regras";

type Casa = "camara" | "senado";
type Contato = [id: string, nome: string, partido: string | null, uf: string, email: string];
type Contatos = Record<Casa, Contato[]>;

const CHAVE = "bnl-uf-contato";
const NOME_CASA: Record<Casa, string> = { camara: "Deputados federais", senado: "Senadores" };
const TRATAMENTO: Record<Casa, string> = { camara: "Deputado(a)", senado: "Senador(a)" };

let promessa: Promise<Contatos | null> | null = null;
function carregar(): Promise<Contatos | null> {
  promessa ??= fetch("/congresso/contatos.json")
    .then((r) => (r.ok ? (r.json() as Promise<Contatos>) : null))
    .catch(() => {
      promessa = null;
      return null;
    });
  return promessa;
}

function lerUf(): string {
  try {
    return localStorage.getItem(CHAVE) ?? "";
  } catch {
    return "";
  }
}

function gravarUf(uf: string) {
  try {
    if (uf) localStorage.setItem(CHAVE, uf);
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: só não lembra a escolha */
  }
}

function mailto(c: Contato, casa: Casa, assunto: string, ufNome: string): string {
  const pagina = typeof window !== "undefined" ? window.location.href.split("#")[0] : "";
  const corpo = [
    `${TRATAMENTO[casa]} ${c[1]},`,
    "",
    `Sou eleitor(a) de ${ufNome} e escrevo sobre ${assunto}${pagina ? ` (${pagina})` : ""}.`,
    "",
    "[Escreva aqui a sua opinião]",
    "",
    "Atenciosamente,",
  ].join("\n");
  return `mailto:${c[4]}?subject=${encodeURIComponent(`Sobre ${assunto}`)}&body=${encodeURIComponent(corpo)}`;
}

export interface FaleComParlamentaresProps {
  /** Casas cujos parlamentares aparecem (ex.: ["camara"] numa votação da Câmara; as duas numa MP). */
  casas: Casa[];
  /** Como a proposta é chamada na mensagem (ex.: "PL 1087/2025"). */
  assunto: string;
  /** Voto registrado nesta votação, por id do parlamentar (só votação nominal). */
  votos?: { casa: Casa; porId: Record<string, string> } | null;
}

export function FaleComParlamentares({ casas, assunto, votos }: FaleComParlamentaresProps) {
  const id = useId();
  const [uf, setUf] = useState("");
  const [dados, setDados] = useState<Contatos | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    const salvo = lerUf();
    if (salvo) setUf(salvo);
  }, []);

  useEffect(() => {
    if (!uf || dados) return;
    void carregar().then((d) => (d ? setDados(d) : setFalhou(true)));
  }, [uf, dados]);

  const ufNome = UFS.find((u) => u.sigla === uf)?.nome ?? uf;

  return (
    <section aria-labelledby={`${id}-t`} className="rounded-xl border border-borda bg-superficie p-4">
      <h2 id={`${id}-t`} className="text-lg font-bold">
        Fale com seus parlamentares
      </h2>
      <p className="mt-1 text-sm text-[var(--cor-secundaria)]">
        Escolha o seu estado para ver o e-mail institucional publicado pela Câmara e pelo Senado. O botão abre o seu
        programa de e-mail com uma mensagem para você completar. O site não envia nem guarda a mensagem; o estado
        escolhido fica só neste aparelho.
      </p>
      <label htmlFor={`${id}-uf`} className="mt-3 block text-sm font-semibold">
        Seu estado
      </label>
      <select
        id={`${id}-uf`}
        value={uf}
        onChange={(e) => {
          setUf(e.target.value);
          gravarUf(e.target.value);
        }}
        className="mt-1 min-h-11 w-full max-w-xs rounded-md border border-[var(--cor-borda-forte)] bg-white px-3 text-base"
      >
        <option value="">Escolha…</option>
        {UFS.map((u) => (
          <option key={u.sigla} value={u.sigla}>
            {u.nome}
          </option>
        ))}
      </select>

      <div aria-live="polite">
        {uf && falhou ? <p className="lacuna mt-3">Não foi possível carregar os contatos agora. Tente de novo mais tarde.</p> : null}
        {uf && !dados && !falhou ? <p className="mt-3 text-sm">Carregando os contatos…</p> : null}
      </div>

      {uf && dados
        ? casas.map((casa) => {
            const lista = (dados[casa] ?? []).filter((c) => c[3] === uf);
            const porId = votos?.casa === casa ? votos.porId : null;
            return (
              <div key={casa} className="mt-4">
                <h3 className="font-semibold">
                  {NOME_CASA[casa]} de {ufNome} <span className="font-normal text-[var(--cor-secundaria)]">· {lista.length}</span>
                </h3>
                {lista.length ? (
                  <ul className="mt-2 divide-y divide-[var(--cor-borda)] rounded border border-[var(--cor-borda)] bg-white">
                    {lista.map((c) => (
                      <li key={c[0]} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <span>
                          <Link href={`/congresso/${casa}/parlamentares/${c[0]}`} className="lk font-semibold" prefetch={false}>
                            {c[1]}
                          </Link>{" "}
                          <span className="text-sm text-[var(--cor-secundaria)]">
                            ({[c[2], c[3]].filter(Boolean).join("-")})
                          </span>
                          {porId ? (
                            <span className="block text-sm">
                              Nesta votação: {porId[c[0]] ?? "sem voto registrado na fonte oficial"}
                            </span>
                          ) : null}
                        </span>
                        <a href={mailto(c, casa, assunto, ufNome)} className="botao">
                          Escrever e-mail
                          <span className="sr-only"> para {c[1]}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="lacuna mt-2">Nenhum contato institucional publicado para este estado na fonte coletada.</p>
                )}
              </div>
            );
          })
        : null}
      <p className="meta mt-3">
        Contatos: dados abertos da Câmara dos Deputados e do Senado Federal, como publicados (só quem está em exercício).
      </p>
    </section>
  );
}

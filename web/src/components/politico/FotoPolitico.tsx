/**
 * Foto oficial do político em moldura de figurinha (manual da marca: borda branca de adesivo e
 * contorno escuro), igual para todos (diretrizes 6 e 11): nenhuma cor por partido, sem neon.
 * Só há foto quando a fonte oficial declara permissão de uso (docs/pesquisa/fotos-licencas.md);
 * sem ela, as iniciais aparecem no MESMO formato e tamanho, sem nada que pareça punição.
 *
 * - decorativa (padrão): o nome está ao lado, a imagem tem alt="" e o crédito vai no title.
 * - com `legenda`: página do parlamentar; alt "Foto oficial de <nome>" e crédito visível abaixo.
 */
import type { FotoInfo } from "./fotos";

const TAMANHOS = {
  pp: { w: 36, h: 48, classe: "w-9 h-12 text-sm" },
  p: { w: 48, h: 64, classe: "w-12 h-16 text-base" },
  m: { w: 72, h: 96, classe: "w-[4.5rem] h-24 text-xl" },
  g: { w: 120, h: 160, classe: "w-[7.5rem] h-40 text-3xl" },
} as const;

export function iniciais(nome: string): string {
  const partes = nome
    .normalize("NFC")
    .replace(/[^\p{L}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^\p{Lu}/u.test(p))
    .filter((p) => !/^(da|de|do|das|dos|e)$/i.test(p));
  if (!partes.length) return "?";
  const a = partes[0][0];
  const b = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (a + b).toLocaleUpperCase("pt-BR");
}

export function FotoPolitico({
  nome,
  foto,
  tamanho = "m",
  legenda = false,
  prioridade = false,
  className = "",
}: {
  nome: string;
  foto: FotoInfo | null | undefined;
  tamanho?: keyof typeof TAMANHOS;
  /** Página do parlamentar: alt descritivo e crédito visível sob a foto. */
  legenda?: boolean;
  /** Primeira dobra: carrega sem esperar a rolagem. */
  prioridade?: boolean;
  className?: string;
}) {
  const t = TAMANHOS[tamanho];
  const moldura = `figurinha-foto ${t.classe}${legenda ? "" : ` ${className}`}`;
  const credito = foto ? `Foto: ${foto.credito}` : null;
  const quadro = foto ? (
    // Arquivo estático já reduzido (256 px, WebP) em public/fotos: <img> com largura e altura fixas.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={foto.src}
      alt={legenda ? `Foto oficial de ${nome}` : ""}
      title={legenda ? undefined : credito ?? undefined}
      width={t.w}
      height={t.h}
      loading={prioridade ? "eager" : "lazy"}
      decoding="async"
      className={moldura}
    />
  ) : (
    <span className={`${moldura} figurinha-iniciais`} aria-hidden={legenda ? undefined : true} role={legenda ? "img" : undefined} aria-label={legenda ? `Sem foto: iniciais de ${nome}` : undefined}>
      {iniciais(nome)}
    </span>
  );
  if (!legenda) return quadro;
  return (
    <figure className={`m-0 inline-flex flex-col items-start gap-1.5 ${className}`}>
      {quadro}
      <figcaption className="meta max-w-[10rem] text-xs leading-snug">
        {foto ? (
          <>
            {credito}
            {" · "}
            <a href={foto.urlPermissao} className="lk whitespace-nowrap" rel={foto.cc ? "license noopener" : "noopener"} target="_blank">
              {foto.cc ? "licença CC BY 4.0" : "uso permitido"}
              <span className="sr-only"> (página oficial da permissão de uso da foto; abre em nova aba)</span>
            </a>
          </>
        ) : (
          "Sem foto com permissão de uso declarada pela fonte oficial"
        )}
      </figcaption>
    </figure>
  );
}

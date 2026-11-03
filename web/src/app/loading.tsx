import { LogoSvg } from "@/components/marca/LogoSvg";

/** Carregamento entre páginas: versão curta do motion (a lupa vasculha o logotipo). */
export default function Carregando() {
  return (
    <div className="carregando flex min-h-[50vh] flex-col items-center justify-center gap-4" role="status">
      <div className="w-[min(70vw,420px)]">
        <LogoSvg prefixo="bnl-c" />
      </div>
      <p className="text-sm text-[var(--cor-texto-apoio)]">Carregando…</p>
    </div>
  );
}

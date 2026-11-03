import Image from "next/image";

/**
 * Logotipo oficial Brasil na Lupa, recortado do manual da marca (docs/marca/). Arquivo com fundo
 * transparente em public/marca/logo.png (1191 × 546).
 */
export function Logo({ altura = 40 }: { altura?: number }) {
  return (
    <Image
      src="/marca/logo.png"
      alt="Brasil na Lupa"
      width={Math.round((altura * 1191) / 546)}
      height={altura}
      priority
      className="logo-brilho"
    />
  );
}

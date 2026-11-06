import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FonteLink } from "@/components/FonteLink";
import { Secao } from "@/components/Secao";
import { textoLegivel } from "@/features/comum/texto";
import { Ficha, Fontes, Lacunas, Selo, Trilha } from "@/features/tribunais-contas/componentes/Basicos";
import {
  anosAcordaos,
  getMetaTce,
  getMetaTcu,
  getOrgao,
  getOrgaos,
  municipiosComContas,
  ouMarcador,
  temAcordaos,
  temContasGovernador,
  temContasPresidente,
} from "@/features/tribunais-contas/dados";
import { BASE_TC, NAO_DISPONIVEL, formatarDataTc, rotuloSituacao } from "@/features/tribunais-contas/rotulos";
import { Figurinha } from "@/components/marca/Figurinhas";
import { getUf } from "@/features/estados/ufs";

export function generateStaticParams() {
  return ouMarcador(getOrgaos().itens.map((o) => ({ orgao: o.id })), { orgao: "sem-dados" });
}

export async function generateMetadata({ params }: PageProps<"/tribunais-de-contas/[orgao]">): Promise<Metadata> {
  const { orgao } = await params;
  const o = getOrgao(orgao);
  if (!o) return { title: "Tribunal não encontrado" };
  return { title: `${o.nome} (${o.id.toUpperCase()})`, description: `Ficha do ${o.nome}: o que julga, site oficial, fontes e situação dos dados no site.` };
}

const ESFERA: Record<string, string> = { federal: "Federal", estadual: "Estadual", distrital: "Distrital", municipal: "Municipal" };

export default async function OrgaoTcPage({ params }: PageProps<"/tribunais-de-contas/[orgao]">) {
  const { orgao } = await params;
  const o = getOrgao(orgao);
  if (!o) notFound();
  const ativo = o.situacao_coleta === "ativa";
  const restricoes = (Array.isArray(o.robots_e_restricoes) ? o.robots_e_restricoes : o.robots_e_restricoes ? [o.robots_e_restricoes] : []).map(textoLegivel);
  const meta = ativo ? (getMetaTcu(o.id) ?? getMetaTce(o.id)) : null;

  const secoes: { href: string; titulo: string; texto: string }[] = [];
  if (ativo) {
    if (temContasPresidente(o.id))
      secoes.push({ href: `${BASE_TC}/${o.id}/contas-do-presidente`, titulo: "Contas do Presidente da República", texto: "Parecer prévio do tribunal e o julgamento pelo Congresso Nacional, exercício por exercício." });
    if (temContasGovernador(o.id))
      secoes.push({ href: `${BASE_TC}/${o.id}/contas-do-governador`, titulo: `Contas do Governador${o.uf ? ` (${o.uf})` : ""}`, texto: `Parecer prévio do Tribunal Pleno, ressalvas, determinações e o julgamento pela ${getUf(o.uf)?.uf === "df" ? "Câmara Legislativa" : "Assembleia Legislativa"}.` });
    for (const m of municipiosComContas(o.id))
      secoes.push({ href: `${BASE_TC}/${o.id}/prefeitos/${m.id}`, titulo: `Contas do Prefeito de ${m.nome}`, texto: "Parecer prévio de cada exercício e o que ainda não está publicado em fonte aberta." });
    if (temAcordaos(o.id)) {
      const anos = anosAcordaos(o.id);
      secoes.push({ href: `${BASE_TC}/${o.id}/acordaos`, titulo: "Acórdãos", texto: `Busca nos acórdãos de ${anos.slice().reverse().join(" e ")} e as decisões sobre impostos.` });
    }
  }

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <Trilha itens={[]} />
        <Figurinha nome="lupa" className="heroi-figurinha figurinha-flutua" />
        <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">{o.nome}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-base text-[var(--cor-secundaria)]">
          <Selo escuro={ativo}>{rotuloSituacao(o)}</Selo>
          <span>{o.id.toUpperCase()}</span>
        </p>
        <p className="mt-3 text-base leading-relaxed text-gray-800">
          {ativo
            ? "Os dados deste tribunal são coletados diariamente das fontes oficiais listadas abaixo."
            : "Em breve: a coleta dos dados deste tribunal ainda não começou. Por enquanto, a página mostra só a ficha do tribunal e o site oficial."}
        </p>
        {meta?.atualizado_em ? <p className="mt-2 text-base text-[var(--cor-secundaria)]">Dados coletados em {formatarDataTc(meta.atualizado_em)}.</p> : null}
      </header>

      {secoes.length ? (
        <nav aria-label={`Dados do ${o.id.toUpperCase()}`} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {secoes.map((s) => (
            <Link key={s.href} href={s.href} className="cartao block min-h-11 hover:bg-superficie">
              <span className="block text-lg font-semibold text-[var(--cor-link)] underline underline-offset-2">{s.titulo}</span>
              <span className="mt-1 block text-base text-gray-800">{s.texto}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      <Secao id="ficha" titulo="Ficha do tribunal">
        <Ficha
          itens={[
            ["Nome oficial", o.nome],
            ["Esfera", ESFERA[o.esfera] ?? o.esfera],
            ["Unidade da Federação", o.uf ?? "Não se aplica (âmbito nacional)"],
            ["Fiscaliza", o.jurisdiciona ?? NAO_DISPONIVEL],
            [
              "Site oficial",
              o.site_oficial ? (
                <FonteLink href={o.site_oficial} tipo="oficial" className="text-base!">
                  {o.site_oficial.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </FonteLink>
              ) : (
                NAO_DISPONIVEL
              ),
            ],
            ["Situação no site", ativo ? "Dados disponíveis" : "Em breve"],
          ]}
        />
        {o.conferencia ? <p className="mt-3 text-base text-[var(--cor-secundaria)]">{textoLegivel(o.conferencia)}</p> : null}
      </Secao>

      {restricoes.length ? (
        <Secao id="acesso" titulo="Regras de acesso automático respeitadas">
          <ul className="max-w-3xl list-disc space-y-2 pl-5 text-base leading-relaxed text-gray-800">
            {restricoes.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <Secao id="lacunas" titulo="O que a fonte oficial não informa">
        <Lacunas lacunas={[o.lacunas]} />
      </Secao>

      <Secao id="fontes" titulo="Fontes">
        <Fontes fontes={[...o.fontes, ...(meta?.fontes ?? [])]} />
      </Secao>
    </div>
  );
}

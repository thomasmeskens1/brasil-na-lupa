# Resumo: Região Sul (PR, SC, RS)

Pesquisa com acessos reais em **2026-11-02**. Detalhes, URLs e exemplos em [pr.md](pr.md), [sc.md](sc.md) e [rs.md](rs.md).

| UF | Deputados | Proposições | Votos nominais | Normas | Formato | Viabilidade |
|---|---|---|---|---|---|---|
| **PR** | HTML (54 perfis em `/deputados/conheca`) | **API JSON documentada** (`webservices.assembleia.pr.leg.br/api/public`, só http) | **Bloqueado a robôs**: Controle de Votações via `/api/votacoes*` (robots `Disallow: /api/` + reCAPTCHA); a API só traz o resultado ("1º TURNO - APROVADO") | API `norma-legal` (ALEP) + Casa Civil (HTML) + DIOE (JSON/HTML) | JSON / HTML | **Parcial**. Proposições, leis e decretos: total, esforço baixo. Voto nominal: curadoria ou pedido formal |
| **SC** | HTML (40 perfis no portal) | e-Legis, HTML (sem API) | **Publicado**: "Extrato de votação" em HTML (nome + Sim/Não, **sem partido**); raro (302 itens simbólicos nas 40 últimas sessões) | Legislação SC (ALESC; leis e decretos com nº do DOE) + DOE-SC (PDF) | HTML / PDF | **Total por raspagem**, esforço médio |
| **RS** | Pelos votos (nome, partido, id); lista própria carregada por JS (não verificada) | Página da proposição com **JSON embutido** + busca HTML (lenta, ~10 s/página) | **Publicado**: JSON com deputado + **partido** + voto, em **plenário e comissões** | LEGIS (ALRS; norma ↔ proposição ↔ DOE) + DOE-RS (**API JSON**) | JSON / HTML / PDF | **Total**, esforço baixo/médio. Melhor caso do Sul |

## Ordem sugerida de implementação
1. **RS**: voto nominal completo e DOE em JSON. Coletor parecido com o da ALESP, mas com leitura do JSON da página.
2. **PR**: proposições, leis e decretos pela API. Voto nominal marcado como "Informação não disponível em fonte oficial" (para coleta automática) até haver canal liberado. Sugerido um pedido via e-SIC.
3. **SC**: raspagem do e-Legis (sessões → ordem do dia → extratos). O partido do voto deve vir de fonte oficial na data da votação.

## Cuidados comuns
- Exibir os rótulos da fonte ("Sim/Não", "Favorável/Contrário", "Votação simbólica") sem convertê-los em juízo.
- Em votações de **veto**, o sentido de "Sim" não vem escrito no registro. Não deduzir; citar o documento (regimento ou ata) que o explique.
- Nenhuma barreira anti-robô foi contornada. Os endpoints com reCAPTCHA ou `Disallow` (ALEP `/api/`, ALESC `/wp-json/`) e as áreas com login (DOE-SC `doe-api`) não foram usados.

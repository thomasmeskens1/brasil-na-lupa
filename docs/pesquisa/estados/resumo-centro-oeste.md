# Resumo: Centro-Oeste (MT, MS, GO, DF)

Acessos reais em **2026-11-02**. Detalhes, URLs e exemplos em `mt.md`, `ms.md`, `go.md` e `df.md`.

| UF | Deputados | Proposições / tramitação | Votos nominais | Normas (leis, decretos, vetos) | Formato principal | Viabilidade |
|---|---|---|---|---|---|---|
| **MT** | 24, HTML (portal ALMT); a API exige OAuth | HTML por proposição (`/proposicao/{id}/tramitacoes`). O robots proíbe as listagens com `?`. API oficial só com credencial | **Não localizados**; só resultado agregado (tramitação, ordem do dia em PDF) | IOMAT: busca JSON (texto por página) + edições por data; ficha ALMT por URN LexML. `legislacao.mt.gov.br` leva a site privado (não usar) | HTML + JSON + PDF | **Parcial**, esforço médio |
| **MS** | 24, nos relatórios de votação | SGPL com **API protegida por CAPTCHA**: sem coleta automática sem acordo. Ordem do dia e matéria apreciada no Diário da ALEMS | **Sim, publicados**: "Lista de votação" (Modo Nominal, voto por deputado, totais) no Diário Oficial da ALEMS, **como imagem no PDF**, o que exige OCR | Domino da Governadoria (views XML; vetos parados em 2023) + DOE-MS (PDF com URL previsível) | PDF (imagem) + XML | **Parcial**, esforço médio/alto (OCR + conferência) |
| **GO** | 41, HTML (portal ALEGO) | SPL "ALEGO Digital" com **`robots: Disallow: /`**: só manual ou autorização | **Não localizados** estruturados; "Votação Preliminar" agregada; atas em PDF (imagem) | **API JSON da Casa Civil** (leis, decretos, **mensagens de veto com razões**, link para o DOE) + DOE-GO (JSON de busca) | JSON + PDF | **Parcial**: normas e vetos com esforço baixo; ALEGO bloqueada |
| **DF** | 24, HTML + dataset CLDF | **API pública documentada do PLe** (proposições, histórico, normas ligadas à proposição e ao DODF) | Só quando requerida; registrada no texto da **ata circunstanciada** (PDF com texto); a maioria é simbólica | **DODF: JSON com texto integral** por dia/seção; normas da CLDF na API PLe. SINJ bloqueado pelo robots | JSON + PDF | **Total** para proposições e normas; **curadoria** para votos; esforço baixo/médio |

## Prioridade sugerida
1. **DF**: API PLe + DODF JSON, coleta diária quase imediata.
2. **GO (Executivo)**: API da Casa Civil para normas e vetos com razões oficiais.
3. **MS (votos)**: única UF do grupo com voto nominal publicado sistematicamente. Vale um coletor de PDF + OCR com fila de conferência humana.
4. **MT**: normas pelo IOMAT. Para proposições e votos, pedir credencial da API à ALMT.

## Pedidos formais recomendados (SIC/Ouvidoria)
- **ALMT:** credencial para a API (`proposicao`, `sessao-plenaria/proposicao-votada`).
- **ALEMS:** relatório de votação em formato aberto e acesso à API do SGPL sem CAPTCHA.
- **ALEGO:** autorização ou dados abertos do SPL (sessões, votações), hoje proibido pelo robots.
- **CLDF:** expor na API pública o resultado de votação por proposição.

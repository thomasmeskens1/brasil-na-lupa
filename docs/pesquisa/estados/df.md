# Distrito Federal (DF): fontes oficiais

Pesquisa feita com acessos reais em **2026-11-02**. Regras seguidas: só fontes oficiais, `robots.txt` respeitado e nenhuma proteção anti-robô contornada. Observação: entre 17h e 18h o host `www.cl.df.gov.br` ficou fora do ar por alguns minutos (timeout de conexão) e depois voltou.

## Resumo

| Item | Melhor via | Formato | Automatizável |
|---|---|---|---|
| Deputados distritais (24) | Portal CLDF `/deputados-2023-2026`; dataset "relação nominal de deputados e servidores" | HTML/CSV | Sim |
| Proposições e tramitação | **API pública documentada do PLe** (`ple.cl.df.gov.br/pleservico/api/public`) | JSON | **Sim** |
| Normas distritais (CLDF) | **API pública de Normas do PLe** (com vínculo à proposição de origem e ao DODF) | JSON | **Sim** |
| Votos nominais | Atas circunstanciadas (PDF com texto), na seção Sessões Plenárias e no DCL. A maioria das votações é simbólica ("aprovado com a presença de 17 deputados") | PDF | Curadoria |
| Atos do Executivo | **DODF**: endpoint JSON por dia/seção com texto integral | JSON | **Sim** |

---

## 1. Câmara Legislativa (CLDF)

- **Portal:** https://www.cl.df.gov.br/ (Liferay). O robots.txt só bloqueia `/web/guest/search`. Seções: `/deputados-2023-2026`, `/ordem-do-dia` (PDF), `/sessoes-plenarias`, `/dcl` (Diário da Câmara Legislativa, PDF).
- **Portal de dados abertos (CKAN):** https://dados.cl.df.gov.br/ (28 conjuntos). O `robots.txt` **proíbe `/api/`** (a API do CKAN) e pede `Crawl-Delay: 10`. As páginas `/dataset/...` são permitidas. Conjuntos relevantes:
  - **Proposições:** https://dados.cl.df.gov.br/dataset/proposicoes. Documenta a "API Pública de Proposições – PLe/CLDF" e traz arquivos anuais JSON/CSV (até 2020).
  - **Normas:** https://dados.cl.df.gov.br/dataset/normas. Documenta a "API Pública de Normas".
  - Também: emendas parlamentares, leis orçamentárias, créditos adicionais, verbas indenizatórias, relação nominal de deputados e servidores.
- **API pública do PLe:** base `https://ple.cl.df.gov.br/pleservico/api/public`, "Autenticação: não requerida", "Estrutura pode evoluir sem aviso prévio". O host `ple.cl.df.gov.br` não tem robots.txt (devolve a SPA). Testada:
  - `POST /proposicao/filter?page=0&size=N&sort=dataLeitura,DESC` com corpo `{"tipoProposicao":"Projeto de Lei","ano":"2026","ementa":true}` → 417 PLs em 2026, com `siglaNumeroAno`, `ementa`, `autoria`, `dataLeitura`, `etapa`, `temaNome` e `regiaoAdministrativaNome`.
  - `GET /proposicao/{id}/detalhe` → proposição + **histórico completo** (156 eventos no PL 2492/2026): tramitações, pareceres, emendas, "1° Turno Aprovado", "2° Turno Aprovado", "Redação Final", "Sanção Veto ou Promulgação" e documento externo "DODF – Lei nº ...".
  - **Divergência com a documentação:** `GET /proposicao/{id}`, `/tramitacoes` e `/documentos` retornaram `[]` ou 404. A rota que funciona é `/detalhe`.
  - `POST /norma/buscar?page=0&size=N` com `{"operadorLogico":"AND","tipoNorma":"Lei","ano":"2026"}` → 104 leis em 2026. `GET /norma/{id}` → `proposicaoNorma` (proposição de origem), `normaFontes` (publicação no DODF), autores, temas e anexo (.docx).
- **Votações:** o front-end do PLe tem rotas de votação (`sessao-proposicao-votacao/resultado/sessao/{s}/proposicao/{p}`, "folha de votação"), mas **fora do caminho `/public`** (uso interno). Não foram testadas por exigirem login. O registro oficial público está nas **atas** (https://www.cl.df.gov.br/sessoes-plenarias: ata circunstanciada, ata sucinta, áudio e lista de presença, desde 2007). Os links usam um token de sessão do portal (`p_auth`), então é preciso manter o cookie da própria página. Na ata da 19ª Sessão Extraordinária (15/09/2026) as votações aparecem como "aprovado em segundo turno com a presença de 17 deputados". Há trechos como "ninguém pediu votação nominal" e o registro, na ata, de votos contrários nomeados a pedido. **Votação nominal só quando requerida; o voto aparece em texto corrido na ata (PDF com texto)**, o que exige curadoria.
- **Atualização:** diária (DCL nº 227 de 29/10/2026; PL 2518/2026 lido em 28/10/2026).

## 2. Governo do DF

- **DODF:** https://dodf.df.gov.br/. O robots.txt bloqueia `/*.html$`, `/admin/`, `/login/` e alguns PDFs antigos; o resto é permitido. O endpoint usado pela página do jornal é `POST https://dodf.df.gov.br/dodf/jornal/diario` com `data={timestamp}&pagina=N&tpSecao=I|II|III&tpJornal=13&letra=A` (para edição extra). Retorna JSON com `lstMaterias` (`coMateria`, `titulo`, `tipo` ex.: "Lei ordinária"/"Decreto", `poder`, `texto` integral, `slug`), `totalMaterias`, `totalPaginas` e PDFs (`lstLinkPdf`).
  - Página da matéria: `https://dodf.df.gov.br/dodf/materia/visualizar?co_data={coMateria}&p={slug}`.
  - PDF da edição: `/dodf/jornal/visualizar-pdf?pasta=AAAA|MM_Mes|DODF NNN DD-MM-AAAA|&arquivo=... INTEGRA.pdf`.
  - **As leis saem com frequência na Edição Extra**, por exemplo a Lei 7.945 na Extra A de 20/10/2026.
- **SINJ-DF** (legislação consolidada): https://www.sinj.df.gov.br/sinj/. O robots **proíbe `/sinj/ashx/`** (onde estão as buscas), `TextoArquivoNorma.aspx` e `BaixarArquivoNorma.aspx`, então **não serve para coleta automática**; só para consulta manual. **DFLegis** (https://dflegis.df.gov.br/, Casa Civil) é uma busca de atos do DODF; o robots permite tudo, mas não foi encontrada API.

## 3. Exemplos reais (abertos em 2026-11-02)

- **Projeto:** PL 2518/2026 (Dep. Pastor Daniel de Castro), lido em 28/10/2026. Origem da lei abaixo: PL 2492/2026 (Poder Executivo, crédito suplementar). Detalhe com histórico: https://ple.cl.df.gov.br/pleservico/api/public/proposicao/159323/detalhe
- **Votação:** ata circunstanciada da 19ª Sessão Extraordinária (15/09/2026), "aprovado em segundo turno com a presença de 17 deputados", em https://www.cl.df.gov.br/sessoes-plenarias (link com token; documento "E091526").
- **Lei:** Lei 7.945, de 20/10/2026 (abre crédito adicional de R$ 53.148.236,00; Autoria: Poder Executivo): https://dodf.df.gov.br/dodf/materia/visualizar?co_data=637960&p=lei-n-7945-de-20-de-outubro-de-2026. Na CLDF: https://ple.cl.df.gov.br/pleservico/api/public/norma/41840
- **Decreto:** Decreto 49.641, de 28/10/2026: https://dodf.df.gov.br/dodf/materia/visualizar?co_data=639839&p=decreto-n-49641-de-28-de-outubro-de-2026

## 4. Viabilidade

- **Classificação: total para proposições, tramitação e normas; curadoria para votos.** É a melhor UF do Centro-Oeste: API pública documentada (PLe) + DODF em JSON. A cadeia proposição → norma → DODF já vem ligada pelos IDs.
- **Esforço:** baixo/médio. Votos nominais exigem leitura das atas.
- **Riscos:** (1) a API do PLe "pode evoluir sem aviso" e já diverge da própria documentação, então é preciso monitorar; (2) o endpoint do DODF é interno (POST da página) e sem contrato; (3) a API do CKAN é proibida pelo robots, então só as páginas `/dataset` podem ser usadas; (4) os links de ata dependem de token de sessão; (5) o SINJ está bloqueado para robôs; (6) a maioria das votações é simbólica, então não se atribui voto individual sem votação nominal (diretriz 5).
- **Recomendação:** pedir à CLDF que publique na API pública o resultado da votação por proposição (as rotas já existem internamente).

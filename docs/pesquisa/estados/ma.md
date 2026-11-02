# Fontes oficiais: Maranhão (MA)

Pesquisa feita com acessos reais (curl) em **2026-11-02**.
Arquivos baixados para verificação: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-nordeste-1\dl_ma\`. Scripts: `ma_doe_parse.py`.

## Resumo

| Item | Melhor via | Formato | Automatizável? |
|---|---|---|---|
| Deputados (42 cadeiras) | ALEMALEGIS `/api/v1/public/parliamentary` | JSON | Total (filtrar pela legislatura 20) |
| Proposições e tramitação | ALEMALEGIS `/api/v1/public/legislative-matter/...` e `/processing/...` | JSON | Total |
| Votação nominal | **Não há registro estruturado.** A rota de votos existe mas vem vazia; o plenário vota de forma simbólica | Texto no Diário da Assembleia (PDF) | Curadoria |
| Normas (leis, LCs, resoluções) | ALEMALEGIS `/api/v1/public/legal-norm/filter` | JSON + arquivos | Total |
| Diário Oficial do Estado | `diariooficial.ma.gov.br/ajax.busca.php` (busca) + `download.php?arq=` (PDF) | JSON com HTML / PDF | Parcial |

**Viabilidade geral:** proposições e normas são **automatizáveis** (sistema novo com API JSON aberta). A votação nominal depende de **curadoria**. Esforço **médio**.

---

## 1. Assembleia Legislativa do Maranhão (ALEMA)

- **Portal:** https://www.al.ma.leg.br/sitealema/ (WordPress). `robots.txt`: `*` liberado (só `/cgi-bin/`). A API WordPress (`/wp-json/wp/v2/`) está aberta, mas só tem notícias.
- **Deputados:** https://www.al.ma.leg.br/sitealema/deputados/
- **Sistema legislativo novo: ALEMALEGIS** (SPA Angular): https://alemalegis.al.ma.leg.br/. O link antigo `sapl.al.ma.leg.br:8080` redireciona para cá. O SAPL antigo (`sapl-old.al.ma.leg.br`) responde com "Site Error" (Zope).
  - **API pública** (prefixo `/api/v1/public/`, Spring Boot, paginação `page`/`size`/`sort`), mapeada a partir do código do próprio site. Sem autenticação. Não há `robots.txt` (a rota devolve o HTML da SPA).

### 1.1 Rotas testadas

| Recurso | Rota | Resultado em 2026-11-02 |
|---|---|---|
| Legislaturas | `/api/v1/public/legislature` | 17ª a 20ª (a 20ª vai de 2023-01-01 a 2026-12-31) |
| Parlamentares | `/api/v1/public/parliamentary?size=200` | 155 registros (101 `ACTIVE`, de várias legislaturas). Filtrar por `legislatureId` = 20 |
| Matérias (lista) | `/api/v1/public/legislative-matter/filter/access?page=0&size=N&sort=id,desc` | JSON com tipo, número/ano, ementa, autores, localização atual, situação, última ação, data de apresentação e arquivos |
| Matéria (detalhe) | `/api/v1/public/legislative-matter/{id}` | Detalhe completo |
| Tramitação | `/api/v1/public/processing/filter/legislative-matter/{id}` | Andamentos com data, unidade de origem e destino, status |
| Normas | `/api/v1/public/legal-norm/filter?page=0&size=N&sort=id,desc` | 2.998 normas (Lei, Lei Complementar, Resolução Legislativa). A rota de detalhe `legal-norm/{id}` liga a norma à matéria de origem |
| Sessões plenárias | `/api/v1/public/plenary-session` | **Só 1 sessão** cadastrada (86ª Ordinária, 2026-10-07) |
| Votos | `/api/v1/public/votes/plenary-session/{id}` e `/parliamentary-vote/{voteId}?voteOptionId=` | **Vazio** (`[]`) para a única sessão existente |

### 1.2 Votação nominal: situação real
- O ALEMALEGIS tem módulo de votação e de voto nominal ("Erro ao carregar votos nominais" no código), mas **não há votos publicados**. O plenário ainda não usa o sistema novo para as sessões.
- O **Diário da Assembleia** (https://www.al.ma.leg.br/sitealema/diarios/, um PDF por dia, por exemplo `wp-content/uploads/2026/10/Diario_184_28_10_2026.pdf`) transcreve as sessões. A fórmula registrada é a da **votação simbólica**: "Em discussão. Em votação. Os Deputados e as Deputadas que aprovam permaneçam como estão. Aprovado." Na edição 184 não houve votação nominal.
- **Conclusão:** só uma eventual votação nominal transcrita no Diário pode ser usada, e com **curadoria**. Para as demais, mostrar o resultado e "Informação não disponível em fonte oficial" no voto individual.

### 1.3 Outros
- Legislação (GED da ALEMA): `legislacao.al.ma.leg.br/ged/busca.html` redireciona para o login da intranet. **Não é público.** Usar a API `legal-norm`.
- Transparência: `sistemas.al.ma.leg.br/transparencia/` (JSF com sessão; não detalhado).

---

## 2. Governo do Maranhão

### 2.1 Diário Oficial do Estado (DOE-MA)
- **Portal:** https://diariooficial.ma.gov.br/. `robots.txt` dá 404 (não existe).
- **Busca de texto integral (usada pelo próprio site):** `GET https://diariooficial.ma.gov.br/ajax.busca.php?termo=<texto>&tipo=1&datai=AAAA-MM-DD&dataf=AAAA-MM-DD`. Devolve JSON (`busca.total`, `scrollId`, `es_html`) com trechos em HTML e o código da edição (por exemplo `EX20261026` = Executivo, 26/10/2026).
  - Exemplo: a busca "decretou e eu sanciono" entre 01/10 e 02/11/2026 devolveu 2 resultados. O número parece baixo para o período, então a busca **não deve ser a única via de coleta**.
- **PDF da edição:** `https://diariooficial.ma.gov.br/download.php?arq=EX20261026` (1,6 MB, com texto). Verificado: **Lei Complementar nº 300, de 26/10/2026**, e Decreto nº 42.855, de 26/10/2026.
- Leis, decretos, vetos e **medidas provisórias estaduais** (o MA adota MP estadual; a Casa Civil lista, por exemplo, a "MP nº 255, de 27/10/2017") saem no caderno do Executivo.

### 2.2 Casa Civil
- https://www.casacivil.ma.gov.br/legislacao-casa-civil: só a legislação do próprio órgão, em PDF. Não é uma base geral.
- A legislação estadual estruturada está na API `legal-norm` da ALEMA (leis e LCs, com o PDF do texto integral).

---

## 3. Exemplos reais

| Tipo | Item | URL |
|---|---|---|
| Projeto | PLO nº 280/2026 (apresentado em 2026-10-29) | https://alemalegis.al.ma.leg.br/api/v1/public/legislative-matter/101485 |
| Tramitação | idem | https://alemalegis.al.ma.leg.br/api/v1/public/processing/filter/legislative-matter/101485 |
| Votação (simbólica, transcrita) | Diário da Assembleia nº 184, 28/10/2026 | https://www.al.ma.leg.br/sitealema/wp-content/uploads/2026/10/Diario_184_28_10_2026.pdf |
| Lei | Lei Complementar nº 300/2026 (origem: PLC 1/2026) | https://alemalegis.al.ma.leg.br/api/v1/public/legal-norm/3014 e DOE https://diariooficial.ma.gov.br/download.php?arq=EX20261026 |

---

## 4. Viabilidade

- **Proposições, tramitação e normas: automatizável total, esforço médio.** A API não tem documentação e o sistema acabou de entrar no ar; é preciso fazer testes de contrato.
- **Votação nominal: curadoria, esforço alto e baixo rendimento** (votação simbólica predominante; não há dado estruturado).
- **DOE: parcial, esforço médio** (busca útil como localizador; PDF por edição).
- **Riscos:**
  1. O sistema ALEMALEGIS é novo (só 1 sessão cadastrada). O formato pode mudar, e o histórico anterior ficou no SAPL antigo, que está fora do ar.
  2. Não há voto nominal estruturado. Nunca inferir voto individual a partir de "Aprovado".
  3. A busca do DOE devolve poucos resultados. Combinar com o download diário das edições.
  4. A filtragem de deputados por legislatura é obrigatória (o campo `activeInHouse` não basta).

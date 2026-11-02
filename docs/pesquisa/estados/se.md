# Fontes oficiais: Sergipe (SE)

Pesquisa feita com acessos reais (curl) em **2026-11-02**.
Arquivos baixados para verificação: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-nordeste-2\dl\`.

## Resumo

| Item | Melhor via | Formato | Automatizável? |
|---|---|---|---|
| Deputados (24 na lista de presença de 29/10/2026) | API Ágape: `aleselegis.al.se.leg.br/api/publico/parlamentar/` | JSON | Total |
| Proposições e tramitação | API Ágape: `aleselegis.al.se.leg.br/api/publico/proposicao/` (71.260 itens) + página `spl/processo.aspx?id=` | JSON / HTML | **Total** |
| Votações | Resultado só na tramitação ("Aprovado em 10/09/2026"); painel "Resultado da Votação" **vazio** nas proposições testadas | HTML | Parcial (resultado) / **não há voto nominal publicado** |
| Presença em plenário | `spl/sessao-parlamentares.aspx?id=` | HTML | Total |
| Normas | **LegisOn** (PGE-SE): `api.legislacao.se.gov.br/api/v1/public/acts` + legislação da Alese | JSON + PDF | **Total** |
| Diário Oficial do Estado | IOSE (plataforma Ionews): busca JSON `iose.se.gov.br/busca/busca/buscar/...` | JSON (texto por página); PDF exige login | Parcial |

**Viabilidade geral:** **alta para proposições e normas** (duas APIs JSON públicas), esforço **baixo/médio**. Voto nominal: **curadoria** (atas e áudios).

---

## 1. Assembleia Legislativa de Sergipe (Alese)

- **Portal:** https://al.se.leg.br/ (WordPress, Yoast). `robots.txt`: `User-agent: * / Disallow:` (liberado).
- **Processo legislativo:** https://aleselegis.al.se.leg.br/spl/ — sistema **SPL da Ágape Consultoria** (ASP.NET WebForms, o mesmo usado pela ALBA na Bahia). `robots.txt`: `User-agent: * / Allow: /`.

### 1.1 Deputados
- `GET https://aleselegis.al.se.leg.br/api/publico/parlamentar/?pag=1&qtd=50` → `total: 29` (inclui ex-titulares/suplentes), com `parlamentarID`, nome, partido e foto. (A resposta vem com `Content-Type: text/html`, mas o corpo é JSON.)
- A lista de presença de 29/10/2026 (`spl/sessao-parlamentares.aspx?id=20952`) tem **24 deputados** (Presente/Falta).

### 1.2 Proposições e tramitação
- **API pública (não documentada na Alese; documentada na ALBA, mesmo fornecedor):** `GET https://aleselegis.al.se.leg.br/api/publico/proposicao/?pag=1&qtd=N` → `total: 71.260`. Filtros documentados pela Ágape: `proposicaoID`, `sigla`, `numero`, `ano`, `tipoID`, `situacaoID`, `autorID`, `assunto`, `dataInicio`, `dataFinal`. Testado: `?proposicaoID=112214` (PL 299/2025, situação "Aprovado").
  - Cada item traz: tipo/sigla, número, ano, assunto (ementa), data, situação, autor, coautores, arquivo (PDF), anexos e **tramitações** (fase, setor, ação, complemento, datas).
  - Defeito observado: o campo `arquivo` vem com o domínio duplicado (`https://aleselegis.al.se.leg.br/https://aleselegis...pdf`) — tratar no coletor.
- **Páginas HTML:** `spl/consulta-producao.aspx?tipo=<id>&ano_proposicao=<ano>` (10 por página, paginação por *postback*; há botões de exportar CSV/Excel também por postback) e `spl/processo.aspx?id=<id>` (ementa, autoria, situação, histórico completo de tramitação com despachos assinados).
- Volume por tipo (página "Consulta por Tipo"): Projeto de Lei 6.511; PLC 414; PEC 69; Veto Governamental 123; Requerimento 31.386; Indicação 8.200 etc.
- **Atenção à diretriz 1:** as páginas da Alese exibem um "Resumo Gerado com Inteligência Artificial". **Não usar** esse resumo; usar só a ementa e o texto oficial.

### 1.3 Votações e voto nominal
- A página do processo tem um painel **"Resultado da Votação"** (componente `sessaovotacao`), mas ele estava **vazio** em todas as proposições aprovadas testadas (PL 299/2025, PL 187/2026 e outras duas de 2026).
- O resultado aparece apenas no texto da tramitação (ex.: "Complemento da Ação: Aprovado em 10/09/2026. Arquive-se.").
- A página de sessões (`spl/sessoes.aspx`, atualizada em 26/10/2026) só oferece **"Presença em Plenário"** por sessão; não há pauta nem votação vinculadas.
- O endpoint de sessões da API Ágape (`/api/publico/spl/sessoes/`) dá **404** na Alese.
- Atas: https://al.se.leg.br/atas-das-sessoes-legislativas/ e áudios: https://al.se.leg.br/audios-das-sessoes-legislativas/ (WordPress). Diário do Legislativo: https://aleselegis.al.se.leg.br/dl/default.aspx. Voto nominal, se houver, só nas atas → **curadoria**.

### 1.4 Normas na Alese
- https://aleselegis.al.se.leg.br/legislacao/ — `consulta-legislacao.aspx?ano=2026` e `norma.aspx?id=<id>&ano=<ano>`: espécie, número, ementa, situação ("Em vigor"), data, autoria e **link para a proposição de origem** (ex.: Lei 10.052/2026 ← PL 299/2025, processo 6325/2025), remissões ativas e passivas.

---

## 2. Governo de Sergipe

### 2.1 Legislação estadual — LegisOn (Procuradoria-Geral do Estado)
- **Portal:** https://legislacao.se.gov.br/ (SPA). **API pública:** `https://api.legislacao.se.gov.br/api/v1/`.
  - `GET public/counter` → contagem: Lei Complementar 466, Lei Ordinária 7.839, **Decreto Numerado 28.785**, Emenda Constitucional 58, atos consolidados 2.271.
  - `GET public/acts?Year=2026&TypeAct=4&Order=desc&Page=1&Quantity=15` → lista paginada (cabeçalho `x-pagination` com `totalItens`; 212 decretos em 2026). `TypeAct`: 2 = LC, 3 = Lei Ordinária, 4 = Decreto Numerado, 8 = EC.
  - `GET public/act/details?Number=<n>&ActTypeId=<tipo>` → ementa, datas do ato e da publicação, situação, iniciativa e **PDF** (link pré-assinado de armazenamento MinIO, que expira).
- Cobre leis, LCs e decretos do governador (ex.: Decreto 1.588/2026, que altera o **Regulamento do ICMS**).
- Atenção: a API devolve texto em UTF-8; nossa leitura via `curl | python` mostrou mojibake ao ler stdin no Windows, não é defeito da fonte.

### 2.2 Diário Oficial do Estado (IOSE — Imprensa Oficial de Sergipe)
- **Portal:** https://iose.se.gov.br/diario-oficial (plataforma **Ionews**, a mesma do DOE da Bahia). `robots.txt` não existe (devolve uma página HTML).
- `GET https://iose.se.gov.br/apifront/portal/edicoes/edicoes_from_data/2026-10-29.json` → edições do dia (id, número, suplemento, páginas).
- `GET https://iose.se.gov.br/busca/busca/buscar/query/0/?1=1&q=<termo>` → **JSON do Elasticsearch com o texto integral de cada página** (`_source.conteudo`, dia/mês/ano, id da edição, página).
- **Download do PDF (`/portal/edicoes/download/<id>`) e visualizador (`/portal/visualizacoes/pdf/<id>`) redirecionam para login.** Não contornar; o texto público vem da busca JSON.
- O domínio antigo `segrase.se.gov.br` não respondeu (timeout).

---

## 3. Exemplos reais (abertos em 2026-11-02)

- **Projeto:** PL 299/2025 (Semana de Combate ao Capacitismo): https://aleselegis.al.se.leg.br/spl/processo.aspx?id=112214 — dado: https://aleselegis.al.se.leg.br/api/publico/proposicao/?proposicaoID=112214
- **Votação (resultado na tramitação):** PL 187/2026: "Aprovado em 10/09/2026" — https://aleselegis.al.se.leg.br/spl/processo.aspx?id=118836 (painel de votação vazio).
- **Presença:** Sessão Ordinária nº 88, 29/10/2026: https://aleselegis.al.se.leg.br/spl/sessao-parlamentares.aspx?id=20952
- **Lei:** Lei 10.052, de 22/09/2026: https://aleselegis.al.se.leg.br/legislacao/norma.aspx?id=12626&ano=2026
- **Decreto:** Decreto 1.588, de 28/10/2026 (altera o RICMS): https://api.legislacao.se.gov.br/api/v1/public/act/details?Number=1588&ActTypeId=4

---

## 4. Viabilidade

- **Proposições e tramitação:** **total**, esforço **baixo** (API JSON Ágape; um coletor serve para Alese e ALBA).
- **Normas (leis e decretos):** **total**, esforço **baixo** (LegisOn). Cruzar com a Alese para ligar lei → projeto.
- **Votação:** só o **resultado**, extraído do texto da tramitação (parcial, esforço médio); **voto nominal: curadoria** (atas), esforço alto.
- **Riscos:** API Ágape não documentada na Alese e com defeitos (URL duplicada, content-type errado); resumos por IA nas páginas (não usar); PDF do DOE atrás de login; links de PDF do LegisOn expiram (guardar o link da página do ato, não o pré-assinado).

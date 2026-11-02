# Fontes oficiais — Minas Gerais (MG)

Pesquisa feita com acessos reais em **2026-11-02** (curl, User-Agent identificado `PlacarDoPoder-pesquisa/1.0`, sem cabeçalhos falsos). Todas as URLs abaixo foram abertas nessa data. Referência de formato: `docs/pesquisa/fontes-sp-atibaia.md`.

## Resumo

| Item | Melhor fonte | Formato | Automatizável |
|---|---|---|---|
| Deputados (77 em exercício) | API ALMG `/api/v2/deputados/em_exercicio` | JSON/XML | Total |
| Proposições e tramitação | API ALMG `/api/v2/proposicoes/...` + CSV anual | JSON/XML/CSV | Total (ver limite do robots) |
| Resultado de plenário (aprovado/rejeitado, placar) | API ALMG `/api/v2/plenario/reunioes/detalhes/...` | JSON | Total |
| **Voto nominal de plenário (nome a nome)** | **Diário do Legislativo (PDF com texto)** | PDF texto | Parcial: parser de texto + conferência |
| Voto nominal em comissão | API ALMG `/api/v2/comissoes/.../resultados` (campo `tipoVoto` por deputado) | JSON | Total (validar volume) |
| Leis, decretos, vetos | API ALMG `/api/v2/legislacao/mineira/...` + Jornal Minas Gerais | JSON + PDF | Total |

**Viabilidade geral: ALTA (o melhor dos três estados). Esforço: médio.**

---

## 1. ALMG — Assembleia Legislativa de Minas Gerais

### 1.1 API de dados abertos
- **Base:** `https://dadosabertos.almg.gov.br/api/v2/` — sem autenticação; licença CC BY-SA 4.0 (declarada na própria especificação).
- **Documentação:** Swagger em https://dadosabertos.almg.gov.br/api/ajuda/swagger/view/lastest ; especificação OpenAPI (JSON, 529 KB, versão 2.5, 160+ rotas) em https://dadosabertos.almg.gov.br/api/ajuda/swagger/endpoints/lastest
- **Formato:** XML por padrão; JSON com `&formato=json`.
- **Arquivos em lote (CSV):** https://dadosabertos.almg.gov.br/documentacao/arquivos — proposições por ano (desde 1959), tramitação, legislação mineira (desde 1947), deputados.
- **robots.txt** (https://dadosabertos.almg.gov.br/robots.txt): permite `/api/v2/`, mas **proíbe URLs com os parâmetros `p=`, `ord=`, `tp=` e `ordenacao=`** (paginação e ordenação). Consequência: coletor pode ler apenas a 1ª página (20 itens) de cada pesquisa. Para cargas completas usar os **CSV** de `/documentacao/arquivos`, e para o dia a dia, consultas filtradas por data (`ini`/`fim`) que caibam em uma página. **Não paginar a API.**
- O `robots.txt` de `www.almg.gov.br` proíbe `/atividade_parlamentar/` e `/apps/api/`, entre outros; as páginas de proposição usadas como link (abaixo) não estão nesses caminhos.

Rotas testadas:

| Dado | Rota | Resultado em 2026-11-02 |
|---|---|---|
| Deputados em exercício | `/deputados/em_exercicio?formato=json` | 77 deputados (id, nome, partido) |
| Proposições | `/proposicoes/pesquisa/direcionada?tipo=PL&ano=2026&formato=json` | 1.086 PL de 2026; mais recente PL 6.214/2026 (publicado 23/10/2026), com autor, ementa, situação, regime, local, fases de tramitação |
| Detalhe | `/proposicoes/{tipo}/{num}/{ano}?formato=json` | ex.: VET 36/2026 → "Veto rejeitado totalmente" |
| Reuniões de plenário | `/plenario/reunioes/pesquisa?ini=20261001&fim=20261031&formato=json` | 14 reuniões em out/2026, com link de vídeo (YouTube) |
| Resultado da reunião | `/plenario/reunioes/detalhes/2026/10/28/14:00?formato=json` | ordem do dia com o **resultado de cada proposição** (ex.: "Rejeitado o veto, com nenhum voto a favor e 46 votos contrários") — **sem lista de nomes**. Dados desde maio/2023 |
| Votos em comissão | `/comissoes/proposicao/{tipo}/{num}/{ano}/reunioes/resultados` | esquema `EsquemaVotacaoComissao` → `votacoes[]` com `deputado` e `tipoVoto` |
| Diário do Legislativo | `/diario_legislativo/pesquisa?ini=20261029&fim=20261101&formato=json` | URLs dos PDFs (ex.: edição de 30/10/2026: https://mediaserver.almg.gov.br/acervo/663/66/2663066.pdf) |
| Legislação mineira | `/legislacao/mineira/pesquisa/direcionada?tipo=LEI&ano=2026&formato=json` | 379 leis de 2026; mais recente Lei 26.054, de 01/09/2026; texto integral em HTML no campo `texto` e link da publicação |
| Decretos | idem com `tipo=DEC` | 148 decretos de 2026; mais recente Decreto 49.306, de 27/10/2026, com link para o Jornal Minas Gerais |

### 1.2 Votação nominal em plenário
- **Existe e é registrada nome a nome no Diário do Legislativo** (ata da reunião), PDF **com camada de texto** (pdftotext funciona). Formato encontrado na edição de 30/10/2026 (ata da 36ª Reunião Ordinária, 28/10/2026):
  - "A presidência vai submeter a matéria a votação pelo processo nominal. … Procede-se à votação por meio eletrônico. … Votaram "sim" 38 deputados. Votaram "não" 10 deputados …"
  - "– Registraram "sim": Adalclever Lopes (PV) Adriano Alvarenga (PP) …" e "– Registraram "não": …" — nome e partido.
  - Há **correções orais** ("Registre-se o voto "sim" do deputado X"), que alteram o total proclamado: o parser deve somá-las e conferir com o total.
- Nessa única reunião houve ~15 votações nominais (vetos, PL em 1º e 2º turnos, projetos de resolução de contas do TCE). Na ALMG o processo nominal é usado com frequência.
- A API **não** traz os nomes do plenário (só o placar no texto da ação). Estratégia: API para saber *quais* proposições foram votadas e o placar; PDF do Diário para os nomes; conferir soma de nomes = placar.

### 1.3 Exemplos reais
- Projeto: PL 6.214/2026 — https://www.almg.gov.br/projetos-de-lei/PL/6214/2026/ (API: https://dadosabertos.almg.gov.br/api/v2/proposicoes/PL/6214/2026?formato=json)
- Votação: Veto 36/2026 (veto parcial à Proposição de Lei 26.939, defesa sanitária animal), rejeitado 0 × 46 em 28/10/2026 — resultado: https://dadosabertos.almg.gov.br/api/v2/plenario/reunioes/detalhes/2026/10/28/14:00?formato=json ; nomes: Diário do Legislativo de 30/10/2026 https://mediaserver.almg.gov.br/acervo/663/66/2663066.pdf
- Lei: Lei 26.054/2026 — https://www.almg.gov.br/legislacao-mineira/texto/LEI/26054/2026/ (publicação: https://diariolegislativo.almg.gov.br/2026/L20260902.pdf)

## 2. Governo de MG — Jornal Minas Gerais (Diário Oficial)
- **Portal:** https://www.jornalminasgerais.mg.gov.br (SPA Angular). API interna, sem documentação, descoberta no código do próprio site: base `https://www.jornalminasgerais.mg.gov.br/api/v1/`.
  - `Jornal/ObterUltimaEdicao` → JSON com cadernos (Diário do Executivo, Diário dos Municípios Mineiros, Diário de Terceiros), seções com página inicial, e `arquivoCadernoPrincipal.arquivo` = PDF assinado (CMS/PKCS#7) em base64.
  - `Jornal/ObterEdicaoPorDataPublicacao?dataPublicacao=…`, `Jornal/ObterEdicaoPorId/{id}`, `Jornal/ListarEdicoesParaCalendario?MesPublicacao=&AnoPublicacao=`, `Pesquisa/PesquisarJornaisPaginados?DataPublicacaoInicial=&DataPublicacaoFinal=&TextoPesquisa=&DiarioExecutivo=…`.
  - Testado: edição de 30/10/2026 (Diário do Executivo, 73 páginas, id 331277). O PDF extraído do envelope assinado tem texto: "DECRETO Nº 49.307, DE 29 DE OUTUBRO DE 2026", "DECRETO NE Nº 1.058…" na seção "Governo do Estado".
- **robots.txt:** não existe (o servidor devolve a página do SPA). Sem bloqueio declarado; usar baixa frequência (1 edição/dia).
- **Leis, decretos e vetos:** a ALMG já indexa leis e decretos com texto e link da publicação (seção 1.1), o que dispensa ler o Jornal para o catálogo. Vetos: a ALMG registra a proposição "VET n/ano" com a mensagem do governador (razões do veto) e o resultado da apreciação.
- **Atenção a dados pessoais:** o Diário do Executivo traz nomes e MASP de servidores (férias-prêmio etc.). Coletar só as seções de atos normativos; aplicar a diretriz 12.

## 3. Viabilidade
- **Automatizável:** deputados, proposições, tramitação, resultados de plenário, votos de comissão, leis e decretos — **total**. Voto nominal de plenário — **parcial** (parser do texto do Diário do Legislativo + conferência de soma; conferência humana por amostragem).
- **Esforço: médio.** Reaproveitar o desenho do coletor da ALESP (`scripts/coleta/alesp/`), trocando o parser de PDF por coordenadas por um parser de texto corrido (mais simples que o da ALESP).
- **Riscos:** (1) robots proíbe paginação → depender de CSV e de janelas de data; (2) API do Jornal Minas Gerais é interna e pode mudar; (3) formato de ata com correções orais; (4) nomes de deputados sem id no PDF → casar com a lista da API por nome+partido; (5) período eleitoral explica poucas leis em set–out/2026 (última lei indexada é de 01/09/2026) — monitorar se a indexação está atrasada.

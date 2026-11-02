# Fontes oficiais — Espírito Santo (ES)

Pesquisa feita com acessos reais em **2026-11-02** (curl, User-Agent identificado `PlacarDoPoder-pesquisa/1.0`, sem cabeçalhos falsos). Todas as URLs abaixo foram abertas nessa data.

## Resumo

| Item | Melhor fonte | Formato | Automatizável |
|---|---|---|---|
| Deputados | API ALES `/api/publico/parlamentar/` | JSON | Total |
| Proposições e tramitação | API ALES `/api/publico/proposicao/` | JSON (+ PDF do texto) | Total |
| Sessões, atas, pautas | API ALES `/api/publico/spl/sessoes` + PDFs da sessão | JSON + PDF | Total (lista); detalhe da sessão com erro |
| **Voto nominal (nome a nome)** | **"Boletim de Votação Nominal" (tipo `RVP`) na API de proposições** | PDF com texto, tabular | **Total** (parser simples) |
| Leis | API ALES `/api/publico/legislacao` | JSON + HTML | Total |
| Decretos, sanções, vetos | DIO-ES (API do portal) | JSON + PDF | Parcial |

**Viabilidade geral: ALTA. Esforço: baixo/médio.**

---

## 1. ALES — Assembleia Legislativa do Espírito Santo

### 1.1 API pública ("Ales Digital", sistema SPL)
- **Catálogo:** https://www3.al.es.gov.br/dados-abertos.aspx (proposições, parlamentares, sessões) e https://www3.al.es.gov.br/legislacao/dados-aberto.aspx (normas). A descrição das rotas está em `https://www3.al.es.gov.br/spl/js/dados-abertos.js` e `.../legislacao/js/dados-aberto.js`. Sem autenticação.
- **Formato:** JSON `{ total, Data[], Paginacao, message, dataRequisicao }`; paginação `pag`/`qtd`.
- **robots.txt:** inexistente em `www.al.es.gov.br` e `www3.al.es.gov.br` (404). Sem bloqueio declarado; usar baixa frequência.

Rotas testadas:

| Dado | Rota | Resultado em 2026-11-02 |
|---|---|---|
| Deputados | `/api/publico/parlamentar/?pag=1&qtd=100` | 35 registros da 20ª legislatura (titulares ativos, titulares afastados e suplentes que exerceram), com partido e situação |
| Proposições | `/api/publico/proposicao/?pag=1&qtd=N&ano=2026` (filtros: `sigla`, `numero`, `ano`, `autorID`, `dataInicio`, `dataFinal`, `situacaoID`…) | 139.498 registros no total; mais recente PLC 29/2026 (29/10/2026), com tramitações, anexos e PDF do texto |
| Sessões | `/api/publico/spl/sessoes/?pag=1&qtd=5` | 1.790 sessões; última 109ª Ordinária Híbrida, 28/10/2026 |
| Detalhe de sessão | `/api/publico/spl/sessoes/?id=2938` | **HTTP 500** (erro interno "LINQ to Entities…") — usar a página `https://www3.al.es.gov.br/spl/sessoes.aspx`, que lista atas, avulsos, pautas e presença em PDF |
| Normas | `/api/publico/legislacao?pag=1&qtd=5&ano=2025` | leis com ementa, origem, situação e texto em HTML (ex.: Lei 12.957, de 13/10/2026) |

- **Atenção (diretriz 12):** o campo `AutorRequerenteDados` da API de proposições traz **CPF, e-mail e telefone** do autor/servidor que protocolou. Esses campos **nunca** podem ser gravados nem exibidos; o coletor deve descartá-los na leitura.
- O filtro `sigla` foi ignorado na rota de legislação nos testes (devolveu tipos misturados); filtrar no próprio coletor ou usar `tipoId`.

### 1.2 Votação nominal
- **Existe e é publicada como documento próprio:** tipo de proposição **`RVP` — "Boletim de Votação Nominal"** (462 boletins no total). Cada boletim é um PDF gerado pelo painel eletrônico, assinado digitalmente, com camada de texto e layout tabular:
  - cabeçalho (sessão, proposição, turno, "Modo: Nominal", início/término);
  - uma linha por deputado: `NOME (PARTIDO)  Sim|Não|Abstenção|Ausente  hora`;
  - totais e resultado ("Totais: Sim: 21 Não: 0 Abstenção: 1 — Resultado: Aprovada").
  - `pdftotext -layout` lê as colunas corretamente (testado) — bem mais simples que o PDF da ALESP.
- Observação a conferir: no boletim de 20/10/2026 há deputados marcados "Ausente" **com** horário registrado. Exibir exatamente como no documento, sem interpretar.
- A maior parte das votações é **simbólica** (ex.: a LDO 2027, PL 286/2026, foi "posta em votação" e aprovada sem registro nominal — ata de 21/10/2026). Só há voto individual quando existe boletim RVP.
- As atas resumidas trazem só presença (painel) e ausências; não trazem votos.

### 1.3 Exemplos reais
- Projeto: PL 545/2026 — https://www3.al.es.gov.br/Arquivo/Documents/2026/10/28/PL/497836-20261028144546712_ca5d7b27(9087104).pdf (API: `/api/publico/proposicao/?proposicaoID=497836`)
- Votação nominal: PLC 28/2026 (emendas parlamentares impositivas), 36ª Sessão Extraordinária, 20/10/2026, aprovado 21 Sim × 0 Não × 1 Abstenção — https://www3.al.es.gov.br/Arquivo/Documents/2026/10/20/RVP/497392-RVP532026-20261020163242665_213c4f6c(3559).pdf
- Lei: Lei 12.957/2026 (13/10/2026) — https://www3.al.es.gov.br/Arquivo/Documents/legislacao/html/LEI129572026.html
- Ata de sessão: 37ª Extraordinária, 21/10/2026 — https://www3.al.es.gov.br/Arquivo/Documents/SES/2936/sessao_2936_20261021130018046_03dcd4d3.pdf

## 2. Governo do ES — DIO-ES (Diário Oficial dos Poderes do Estado)
- **Portal:** https://ioes.dio.es.gov.br/portal/visualizacoes/diario_oficial. API interna (descoberta em `/theme/Es/js/controllers/home.js`):
  - `/apifront/portal/edicoes/ultimas_edicoes.json` → lista de edições (id, data, número, edição extra). Testado: 827 itens, última edição 29/10/2026 (nº 26.840, com duas extras).
  - `/apifront/portal/edicoes/edicoes_from_data/{data}.json`, `/apifront/portal/edicoes/busca_edicao/…`
  - PDF integral: `/portal/edicoes/download/{id}` (testado id 11595: 5,6 MB, PDF com texto; contém "DECRETO Nº 2265-S, DE 28 DE OUTUBRO DE 2026" etc.).
  - Busca textual: formulário `/buscanova`.
- **robots.txt:** inexistente (404).
- Leis sancionadas e vetos são publicados no DIO-ES; a ALES indexa as leis (seção 1.1), não os decretos do Executivo (nenhum decreto de 2026 apareceu na amostra da API de legislação). Os decretos exigem leitura do PDF diário e separação dos atos por heurística ("DECRETO Nº … DE …").
- O DIO-ES também publica atos de pessoal com nomes de servidores e particulares: aplicar a diretriz 12.

## 3. Viabilidade
- **Automatizável:** deputados, proposições, tramitação, boletins de votação nominal, leis — **total**. Decretos e vetos do governador — **parcial** (PDF diário + heurística + curadoria leve).
- **Esforço: baixo/médio.**
- **Riscos:** (1) API interna sem versão — mudanças sem aviso; (2) rota de detalhe de sessão quebrada (500); (3) API expõe CPF/e-mail — risco de vazamento se o coletor gravar o JSON bruto; (4) nomes no boletim em maiúsculas e abreviados ("DEL DANILO BAHIENSE", "DR BRUNO RESENDE") → tabela de correspondência com `parlamentarID`; (5) boletim vinculado à proposição votada só pelo texto do campo `assunto` ("PROJETO DE COMPLEMENTAR Nº 28/2026 - APROVADO…") → casar por regex e conferir.

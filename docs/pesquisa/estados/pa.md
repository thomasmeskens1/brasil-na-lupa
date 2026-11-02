# Pará (PA): fontes oficiais

Pesquisa feita com acessos reais em **2026-11-02** (curl e Python, com o agente `PlacarDoPoder-pesquisa/1.0`).
Scripts e respostas: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-norte\` (`out/pavn2.html`, `out/pavd.html`, `out/papd.html`, `out/paprop2.html`).

## 1. Assembleia Legislativa (ALEPA)

| Item | Onde | Formato | Observação |
|---|---|---|---|
| Portal | https://www.alepa.pa.gov.br/ (ASP.NET MVC com DevExpress) | HTML | robots.txt: **404** (sem restrição declarada) |
| Deputados | https://www.alepa.pa.gov.br/Home/Page/Deputados | HTML | **41 deputados**: na votação nominal abaixo, 25 votaram SIM e 16 não votaram, todos com o partido |
| Proposições | https://www.alepa.pa.gov.br/Legislativo/Proposicoes (formulário: `Ano`, `Numero`, `DataInicio`, `DataFim`, tipo, autor, `Texto`) | HTML (POST) | Um POST com `Ano=2026&DataInicio=01/10/2026&DataFim=31/10/2026` devolveu **100 resultados (10 páginas; parece ser um limite)**. Ficha: `/Legislativo/DetalhesProposicao?IdProposicao={id}`, com tipo, autor, ementa, regime, **situação**, pareceres das comissões (relator e data), **votação em plenário por turno** ("VOTAÇÃO NOMINAL", data, resultado) e anexos. PDF: `https://downloads.alepa.pa.gov.br/Projeto/{id}.PDF` |
| **Votações nominais** | https://www.alepa.pa.gov.br/Legislativo/VotacoesNominais (POST `Ano`, `Mes`) | **HTML**, com download em **DOC e PDF** | Lista por mês (data, projeto, turno). O detalhe em `/Legislativo/DetalhesVotacaoNominal?IdProposicao={p}&IdVotacao={v}` traz tipo e número da sessão, projeto, data, autor, turno, resultado e as listas **SIM / NÃO / ABSTENÇÃO / NÃO VOTARAM**, com **nome e partido** e as quantidades. Também `&type=PDF` ou `&type=DOC` |
| Pautas e atas | `/Home/Page/PautasdoPlenario`, `/Home/Page/AtasdasSessoes`, "Resumo do Plenário" | HTML/PDF | Não exploradas a fundo |
| **Banco de Leis (API aberta)** | https://bancodeleis.alepa.pa.gov.br/api.php (documentação) e **`/api/leis.php`** | **JSON** | Parâmetros `numero`, `ano`, `q` e `tipo`; **até 50 resultados por chamada**; campos `id`, `numero`, `ano`, `tipo`, `ementa`, `link_pdf`. O portal diz ter 30.118 leis. Tipos: Lei Ordinária, Lei Complementar, **Decreto Estadual**, Decreto Legislativo, Emendas Constitucionais e Resoluções. robots.txt: 404 |

## 2. Governo do Estado

| Item | Onde | Formato | Observação |
|---|---|---|---|
| DOE-PA (IOEPA) | http://www.ioepa.com.br/portal/ (atrás do Cloudflare) | PDF | O robots.txt só traz o texto padrão de "content signals" do Cloudflare, sem regras `Disallow`. A edição do dia está em http://www.ioepa.com.br/Frame/ (formulário com data e token antifalsificação): **os PDFs ficam no Google Drive** (`drive.google.com/uc?id=…&export=download`), e a capa em `ioepa.com.br/pages/2026/2026.10.29.DOE.jpg`. Última edição vista: **29/10/2026 (DOE + Extra)** |
| Busca no DOE | http://www.ioepa.com.br/pesquisa/ (POST para `/pesquisa/resultado/QueryTexto`, que redireciona para `/pesquisa/?q=&di=&df=`) | HTML | **Respondeu "Error. An error occurred while processing your request."** em 2026-11-02 |
| Legislação | O Banco de Leis da ALEPA (acima) inclui decretos estaduais | JSON + PDF | Não explorei o portal de legislação da Casa Civil ou do Governo |

## 3. Exemplos reais

- **Projeto:** PLC 10/2026 (autor: Ministério Público do Estado), sobre a "elevação de entrância das Promotorias de Justiça de Parauapebas". Situação: "AGUARDAR SANÇÃO OU VETO". https://www.alepa.pa.gov.br/Legislativo/DetalhesProposicao?IdProposicao=16339; PDF em https://downloads.alepa.pa.gov.br/Projeto/16339.PDF.
- **Votação nominal:** a mesma matéria, 1º turno, 29ª Sessão Ordinária, 27/10/2026, "APROVADA": 25 SIM, 0 NÃO, 0 ABSTENÇÃO, 16 NÃO VOTARAM. https://www.alepa.pa.gov.br/Legislativo/DetalhesVotacaoNominal?IdProposicao=16339&IdVotacao=8869. Em out/2026 houve 8 votações nominais (PLC 8, 9 e 10/2026 e PEC 8/2026, em 1º e 2º turnos).
- **Lei:** Lei Ordinária 11.666/2026 (diretrizes para a LOA 2027): https://bancodeleis.alepa.pa.gov.br/api/leis.php?ano=2026, PDF em https://bancodeleis.alepa.pa.gov.br/arquivos/lei_20260805105738_151029fb.pdf.

## 4. Viabilidade

- **Votos nominais e leis: automatizáveis** (esforço **médio**). Os votos nominais vêm em HTML bem estruturado (com PDF e DOC como prova); a API do Banco de Leis é aberta e documentada. A ALEPA só registra votação nominal em parte das matérias (PLC e PEC em out/2026); as demais são simbólicas, e o resultado aparece na ficha.
- **Proposições: automatizáveis em parte** (esforço **médio**). Os POSTs do DevExpress funcionam sem estado, mas a lista corta em 100 itens, então é preciso consultar por janelas de datas curtas.
- **DOE: curadoria** (esforço **alto**). Os PDFs ficam no Google Drive, a busca está quebrada e o formulário exige token. O Banco de Leis substitui em parte (leis e decretos), mas vetos e razões de veto exigem o DOE.
- **Riscos:** os componentes DevExpress mudam com atualizações do portal; o Cloudflare na IOEPA pode passar a bloquear; o limite de 50 resultados por chamada na API de leis (paginar por número ou tipo); o campo "Quantidade" deve ser conferido contra a lista de nomes.

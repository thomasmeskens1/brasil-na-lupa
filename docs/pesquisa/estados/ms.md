# Mato Grosso do Sul (MS): fontes oficiais

Pesquisa feita com acessos reais em **2026-11-02**. Regras seguidas: só fontes oficiais, `robots.txt` respeitado e nenhuma proteção anti-robô contornada.

## Resumo

| Item | Melhor via | Formato | Automatizável |
|---|---|---|---|
| Deputados (24) | Lista de votação no Diário Oficial da ALEMS; o portal monta o menu por JavaScript | PDF (imagem) | Parcial |
| Proposições e tramitação | SGPL (`sgpl.consulta.al.ms.gov.br`). **API protegida por CAPTCHA** | JSON (bloqueado) | **Não** sem acordo com a ALEMS |
| **Votos nominais** | **Diário Oficial Eletrônico da ALEMS**: "Lista de votação" de cada item, **Modo: Nominal**, com voto de cada deputado | **PDF com o relatório como imagem** | Parcial (exige OCR + conferência) |
| Normas | Base "Legislação Governadoria" (Lotus Domino, views em XML) + DOE-MS (PDF com URL previsível) | XML + PDF | Sim |

---

## 1. Assembleia Legislativa (ALEMS)

- **Portal:** https://al.ms.gov.br/ (robots.txt: 404, sem restrição). O menu é carregado por script. Páginas acessadas: `/OrdemDoDia` (texto da ordem do dia, ex.: "Sessão Ordinária do dia 28/10/2026"). As URLs `/Deputados` e `/Legislacao` retornam 404.
- **Sistema de proposições (SGPL):** https://sgpl.consulta.al.ms.gov.br/sgpl-publico/#/busca-proposicoes (AngularJS). O código público expõe a API `/sgpl/sgpl-api/public/{proposicao/:id, tipoProposicao, atividade/filtro, proponente/autoria...}`. **Todas as chamadas testadas responderam `403 Invalid CAPTCHA solution`** (há um serviço de CAPTCHA no front-end). Por regra, **não contornamos**: a coleta automática de proposições e tramitação **depende de acordo com a ALEMS** (pedido via SIC: https://www.transparencia.al.ms.gov.br/pages/index.php/sic). Consulta manual por pessoa no navegador é possível.
- **Diário Oficial Eletrônico da ALEMS:** https://diariooficial.al.ms.gov.br/ (sem robots.txt). Lista das edições em JSON, a mesma usada pela página: `GET https://diariooficial.al.ms.gov.br/DiarioOficial/DiarioList?retNum=&retDT=` → `[{id, dtPub, numDiario, linkURL:"/DiarioOficial/DownloadPdf?q=..."}]`. A edição tem texto selecionável, com seções "Ordem do Dia" e "Matéria Apreciada" (ex.: "APROVADO. VAI À REDAÇÃO FINAL.").
- **Votação nominal: existe e é publicada.** Depois de cada matéria apreciada vem a nota "Relatório de votação publicado em atendimento ao disposto no art. 224, §6º do RIAL" e o relatório **"Lista de votação"**. Ele traz: item (ex.: "PL Nº 00354/2023 – Autoria Deputada Mara Caseiro"), turno, **Modo: Nominal**, início e término, autores, ementa e uma linha por deputado (nome, partido, voto: Sim / Não votou / Ausente / Presidente, e hora), além de totais (SIM 16, NÃO 0, ABSTENÇÃO 0) e resultado (APROVADA). O relatório é assinado pelo 2º Secretário. **Formato: a lista é inserida como imagem** (faixas horizontais) dentro do PDF, então o `pdftotext` não a lê. **É preciso OCR**, com conferência humana dos nomes e votos.
- **Atualização:** diária (edição nº 3175 de 29/10/2026 traz a sessão de 28/10/2026; a ordem do dia de 03/11/2026 já está publicada).
- **Vídeo:** https://www.youtube.com/c/assembleialegislativadems (apoio para curadoria).

## 2. Governo de MS

- **Diário Oficial do Estado (DOE-MS):** https://www.imprensaoficial.ms.gov.br/ → https://www.diariooficial.ms.gov.br/ (Next.js). O domínio antigo `spdo.ms.gov.br` **não resolve mais (NXDOMAIN)**. Os PDFs ficam em armazenamento público com **URL previsível**: `https://assets.imprensaoficial.ms.gov.br/public/prd/Diario%20Oficial/AAAA/MM/DD/DO{numero}_{DD}_{MM}_{AAAA}.pdf` (suplementos com `_SUP_1`). O PDF tem texto e sumário por tipo ("DECRETO NORMATIVO", "DECRETO ORÇAMENTÁRIO", "LEI COMPLEMENTAR"...). O `robots.txt` do assets responde 403 (bucket); não há restrição declarada. O portal tem um índice de matérias (`materiadoe.ms.gov.br`), não analisado.
- **Legislação (Governadoria):** https://aacpdappls.net.ms.gov.br/appls/legislacao/secoge/govato.nsf (Lotus Domino; sem robots.txt). Views: `Lei Estadual`, `Lei Complementar`, `Decreto`, `DecretoE`, `Emenda`, **`Mensagem Veto`**... Leitura estruturada pela interface padrão do Domino: `.../govato.nsf/Lei%20Estadual?ReadViewEntries&Expand=1&Count=N` → XML com número, data e ementa, mais o `unid`. Documento: `.../govato.nsf/Lei%20Estadual/{unid}?OpenDocument`. 2026 tem 104 leis (a mais recente é a Lei 6.646, de 23/10/2026). **Atenção:** a view "Mensagem Veto" tem como ano mais recente **2023**, então parece desatualizada. Os vetos recentes precisam ser buscados no DOE-MS.

## 3. Exemplos reais (abertos em 2026-11-02)

- **Projeto:** PL 354/2023 (Dep. Mara Caseiro, sistematização de dados sobre violência contra a mulher), Processo 517/2023, aprovado em 2ª discussão em 28/10/2026 e na Ordem do Dia de 03/11/2026 para redação final. Diário ALEMS nº 3175, págs. 3–4.
- **Votação nominal:** "Lista de votação", 96ª Sessão Ordinária, 28/10/2026, PL 354/2023, 2ª votação, Modo Nominal, SIM 16 / NÃO 0 / ABSTENÇÃO 0, APROVADA: https://diariooficial.al.ms.gov.br/DiarioOficial/DownloadPdf?q=Na3YAxMstCs77YvRjIg8jg== (pág. 4).
- **Lei:** Lei 6.642, de 23/10/2026, e Lei Complementar 356, de 23/10/2026: DOE-MS nº 12.314 de 26/10/2026, https://assets.imprensaoficial.ms.gov.br/public/prd/Diario%20Oficial/2026/10/26/DO12314_26_10_2026.pdf. Ficha da Lei 6.646/2026: https://aacpdappls.net.ms.gov.br/appls/legislacao/secoge/govato.nsf/Lei%20Estadual/A201B9338AA3695C04258E9C0044767F?OpenDocument

## 4. Viabilidade

- **Classificação: parcial.** Normas: **automatizável** (XML do Domino + PDFs do DOE). Votos nominais: **automatizável com OCR + curadoria**, pois o dado oficial existe e é rico. Proposições e tramitação: **bloqueadas por CAPTCHA**, o que exige acordo ou pedido formal; até lá, extrair do Diário da ALEMS (ordem do dia e matéria apreciada).
- **Esforço:** médio/alto (por causa do OCR).
- **Riscos:** (1) o OCR pode errar nomes e votos, então a conferência humana é obrigatória antes de atribuir voto (diretriz 5); (2) o SGPL com CAPTCHA impede a descoberta automática de proposições; (3) a base de vetos está desatualizada; (4) as URLs do DOE-MS mudaram recentemente (o domínio spdo foi desativado).
- **Recomendação:** pedir à ALEMS (SIC) o relatório de votação em formato aberto (CSV/JSON) e acesso à API do SGPL sem CAPTCHA para fins de dados abertos.

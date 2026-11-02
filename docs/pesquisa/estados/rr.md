# Roraima (RR): fontes oficiais

Pesquisa feita com acessos reais em **2026-11-02** (curl e Python, com o agente `PlacarDoPoder-pesquisa/1.0`).
Scripts e respostas: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-norte\` (`out/sapl.al.rr.leg.br.*`, `out/iorr10.html`, `dl/rr_ata21.pdf`).

## 1. Assembleia Legislativa (ALE-RR)

| Item | Onde | Formato | Observação |
|---|---|---|---|
| Portal | https://al.rr.leg.br/ (WordPress) | HTML | robots.txt (Yoast): `Disallow:` vazio, tudo liberado. "Leis Estaduais" aponta para o SAPL |
| Sistema legislativo | **SAPL 3**: https://sapl.al.rr.leg.br/ (API em `/api/`) | **JSON** + HTML + PDF/DOCX | Sem autenticação |
| Deputados | `/api/parlamentares/mandato/?legislatura=9` | JSON | 25 mandatos (24 titulares) na 9ª legislatura. *O SAPL registra a legislatura como "2023–2026", com `data_fim` em 2026-12-31* |
| Proposições | `/api/materia/materialegislativa/` | JSON | 19.287 no total; **774 de 2026**. Mais recente: Substitutivo 5/2026, de 30/10/2026 |
| Tramitação | `/api/materia/tramitacao/` | JSON | 89.417 registros; o último é de 30/10/2026 |
| Sessões | `/api/sessao/sessaoplenaria/` | JSON | 285 sessões, com `upload_pauta` (DOCX), `upload_anexo` (expediente, em PDF) e **`upload_ata` (PDF)**; a 23ª Ordinária está marcada para 03/11/2026 |
| Ordem do dia | `/api/sessao/ordemdia/` | JSON | 4.005 itens, 3.347 marcados `tipo_votacao=2` (nominal), **mas sem nenhum registro de resultado** |
| **Voto nominal** | `/api/sessao/votoparlamentar/` e `/registrovotacao/` | — | **0 registros nos dois**. A ALE-RR não lança votos no SAPL |
| Atas | ex.: `…/sessaoplenaria/320/ata/ata_da_21a_sessao_ordinaria_de_2026.pdf` | **PDF digitalizado com OCR** (texto com ruído) | Lista as matérias com "(aprovado)", sem placar e sem votos individuais |
| Normas | `/api/norma/normajuridica/` | JSON + PDF | 5.354 normas; **158 de 2026**; a mais recente é a Lei 2.421, de 14/10/2026 |

**robots.txt** (`sapl.al.rr.leg.br`): **`Crawl-delay: 60`**; bloqueia só `/materia/docacessorio/pdf|zip/*`.

## 2. Governo do Estado

| Item | Onde | Formato | Observação |
|---|---|---|---|
| DOE-RR (Imprensa Oficial) | https://imprensaoficial.rr.gov.br/_inicial/ | PDF (com camada de texto) | Lista por mês em `/_visualizar-mes/?ano=2026&mes=10` (18 edições em out/2026; a última é de **29/10/2026, 5,18 MB**). O PDF sai por **POST em `/_visualizar-doe/` com `doe=2026/10/doe-20261029.pdf`** (devolve o PDF direto; testado). robots.txt: 404 |
| Busca no DOE | `/_buscar/?termos=` | Google Custom Search (JavaScript) | Não serve para coleta |
| Legislação | O SAPL da ALE-RR (leis, LCs, decretos legislativos) | JSON + PDF | **Os decretos do governador só aparecem no DOE.** Não encontrei portal de legislação do Executivo |

## 3. Exemplos reais

- **Projeto:** PLC 12/2026 (30/10/2026), altera a LC 53/2001 (regime jurídico dos servidores), https://sapl.al.rr.leg.br/materia/19558.
- **Votação:** 21ª Sessão Ordinária (20/10/2026). A ata registra os PLs 020/2025, 108/2025, 119/2025 e 203/2025 como "(aprovado)". https://sapl.al.rr.leg.br/media/sapl/public/sessaoplenaria/320/ata/ata_da_21a_sessao_ordinaria_de_2026.pdf. **Não há voto nominal.**
- **Lei:** Lei Ordinária 2.421, de 14/10/2026 (suspensão do prazo de validade de concursos durante o período eleitoral), https://sapl.al.rr.leg.br/norma/5431, PDF em http://sapl.al.rr.leg.br/media/sapl/public/normajuridica/2026/5431/lei_no_2421_de_14_de_outubro_de_2026.pdf.
- **DOE:** edição de 29/10/2026 (POST acima).

## 4. Viabilidade

- **Proposições, tramitação e normas: automatizáveis** (esforço **baixo**, com o coletor SAPL comum).
- **Votações: curadoria** (esforço **alto**). Há só a ata em PDF digitalizado, com resultado "aprovado" por item; não há placar nem votos individuais. O site exibe "Informação não disponível em fonte oficial" para o voto de cada deputado.
- **DOE: automatizável em parte** (esforço **médio**). A lista mensal é HTML e o PDF sai por POST, mas separar os atos (decretos, vetos) exige curadoria.
- **Riscos:** o OCR das atas é ruidoso (ex.: "Prometod e Lei"), então os resultados extraídos precisam de conferência humana; o `tipo_votacao=2` marcado sem resultado não pode ser lido como votação nominal; a legislatura está mal cadastrada (data de fim).

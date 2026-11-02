# Tocantins (TO): fontes oficiais

Pesquisa feita com acessos reais em **2026-11-02** (curl e Python, com o agente `PlacarDoPoder-pesquisa/1.0`).
Scripts e respostas: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-norte\` (`out/sapl.al.to.leg.br.*`, `out/doeto*.html`, `out/alto_leg.html`).

## 1. Assembleia Legislativa (AL-TO)

| Item | Onde | Formato | Observação |
|---|---|---|---|
| Portal | https://www.al.to.leg.br/ | HTML | robots.txt: 404 (sem restrição). Menus: "Legislação Estadual", "Diário da Assembleia", "Matérias Legislativas" e "SAPL" (que redireciona para `sapl.al.to.leg.br`) |
| Sistema legislativo atual | **SAPL 3**: https://sapl.al.to.leg.br/ (API em `/api/`) | **JSON** + HTML + PDF/DOC | Sem autenticação. *A página `/materiasLegislativas` do portal ainda diz que o SAPL "foi descontinuado em Março de 2016" e manda para o sistema Legis (`legis.al.to.leg.br/legis/consultaExterna/localizarProcessos.jsp`, que está no ar). O aviso se refere ao SAPL antigo: o SAPL 3 atual tem dados de 2026* |
| Deputados | `/api/parlamentares/mandato/?legislatura=11` | JSON | 27 mandatos, 24 titulares, na 10ª legislatura (2023–2027) |
| Proposições | `/api/materia/materialegislativa/` | JSON | 14.545 no total; **1.093 de 2026**. Tipos com a origem no nome ("Projeto de Lei da Casa", "do Executivo", "do TJ", "Mensagem de Veto", "Medida Provisória"…); 35 tipos ao todo |
| Tramitação | `/api/materia/tramitacao/` | JSON | 17.967 registros; o último é de 28/10/2026 |
| Sessões | `/api/sessao/sessaoplenaria/` | JSON | 390 sessões, mas **a última cadastrada é de 12/05/2026** (196ª Ordinária), com pauta em DOC |
| Ordem do dia e votos | `/api/sessao/ordemdia/`, `registrovotacao/`, `votoparlamentar/` | — | **76 itens de ordem do dia (o último de 2020); 0 resultados; 0 votos nominais** |
| Normas (SAPL) | `/api/norma/normajuridica/` | JSON + PDF | 1.581 normas; **164 de 2026**; as mais recentes são a Lei 5.099 (27/07/2026, DOE 7.111) e a LC 179/2026. Muitas trazem o vínculo `materia` (projeto de origem) |
| Legislação estadual (portal) | https://www.al.to.leg.br/legislacaoEstadual | HTML + PDF (`/arquivo/{id}`) | Busca por termo, número, ano, datas e tipo. A mais recente listada é a **Lei 5.100, de 29/07/2026** |
| Diário da Assembleia | https://www.al.to.leg.br/diario | PDF (`/arquivo/{id}`) | Não analisado a fundo |
| **Voto nominal** | — | — | **Não encontrado** em fonte estruturada (SAPL sem dados; Legis sem votação). Fica a verificar no Diário da Assembleia e nos vídeos |

**robots.txt** (`sapl.al.to.leg.br`): **`Crawl-delay: 60`**; bloqueia só `/materia/docacessorio/pdf|zip/*`.

## 2. Governo do Estado

| Item | Onde | Formato | Observação |
|---|---|---|---|
| DOE-TO | https://diariooficial.to.gov.br/ (resposta gzip) | HTML + PDF | **Busca por texto** (`/busca?por=texto&texto=…&data-inicial=AAAA-MM-DD&data-final=…`), **por tipo de documento** (`por=doc&tipo-documento=1` para Decretos, 2 Leis, 3 EC, 4 LC, 5 MP, 6 Atos, e `numero=`) e por edição. A busca devolve **edições**, não atos. PDF em `https://doe.to.gov.br/diario/{id}/download` (HTTP 206, `application/pdf`). Última edição vista: **nº 7.173, de 29/10/2026** (118 páginas). robots.txt: 404 em `diariooficial.to.gov.br`; **403 em `doe.to.gov.br/robots.txt`** (RFC 9309: 4xx = sem restrição) |
| Teste | `texto=LEI Nº 5.099`, julho–agosto de 2026 | — | Encontrou a edição **nº 7.111, de 29/07/2026** (179 páginas). A busca por tipo "Leis" com `numero=5099` deu "Nenhum resultado" |
| Medidas provisórias | O Tocantins usa MP estadual | SAPL (tipo "Medida Provisória") + DOE | 2 MPs entre as 60 matérias mais recentes de 2026 |

## 3. Exemplos reais

- **Projeto:** Projeto de Lei do TJ 7/2026 (27/10/2026), altera a Lei 2.409/2010 (vencimento de Auxiliar Judiciário), https://sapl.al.to.leg.br/materia/14793.
- **Votação:** **nenhuma encontrada em fonte oficial estruturada.** A última sessão no SAPL é de 12/05/2026 e não há resultado registrado.
- **Lei:** Lei 5.099, de 27/07/2026 (DOE 7.111), https://sapl.al.to.leg.br/norma/1588, PDF em http://sapl.al.to.leg.br/media/sapl/public/normajuridica/2026/1588/lei_5099-2026.pdf. Também na lista https://www.al.to.leg.br/legislacaoEstadual.

## 4. Viabilidade

- **Proposições, tramitação e normas: automatizáveis** (esforço **baixo**, com o coletor SAPL comum).
- **Votações: curadoria** (esforço **alto**). O SAPL não tem sessões depois de maio/2026 nem votos. Será preciso ler o Diário da Assembleia (PDF) e talvez as atas; o voto individual fica como "Informação não disponível em fonte oficial".
- **DOE: automatizável em parte** (esforço **médio**). A busca por texto localiza a edição e o PDF é baixável; separar os atos exige curadoria.
- **Riscos:** os sistemas estão em transição (o aviso do portal se contradiz com o SAPL 3; o Legis ainda está no ar), com risco de dados duplicados ou divergentes; desde julho/2026 não aparecem leis novas nem no SAPL nem no portal (talvez pelo período eleitoral, **não verificado**); a busca por tipo e número no DOE não achou uma lei existente.

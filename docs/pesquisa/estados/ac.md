# Acre (AC): fontes oficiais

Pesquisa feita com acessos reais em **2026-11-02** (curl e Python, com o agente `PlacarDoPoder-pesquisa/1.0`). Todas as URLs abaixo foram abertas nessa data, salvo indicação.
Scripts e respostas brutas: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-norte\` (`sapl3.py`, `sapl4.py`, `out/sapl.al.ac.leg.br.*`).

## 1. Assembleia Legislativa (ALEAC)

| Item | Onde | Formato | Observação |
|---|---|---|---|
| Portal | https://www.al.ac.leg.br/ (WordPress) | HTML | Notícias e páginas institucionais. O processo legislativo fica no SAPL |
| Sistema legislativo | **SAPL 3** em https://sapl.al.ac.leg.br/ | HTML + **API REST JSON** (`/api/`) | Índice da API: https://sapl.al.ac.leg.br/api/ (sem autenticação) |
| Deputados | `/api/parlamentares/mandato/?legislatura=17` | JSON | 25 mandatos na 16ª legislatura (2023–2027), id 17. O filtro `/api/parlamentares/parlamentar/?ativo=true` deu **HTTP 500** |
| Proposições | `/api/materia/materialegislativa/` | JSON | 19.369 no total; **1.145 de 2026**. Mais recente: PL 159/2026, apresentado em 28/10/2026 |
| Tramitação | `/api/materia/tramitacao/` | JSON | 27.121 registros; o último é de 28/10/2026 |
| Sessões | `/api/sessao/sessaoplenaria/` | JSON | 578 sessões; a última é a 55ª Ordinária, de 28/10/2026. `url_video` vem vazio |
| Resultado por item | `/api/sessao/registrovotacao/` | JSON | 572 registros com `numero_votos_sim/nao/abstencoes`; o último é de 10/08/2026 |
| **Voto nominal** | `/api/sessao/votoparlamentar/` | JSON (um registro por deputado: `voto`, `parlamentar`, `votacao`) | **709 votos no total**. Itens com `tipo_votacao=2` (nominal): **42**. Os votos nominais mais recentes são de **vetos**, de 30/03/2026 (Veto 8/2026 e outros) |
| Normas | `/api/norma/normajuridica/` | JSON | **Não serve para normas recentes**: 3.736 registros, a maioria edições antigas do Diário Oficial (2005–2011); `?ano=2026` retorna **0** |
| Banco de leis da ALEAC | https://app.al.ac.leg.br/legisla-e/ | HTML (Java/Thymeleaf) | A página por ano (`/legislacao/busca-por-ano/2026`) voltou **sem itens** via curl, provavelmente porque o conteúdo é montado no navegador. A ficha `/legislacao/visualizar/{id}` existe (ementário em HTML) |

**robots.txt.** `www.al.ac.leg.br/robots.txt` responde **403**. Pela RFC 9309, uma resposta 4xx significa que não há restrição declarada. O `sapl.al.ac.leg.br/robots.txt` bloqueia dezenas de robôs pelo nome, e para `*` define **`Crawl-delay: 60`** e `Disallow: /materia/docacessorio/pdf/*` e `/zip/*`. A API não é bloqueada, mas é preciso fazer **uma requisição por minuto**.
*Nota de conduta:* no primeiro reconhecimento fiz cerca de 9 requisições seguidas à API antes de ler o crawl-delay. Daí em diante, todas respeitaram 61 s.

**Votação nominal.** O SAPL tem o modelo completo (`votoparlamentar`), mas a ALEAC só o usa em parte: as votações comuns são simbólicas, gravadas apenas com o total de votos. O registro nominal aparece, até agora, em **vetos**. Quando não há registro nominal, o site exibe "Informação não disponível em fonte oficial".

## 2. Governo do Estado

| Item | Onde | Formato | Observação |
|---|---|---|---|
| Diário Oficial (DOE-AC) | https://www.diario.ac.gov.br/ | PDF por edição; busca por número ou palavra-chave | Última edição: **nº 14.384, de 30/10/2026**. O link é `download.php?arquivo=<base64>` |
| robots.txt do DOE | https://diario.ac.gov.br/robots.txt | — | **`Disallow: /*?`, `/*=`, `/*download`, `/*html`**. Só libera `/index.php`, `/normas.php`, `/ajuda.php`, `/contato.php` e dois PDFs. **Baixar as edições e usar a busca automaticamente é proibido pelo robots.txt.** Não contornar |
| Legislação estadual (LEGIS, da Casa Civil e da PGE) | https://legis.ac.gov.br/ | HTML com AJAX | Constituição, leis complementares, leis ordinárias e decretos normativos (estes só desde maio de 2020; decretos de pessoal ficam de fora). O próprio portal diz ter "natureza meramente consultiva". O robots.txt é igual ao do DOE (bloqueia `/*?` e `/*=`), e as listas são carregadas por JavaScript |
| Casa Civil | https://www.casacivil.ac.gov.br/ | — | Só um link a partir do LEGIS; não explorado |

## 3. Exemplos reais

- **Projeto:** PL 159/2026 (apresentado em 28/10/2026), https://sapl.al.ac.leg.br/materia/19858 (API: `/api/materia/materialegislativa/?ano=2026&o=-data_apresentacao`).
- **Votação nominal:** Veto 8/2026, 6ª Sessão Ordinária da 4ª Sessão Legislativa, resultado "Aprovado". Votos por deputado em https://sapl.al.ac.leg.br/api/sessao/votoparlamentar/?o=-id&page_size=30 (aberta; registros com `votacao=642`, por exemplo "WHENDY LIMA: Sim"). O filtro `?votacao=642` existe na API, mas não foi aberto.
- **Resultado simbólico com totais:** Moção 19/2026 (15 sim, 0 não), `/api/sessao/registrovotacao/?o=-id`.
- **Sessão:** https://sapl.al.ac.leg.br/sessao/591/resumo (55ª Ordinária, 28/10/2026). A página abriu; a lista de presença não apareceu no resumo.
- **Lei recente: não obtida em fonte automatizável.** O SAPL não tem normas de 2026; o Legisla-e não mostrou a lista sem JavaScript; o DOE e o LEGIS bloqueiam por robots.txt as URLs com parâmetros. Fica para curadoria manual no navegador.

## 4. Viabilidade

- **Legislativo: automatizável em parte** (esforço **baixo**). O mesmo coletor SAPL serve para AM, RO, RR e TO. Deputados, proposições, tramitação, sessões e totais de votação vêm em JSON; os votos nominais aparecem só em parte das votações (vetos).
- **Normas e Executivo: curadoria** (esforço **médio**). O robots.txt do DOE-AC e do LEGIS proíbe a coleta automática das edições e das buscas. A saída é a curadoria humana no navegador, ou pedir à Casa Civil e à ALEAC (via LAI) a liberação, ou um dump.
- **Riscos:** o crawl-delay de 60 s limita a carga inicial (cerca de 1.440 requisições por dia; com `page_size=100`, isso basta para manter os dados em dia); o filtro `ativo=true` dá erro 500; os votos nominais são raros (o site não pode tratar o voto simbólico como unânime por dedução); o Legisla-e depende de JavaScript.

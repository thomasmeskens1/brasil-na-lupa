# Fontes oficiais do TCU e do TCE-SP: avaliação técnica

Data dos testes: 02/11/2026. Todas as chamadas abaixo foram feitas de verdade nesta data. Trechos de resposta foram copiados e encurtados com "…".
Scripts e respostas brutas estão no scratchpad da sessão (`pesquisa-tcu/`: `scripts/baixa_acordaos.py`, `scripts/filtra_csv.py`, `scripts/exemplos.py`, `scripts/xlsx_rows.py`, `raw/`, `pdf/`, `csv/`).
Nenhum dado aqui foi deduzido. Quando um item não foi verificado, isso está escrito.
Nomes e CPF de particulares que aparecem nas listas de condenados **não** foram copiados para este documento (diretriz 12).

## Resumo rápido

| Fonte | Chave? | Formato | Atualização observada | Serve para |
|---|---|---|---|---|
| API de acórdãos `dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos` | não | JSON | contínua (último acórdão: sessão de 28/10/2026) | **feed diário**: número, tipo, colegiado, data da sessão, relator, sumário, links do inteiro teor |
| CSV anuais de acórdãos `sites.tcu.gov.br/dados-abertos/jurisprudencia/` | não | CSV `\|` UTF-8 (300–500 MB/ano) | arquivo substituído; última atualização 02/10/2026 | **base principal estruturada**: processo, revisor, autor do voto vencedor, assunto, sumário, texto do acórdão, quórum (com "Ministros com voto vencido"), relatório, voto, declaração de voto |
| Inteiro teor (PDF/RTF) `contas.tcu.gov.br/sagas/...` | não | PDF e RTF | no dia da sessão | conferência do quórum e do resultado quando o CSV ainda não trouxe o acórdão |
| Pesquisa integrada `pesquisa.apps.tcu.gov.br` (REST) | — | — | — | **bloqueada para robôs** (firewall de aplicação do TCU) |
| Acervo "Contas do Presidente" `sites.tcu.gov.br/contas-do-presidente*/` | não | HTML + PDF | um hotsite por exercício | parecer prévio, acórdão, voto do relator, declarações de voto |
| Listas de responsáveis (contas irregulares, fins eleitorais, inabilitados, inidôneos) `certidoes.apps.tcu.gov.br/api/publico/...` | não | JSON (POST) | contínua | contas julgadas irregulares por município; **traz CPF** (descartar) |
| Pautas, atos normativos, solicitações do Congresso | não | JSON | contínua | contexto (pautas, pedidos do Congresso ao TCU) |
| Senado/Congresso — MCN das contas do Presidente | não | JSON | contínua | situação do julgamento das contas pelo Congresso |
| TCE-SP "Contas Anuais" `www.tce.sp.gov.br/contas-anuais` | não | HTML + PDF | por exercício (último: 2024) | contas do Governador: relator, decisão do Pleno, parecer |
| TCE-SP pesquisa de pareceres municipais `www10.tce.sp.gov.br/protocolo-drupal/...` | — | HTML | — | **proibida pelo robots.txt** (`Disallow: /`) e recusa acesso direto |
| TCE-SP conjunto "Pareceres" `transparencia.tce.sp.gov.br` | não | CSV (ZIP) | parado em 14/10/2020 (exercícios 2008–2017) | histórico de pareceres das prefeituras; links quebrados |
| TCE-SP contas julgadas irregulares (XLSX/PDF, CPF anonimizado) | não | XLSX, PDF | corte em 01/10/2026 | lista para fins eleitorais (LC 64/1990) |
| TCE-SP demais conjuntos (Audesp) | não | CSV/ZIP, API JSON/XML | semanal a anual | despesas, receitas, RCL, resultado das análises Audesp, dívida ativa, licitações |

Conclusão principal: no **TCU, quase tudo é automatizável**. O CSV anual de acórdãos já traz, em campos separados, relator, revisor, autor do voto vencedor, quórum (com a lista literal de "Ministros com voto vencido") e os textos do voto e da declaração de voto. A API diária cobre o intervalo até o CSV seguinte. No **TCE-SP, só as contas do Governador são automatizáveis** (PDF na página "Contas Anuais"). Os pareceres das contas do **Prefeito de Atibaia de 2018 em diante não têm caminho automático permitido** e exigem curadoria (navegador humano ou pedido via SIC).

---

## TCU — Tribunal de Contas da União

### Regras de acesso (robots.txt e bloqueios)

| Host | robots.txt (02/11/2026) | Observação |
|---|---|---|
| `portal.tcu.gov.br` | `Allow: /`, `Disallow: /uploads/` | portal novo (Next.js); `/dados-abertos` dá 404 |
| `dados-abertos.apps.tcu.gov.br` | só bloqueia `MJ12bot` | `/swagger-ui.html` devolve **499 "Acesso Bloqueado"** |
| `pesquisa.apps.tcu.gov.br` | só bloqueia `MJ12bot` | a chamada REST `rest/publico/base/acordao-completo/documentosResumidos?...` devolveu "O acesso a este recurso foi bloqueado pela solução de firewall de aplicações do TCU". **Não contornar.** |
| `contas.tcu.gov.br` | `Allow: /ords`, **`Crawl-delay: 10`** | aplicação APEX `f?p=1660:2` "colocada como indisponível no dia 22/05/2026" |
| `sites.tcu.gov.br` (hotsites, CSV de dados abertos, contas do Presidente) | `Disallow: /` para **GPTBot, ChatGPT-User, CCBot, Google-Extended, Bytespider, ClaudeBot, anthropic-ai**, Applebot-Extended, Meta-ExternalAgent; para `*` só bloqueia `/assets/`, `/img/` e páginas de aviso | ver nota abaixo |
| `certidoes.apps.tcu.gov.br` | só bloqueia `MJ12bot` | — |

**Nota sobre `sites.tcu.gov.br`:** o TCU proíbe ali robôs de inteligência artificial pelo nome. Os acessos desta pesquisa foram feitos sob demanda do usuário, com `curl` comum, e o coletor diário do projeto se identifica como `User-agent: *` (permitido). Mesmo assim, **recomenda-se que o orquestrador decida** se o coletor deve baixar os CSV desse host ou usar só a API de `dados-abertos.apps.tcu.gov.br` (que não tem essa restrição). Aviso da página de webservices: "É possível que alguns serviços fiquem indisponíveis das 20h às 21h."

### 1. Dados abertos do TCU

- **Página:** https://sites.tcu.gov.br/dados-abertos/ — três bases: "Jurisprudência", "Normativos" e "Inabilitados, inidôneos e com contas irregulares", mais a página "Webservices TCU" (https://sites.tcu.gov.br/dados-abertos/webservices-tcu/).
- **Licença:** nenhuma licença explícita foi encontrada nas páginas de dados abertos. A página só cita a definição da Open Knowledge Foundation ("dados são abertos quando qualquer pessoa pode livremente usá-los…"). Termos de uso do portal: https://portal.tcu.gov.br/sobre-o-portal/termos-de-uso (não lido nesta pesquisa).

#### 1.1 API de acórdãos

- `GET https://dados-abertos.apps.tcu.gov.br/api/acordao/recupera-acordaos?inicio={n}&quantidade={q}` — sem chave, JSON UTF-8.
- **Ordem:** mais recentes primeiro. **Não há filtros**: `ano`, `numeroAcordao`, `anoAcordao` foram ignorados (a resposta veio igual à sem filtro).
- **Campos:** `key, tipo, anoAcordao, titulo, numeroAcordao, numeroAta, colegiado, dataSessao (DD/MM/AAAA), relator, situacao, sumario, urlArquivo (RTF), urlArquivoPdf, urlAcordao`.
- **Desempenho:** `quantidade=1000` respondeu em 8,4 s (885 KB). `inicio=100000` levou 82 s. Nenhum 429 ou cabeçalho de limite.
- **Volume real (paginando de 1000 em 1000 até sair de 2025):** 35.040 registros, sendo 19.557 de 2025 e 14.039 de 2026 (até a sessão de 28/10/2026).
- **Limite importante:** `sumario` só vem preenchido para `tipo = "ACÓRDÃO"`. Os "ACÓRDÃO DE RELAÇÃO" (cerca de 2/3 do total) vêm com `sumario: null`.
- Exemplo real (encurtado):

```json
{"key":"ACORDAO-COMPLETO-2784300","tipo":"ACÓRDÃO","anoAcordao":"2026",
 "titulo":"ACÓRDÃO 2933/2026 ATA 42/2026 - PLENÁRIO","numeroAcordao":"2933","colegiado":"Plenário",
 "dataSessao":"28/10/2026","relator":"VITAL DO RÊGO","situacao":"OFICIALIZADO",
 "sumario":"REFORMA TRIBUTÁRIA. CÁLCULO DA ALÍQUOTA DE REFERÊNCIA DA CONTRIBUIÇÃO SOCIAL SOBRE BENS E SERVIÇOS (CBS) PARA 2027 …",
 "urlArquivoPdf":"https://contas.tcu.gov.br/sagas/SvlVisualizarRelVotoAc?codFiltro=SAGAS-SESSAO-ENCERRADA&seOcultaPagina=S&item0=920740",
 "urlAcordao":"https://contas.tcu.gov.br/pesquisaJurisprudencia/#/detalhamento/11/*/KEY:%22ACORDAO-COMPLETO-2784300%22/…"}
```

#### 1.2 CSV anuais de jurisprudência (base estruturada completa)

- Lista de arquivos: https://sites.tcu.gov.br/dados-abertos/jurisprudencia/arquivos/jurisprudencia-arquivos.csv — primeira linha `"02/10/2026"` (data da última atualização); depois `BASE|ANO|TAMANHO|ARQUIVO`.
- Acórdãos de 1992 a 2026, um arquivo por ano: `…/arquivos/acordao-completo/acordao-completo-{ano}.csv` (2025: 394,40 MB; 2026: 308,50 MB; `Last-Modified` do de 2026: 02/10/2026). Também há "Jurisprudência Selecionada", "Súmulas", "Respostas a Consultas", boletins e um `acordao-completo-resumo.csv`.
- Periodicidade: a página mostra "Periodicidade da atualização: -" (não informada).
- Formato: separador `|`, aspas `"`, UTF-8, campos com HTML.
- **Campos do CSV de acórdãos** (dicionário: https://sites.tcu.gov.br/dados-abertos/jurisprudencia/dicionario-dados.html): `KEY, TIPO, TITULO, NUMACORDAO, ANOACORDAO, NUMATA, COLEGIADO, DATASESSAO, RELATOR, SITUACAO, PROC, ACORDAOSRELACIONADOS, TIPOPROCESSO, INTERESSADOS, ENTIDADE, RELATORDELIBERACAORECORRIDA, MINISTROREVISOR, MINISTROAUTORVOTOVENCEDOR, REPRESENTANTEMP, UNIDADETECNICA, ADVOGADO, ASSUNTO, SUMARIO, ACORDAO, DECISAO, QUORUM, MINISTROALEGOUIMPEDIMENTOSESSAO, RECURSOS, RELATORIO, VOTO, DECLARACAOVOTO, VOTOCOMPLEMENTAR, VOTOMINISTROREVISOR`.
- O dicionário cita ainda `VISAOGERAL` ("Visão geral do Acórdão gerada com IA") e há um arquivo separado "Acórdãos - Visões gerais", com o aviso "Sempre verifique as informações geradas por Inteligência Artificial". Esse campo **não** veio nos CSV de 2025/2026 e **não deve ser usado** (não é texto oficial do acórdão).
- `INTERESSADOS` traz nomes de responsáveis com CPF mascarado (ex.: `XXX.099.802-XX`): **descartar** o campo ou omitir particulares.

#### 1.3 Outros webservices testados

| Serviço | Endpoint | Resultado do teste |
|---|---|---|
| Contas julgadas irregulares (CADIRREG) | `POST https://certidoes.apps.tcu.gov.br/api/publico/responsaveis-contas-irregulares` corpo `{"uf":"SP","municipio":"ATIBAIA"}` | 200, 11 registros |
| Contas irregulares com possível implicação eleitoral ("imputação de débito e com decisão transitada em julgado nos últimos 8 anos") | `POST …/responsaveis-fins-eleitorais` | 200, 5 registros |
| Inabilitados / inidôneos | `POST …/responsaveis-inabilitados`, `…/responsaveis-inidoneos`; também `GET https://contas.tcu.gov.br/ords/condenacao/consulta/inabilitados` e `/inidoneos` | 200 (JSON `items`) |
| Pautas das sessões | `GET https://dados-abertos.apps.tcu.gov.br/api/pautassessao` | 200, 15,8 MB, histórico desde pelo menos 2015 |
| Solicitações do Congresso Nacional | `GET https://contas.tcu.gov.br/ords/api/publica/scn/pedidos_congresso` | 200 (tipo, número, data de aprovação, assunto, autor, processo, link da proposição no Senado) |
| Atos normativos | `GET https://dados-abertos.apps.tcu.gov.br/api/atonormativo/recupera-atos-normativos` | documentado; não testado |
| Certidões de pessoa jurídica | `GET https://certidoes-apf.apps.tcu.gov.br/api/rest/publico/certidoes/{cnpj}` | documentado; não testado (não é objeto do site) |

- Campos das listas de responsáveis: `numeroProcessoFormatado, nome, tipoRegistro, numeroRegistro (CPF/CNPJ completo), municipio, uf, dataTransitoEmJulgado, dataFinalFinsEleitorais, linkDeliberacoesProcesso, linkAcompanhamentoProcesso, codigoProcesso, seProcessoGestao, numeroAcordaoFormatado`. **`numeroRegistro` traz CPF completo: nunca gravar.** O significado de `municipio` (domicílio do responsável ou ente lesado) **não é documentado**.
- **Atibaia — fins eleitorais (5 processos, sem nomes):** 006.837/2019-0 (Acórdão 6711/2020-2C; trânsito 07/08/2020; fim 07/08/2028); 024.126/2020-9 (6990/2023-1C; 02/08/2024; 02/08/2032); 025.840/2020-7 (3793/2022-2C; 04/02/2023; 04/02/2031); 026.774/2020-8 (2905/2022-2C; 27/08/2022; 27/08/2030); 031.814/2022-0 (811/2025-PL; 18/06/2025; 18/06/2033).
- **Uso no site:** só faz sentido para **agentes públicos** (ex.: ex-prefeito com contas irregulares), e isso exige saber se a pessoa exerceu função pública — a API não informa. Recomendação: não publicar a lista; no máximo, na página de um agente público já identificado por outra fonte oficial, citar o processo e o acórdão com link.

### 2. Acórdãos: como obter cada informação

| Informação | Onde está (estruturado) | Observação |
|---|---|---|
| Número, ano, ata, colegiado (Plenário, Primeira Câmara, Segunda Câmara) | API e CSV | **O número só é único por colegiado e ano**: existem o Acórdão 2833/2025-Plenário (CBS) e o 2833/2025-Segunda Câmara (TCE do FNS). O identificador estável é `KEY` |
| Data da sessão; sessão ordinária/extraordinária | API/CSV (`DATASESSAO`); tipo da sessão no texto (item 11: "Data da Sessão: 28/10/2026 – Extraordinária") | — |
| Relator | API/CSV | grafia em maiúsculas na API ("RODRIGO PACHECO") |
| Revisor | CSV `MINISTROREVISOR` e, no quórum, "(Revisor)" | 62 acórdãos com revisor em 2025–2026 |
| Redator / autor do voto vencedor | CSV `MINISTROAUTORVOTOVENCEDOR`; quórum "(Redator)" | 20 casos em que difere do relator |
| Processo, tipo de processo, entidade, unidade técnica, representante do MP | CSV `PROC, TIPOPROCESSO, ENTIDADE, UNIDADETECNICA, REPRESENTANTEMP` | — |
| Assunto e sumário | CSV `ASSUNTO, SUMARIO`; API só `sumario` | — |
| Decisão (dispositivo) | CSV `ACORDAO` (texto "ACORDAM … em: 9.1 …") | o campo `DECISAO` veio **vazio** nos exemplos conferidos |
| Resultado (unanimidade/maioria) | texto de `ACORDAO` | "por unanimidade" aparece em 2.970 dos 10.267 acórdãos não-relação; "por maioria" em 14. **Nos demais não há expressão literal** (ex.: Acórdãos 735/2025 e 1442/2026) → lacuna, nunca "unanimidade" deduzida |
| Ministros presentes, vencidos, desempate | CSV `QUORUM` (item 13 do acórdão) | ex. abaixo; 42 acórdãos com "voto vencido" no quórum |
| Impedimentos | CSV `MINISTROALEGOUIMPEDIMENTOSESSAO` | 86 acórdãos |
| Votos (relator, revisor, complementar, declaração de voto) | CSV `VOTO, VOTOMINISTROREVISOR, VOTOCOMPLEMENTAR, DECLARACAOVOTO` | texto integral; 90 acórdãos com declaração de voto, 67 com voto do revisor |

Contagens acima: CSV de 2025 e de 2026 (até 02/10/2026), 31.541 registros (21.274 "ACÓRDÃO DE RELAÇÃO" e 10.267 "ACÓRDÃO").

**Casos reais de votação dividida (campo `QUORUM`, literal):**

- Acórdão 2894/2025-Plenário (08/12/2025), relator Antonio Anastasia, `MINISTROAUTORVOTOVENCEDOR` = Bruno Dantas: "13.1. Ministros presentes: Vital do Rêgo (Presidente), Walton Alencar Rodrigues, Benjamin Zymler, Augusto Nardes (Revisor), Aroldo Cedraz, Bruno Dantas (Redator), Jorge Oliveira, Antonio Anastasia (Relator) e Jhonatan de Jesus. 13.2. Ministros com voto vencido: Benjamin Zymler, Jorge Oliveira e Antonio Anastasia (Relator)." Tem declaração de voto.
- Acórdão 2901/2025-Plenário (08/12/2025), relator Aroldo Cedraz: "… Walton Alencar Rodrigues (Revisor) … 13.2. Ministro que proferiu o voto de desempate: Vital do Rêgo (Presidente). 13.3. Ministros com voto vencido: Walton Alencar Rodrigues (Revisor), Benjamin Zymler, Bruno Dantas e Antonio Anastasia."
- Acórdão 2844/2025-Plenário (03/12/2025), relator Augusto Nardes: "13.2. Ministros com voto vencido: Walton Alencar Rodrigues (Revisor) e Bruno Dantas." Tem declaração de voto e voto do revisor.

Com isso, o voto de cada ministro presente pode ser exibido **sem dedução**: quem está em "Ministros com voto vencido" ficou vencido; os demais presentes não são listados como vencidos. Atenção: o quórum não diz literalmente "acompanhou o relator"; o texto exibido deve ser "não consta como vencido no quórum oficial", ou só a lista de vencidos.

**Dificuldade na extração de PDF:** no PDF dos Acórdãos 2955/2026 e 2933/2026 (sessões de 28/10/2026), `pdftotext` deslocou "Nardes," para outra linha ("Walton Alencar Rodrigues, Augusto / Antonio Anastasia …"). O RTF (`urlArquivo`) trouxe o quórum correto: "Vital do Rêgo (Presidente), Walton Alencar Rodrigues, Augusto Nardes, Antonio Anastasia, Jhonatan de Jesus, Odair Cunha e Rodrigo Pacheco" (2933/2026), mas o arquivo tem 46 MB (inclui anexos). Para acórdãos ainda fora do CSV, preferir o RTF ou aguardar o CSV.

### 3. Parecer prévio sobre as Contas do Presidente da República

Acervo: https://sites.tcu.gov.br/acervo-de-contas-do-presidente/ (exercícios 1995–2025). Cada hotsite traz relatório, parecer prévio, acórdão, voto do relator e "Votos dos ministros" (PDF com as declarações de voto).

| | Exercício 2025 | Exercício 2024 |
|---|---|---|
| Hotsite | https://sites.tcu.gov.br/contas-do-presidente/ | https://sites.tcu.gov.br/contas-do-presidente-2024/ |
| Processo | TC 005.405/2026-2 (apenso 021.660/2025-5) | TC 008.437/2025-4 |
| Acórdão | 1442/2026 – TCU – Plenário, Ata 21/2026 | 1326/2025 – TCU – Plenário, Ata 21/2025 |
| Sessão | 10/6/2026, extraordinária | 11/6/2025, extraordinária |
| Relator | Ministro Benjamin Zymler | Ministro Jhonatan de Jesus |
| Ministros presentes | Vital do Rêgo (Presidente), Walton Alencar Rodrigues, Benjamin Zymler (Relator), Augusto Nardes, Bruno Dantas, Jorge Oliveira, Antonio Anastasia, Jhonatan de Jesus e Odair Cunha; ministros-substitutos Augusto Sherman Cavalcanti, Marcos Bemquerer Costa e Weder de Oliveira | Vital do Rêgo (Presidente), Walton Alencar Rodrigues, Benjamin Zymler, Augusto Nardes, Bruno Dantas, Jorge Oliveira, Antonio Anastasia e Jhonatan de Jesus (Relator); convocado Augusto Sherman Cavalcanti; substitutos Marcos Bemquerer Costa e Weder de Oliveira |
| Conclusão (literal) | "O Tribunal de Contas da União é de parecer que as Contas atinentes ao exercício de 2025, de responsabilidade do Excelentíssimo Senhor Presidente da República, Luiz Inácio Lula da Silva, estão em condições de serem aprovadas pelo Congresso Nacional, com ressalvas." | "… exercício de 2024 … estão em condições de ser aprovadas pelo Congresso Nacional, com ressalva." |
| Unanimidade/maioria | não consta no acórdão (lacuna) | não consta no acórdão (lacuna) |
| Declarações de voto | 8 no PDF "Votos dos ministros"; assinaturas legíveis: Augusto Nardes, Walton Alencar Rodrigues, Bruno Dantas, Jorge Oliveira, Antônio Anastasia, Odair Cunha; 2 com o marcador "tagRedator" (identificar na curadoria) | 8; assinaturas: Augusto Nardes, Benjamin Zymler, Augusto Sherman Cavalcanti (ministro-substituto), Walton Alencar Rodrigues, Bruno Dantas, Vital do Rêgo, Jorge Oliveira, Antônio Anastasia |

Detalhes:

- **2025:** o parecer tem duas opiniões "com ressalva" (execução dos orçamentos e Balanço Geral da União), subdivididas em conformidade orçamentária e financeira (5 não conformidades), gestão fiscal (6), resultados da atuação governamental e demonstrações contábeis; e 11 alertas ao Poder Executivo. Entre as ressalvas de gestão fiscal: "Concessão, sanção e implementação de renúncias de receitas tributárias sem a demonstração integral dos requisitos constitucionais e legais … (Achado 2.3.2.2)" e "Descumprimento parcial do § 6º do art. 165 da Constituição Federal, em virtude da edição de demonstrativo que não abrange todas as renúncias … (Achado 2.3.2.7)". A Procuradora-Geral do MP junto ao TCU, Cristina Machado da Costa e Silva, fez manifestação oral, apesar de o item 6 do acórdão dizer "Representante do Ministério Público: não atuou" (registrar os dois textos).
- **Grafia:** o Acórdão 1442/2026 escreve "Luís Inácio Lula da Silva"; o parecer escreve "Luiz Inácio Lula da Silva". Reproduzir cada documento como está.
- **2024:** o parecer lista "Irregularidades" (1.1 inobservância dos arts. 132 e 135 da LDO 2024 na elaboração e sanção de leis que concederam ou ampliaram benefícios tributários — Leis 14.871/2024, 14.902/2024, 14.937/2024 e sanção das Leis 14.859/2024, 14.943/2024, 14.968/2024, 14.973/2024, 15.042/2024 e 15.075/2024; 1.2 crédito extraordinário do Firece pela MP 1.282/2024) e "Impropriedades" (1.3, 1.4…). O Acórdão 1326/2025 também faz recomendações (9.2.1 a 9.2.3).

**Julgamento pelo Congresso Nacional** (API do Senado, `materia/movimentacoes/{codigo}`; o serviço informa descontinuação e indica `/dadosabertos/processo` como substituto):

| Exercício | Mensagem | Parecer do TCU recebido | Situação em 02/11/2026 |
|---|---|---|---|
| 2023 | MCN 1/2024 (código 162887) | 25/06/2024 (Aviso 468-GP/TCU) | "AGUARDANDO DESIGNAÇÃO DO RELATOR" na CMO desde 10/07/2024 |
| 2024 | MCN 1/2025 (167873; MSG 343/2025) | 23/06/2025 (Aviso 600-GP/TCU) | idem, desde 03/07/2025 |
| 2025 | MCN 1/2026 (173463; MSG 242/2026) | 22/06/2026 (Aviso 561-GP/TCU) | idem, desde 03/08/2026 |

Ou seja, **não há julgamento do Congresso** para 2023, 2024 nem 2025. O site deve mostrar "aguardando designação do relator na Comissão Mista de Planos, Orçamentos Públicos e Fiscalização (CMO)", com link e data.

### 4. Recorte de impostos: acórdãos de 2025–2026

Método: filtro por palavras ("renúncia de receita", "benefício tributário/fiscal", "gasto tributário", "reforma tributária", "alíquota de referência", IBS, CBS, "Imposto Seletivo", "Comitê Gestor", "Lei Complementar 214") em `ASSUNTO` e `SUMARIO` do CSV (até 02/10/2026) e em `sumario` da API (até 28/10/2026), só tipo "ACÓRDÃO". **É uma triagem**: acórdãos de relação (sem sumário) e assuntos com outra redação ficam de fora; a lista precisa de revisão humana antes de publicar.

Todos são do **Plenário**. Link oficial: `https://contas.tcu.gov.br/pesquisaJurisprudencia/#/detalhamento/11/*/KEY:%22{KEY}%22/DTRELEVANCIA%2520desc%252C%2520NUMACORDAOINT%2520desc/false/1/false`.

| Acórdão | Sessão | Relator | Processo (tipo) | Assunto (sumário, encurtado) | Resultado literal | KEY |
|---|---|---|---|---|---|---|
| 735/2025 | 02/04/2025 | Bruno Dantas | 039.004/2023-6 (Acompanhamento) | conformidade das despesas obrigatórias de caráter continuado e renúncias de receita em 2023 | não consta | ACORDAO-COMPLETO-2701124 |
| 756/2025 | 02/04/2025 | Augusto Sherman | 011.541/2022-9 (Monitoramento) | renúncias de receitas tributárias no MCTI; inaplicabilidade do monitoramento | não consta | ACORDAO-COMPLETO-2656622 |
| 2101/2025 | 10/09/2025 | Antonio Anastasia | 016.210/2024-7 (Monitoramento) | modelo de governança para concessão e gestão de benefícios fiscais; "não atendimento à recomendação" | não consta | ACORDAO-COMPLETO-2727986 |
| 2517/2025 | 29/10/2025 | Jorge Oliveira | 021.989/2024-9 (Representação) | benefício tributário da MP 1.255/2024 (depreciação acelerada de navios-tanque) e a LRF | não consta | ACORDAO-COMPLETO-2722098 |
| 2537/2025 | 29/10/2025 | Aroldo Cedraz | 017.290/2025-2 (Solicitação do Congresso) | cópias de acórdãos sobre gastos tributários | não consta | ACORDAO-COMPLETO-2732702 |
| 2833/2025 | 03/12/2025 | Vital do Rêgo | 015.848/2025-6 (Administrativo) | reforma tributária: homologação da metodologia da alíquota da CBS e do redutor das compras governamentais | não consta | ACORDAO-COMPLETO-2739181 |
| 858/2026 | 08/04/2026 | Benjamin Zymler | 008.798/2025-7 (Rel. de acompanhamento) | governança e transparência dos benefícios tributários | por unanimidade | ACORDAO-COMPLETO-2754222 |
| 1197/2026 | 13/05/2026 | Benjamin Zymler | 021.035/2025-3 (Rel. de acompanhamento) | renúncias fiscais propostas em 2025; falha no art. 113 do ADCT, art. 14 da LRF e LDO 2025 | por unanimidade | ACORDAO-COMPLETO-2763993 |
| 1493/2026 | 10/06/2026 | Augusto Nardes | 004.658/2026-4 (Administrativo) | resolução do trâmite de homologação das metodologias e cálculo das alíquotas de referência da CBS e do IBS | por unanimidade | ACORDAO-COMPLETO-2764175 |
| 1620/2026 | 24/06/2026 | Augusto Nardes | 004.658/2026-4 (Administrativo) | altera a Resolução-TCU 388/2026 após a LC 227/2026 | por unanimidade | ACORDAO-COMPLETO-2771738 |
| 2607/2026 | 23/09/2026 | Antonio Anastasia | 006.750/2026-5 (Rel. de levantamento) | regras de renúncias de receitas para as contas do Presidente de 2026 | por unanimidade | ACORDAO-COMPLETO-2778995 |
| 2933/2026 | 28/10/2026 (extraordinária) | Vital do Rêgo | 006.529/2026-7 (Administrativo) | alíquota de referência da CBS para 2027 = 11,3% ("arredondamento da alíquota calculada de 11,3468%"); redutor de 44,2%; comunicação ao Senado | por unanimidade (PDF) | ACORDAO-COMPLETO-2784300 |

Tangenciais (não incluir sem decisão editorial): 2770/2026 (07/10/2026, Benjamin Zymler, SICRO — "impacto da reforma tributária" nos custos de obras); 2204/2026 e 2206/2026 (concessões, citam benefícios fiscais na modelagem). Falso positivo: 1856/2026 ("IBS" = "Instituto Buzzo Sports").

Ligação com o piloto: o Acórdão 2933/2026 alimenta uma resolução do **Senado** (que fixa a alíquota até 15/12, segundo a notícia oficial do TCU de 28/10/2026). Quando o Senado votar, a resolução é uma `decisao` do caminho `congresso`, e o acórdão entra como antecedente.

---

## TCE-SP — Tribunal de Contas do Estado de São Paulo

### Regras de acesso

| Host | robots.txt | Consequência |
|---|---|---|
| `www.tce.sp.gov.br` | Drupal padrão (bloqueia `/admin/`, `/search/`, `/user/…`) | páginas e PDFs em `/sites/default/files/portal/` liberados |
| `transparencia.tce.sp.gov.br` | Drupal padrão | API e conjuntos de dados liberados |
| `www10.tce.sp.gov.br` | `Allow: /arqs_juri/pdf/`, **`Disallow: /`**, `Crawl-delay: 8` | **a pesquisa de pareceres municipais e de processos (Tc01sql1.asp) não pode ser automatizada**. Quatro chamadas feitas nesta pesquisa (antes de ler o robots) devolveram "Esta página foi chamada de um caminho inválido" (verificação de origem). Não repetir |
| `doe.tce.sp.gov.br` (Diário Oficial do TCE-SP) | `Disallow: /pdf/`, `/v/`, `/search/` | os PDFs do diário não podem ser baixados por robô |
| `www2.tce.sp.gov.br` | 403 | os links antigos `www2…/arqs_juri/pdf/*.pdf` não funcionam; o mesmo arquivo em `www10…/arqs_juri/pdf/744072.pdf` deu 404 |

### 5. Contas anuais

#### Governador de SP (automatizável: PDF na página oficial)

Página: https://www.tce.sp.gov.br/contas-anuais (exercícios 2007–2024; **o exercício de 2025 não aparecia em 02/11/2026**).

| Exercício | Processo | Relator (página) | Sessão do Tribunal Pleno | Decisão (literal, encurtada) | Conselheiros que votaram |
|---|---|---|---|---|---|
| 2024 | TC-005174.989.24-4 | Conselheiro Dimas Ramalho | 25/06/2025, 1ª Sessão Extraordinária; presidente Conselheiro Antonio Roque Citadini | "decidiu emitir parecer favorável à aprovação das contas anuais do exercício de 2024 do Excelentíssimo Senhor Governador do Estado de São Paulo Tarcísio de Freitas, com ressalvas relativas a Renúncias de Receitas, Previdência e Inconsistências Contábeis, sem prejuízo das determinações e recomendações…" | "Pelo voto dos Conselheiros Dimas Ramalho, Relator, Renato Martins Costa, Cristiana de Castro Moraes, Sidney Estanislau Beraldo, Marco Aurélio Bertaiolli e Maxwell Borges de Moura Vieira" |
| 2023 | TC-005272.989.23-7 | página: Conselheiro Robson Marinho | 26/06/2024, 1ª Sessão Extraordinária; presidente Conselheiro Renato Martins Costa | "decidiu emitir parecer prévio favorável à aprovação das contas do Governador … relativas ao exercício financeiro de 2023, com ressalvas e recomendações…" | "Pelo voto do Auditor Substituto de Conselheiro Valdenir Antonio Polizeli, Relator, e dos Conselheiros Antonio Roque Citadini, Cristiana de Castro Moraes, Dimas Ramalho, Sidney Estanislau Beraldo e Marco Aurélio Bertaiolli" |

- Documentos de 2024: "Relatório e Voto", "Notas Taquigráficas", "Decisão" e "Parecer" (`…/files/portal/26___TC_005174.989.24_4___Decisao_Ocultado.pdf`, `27___…___Parecer_Ocultado.pdf`). De 2023: "Nota de Decisão" (`19.1.%20Atos%20do%20Colegiado%20-%20Nota%20de%20Decis%C3%A3o%20do%20TP.pdf`), "Parecer" e "Publicação do Parecer".
- **Divergência a registrar:** em 2023 a página indica "Relator(a): Conselheiro Robson Marinho", mas a nota de decisão diz que o relator foi o Auditor Substituto de Conselheiro Valdenir Antonio Polizeli. Mostrar o texto da decisão e anotar a divergência.
- **Dificuldade:** os PDFs de "Parecer" de 2023 e 2024 têm fontes sem mapeamento Unicode (o `pdftotext` devolve caracteres ilegíveis). A "Decisão"/"Nota de Decisão" é legível e basta para o resumo. Ressalvas detalhadas exigem OCR ou leitura humana.
- **Julgamento pela ALESP (exercício 2024), já coletado no repositório:** PDL 46/2025 ("Considera regulares e aprova as contas anuais apresentadas pelo Senhor Chefe do Poder Executivo relativas ao exercício econômico-financeiro de 2024"), autor CFOP; Comissão de Fiscalização e Controle em 16/12/2025 ("Aprovado como parecer o voto da Deputada Fabiana Bolsonaro", 5 votos "Favorável ao voto do relator" e 2 "Com o Voto em Separado"); Plenário, 62ª Sessão Extraordinária de 16/12/2025, votação nominal por verificação ("VERIFICAÇÃO REQ. P/ DEP. DONATO"): 58 sim, 17 não, 14 em obstrução (arquivos `dados/alesp/votacoes/00aa7b10-28af-4f87-89a6-983b9181c023.json` e `50000199015.json`; https://www.al.sp.gov.br/propositura/1000672526). O julgamento das contas de 2023 pela ALESP **não foi procurado** (o índice local só cobre 2025–2026).

#### Prefeito de Atibaia (curadoria)

- **Pesquisa oficial:** a aba "Contas Municipais (Parecer)" de `/contas-anuais` monta o endereço `https://www10.tce.sp.gov.br/protocolo-drupal/Tc01sql1.asp?CONTAS_ANUAIS=S&XCDMATERIA=12&XEXERCICIO={ano}&XDSPARTE2={município}` num iframe. Esse host é **proibido para robôs** (ver acima). Só uma pessoa, no navegador, pode consultar.
- **Conjunto "Pareceres" (transparência):** https://transparencia.tce.sp.gov.br/sites/default/files/conjunto-dados/pareceres/pareceres.zip — "Consolidação de todos os pareceres emitidos pelo Tribunal para as Contas de Prefeituras no período de 2008 a 2017", `Last-Modified` 14/10/2020, CSV ISO-8859-1 com `codigo_ibge;municipio;exercicio;processo;parecer;voto_link;data_transito_julgado`. Atibaia (IBGE 3504107), real:

| Exercício | Processo | Parecer | Trânsito em julgado |
|---|---|---|---|
| 2008 | 1930/026/08 | Favorável | 27/02/2012 |
| 2009 | 395/026/09 | Desfavorável | 11/01/2013 |
| 2010 | 2793/026/10 | Favorável | 17/06/2013 |
| 2011 | 1265/026/11 | Favorável | 29/11/2013 |
| 2012 | 1854/026/12 | Desfavorável | 26/10/2015 |
| 2013 | 1922/026/13 | Favorável | 11/12/2015 |
| 2014 | 395/026/14 | Favorável | 09/08/2016 |
| 2015 | 2487/026/15 | Favorável | 18/10/2017 |
| 2016 | 4345/989/16 | Favorável | 17/08/2018 |
| 2017 | 6823/989/16 | Favorável | 12/12/2019 |

  Os links `voto_link` apontam para `www2.tce.sp.gov.br` (403) e não abrem no `www10` (404).
- **Exercícios 2023, 2024 e 2025: não localizados** por meio permitido. O parecer, a data, o conselheiro relator e a conclusão ficam "Informação não disponível em fonte oficial" até a curadoria. (O parecer de um exercício costuma sair dois anos depois, mas isso não foi verificado para Atibaia e não deve ser exibido como fato.)
- **Votação na Câmara de Atibaia:** a Câmara tem o tipo de propositura "Parecer do Tribunal de Contas" (36 itens, ver `docs/pesquisa/fontes-sp-atibaia.md`). O portal tem proteção anti-robô por cookie gerado em JavaScript; a pesquisa anterior usou navegador real. O voto de cada vereador, se nominal, só aparece na ata (PDF) ou no vídeo.
- **Lista de contas julgadas irregulares do TCE-SP** (https://www.tce.sp.gov.br/relacao-de-responsaveis-por-contas-julgadas-irregulares): XLSX e PDF "CPF anonimizado" (ex.: `125.XXX.XXX-81`), corte em 01/10/2026; "Base Legal: Deliberação SEI Nº 13122/2021-07, em consonância com a LC n°64/1990, artigo 1°, inciso I, alínea g…". O arquivo para fins eleitorais (trânsito de 01/10/2018 a 01/10/2026) tem 2 processos com origem "PREFEITURA MUNICIPAL DE ATIBAIA": 13537/989/18 (prestação de contas de repasses ao terceiro setor, exercício 2016, trânsito 22/09/2022) e 17136/989/23 (prestação de contas de contrato de gestão, exercício 2020, trânsito 22/05/2026). Os responsáveis podem ser particulares (dirigentes de entidades): não publicar nomes. Dificuldade: as colunas do XLSX vêm deslocadas (o "Responsável" aparece duas vezes, com índice no meio).

### 6. Outras bases do TCE-SP úteis para Atibaia

Página de conjuntos: https://transparencia.tce.sp.gov.br/conjunto-de-dados. Aviso da própria fonte: os dados do Audesp são "prestados pelos próprios Municípios" e podem ter erros de digitação.

| Conjunto | Endereço | Atualização declarada / observada | Uso |
|---|---|---|---|
| Resultado das análises Audesp | `…/conjunto-dados/resultado_analises_audesp.zip` (CSV `;` ISO-8859-1) | mensal; `Last-Modified` 01/11/2026 | por exercício: resultado da execução orçamentária (valor e %), FUNDEB, ensino, saúde e pessoal do Executivo. Atibaia 2024: resultado −22.393.688,72 (−1,82%); ensino 25,14%; saúde 25,24%; pessoal 34,88% (valores do campo, convertidos de fração) |
| Receita Corrente Líquida | `…/conjunto-dados/rcl_completo.zip` | semanal; `Last-Modified` 02/11/2026 | denominador de limites da LRF |
| Despesas e receitas (anual) | `…/conjunto-dados/despesas-{ano}.zip`, `receitas-{ano}` (despesas 2025: 1,96 GB) | semanal | complementa a API mensal já usada |
| Dívida ativa | `…/divida-ativa/Divida_Ativa_2019_2024.csv` | anual; `Last-Modified` 11/11/2025 | estoque, inscrições, recebimentos, cancelamentos |
| Licitações e ajustes (Audesp Fase IV) | `…/licitacoes-contratos/licitacao-*.zip`, `ajustes-*.zip` | esporádica (arquivos de 14/08/2026) | contratos da prefeitura |
| Alterações orçamentárias; programas e ações (PPA) | `…/alteracoes-orcamentarias/…` (2015–2019); `planejamento-municipal/…`; `relatorio-atividades/…` | anual | créditos suplementares, metas por programa |
| API (já usada) | `https://transparencia.tce.sp.gov.br/api/{json\|xml}/despesas\|receitas/{municipio}/{ano}/{mes}` e `/municipios` | defasagem ~2 meses | — |
| IEGM (Índice de Efetividade da Gestão Municipal) | https://www.tce.sp.gov.br/transparencia-tcesp/resultados-iegm | página lista até "Exercício 2021 / Apuração 2022" | indicador do próprio TCE; não testado o arquivo |
| "Julgamentos" | https://julgados.tce.sp.gov.br/resultados-julgados/ (Angular; serviço `/resultado/listaPorMateria`) | — | só estatística agregada por matéria e exercício; não lista processos |

---

## Estratégia de coleta recomendada

**Automatizável (rotina diária, só fontes permitidas):**

1. **TCU, acórdãos novos:** API `recupera-acordaos` com `inicio=0&quantidade=1000`, parando ao encontrar `key` já conhecida (incremental barato; nunca paginar fundo todo dia). Gravar só metadados.
2. **TCU, enriquecimento mensal:** baixar `acordao-completo-{ano}.csv` do ano corrente quando a data de `jurisprudencia-arquivos.csv` mudar; extrair `PROC, TIPOPROCESSO, MINISTROREVISOR, MINISTROAUTORVOTOVENCEDOR, ASSUNTO, SUMARIO, QUORUM, MINISTROALEGOUIMPEDIMENTOSESSAO` e o trecho "ACORDAM … por unanimidade|por maioria" do campo `ACORDAO`; textos de `VOTO`/`DECLARACAOVOTO` ficam como link, não copiados. **Decisão pendente do orquestrador** sobre o robots de `sites.tcu.gov.br` (ver nota).
3. **Recorte temático:** aplicar o filtro de palavras do item 4 e mandar os candidatos para revisão humana (não publicar automaticamente).
4. **Contas do Presidente:** situação no Congresso pela API do Senado (`MCN n/ano`, migrar para `/dadosabertos/processo`); os documentos do TCU entram uma vez por ano (junho).
5. **TCE-SP:** conjuntos Audesp (análises, RCL, despesas/receitas) e a página `/contas-anuais` (detectar exercício novo do Governador e baixar a "Decisão"). Respeitar `Crawl-delay` de 10 s em `contas.tcu.gov.br` e de 8 s em `www10.tce.sp.gov.br/arqs_juri/pdf/`.

**Exige curadoria humana:**

- Pareceres do TCE-SP sobre as contas do Prefeito de Atibaia de 2018 em diante (consulta no navegador ou pedido via SIC ao TCE-SP para atualizar o conjunto "Pareceres", parado em 2017) e a votação na Câmara de Atibaia (ata/vídeo).
- Ressalvas detalhadas dos pareceres do Governador (PDF ilegível sem OCR).
- Identificação das declarações de voto das Contas do Presidente 2025 com marcador "tagRedator".
- Acórdãos tributários: confirmar relevância de cada item e o texto do resultado; quando não houver "por unanimidade"/"por maioria" literal, exibir só a lista de vencidos do quórum (ou "Informação não disponível em fonte oficial").
- Listas de condenados: nunca automatizar a publicação (CPF, particulares).

## Modelo de dados mínimo (compatível com `julgamento` e `decisao`)

Estende `julgamento` com `tribunal: "tcu" | "tce-sp"` e campos opcionais. Arquivos sugeridos: `dados/tcu/acordaos/indice-{ano}.json`, `dados/tcu/acordaos/{key}.json`, `dados/tcu/contas-presidente/{exercicio}.json`, `dados/tce-sp/contas/{ente}-{exercicio}.json`.

```json
{
  "tribunal": "tcu",
  "id": "tcu-acordao-2933-2026-plenario",
  "chave_oficial": "ACORDAO-COMPLETO-2784300",
  "natureza": "acordao | parecer-previo",
  "processo": { "classe": "Administrativo", "numero": "TC 006.529/2026-7", "incidente_ou_registro": null, "url": "https://contas.tcu.gov.br/pesquisaJurisprudencia/#/detalhamento/11/*/KEY:%22ACORDAO-COMPLETO-2784300%22/…" },
  "numero": "2933/2026", "ata": "42/2026",
  "orgao": "Plenário | Primeira Câmara | Segunda Câmara | Tribunal Pleno",
  "sessao": "ordinaria | extraordinaria | null",
  "relator": "Vital do Rêgo", "revisor": null, "redator_acordao": null,
  "data_julgamento": "2026-10-28", "data_publicacao": null,
  "assunto": "texto de ASSUNTO", "sumario": "texto de SUMARIO",
  "certidao_literal": "trecho 'ACORDAM … em: 9.1 …' copiado",
  "parecer": { "conclusao_literal": null, "ressalvas_literal": [], "alertas_literal": [] },
  "votacoes": [{
    "parte": "mérito",
    "resultado": "por unanimidade (só se literal; senão null)",
    "presentes": ["Vital do Rêgo (Presidente)", "Walton Alencar Rodrigues", "…"],
    "substitutos_presentes": ["Weder de Oliveira (convocado)"],
    "vencidos": [], "voto_desempate": null, "impedidos": [], "ausentes": [],
    "presidente": "Vital do Rêgo",
    "declaracoes_de_voto": [{ "ministro": "…", "url": "…" }],
    "votos": []
  }],
  "julgamento_politico": { "casa": "congresso | alesp | camara-atibaia", "decisao_id": "id de um item 'decisao' ou null", "situacao_literal": "AGUARDANDO DESIGNAÇÃO DO RELATOR", "data_situacao": "2026-08-03", "fonte": "fonte" },
  "situacao_conferencia": "automatico-estruturado | conferido | pendente",
  "fontes": ["fonte"],
  "lacunas": ["Resultado (unanimidade ou maioria) não consta no texto oficial do acórdão"]
}
```

Regras: `vencidos`, `voto_desempate`, `revisor` e `redator_acordao` vêm **só** do campo `QUORUM`/`MINISTROREVISOR`/`MINISTROAUTORVOTOVENCEDOR` ou do item 13 do acórdão; `votos` por ministro fica vazio (o TCU não publica voto a voto além do quórum). O julgamento político das contas (Congresso, ALESP, Câmara) é um item `decisao` comum (`caminho: "congresso" | "alesp"`, `instrumento: "Decreto Legislativo"`, votação nominal quando houver), ligado pelo `decisao_id`; para a Câmara de Atibaia seria preciso acrescentar `camara-atibaia` à lista `caminho` do esquema (edição do orquestrador).

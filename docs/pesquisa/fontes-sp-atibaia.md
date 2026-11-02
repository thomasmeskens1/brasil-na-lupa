# Fontes oficiais — Estado de SP e Município de Atibaia

Pesquisa feita com acessos reais em **2026-11-02** (curl e navegador). Todas as URLs abaixo foram abertas nessa data.
Escopo: acompanhar **o que é votado e decidido** (Legislativo estadual e municipal, atos do Executivo, ICMS/CONFAZ, contas).
Regra do projeto: só fontes oficiais. Uma fonte não oficial só pode servir de **meio de acesso**, nunca de citação, e sempre com link para o original.

---

## Resumo executivo

| # | Fonte | Melhor via de coleta | Formato | API? | Automatizável? |
|---|-------|----------------------|---------|------|----------------|
| 1 | ALESP — processo legislativo | `legis-api-portal-prd.al.sp.gov.br` (OpenAPI pública) + dumps XML diários | JSON / XML / PDF (votação nominal) | **Sim** (REST com Swagger) | **Alta**. Exceção: o voto nominal em plenário só sai em PDF |
| 1b | ALESP — normas estaduais (leis e decretos) | `repositorioDados/legislacao/legislacao_normas.zip` | XML | Dump diário | **Alta** |
| 2 | DOE-SP (Diário Oficial do Estado) | `do-api-web-search.doe.sp.gov.br` (API do próprio portal) | JSON com o texto integral em HTML | Sim, mas sem documentação | **Alta**. Leis, decretos e vetos ficam em seções próprias |
| 3 | CONFAZ — convênios ICMS | Listagem anual em Plone (HTML) | HTML | Não | **Média** (scraping estável); a leitura do conteúdo exige curadoria |
| 3b | SEFAZ-SP — legislação tributária | Portal SharePoint `legislacao.fazenda.sp.gov.br` | HTML | `_api` SharePoint aberto, mas há WAF | **Baixa/Média** |
| 4 | TCE-SP | `transparencia.tce.sp.gov.br/api/...` | JSON / XML / CSV | **Sim** (documentada) | **Alta** para despesas e receitas; pareceres de contas só em PDF |
| 5 | Câmara Municipal de Atibaia | Portal Webline (`camaraatibaia.sp.gov.br`) | HTML / JSON limitado / PDF | "Dados abertos" limitado aos **10 últimos itens** | **Baixa/Média**. Não publica votação nominal |
| 6 | Prefeitura de Atibaia — Imprensa Oficial (IOE) | `prefeitura.atibaia.sp.gov.br/imprensa/` | PDF (com camada de texto) | Não | **Média**: dá para baixar e extrair texto; separar os atos exige heurística e curadoria |
| 7 | Querido Diário | — | — | API fora do ar (HTTP 522) | **Atibaia não é coberta** (não há raspador no repositório) |

**Estratégia recomendada, em uma linha.** Para o estado, coletar automaticamente da API da ALESP e da API do DOE-SP, cruzando com o dump de normas da ALESP. Para o município, ler todo dia os PDFs da Imprensa Oficial de Atibaia e a busca de proposituras da Câmara, e fazer uma **curadoria humana semanal** de votações e vetos a partir das atas e dos vídeos das sessões.

---

## 1. ALESP — Assembleia Legislativa do Estado de São Paulo

### 1.1 Portal de dados abertos (dumps)
- **URL:** https://www.al.sp.gov.br/dados-abertos/ (catálogo em `/dados-abertos/grupo/{1,2,21,41,81}`). O aviso do portal diz que haverá migração para `https://ckan.al.sp.gov.br/alesp-dados-abertos` ("em breve"). Esse endereço ainda não está no ar.
- **Formato:** arquivos XML (ou XML zipado) em `https://www.al.sp.gov.br/repositorioDados/...`, cada um com um PDF de documentação em `repositorioDados/docs/...`.
- **Atualização:** todos declaram frequência "Diária". O `Last-Modified` confirma geração por volta de 03:28 (horário de Brasília). Exceções paradas desde 2023: `funcionarios_*`, `legislacao_subtemas`.
- **Termos:** nada além da LAI e do "Programa de Dados Abertos". O `robots.txt` só bloqueia `/web`, `/StaticFile`, `/repositorio/contratos` e caminhos de SEO.

Recursos relevantes (todos com HTTP 200, verificados):

| Recurso | URL | Tamanho | Observação |
|---|---|---|---|
| Deputados (legislatura atual) | `repositorioDados/deputados/deputados.xml` | 0,3 MB | Contato, partido, bases eleitorais |
| Partidos | `repositorioDados/deputados/partidos.xml` | | |
| Despesas de gabinete (desde 2002) | `repositorioDados/deputados/despesas_gabinetes.xml` | | |
| Proposituras | `repositorioDados/processo_legislativo/proposituras.zip` | 17 MB (132 MB descompactado, 278.014 registros) | Ver **alerta** abaixo |
| Autores | `.../documento_autor.zip` | | |
| Tramitação (completa / últimos 12 meses) | `.../documento_andamento.zip` e `.../documento_andamento_atual.zip` | 1,8 MB zip / 85 MB | 248 mil andamentos; os mais recentes são de 2026-10-28 |
| Pareceres | `.../propositura_parecer.zip`, `.../tipo_parecer.xml` | 4,7 MB | |
| Comissões, membros, reuniões, presenças | `.../comissoes*.xml` | | |
| **Votos nominais em comissões** | `.../comissoes_permanentes_votacoes.xml` | 67 MB | Um registro por deputado e item: `Voto`, `TipoVoto` (F/C...), `IdDocumento`, `IdReuniao`, `Deputado` |
| Deliberações em comissões | `.../comissoes_permanentes_deliberacoes.xml` | 12,5 MB | |
| Normas estaduais (leis, LCs, decretos) | `repositorioDados/legislacao/legislacao_normas.zip` | 10 MB (119 MB descompactado, 241.553 normas) | Em dia: a norma mais recente é o Decreto 70.950, de 28/10/2026 |
| Agenda | `repositorioDados/agenda/agenda_eventos.xml` | 29 MB | |

**Alerta (dificuldade real):** o `proposituras.xml` é gerado todos os dias, mas a `DtPublicacao` mais recente nele é **2026-07-28**. A API nova (abaixo) já mostra o PL 901/2026, publicado em 2026-11-03. A ALESP migrou para um sistema novo, com IDs `1100xxxxxx`, e o dump legado (SPL) deixou de receber proposituras novas. **Não usar o dump como fonte única de proposituras.**

Exemplo de norma recente (ficha oficial): https://www.al.sp.gov.br/norma/213068 (Lei 18.499, de 28/10/2026).

### 1.2 API do portal legislativo (fonte principal recomendada)
- **Base:** `https://legis-api-portal-prd.al.sp.gov.br`. É a API que alimenta o próprio site da ALESP (SPA em `/legis-web-files/`).
- **Documentação:** **OpenAPI pública** em https://legis-api-portal-prd.al.sp.gov.br/v3/api-docs e Swagger em `/swagger-ui/index.html` ("legis-api-portal" v3.53.0, 142 rotas). Não exige autenticação.
- **Rotas úteis (testadas):**
  - `GET /processo?page=0&size=N`: proposições mais recentes primeiro (tipo, número/ano, resumo, autor, partido, `dtPublicacao`, link para o "Sem Papel").
  - `GET /processo/detalhes/{idProcesso}`, `/processo/tramitacoes/{idProcesso}`, `/processo/documentos/{idProcesso}`, `/processo/autores/{idProcesso}`.
  - `GET /processo/votacaoComissao/{idProcesso}`: **votos nominais nas comissões**, em JSON (parlamentar e voto).
  - `GET /votacao/{ano}`: lista das **votações nominais em plenário** do ano (39 em 2025 e 12 em 2026 até julho), com sessão, proposição, ementa, `resultadoVotacao` e **`urlArquivoPrincipal` (PDF)**.
  - `GET /sessoes-plenarias/consulta?page=&size=`, `/sessoes-plenarias/{id}/votacoes`, `/pauta`, `/ordem-do-dia`, `/integra` (íntegra/taquigrafia), `/videos`, `/audios`.
  - `GET /autografoPendSancao/listarPendenteSancao`: autógrafos à espera de **sanção ou veto**, útil para acompanhar a decisão do governador.
  - `GET /notificacao/tramitacoes/{data}`: tramitações do dia. Veio vazio para 2026-10-30; o comportamento precisa ser validado.
  - `GET /parlamentar-portal/todos`, `/lista-presenca-parlamentar/{matricula}/{mes}/{ano}`, `/partido/ativos/representatividade`.
- **Exemplos reais:**
  - Lista de votações: https://legis-api-portal-prd.al.sp.gov.br/votacao/2026
  - PDF de votação nominal (LDO 2027, PL 407/2026, 29ª Sessão Extraordinária, 21/07/2026): https://www.al.sp.gov.br/repositorio/ementario/votacoes/65ba6948-50ce-46f3-b416-47a79cee52ca.pdf
  - Página da proposição: https://www.al.sp.gov.br/propositura/1000688517
- **Votação nominal no plenário: existe, mas só como PDF** ("Relatório de Verificação de Votação"), gerada quando há *verificação de votação*. O PDF tem duas colunas (Parlamentar / Partido / Voto: Sim, Não, Obstrução, Licenciado, `---`) e o `pdftotext -layout` **embaralha as colunas**. É preciso um parser próprio (coordenadas com `pdfplumber`/`pdftotext -bbox`) e conferência humana. As votações simbólicas não têm voto individual.
- **Justificativas:** ficam no texto do projeto (documentos do processo e "Sem Papel"), em PDF.
- **Limites:** não há rate-limit documentado. A API é interna, então pode mudar sem aviso (fixar versão, monitorar o `/v3/api-docs`, fazer poucas requisições, respeitar cache). Não enviar cabeçalhos falsos (Origin etc.): chamadas simples funcionam.

### 1.3 Diário da Assembleia
O "Diário da Assembleia" é publicado no **DOE-SP, caderno Legislativo** ("Atos Legislativos e Parlamentares da Assembleia" > Expediente, Emendas, Requerimentos...). Coleta igual à da seção 2. Exemplo: https://doe.sp.gov.br/legislativo/expediente/requerimento-de-urgencia-n-3372-de-2026-20261026211611392235277

---

## 2. Governo de SP — Diário Oficial do Estado (DOE-SP)

- **URL:** https://doe.sp.gov.br/ (Next.js exportado estaticamente; o conteúdo é carregado no navegador).
- **API:** `https://do-api-web-search.doe.sp.gov.br/`. É o backend do portal, **sem documentação pública**, mas aberto e sem autenticação. Rotas testadas:
  - `GET v2/journals`: cadernos (Executivo, Legislativo, Municípios, Empresarial, Jucesp), com IDs.
  - `GET v2/sections?JournalId=..&ParentId=..`: árvore de seções. Em Executivo > **Atos Normativos** há as seções `Leis Complementares`, `Leis`, `Veto Total a Projeto de Lei`, `Veto Parcial a Projeto de Lei`, `Decretos`, `Atos do Governador`...
  - `GET v2/advanced-search/publications?JournalId=&SectionId=&FromDate=YYYY-MM-DD&ToDate=&Terms=&PageNumber=&PageSize=`: lista paginada (`totalItems`, `hasNextPage`) com `title`, `date`, `slug`, `hierarchy` e `excerpt`.
  - `GET v2/publications/{slug}`: **texto integral em HTML** (gerado pelo SEI), tipo da publicação e seção.
  - Também existem: `v3/unified-search/publications`, `v2/summary/structured` (sumário da edição), `v1/editions/url` (PDF da edição).
- **IDs úteis (Executivo):** journal `ca96256b-6ca1-407f-866e-567ef9430123`; Decretos `81f77c5c-d935-49ac-7d52-08db6b94d2bf`; Leis `7b2846f0-ea2b-4ce5-7d51-08db6b94d2bf`; Veto Total `56624b88-ed11-4424-b5b6-08db6b943832`; Veto Parcial `25d1b21a-fb6c-4335-e51a-08db6b932348`. Legislativo: journal `0953858b-7195-4020-ec15-08db6b8e0e4c`.
- **Volume observado:** 42 decretos entre 01/10 e 02/11/2026; 3 publicações em "Leis" em outubro; 5 vetos totais e 3 parciais em 2026.
- **Exemplos reais:**
  - Lei 18.499, de 28/10/2026: https://doe.sp.gov.br/executivo/leis/lei-n-18499-de-28-de-outubro-de-2026-202610281152102243849 (JSON: `.../v2/publications/executivo/leis/lei-n-18499-...`)
  - Decreto 70.913, de 30/09/2026: https://doe.sp.gov.br/executivo/decretos/decreto-n-70913-de-30-de-setembro-de-2026-202609301182022170554
  - Veto Total ao PL 1257/2019: https://doe.sp.gov.br/executivo/veto-total-a-projeto-de-lei/veto-total-ao-projeto-de-lei-n-1257-2019-de-22-de-janeiro-de-2026-202601231162271587348
- **Frequência:** diária, com publicação de madrugada (`date` por volta de 01:02).
- **Dificuldades:** API sem contrato público (pode mudar); acentos às vezes em ISO-8859-1 dentro do HTML; retificações publicadas como itens separados (ex.: "RETIFICAÇÃO DO D.O. DE 29 DE OUTUBRO"). A ligação entre veto e PL da ALESP precisa ser feita pelo número do PL, extraído do título.
- **Alternativa estruturada:** o link "Consulta a leis e decretos" do DOE leva à **ficha de norma da ALESP** (seção 1.1). Para leis e decretos já consolidados, o dump da ALESP é mais simples.

---

## 3. ICMS — CONFAZ e SEFAZ-SP

### 3.1 CONFAZ (convênios ICMS)
- **URL:** https://www.confaz.fazenda.gov.br/legislacao/convenios, com páginas por ano (`/legislacao/convenios/2026`).
- **Formato:** HTML (Plone). Cada convênio tem uma página com o texto integral: número, data, reunião do CONFAZ, "Publicado no DOU de dd.mm.aaaa", ementa e cláusulas. **Não há API, RSS nem JSON** (`/RSS` retorna 404). Os Ajustes SINIEF de 2026 pedem login (`require_login`); os Atos COTEPE são públicos em `/legislacao/atos/2026`.
- **Como listar por data:** baixar a página do ano e extrair os links `convenios/2026/...`. Os slugs **não seguem um padrão** (`CV117_26`, `convenio-icms-122-26`, `convenio-icms-124-26-1`), então o número deve ser lido do título `<h1 class="documentFirstHeading">`. A data de publicação está na linha "Publicado no DOU de ...".
- **Exemplo:** Convênio ICMS 131/26 (433ª Reunião Extraordinária, 27/10/2026, DOU de 29/10/2026, prorroga benefícios até 31/12/2028): https://www.confaz.fazenda.gov.br/legislacao/convenios/2026/convenio-icms-131-26
- **Frequência:** cada reunião do CONFAZ (ordinárias trimestrais e extraordinárias frequentes); 131 convênios até 27/10/2026.
- **Ligação com SP:** a adesão e a ratificação de SP aparecem como **Decreto estadual** (ex.: Decreto 70.762, de 17/07/2026) e como **Projeto de Decreto Legislativo da ALESP** que "Manifesta concordância com a implementação do Convênio ICMS nn/26" (achados no dump de proposituras: PDLs 19, 20 e 21/2026). Dá para montar a cadeia CONFAZ → Decreto SP (DOE) → PDL (ALESP) de forma automática, por regex sobre o número do convênio.

### 3.2 SEFAZ-SP — legislação tributária
- **URL:** https://legislacao.fazenda.sp.gov.br/Paginas/Home.aspx (SharePoint), com listas por tipo `Paginas/Atos.aspx?Tipo=Decretos|Leis|Portarias CAT/SRE|Resoluções SF/SFP|...` e o RICMS integral em `/Paginas/textoricms.aspx`.
- **API:** a REST do SharePoint (`/_api/web/lists/getbytitle('Páginas')/items`) responde sem login (lista "Páginas" com 27.536 itens, atualizada em 02/11/2026; exemplo: "Portaria SRE 51 de 2026"). Uma consulta com `$filter` foi **bloqueada pelo WAF** ("Request Rejected"). Por isso não deve ser a base da coleta: usar com moderação, ou só como checagem manual.
- **Recomendação:** a fonte primária para atos tributários de SP é o **DOE-SP** (decretos) mais a ficha da ALESP. A SEFAZ entra como texto consolidado de referência (RICMS) e para atos infralegais (portarias), na curadoria.
- Outro agente (`pesquisa-icms`) cobre ICMS em profundidade; aqui fica só o acesso.

---

## 4. TCE-SP — Tribunal de Contas do Estado

- **Portal:** https://transparencia.tce.sp.gov.br/ (Conjunto de Dados e APIs).
- **API documentada** (https://transparencia.tce.sp.gov.br/apis), aberta:
  - `GET /api/{json|xml}/municipios` (644 municípios; Atibaia = `atibaia`).
  - `GET /api/{formato}/despesas/{municipio}/{exercicio}/{mes}`: empenhos, liquidações e pagamentos por fornecedor.
  - `GET /api/{formato}/receitas/{municipio}/{exercicio}/{mes}`.
  - Exemplo real: https://transparencia.tce.sp.gov.br/api/json/despesas/atibaia/2026/8 (com dados). Para **2026/9 veio vazio**, o que indica **defasagem de cerca de 2 meses** (os dados vêm do sistema Audesp, alimentado pelo próprio município).
  - Conjuntos para download em CSV (despesas desde 2008, atualização semanal).
  - Ressalva do próprio TCE: os dados são "fornecidos pelo próprio Município" e ainda serão verificados.
- **Contas anuais e pareceres:** https://www.tce.sp.gov.br/contas-anuais (contas do governador e consolidado dos municípios), com relatórios e pareceres em **PDF**. A pesquisa por processo fica em https://www.tce.sp.gov.br/pesquisa-de-processos (formulário). Na Câmara de Atibaia, o tipo de propositura "Parecer do Tribunal de Contas" (36 itens) traz o julgamento das contas do prefeito pelos vereadores, que é o fato político de interesse.
- **Utilidade:** média. Serve para contexto ("quanto a prefeitura gastou com X") e para o parecer prévio sobre as contas do prefeito. Não serve para acompanhar votações.

---

## 5. Câmara Municipal de Atibaia

- **URL:** https://www.camaraatibaia.sp.gov.br/ (sistema **Webline Sistemas**, não é SAPL; `sapl.camaraatibaia.sp.gov.br` não resolve).
- **Barreira de acesso:** a primeira resposta HTTP é uma página "Carregando..." que grava o cookie `wls_js` via JavaScript (proteção anti-robô simples). Com `curl` puro só vem essa página; **o acesso foi feito por navegador real**. Um coletor automático precisará de navegador headless (Playwright). Antes disso, é recomendável **pedir à Câmara** (SIC/Ouvidoria) autorização ou um endpoint de dados, para não contornar a proteção.
- **URLs internas:** todas as páginas usam `/?pag=<token opaco de 64 caracteres>&...`. Exemplos: proposição `&id=26359&tp=10`; sessão `&id_sessao=1089&id=1091`. Os links são estáveis enquanto o token `pag` não mudar.
- **O que oferece:**
  - **Proposituras** (busca avançada por autor, número, protocolo, categoria, situação, período e palavra-chave). Contagem total: PL 1.441; PLC 392; Resoluções 141; PDL 58; Emendas à LOM 23; **Vetos 47**; Requerimentos 2.284; Indicações 17.803; Moções 657; Pareceres 1.946; Redação Final 289; "Parecer do Tribunal de Contas" 36. A página de resultados oferece **exportação em PDF, XLS, XLSX, DOCX e TXT**.
  - **Detalhe da propositura:** número, protocolo, autor, início da tramitação, ementa, situação, sessão de apresentação, abas "Tramitação da Matéria", "Arquivos Avulsos" e "Encaminhamentos". Exemplo: PL 0113/2026 (LOA 2027, R$ 1.558.976.655,00, autor Executivo, apresentado na 33ª Sessão Ordinária). Situação "Em Tramitação"; tabela de tramitação **vazia** ("Nenhum registro encontrado").
  - **Situações** possíveis incluem "Aprovado", "Rejeitado em 1ª/2ª discussão", "Sancionado", "Vetado", "Veto Mantido", "Veto Rejeitado", "AGUARDA SANÇÃO OU VETO"... Isso dá o **resultado agregado**, não o voto de cada vereador.
  - **Sessões:** Atas (Ordinária, Extraordinária, Solene, reuniões de comissões), pautas e vídeos (canal YouTube https://www.youtube.com/user/camaradeatibaia). Em 2026 já houve 36 sessões ordinárias (36ª em 27/10/2026, às 17h, às terças). A ata é baixada por um formulário ("clique no ícone"), não por link direto.
  - **Vereadores, Mesa, Comissões, Legislaturas.**
  - **Legislação:** Leis Ordinárias, Complementares, Decretos Legislativos, Resoluções, Emendas à LOM, Lei Orgânica, Regimento Interno.
  - **"Dados Abertos"** (Programa de Dados Abertos): JSON/XML por tipo de propositura e ano via `/indexAjax.php` (GET). **Limitação grave:** a exportação de "Projeto de Lei / 2026" trouxe `{"total":10,"proposituras":[...]}`, ou seja, só os **10 mais recentes** (PL 0106 a 0115/2026), com os campos `tipo, numero, ano, data, ementa, autores, situacao`. Serve como "feed de novidades" se for lido com frequência, não como base histórica.
- **Votação nominal:** **não é publicada de forma estruturada.** Não há menu de votações nem voto por vereador no detalhe da propositura. O voto individual, quando houver (votação nominal ou verificação), só aparece na **ata** (PDF) ou no **vídeo**. Isso exige curadoria manual.
- **API:** não há API documentada.
- **Frequência:** o portal mostra "Última atualização: 31/10/2026 19:36"; as atas saem com alguns dias de atraso (a da 36ª, de 27/10, ainda não estava disponível).

---

## 6. Prefeitura de Atibaia — Imprensa Oficial Eletrônica (IOE)

- **URL:** https://prefeitura.atibaia.sp.gov.br/imprensa/ (criada pela LC 760/2017). O link vem do portal https://www.atibaia.sp.gov.br/.
- **Formato:** **PDF por edição** (com camada de texto; `pdftotext` funciona), assinado digitalmente via 1Doc. Há edições extras com sufixos B e C (ex.: 3049B).
- **Navegação:** calendário por ano (`index.php?ano=2026`), "Edições" (`numero.php`) e busca textual (`pesquisar.php`, formulário POST para `processar.php` com campos `pesquisa` e `ano`).
- **Padrão de URL:** `https://prefeitura.atibaia.sp.gov.br/imprensa/pdf/2026/{edição}[B|C]_{hash32}.pdf`. O hash é imprevisível, então é preciso ler o calendário para descobrir os links (algumas edições antigas não têm hash, ex.: `pdf/2026/3049.pdf`).
- **Exemplo real:** edição **n.º 3051, sábado, 31/10/2026, 36 páginas**: https://prefeitura.atibaia.sp.gov.br/imprensa/pdf/2026/3051_9950d11ac24df372723acdf90a165747.pdf (3,6 MB; `Last-Modified` 29/10/2026). Contém, entre outros, a **Lei n.º 5.196, de 28/10/2026** (utilidade pública da AGCMA, de autoria do vereador Derek Bonjardim), atas de conselhos municipais, licitações e homologações, e menções aos Decretos 11.547/2025 e 11.834/2026.
- **Frequência:** quase diária (inclusive sábados).
- **Dificuldades:** layout em **várias colunas**, e o texto extraído intercala colunas (no exemplo, a Lei 5.196 aparece misturada com um edital). Não há índice estruturado de atos. Para separar "LEI N.º", "DECRETO N.º" e "LEI COMPLEMENTAR N.º" é preciso extração por coordenadas e revisão humana. O `robots.txt` só tem o preâmbulo de *content signals*, sem regras de bloqueio.
- **Não oficiais (não usar como fonte):** `leismunicipais.com.br/prefeitura/sp/atibaia` (compilador privado, linkado pelo portal da prefeitura). Pode ajudar a localizar o texto consolidado, mas a citação deve ir sempre para a IOE ou para a Câmara.

---

## 7. Querido Diário (Open Knowledge Brasil)

- **Status em 2026-11-02:** a API (`https://api.queridodiario.org.br/gazettes?territory_ids=3504107`, para onde `queridodiario.ok.org.br/api/...` redireciona) devolveu **HTTP 522** (origem fora do ar, Cloudflare) em todas as tentativas.
- **Cobertura de Atibaia (IBGE 3504107):** no repositório `okfn-brasil/querido-diario`, o código IBGE 3504107 só aparece em `resources/territories.csv`. **Não há raspador para Atibaia** (a pasta `spiders/sp` tem 117 arquivos e nenhum é de Atibaia). Conclusão: **Atibaia não é coberta.**
- **Papel possível:** nenhum para Atibaia, por enquanto. Em outros municípios cobertos, poderia servir de *índice de busca* textual que aponta para o PDF original (o campo `url` da API aponta para o arquivo do diário oficial). O site deve **linkar sempre o original** e nunca citar o Querido Diário como fonte.

---

## Estratégia de coleta proposta

### Automatizável (jobs agendados, só leitura, cache agressivo)
1. **ALESP, diário (madrugada):**
   - `GET /processo?page=0..k&size=100` até chegar a `dtPublicacao` já conhecida (novas proposições).
   - Para proposições acompanhadas (as de interesse curado ou todas as de tipos PL, PLC, PEC e PDL): `/processo/detalhes`, `/processo/tramitacoes`, `/processo/votacaoComissao`.
   - `GET /votacao/{ano}`: novas votações nominais em plenário. Baixar o PDF e rodar o parser por coordenadas, com **status "a conferir"** até revisão.
   - `GET /autografoPendSancao/listarPendenteSancao`: o que aguarda o governador.
   - Dumps: `legislacao_normas.zip` (leis e decretos), `deputados.xml`, `comissoes_permanentes_votacoes.xml` (histórico de votos em comissão).
2. **DOE-SP, diário:** `v2/advanced-search/publications` nas seções Leis, Leis Complementares, Decretos, Veto Total e Veto Parcial, com janela D-3..D (cobre retificações). Depois, `v2/publications/{slug}` para o texto. Ligar ao PL da ALESP pelo número no título ou no texto.
3. **CONFAZ, semanal:** página `/legislacao/convenios/{ano}` e páginas novas; extrair número, data, reunião, DOU e ementa. Cruzar por regex com os decretos do DOE e os PDLs da ALESP ("Convênio ICMS nn/aa").
4. **TCE-SP, mensal:** `api/json/despesas|receitas/atibaia/{ano}/{mes}`, aceitando a defasagem de cerca de 2 meses.
5. **IOE Atibaia, diário:** ler `index.php?ano=AAAA`, baixar só edições novas, extrair texto, achar candidatos a atos (`^LEI N`, `^DECRETO N`, `^LEI COMPLEMENTAR N`, `VETO`) e gravar com link para o PDF e o número da página. Tudo entra como **"candidato" para revisão**.
6. **Câmara de Atibaia:** feed de novidades pelos JSON de dados abertos (10 últimos por tipo), lidos com frequência suficiente para não perder itens. **Só depois de resolver o acesso** (pedido formal à Câmara, ou navegador headless respeitando a proteção). Situação de PLs e vetos pela página de detalhe.

### Exige curadoria manual
- **Votos individuais dos vereadores de Atibaia:** ler as atas (PDF) e/ou assistir aos vídeos das sessões; registrar, para cada votação, a fonte (ata, página, minuto do vídeo).
- **Conferência dos votos nominais da ALESP** extraídos dos PDFs, que têm layout em colunas.
- **Separação dos atos na IOE de Atibaia** (leis e decretos do prefeito), já que o texto em colunas mistura atos.
- **Interpretação neutra** de convênios ICMS e decretos tributários (o que muda, para quem), sempre citando o texto literal.
- **Seleção de relevância:** de ~1.900 proposituras/ano na ALESP e ~17 mil indicações acumuladas em Atibaia, escolher o que destacar com critérios publicados (ex.: PL/PLC/PEC/LOA/LDO, vetos, matérias com votação nominal).

### Princípios técnicos
- Guardar sempre a **URL original**, a data de coleta e um hash do documento. A página do site linka o original, nunca uma cópia.
- APIs não documentadas (ALESP-portal, DOE) devem ser tratadas como instáveis: testes de contrato diários e alerta quando o schema mudar.
- Pouca carga: uma requisição por vez, `User-Agent` identificado com contato, cache de respostas, nenhuma tentativa de contornar WAF ou proteções (SEFAZ, Câmara).

---

## Pendências e verificações futuras
- Confirmar se a ALESP vai corrigir o `proposituras.xml` ou se o CKAN anunciado o substituirá.
- Validar `/notificacao/tramitacoes/{data}` da ALESP com datas de sessão.
- Pedir à Câmara de Atibaia (SIC) exportação completa (não só os 10 últimos) e publicação estruturada das votações nominais.
- Verificar se a Prefeitura de Atibaia tem uma busca estruturada por ato além da busca textual.
- Tentar de novo a API do Querido Diário quando voltar ao ar, só para confirmar a ausência de Atibaia.
- Scripts e amostras desta pesquisa: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\pesquisa-fontes-sp-atibaia\` (ex.: `an_alesp.py`, `alesp_openapi.json`).

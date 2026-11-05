# Tribunais de contas do Nordeste: avaliação técnica das fontes oficiais

Data dos testes: 2026-11-04 (alguns carimbos de resposta dos servidores já aparecem como 05/11 em UTC). Pesquisa somente de leitura: poucas requisições, no mínimo 1 s entre elas, User-Agent `BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)`, robots.txt lido antes de cada host. Nenhum CAPTCHA ou bloqueio foi contornado. Onde algo não foi verificado, está escrito "não confirmado". Nomes de particulares vistos em respostas não foram copiados.

Tribunais: TCE-AL, TCE-BA, TCE-CE, TCE-MA, TCE-PB, TCE-PE, TCE-PI, TCE-RN, TCE-SE e TCM-BA.

## Tabela resumo

| Tribunal | Dados abertos | Acórdãos/decisões | Contas do governador/prefeito | Bloqueios | Esforço |
|---|---|---|---|---|---|
| **TCE-PE** | API REST própria `sistemas.tcepe.tc.br/DadosAbertos`, JSON/XML/HTML, sem chave (confirmado) | `Resultados`: processo, relator, colegiado, data da sessão, resultado, nº do acórdão/parecer, link do documento (só processos transitados em julgado). Sem ementa estruturada | **Sim, estruturado**: governador (2014 a 2022: relator, data, resultado) e prefeitos (`Tipo=Governo`, com link do parecer prévio) | Nenhum visto na API. Texto em ISO-8859-1 | **Baixo** |
| **TCE-PB** | `dados-abertos.tce.pb.gov.br`: só ZIP de receitas, despesas, servidores e licitações (sem decisões) | API JSON do front de jurisprudência (`jurisprudencia.tce.pb.gov.br/api/...`): número, relator, órgão julgador, data, resultado, resumo do dispositivo, PDF. Não documentada | Parecer Prévio é tipo de decisão na API (372 registros); governador e prefeitos. Filtros não confirmados | Sem CAPTCHA visto; SPAs; API sem documentação pública | **Médio** |
| **TCE-CE** | `api-dados-abertos.tce.ce.gov.br/sim` (OpenAPI; finanças municipais, sem decisões) | App "Contexto" (Angular + `contexto-api`), API não documentada. Não confirmado | **Governador: PDFs por exercício (2014 a 2025)** em páginas HTML (parecer prévio, voto do relator, declarações de voto). Prefeitos: não confirmado | Sem bloqueio visto; CAPTCHA (Altcha) só em formulário de inscrição | **Médio** |
| **TCE-SE** | Não encontrado | Formulário ASP.NET/SharePoint com filtro por relator, tipo de processo, tipo de decisão e datas. Formato dos resultados não confirmado | Tipo "CONTAS ANUAIS DE GOVERNO" e decisões "PARECER PRÉVIO ..." existem no formulário. Resultado não confirmado | Sem CAPTCHA visto; exige ViewState/POST | **Médio** (não confirmado) |
| **TCE-AL** | Sem portal de dados abertos de decisões (há painéis Power BI) | `POST /view/consultarDadosJurisprudencia.php` achado no JavaScript; sondagem voltou vazia. Não confirmado | Governador: não confirmado. **Prefeitos: tabela HTML "Contas Julgadas"** (só reprovadas/irregulares, 2023 a 2026) | Sem CAPTCHA visto | **Médio a alto** |
| **TCE-MA** | API `tce-api.apps.tcema.tc.br` (OpenAPI aberto, 307 caminhos, **Bearer** declarado); só finanças, folha, contratos | `/spe/processo/...` listado na API; mural de documentos é SPA. Não confirmado | Não confirmado | Credencial (Bearer); SPAs | **Depende de terceiros** (credencial ou LAI) |
| **TCE-PI** | Sem dados abertos de decisões achados; `sistemas.tce.pi.gov.br/api/portaldacidadania` (conteúdo não confirmado) | Páginas "Decisões", "Pesquisa de processos", boletins. Formato não confirmado | Página "Parecer das Contas de Governo" existe; conteúdo não confirmado | Não confirmado | **Médio** (não confirmado) |
| **TCE-RN** | `apidadosabertos.tce.rn.gov.br` (Swagger; dados do SIAI, finanças; sem decisões) | `jurisprudencia.tce.rn.gov.br` é SPA Angular, backend não identificado; boletins em PDF | Governador: não localizado em fonte estruturada. Lista de contas irregulares/reprovadas em HTML | **reCAPTCHA** na consulta de processos (não contornar) | **Alto** |
| **TCE-BA** | Não confirmado | Não confirmado | Não confirmado | **Site em manutenção** em 04/11/2026 | **Depende de terceiros** |
| **TCM-BA** | Portal oficial de dados abertos não encontrado | Pesquisa "Contas Anuais" (formulário; script de reCAPTCHA citado) e ementário (HTML de 2 MB, 1.345 links PDF) | **Prefeitos: "Quadro Geral de Prestação de Contas por município" (HTML estático)**, 2011 a 2025, decisão por cor; detalhe via JavaScript | reCAPTCHA possível no formulário (não testado) | **Médio** |

## Observações

- **Melhor candidato: TCE-PE**, de longe: API aberta com parecer prévio do governador e dos prefeitos, relator, data, resultado e link.
- **Sistema e-TCE compartilhado (indício, não confirmado):** TCE-PE (`etce.tcepe.tc.br/epp/...`), TCM-BA (`e.tcm.ba.gov.br/epp/ConsultaPublica/listView.seam`, mesmo caminho `/epp/`), TCE-AL (`consultatce.tceal.tc.br`, "Consulta pública do sistema ETCE") e TCE-SE (tipo "CONTAS ANUAIS - eTCE 2016"). Um parser de consulta JSF/Seam poderia servir a mais de um.
- Segundos candidatos: TCE-PB (API JSON rica, mas não documentada) e TCE-CE (governador em PDF por exercício, até 2025); TCM-BA para o panorama de prefeitos (HTML estático).
- TCE-BA fora do ar, TCE-MA com credencial e TCE-RN com reCAPTCHA: depender de LAI/SIC ou aguardar.

---

## TCE-PE (Pernambuco)

- **Site:** https://www.tce.pe.gov.br/internet/ (Joomla). Dados abertos: https://www.tce.pe.gov.br/internet/index.php/dados-abertos. Jurisprudência: https://portal.tcepe.tc.br/jurisprudencia/consulta/deliberacoes (SPA; não usada).
- **robots.txt (04/11):** `www.tce.pe.gov.br`, `sistemas.tcepe.tc.br`, `portal.tcepe.tc.br`, `www.tcepe.tc.br`: todos **404** (sem regras).
- **API:** `https://sistemas.tcepe.tc.br/DadosAbertos/` (catálogo em `Exemplo!listar`; detalhe em `Exemplo!detalhar?dadosAbertos.id=N`). URL padrão `https://sistemas.tcepe.tc.br:443/DadosAbertos/{Entidade}!{formato}` com formatos json, xml, html e htmlFormatado. Sem chave. Limite de resultado declarado: 100000 por chamada. JSON em **ISO-8859-1** (`Content-Type: application/json;charset=ISO-8859-1`), cookie JSESSIONID.
- **Entidades de interesse (grupo Processos):** `Processos` (id 43), `Resultados` (id 42), `DadosLimiteGastos` (id 65: limites de gastos nos processos julgados de contas de governo), `Determinacoes`, `Considerandos`, `Recomendacoes`, `DebitosMultas`, `ResultadosAPR`, `ResultadosTomadaContaEspecial`. Também receitas, despesas, contratos, licitações, folha, obras etc.
- **Testes:**
  - `Resultados!json?ExercicioPrincipalProcesso=2023&Tipo=Governo` -> 200, 174 registros, 138 KB. Campos: `NomeUJPrincipalProcesso, NomeColegiado, StatusProcesso, EsferaUJPrincipalProcesso, NomePessoa, MunicipioUJPrincipalProcesso, ExercicioPrincipalProcesso, Modalidade, DataSessaoJulgamento, NomeRelator, HoraSessaoJulgamento, Processo, Resultado, Tipo, LinkDocumento, Documento, AnoAcordaoParecer, LinkProcesso`. Ex.: Prefeitura Municipal de Lagoa dos Gatos, 2ª Câmara, "Transitado em julgado", sessão 2025-01-30, resultado "Aprovação com ressalvas", documento "Parecer Prévio". `NomePessoa` traz o nome do prefeito (agente público); em outros tipos de processo pode ser particular: filtrar.
  - `Resultados!json?Tipo=Governo&EsferaUJPrincipalProcesso=E` -> 10 registros do **Governo do Estado**, todos "Tribunal Pleno", documento "Parecer Prévio": exercício 2014 (sessão 2016-07-27, Teresa Duere, Aprovação; aparece duplicado, deduplicar por `Processo`), 2015 (2017-07-19, Ranilson Ramos, Aprovação), 2016 (2018-04-25, Valdecir Pascoal, Aprovação), 2017 (2019-12-16, Dirceu Rodolfo de Melo Júnior, Aprovação), 2018 (2022-02-09, Carlos Neves, Aprovação), 2019 (2023-09-13, Eduardo Lyra Porto, Aprovação), 2020 (2023-11-08, Marcos Loreto, Aprovação), 2021 (2024-12-04, Dirceu Rodolfo de Melo Júnior, Aprovação com ressalvas), 2022 (2025-06-04, Ranilson Ramos, Aprovação).
  - `Processos!json?Exercicio=2023&Esfera=E&Modalidade=Prestação de Contas` -> processo 24100726-4, Governo do Estado, `Situacao: Não Julgado` (contas de 2023 do governador ainda sem julgamento na API em 04/11/2026). Há uma linha por interessado, inclusive particulares: não copiar.
- **Inteiro teor:** `LinkDocumento` aponta para `etce.tcepe.tc.br/epp/validaDoc.seam?cod=...` (formato do arquivo não confirmado) e `LinkProcesso` para a consulta externa do e-TCE.
- **Ementa e votação:** a documentação de `Resultados` prevê `DescricaoProcesso` (varchar 8000); o campo não apareceu nos registros de exemplo (não confirmado). Resultado de votação (unanimidade/maioria) e votos por conselheiro: não vistos.
- **Esforço: baixo.** **Recomendação:** coletor de `Resultados` por exercício (governo estadual e municipal), deduplicando por `Processo`, lendo ISO-8859-1 e guardando o link do parecer. Conferir manualmente o parecer do governador (votação e ressalvas).

## TCE-PB (Paraíba)

- **Sites:** https://tce.pb.gov.br/ (WordPress; home de 1,1 MB), dados abertos https://dados-abertos.tce.pb.gov.br/ (SPA React), jurisprudência https://jurisprudencia.tce.pb.gov.br/ (SPA Angular, "TCE-PB Tramita").
- **robots.txt:** `tce.pb.gov.br`: `Disallow: /wp-admin/` (admin-ajax liberado), Sitemap `/wp-sitemap.xml`. Nos dois subdomínios `/robots.txt` devolve a própria SPA (200 com HTML): na prática, sem regras.
- **Dados abertos:** a SPA lista quatro conjuntos (receitas, despesas, servidores e licitações), baixados como ZIP em `https://download.tce.pb.gov.br/dados-abertos/dados-consolidados/{id}/{id}-{ano}.zip` e `.../dados-por-municipio/...`. **Sem decisões.** Nada baixado (volume).
- **API de jurisprudência (descoberta no JavaScript do front; sem documentação oficial):**
  - `GET https://jurisprudencia.tce.pb.gov.br/api/facet/tipo-decisao` -> Acórdão, Decisão Singular, Parecer Normativo, **Parecer Prévio**, Resolução Processual, Resolução Sumular. `.../facet/orgao-julgador` -> Primeira Câmara, Segunda Câmara, Tribunal Pleno. Também existem `facet/relator`, `municipio`, `subcategorias`, `tipo-arquivo` e `tipo-tramitavel`.
  - `GET /api/juris/busca/decisoes?termo=...` -> JSON (HTTP 202, 20 documentos por página, com `pagina`, `qtdEncontrados` e `facets`). Campos: `data, jurisdicionado, paginas, tamanho, ente, subcategoria, tipoArquivo, tipoTramitavel, protocolo, relator, descricao, dataJulgamento, orgaoJulgador, numeroDecisao, tipoDecisao, resultado, resumoDecisao, highlights, codigoAbrirArquivo`. Ex.: "Acórdão APL-TC 00096/18", Tribunal Pleno, 07/03/2018, relator Arnóbio Alves Viana, resultado "Regular com Ressalvas", 6 páginas, 147 KB; o `resumoDecisao` traz o dispositivo e "por unanimidade" quando consta literalmente.
  - Teste `termo=governador` -> 2.021 documentos (Parecer Prévio 372; Acórdão 1.462; ente "Paraíba (Governo do Estado)" 1.191). `termo=Governo do Estado` junto de `tipoDecisao=Parecer Prévio` devolveu 11.153: o parâmetro `tipoDecisao` **foi ignorado** (nomes dos filtros não confirmados; estão no código do front, possivelmente por POST). Um resultado com "Parecer Prévio": **PPL-TC 00224/22**, Governo do Estado, sessão 13/12/2022, relator Antônio Nominando Diniz Filho, "Parecer Favorável" (exercício ao qual se refere: não confirmado).
  - Download do PDF: método `downloadArquivo` no front (endereço exato não confirmado); se o PDF tem texto: não confirmado.
- **Contas do governador e dos prefeitos:** Parecer Prévio é um `tipoDecisao` próprio, com o ente (município ou Governo do Estado). Dá para montar a lista por município quando os filtros forem confirmados.
- **Risco:** API de front-end não documentada; pode mudar sem aviso.
- **Esforço: médio.** **Recomendação:** coletor sobre `busca/decisoes` (padrão do TCU) depois de confirmar os parâmetros de filtro no JavaScript (`main-es2015.*.js`); `resumoDecisao` já cobre o dispositivo. Se virar fonte principal, pedir liberação formal ao tribunal.

## TCE-CE (Ceará)

- **Site:** https://www.tce.ce.gov.br/ (Joomla).
- **robots.txt:** `User-agent: *` bloqueia `/administrator/, /cache/, /cli/, /components/, /images/, /includes/, /installation/, /language/, /libraries/, /logs/, /media/, /modules/, /plugins/, /templates/, /tmp/`; `Screaming Frog SEO Spider: Disallow: /`. Os links de documentos de contas de governo usam `.../documentos-das-contas-do-governo-AAAA/send/...` (não bloqueado).
- **API de dados abertos:** https://api-dados-abertos.tce.ce.gov.br/sim/ (Swagger UI; `openapi_prod.yaml`, 436 KB, 105 caminhos) do **SIM** (Sistema de Informações Municipais): municípios, gestores, orçamento, balancetes, contratos, parcerias etc. **Sem decisões nem pareceres.** O esquema declara `basicAuth`, mas `GET /sim/municipios?limit=1` respondeu 400 ("The field 'limit' does not exist") sem credencial, isto é, não pediu autenticação (dados reais não testados). robots.txt do host: 404.
- **Contas do governador (HTML + PDF):** índice https://www.tce.ce.gov.br/jurisdicionado/fiscalizacao-e-controle/relatorios-de-contas-de-governo, uma página por exercício (2014 a 2025) mais "Parecer Prévio referente ao exercício" de 2000 a 2013. Exercício 2024 (`.../documentos-das-contas-do-governo-2024`): "Parecer Prévio Contas do Governador 2024" (apresentação e versão em linguagem simples), "Relatório Voto - Conselheiro Ernesto Saboia (Relator)", relatórios de instrução (inicial e final), parecer do Ministério Público de Contas e **declarações de voto** dos conselheiros Soraia Victor, Valdomiro Távora, Patrícia Saboya e Edilberto Pontes. Exercício 2025 (`.../documentos-das-contas-do-governo-2025`) já publicado: parecer prévio (apresentação), "Relatório Voto - Conselheiro Edilberto Pontes (Relator)", relatórios de instrução e parecer do MP de Contas. Se os PDFs têm texto ou são imagem: **não confirmado** (não baixados).
- **Acórdãos/decisões:** "Jurisprudência > Consulta" remete ao app **Contexto** (https://www.tce.ce.gov.br/contexto/, Angular), com backend em `contexto-api.tce.ce.gov.br` e `api-processos.tce.ce.gov.br` (raiz responde 404 JSON Spring; robots 404) e a um serviço de jurisprudência em Sydle (`tcece.sydle.one`). Endpoints de busca de acórdãos: **não confirmados**. Consulta textual do Diário Oficial e ata de julgamentos existem no portal (não testadas). A "Consulta geral" (`contexto-consulta-geral?tipo=processos-protocolos`) não mostrou CAPTCHA; o Altcha visto (`comunica.tce.ce.gov.br/api/public/captcha/altcha`) é de um formulário de inscrição.
- **Prefeitos:** fonte estruturada de parecer prévio municipal: **não confirmada**.
- **Esforço: médio.** **Recomendação:** coletar o governador pelas páginas por exercício (listar links, baixar o parecer e o voto, extrair texto); investigar o `contexto-api` só depois de pedir documentação ao tribunal.

## TCE-SE (Sergipe)

- **Sites:** https://www.tce.se.gov.br/ (SharePoint; `www.tcese.tc.br` redireciona para ele). Consultas: https://www.tce.se.gov.br/consultas/ConsultaVirtual.aspx e `ConsultaVirtualDecisoes.aspx` (ASP.NET WebForms; campos Protocolo, Assunto e UG; sem CAPTCHA no HTML).
- **robots.txt:** `User-agent: *` `Disallow: /_layouts/`; `meta-externalagent` também bloqueia algumas listas de notícias. Igual em `www.tcese.tc.br`.
- **Jurisprudência:** https://www.tcese.tc.br/jurisprudencia/SitePages/decisoes.aspx e `.../pareceres.aspx` (SharePoint, 340 a 385 KB). Formulário com termo, relator, **tipo de processo** (inclui "CONTAS ANUAIS DE GOVERNO", "CONTAS ANUAIS DO PODER LEGISLATIVO", "CONTAS ANUAIS - eTCE 2016", prestação de contas de convênio etc.), **tipo de decisão** (inclui "PARECER PRÉVIO FAVORÁVEL", "PARECER PRÉVIO FAVORÁVEL COM RECOMENDAÇÃO", "PARECER PRÉVIO PELA REJEIÇÃO", "LEGAL", "IRREGULAR, GLOSA E MULTA"), datas e jurisdicionado. Envio por POST com `__VIEWSTATE`, `__EVENTVALIDATION` e `__REQUESTDIGEST`. Um POST de teste (termo "governador", outubro/2026) devolveu a página (393 KB), mas **não identifiquei a tabela de resultados** (formato dos resultados: não confirmado). Há boletins de jurisprudência em `/jurisprudencia/SitePages/boletim.aspx`.
- **Dados abertos:** não encontrados nos menus lidos (transparência em `/transparencia/SitePages/Inicial.aspx`, não explorada).
- **Esforço: médio** (depende de confirmar o formato dos resultados). **Recomendação:** nova sondagem controlada do POST com o navegador aberto para ver a requisição real; se os resultados forem HTML com link de PDF, coletar por tipo de decisão "PARECER PRÉVIO ..." para governador e prefeitos.

## TCE-AL (Alagoas)

- **Sites:** https://www.tceal.tc.br/ (PHP próprio); consulta de processos https://consultatce.tceal.tc.br/ ("Consulta pública do sistema ETCE"); https://consulta.tceal.tc.br/; diário https://consultadoe.tceal.tc.br/.
- **robots.txt:** `www.tceal.tc.br`, `consultatce.tceal.tc.br` e `consulta.tceal.tc.br`: **404** (sem regras).
- **Dados abertos:** portal de dados abertos de decisões não encontrado. A home aponta painéis Power BI (`painel.tceal.tc.br`) e licitações.
- **Jurisprudência:** https://www.tceal.tc.br/view/consulta-jurisprudencia.php (pesquisa livre em ementa, inteiro teor e indexação; filtros por número, datas de sessão e de diário, conselheiro, partes, natureza e colegiado). O JavaScript (`view/js/consulta-jurisprudencia.js`) chama `POST consultarDadosJurisprudencia.php` (endereço efetivo `https://www.tceal.tc.br/view/consultarDadosJurisprudencia.php`: 200, corpo vazio) com `numeroAno, dataSessaoInicial, dataSessaoFinal, dataDiarioInicial, dataDiarioFinal, codConselheiro, codDecisao, colegiado, observacao`, esperando JSON com `numero, ano, dataSessao, dataDiario, natureza, relator, interessado, decisao, arquivo`. Duas sondagens (junho/2025 e outubro/2026, demais campos em branco) voltaram **vazias**: provavelmente faltam parâmetros; **não confirmado**. Detalhe: `detalhes.php?n=..&a=..` (valores em base64).
- **Contas julgadas (prefeitos):** https://www.tceal.tc.br/view/contas-julgadas.php, **tabela HTML por ano (2023 a 2026)** com responsável, natureza, processo, deliberação, trânsito em julgado e jurisdicionado. Tem linhas como "Parecer Prévio pela Reprovação em 03.02.2026" (Prefeitura de Canapi). É a lista de reprovadas/irregulares, não de todos os pareceres (35 linhas `<tr>`, 27 com "Parecer Prévio" no dia do teste). Os responsáveis são prefeitos nominados na lista; confirmar a condição de agente público antes de publicar.
- **Contas de governo:** https://consultatce.tceal.tc.br/contas/governo lista entregas por exercício (unidade gestora, data de entrega, protocolo) e traz manuais e modelos; **não traz o parecer**. Há "Mapa de relatorias" (https://relatorias.tceal.tc.br/) e acompanhamento (https://acompanhamento.tceal.tc.br/), não explorados. Parecer prévio do governador: não confirmado onde está.
- **Esforço: médio a alto.** **Recomendação:** coletar a tabela "Contas Julgadas" (HTML simples) e confirmar o endpoint de jurisprudência no navegador (ou pedir o parâmetro correto ao tribunal) antes de investir.

## TCE-MA (Maranhão)

- **Site:** https://www.tcema.tc.br/ (WordPress exportado como site estático). Sistemas em `*.apps.tcema.tc.br` e `sistema.tcema.tc.br` (SPE, ZK).
- **robots.txt:** `www.tcema.tc.br` 404; `tce-api.apps.tcema.tc.br` 404 (JSON); `sistema.tcema.tc.br` 404; `publicacao.apps.tcema.tc.br` devolve a SPA. Sem regras.
- **API:** https://tce-api.apps.tcema.tc.br/swagger-ui/index.html, OpenAPI em `/v3/api-docs` (200, 122 KB, "API de dados do TCE-MA", licença Apache 2.0). 307 caminhos: `sincfiscal` (2023 a 2026), `sincfolha`, `sinccontrata`, `sacop`, `saapfolha`, `contrato`, `licitacao`, `ente`, `poder`, `unidade`, e `/spe/processo/find-all-by-filtro-processo` (POST) e `/spe/processo/{numero}/{ano}` (GET). Esquema de segurança: **Bearer Authentication** (credencial). Uma chamada sem token a `/spe/processo/1/2024` respondeu 400 com uma mensagem interna de 404 (`/spe/api/processo/find-by-numero/1/2024`): não confirmei se os dados exigem o token. **Não há endpoints de acórdãos ou pareceres prévios.**
- **Acórdãos e contas:** o portal tem "Consulta de processos" (SPE, `sistema.tcema.tc.br/spe/consultapauta.zul`), "Mural de prejulgados" (`publicacao.apps.tcema.tc.br/#/muralprejulgados`), "Mural de documentos" e "Mural de prestação de contas". São SPAs/ZK; formato e se há inteiro teor público: **não confirmado**. Páginas do governador e dos prefeitos: **não localizadas** (a busca do site estático não funcionou).
- **Esforço: depende de terceiros.** **Recomendação:** pedir à Ouvidoria/SIC a credencial da API ou a lista de pareceres prévios; por ora, nada automático.

## TCE-PI (Piauí)

- **Sites:** https://www.tcepi.tc.br/ e https://www.tce.pi.gov.br/ (WordPress, espelho); sistemas em `sistemas.tce.pi.gov.br`, `sistemas.tcepi.tc.br` e `internos.tce.pi.gov.br`.
- **robots.txt:** `www.tcepi.tc.br` e `www.tce.pi.gov.br` bloqueiam `/admin/, /wp-admin/, /images/, /wp-include/, /language/, /libraries/, /media/, /modules/, /plugins/, /templates/, /tmp/, /xmlrpc/, /audio/` e `/wp-content/uploads/wp-import-export-lite/`. `sistemas.tce.pi.gov.br`: `Disallow: /licitacoesweb/`.
- **Dados abertos:** "Portal da Cidadania" (`sistemas.tce.pi.gov.br/portaldacidadania/`) e documentação de API em https://sistemas.tce.pi.gov.br/api/portaldacidadania/docs/ (200, 45 KB); a lista de rotas não pôde ser extraída (conteúdo dinâmico). Cobertura (decisões ou só finanças): **não confirmado**.
- **Decisões:** https://www.tcepi.tc.br/legislacao/jurisprudencia/decisoes/ (200), "Consulta de Jurisprudência Selecionada", "Pesquisa Unificada", "Pesquisa de Processos" (https://www.tcepi.tc.br/fiscalizado/pesquisa-de-processos), atas e pautas de julgamento, boletins e informativos de julgamentos. Formato dos dados: **não confirmado**.
- **Contas:** https://www.tcepi.tc.br/controle-externo/paineis-e-levantamentos/parecer-previo-das-contas-de-governo/ (a página existe; conteúdo útil não extraído, provável painel incorporado) e https://www.tcepi.tc.br/fiscalizado/responsaveis-com-contas-reprovadas-eou-irregulares/. A Resolução TCE-PI 11/2021 rege o processo de contas de governo (prazos de 60 dias para o governador e 90 para prefeitos, segundo busca web; não verificado no texto).
- **Esforço: médio**, sem confirmação. **Recomendação:** sondar no navegador "Parecer das Contas de Governo" e "Pesquisa Unificada" antes de decidir.

## TCE-RN (Rio Grande do Norte)

- **Sites:** https://www.tce.rn.gov.br/ (ASP.NET MVC/IIS), jurisprudência https://jurisprudencia.tce.rn.gov.br/consulta (Angular), dados abertos https://apidadosabertos.tce.rn.gov.br/.
- **robots.txt:** `www.tce.rn.gov.br` 404; `apidadosabertos.tce.rn.gov.br` 404; `jurisprudencia.tce.rn.gov.br` devolve a SPA. Sem regras.
- **Dados abertos:** "Portal dos Dados Abertos TCE/RN", documentação Swagger em `/swagger`, dados brutos do **SIAI** enviados pelas unidades jurisdicionadas (finanças). **Sem decisões.** Painéis em `siaiconsultas.tce.rn.gov.br` (SPA).
- **Consulta de processos:** `https://www.tce.rn.gov.br/ConsultaProcesso/ConsultaAvancada` usa **reCAPTCHA** (`grecaptcha.reset()` no código). **Não automatizar.**
- **Jurisprudência:** SPA Angular (bundle de 4 MB); API de busca não identificada. Boletins de jurisprudência do NJURIS em PDF (ex.: `https://www.tce.rn.gov.br/as/InformativoJurisprudencia/104/TCERN_BOLETIM_01_2025.pdf`).
- **Contas:** `https://www.tce.rn.gov.br/ContasDeGoverno/Versoes` (lista "ContasGoverno2026") e `https://www.tce.rn.gov.br/Transparencia/RelacaoResponsaveisContasIrregulares` (relação de responsáveis com contas irregulares ou parecer pela reprovação). Conteúdo detalhado não extraído. Uma notícia local cita o Acórdão 810/2025-TC (parecer favorável com ressalvas às contas do governador, quatro votos a dois): fonte jornalística, **não oficial**; localizar o acórdão no site do tribunal.
- **Esforço: alto.** **Recomendação:** não automatizar; pedir via SIC a lista de pareceres prévios e acórdãos de contas de governo; usar boletins/PDFs só para conferência.

## TCE-BA (Bahia)

- **Site:** https://www.tce.ba.gov.br/ respondeu 200 com a página **"Estamos em manutenção"** (3,3 KB; contatos para protocolo urgente). Os endereços `tce.ba.gov.br`, `portal.tce.ba.gov.br` e `www.tcebahia.tc.br` não responderam (HTTP 000).
- **robots.txt:** 404.
- **Dados abertos, acórdãos e parecer prévio do governador:** **não confirmado** (sem acesso ao site). Fonte secundária: a Assembleia Legislativa da Bahia hospeda documentos das contas do governador (ex.: `al.ba.gov.br/fserver/:imagensAlbanet:upload:2023_Aprec_Conta_Gov_Voto_Cons_Joao_Bonfim.pdf`, voto do relator de 2023, segundo busca web; arquivo não aberto). Parecer prévio de **prefeitos não é do TCE-BA**: é do TCM-BA.
- **Esforço: depende de terceiros.** **Recomendação:** repetir a sondagem quando o portal voltar; por ora, buscar o parecer do governador no acervo da ALBA e pedir ao tribunal via LAI.

## TCM-BA (Tribunal de Contas dos Municípios da Bahia)

- **Site:** https://www.tcm.ba.gov.br/ (WordPress).
- **robots.txt:** `User-agent: *` apenas com linhas `Allow` (`/feed/, /trackback/, /wp-admin/, /wp-includes/, /xmlrpc.php, /wp-content/uploads/...`) e Sitemap. Nada proibido. `e.tcm.ba.gov.br/robots.txt`: 404.
- **Dados abertos:** portal oficial **não encontrado**. Um projeto de terceiros (`DadosAbertosDeFeira/tcm-ba`) coleta por scraping "Documentos da consulta pública" e "Processos"; não verificado.
- **Prefeitos (contas):**
  - https://www.tcm.ba.gov.br/quadro-geral-de-prestacao-de-contas-por-municipio redireciona para `https://www.tcm.ba.gov.br/resumo/index.html` (HTML estático de ~1,9 MB, 1.175 linhas): **matriz município x entidade (Prefeitura, Câmara, descentralizada) x exercício, 2011 a 2025**. A decisão é indicada pela **cor da célula** (legenda: Aprovada, Aprovada com ressalvas, Rejeitada, Outra decisão, Não julgada) e cada célula é um link JavaScript `j('P','2024','00001',' ')`. O mapeamento cor -> decisão deve ser conferido na legenda antes do uso; o detalhe por célula exige JavaScript (endpoint não confirmado).
  - https://www.tcm.ba.gov.br/consulta/legislacao/decisoes/contas-anuais/ (WordPress): formulário (processo, pesquisa por município ou gestor, exercício de 1990 a 2025, entidade, município, decisão, multa, ressarcimento, sub judice, trânsito em julgado). O HTML cita "Script para reCaptcha do Google" (ativo ou comentado: **não confirmado**; POST não testado).
  - https://e.tcm.ba.gov.br/epp/ConsultaPublica/listView.seam ("e-TCM: Consulta Pública", JSF/Seam, 200; filtros de periodicidade, ano 2015 a 2026 e município; sem CAPTCHA no HTML). Mesmo caminho `/epp/` do e-TCE de Pernambuco.
  - https://www.tcm.ba.gov.br/consulta/jurisprudencia/consulta-ementario-juridico/ (HTML de 2 MB com 1.345 links de PDF: ementário jurídico; não analisado em detalhe).
- **Pareceres individuais:** PDFs ligados ao ementário e à consulta processual (`/consulta-processual`); se têm texto ou são imagem: **não confirmado**.
- **Esforço: médio.** **Recomendação:** começar pelo quadro geral (uma página HTML, decisão por município e exercício) para o painel de prefeitos; depois a consulta pública e-TCM (parser JSF) para número do parecer, relator e data; só então os PDFs.

---

## Riscos e bloqueios (síntese)

- Nenhum dos hosts testados proíbe, no `robots.txt` para `User-agent: *`, os caminhos usados aqui. Restrições a respeitar: TCE-CE bloqueia `/components/` entre outros; TCE-SE bloqueia `/_layouts/`; TCE-PB bloqueia `/wp-admin/`; TCE-PI bloqueia `/wp-content/uploads/wp-import-export-lite/`, `/xmlrpc/` etc.
- APIs de front-end (TCE-PB, TCE-CE Contexto, TCE-AL, TCE-RN) não são dados abertos declarados: antes de usar em rotina, pedir liberação formal ou confirmar os termos de uso. Única API aberta e documentada com decisões: **TCE-PE**. TCE-CE, TCE-RN e TCE-PB têm APIs ou ZIPs abertos, mas de finanças.
- reCAPTCHA confirmado: TCE-RN (consulta de processos). Possível: TCM-BA (formulário de contas anuais). Credencial: TCE-MA (Bearer). Fora do ar: TCE-BA.

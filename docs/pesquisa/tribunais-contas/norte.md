# Tribunais de contas da região Norte: avaliação técnica das fontes oficiais

Data dos testes: 2026-11-04. Pesquisa somente leitura. User-Agent usado: `BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)`, com pausa de pelo menos 1 s entre requisições.
Nada foi deduzido. Quando um item não foi verificado, está escrito "não confirmado". Nenhum CAPTCHA, desafio anti-bot, login ou token foi contornado: onde apareceu, só foi registrado.
Tribunais: TCE-AC, TCE-AM, TCE-AP, TCE-PA, TCE-RO, TCE-RR, TCE-TO e TCM-PA. Modelo de referência: `docs/pesquisa/fontes-tcu-tce.md`.

## Tabela resumo

| Tribunal | Dados abertos | Acórdãos/decisões | Contas do governador / prefeito | Bloqueios | Esforço |
|---|---|---|---|---|---|
| TCE-AC | Sem portal de dados abertos localizado. Banco de jurisprudência é uma SPA cuja API (`/api/v1/ejuris/*`) responde 401 "Token nao fornecido" | Só pelo banco de jurisprudência (SPA, API com token). Informativos e súmulas em PDF no site WordPress | Governador: só notícias da Comunicação (WordPress, `wp-json` aberto); exercício 2022 julgado em 09/10/2025. Prefeitos: não confirmado | API exige token; robots.txt inexistente (404) | Acórdãos: depende de terceiros (LAI). Governador: médio |
| TCE-AM | Sem portal formal, mas a API JSON do banco de jurisprudência (`jurisprudencia-api.tce.am.gov.br`) é aberta, sem credencial | Sim: JSON com texto integral do acórdão, relator, órgão julgador, data da sessão, link do PDF | Sim: "Parecer Prévio" do Governador (ex.: nº 96/2022, exercício 2021) e das prefeituras (ex.: nº 59/2024), com texto integral | Nenhum encontrado. Sem robots.txt (404 na API; o do portal devolve HTML). API não documentada oficialmente | **Baixo** |
| TCE-AP | Não localizado | Busca em `busca.tce.ap.gov.br` (SPA); backend não identificado | Página "Contas de Governo" no portal (conteúdo carregado por JS); arquivos em `app.tce.ap.gov.br/storage` | `app.tce.ap.gov.br` tem robots `Disallow: /` (inclui os PDFs). Portal e busca dependem de JS | Depende de terceiros (LAI) |
| TCE-PA | Não localizado | Consulta de jurisprudência em `/modules/...` e `/components/...`, ambos `Disallow` no robots.txt | Governador: página por exercício (2005 a 2025) com PDFs de texto (relatório, voto, resolução do parecer prévio). Prefeitos: competência do TCM-PA | Robots proíbe `/modules/`, `/components/`, `/files/`, `/images/`, `/pesquisaintegrada/` | Governador: **médio** (baixo se só a resolução). Acórdãos: depende de terceiros |
| TCE-RO | Sem portal de dados abertos. e-Papyrus (pesquisa de julgados): API `gw.tcero.tc.br` responde 401 "Unauthorized" | e-Papyrus (SPA, API com token); SPJ (WordPress) tem informativos e posts | Governador: página "Pareceres prévios" do SPJ (conteúdo não confirmado). Prefeituras: posts "Simplifica TCERO" com parecer prévio resumido | API exige token; `wp-json` do site principal responde 401 | Acórdãos: depende de terceiros. Contas: médio a alto |
| TCE-RR | API JSON aberta de deliberações em `transparencia.tcerr.tc.br/api/sessoes/deliberacao` (SPA Vue do próprio portal), sem credencial | Sim: 9.112 deliberações (Acórdão, Decisão, Parecer Prévio, Resolução, Súmula etc.) com número, data de publicação, colegiado e link do documento no SEI (HTML). Relator e ementa só dentro do HTML | Sim: série "Parecer Prévio" (471 itens, Pleno e Câmaras). Quem é o ente de cada parecer: só no HTML | Sem robots.txt (404). Sem CAPTCHA no que foi testado | **Médio** |
| TCE-TO | Sem portal de dados abertos localizado | Portal de Jurisprudência (Laravel Livewire, JS e CSRF obrigatórios; robots.txt permite tudo) | Página "Contas do Governador" sem conteúdo útil no HTML; só notícias sobre a entrega das contas. Parecer prévio: não confirmado | Livewire exige sessão, token CSRF e JS. `/sistemas_scp2/` proibido no robots | Médio a alto (a confirmar) |
| TCM-PA | Não localizado | Consulta pública (SPE) tem reCAPTCHA; atos oficiais ficam no `atosoficiais.com.br` (desafio Cloudflare) | Prefeituras: notícias do site (WordPress, `wp-json` aberto) descrevem cada parecer prévio, com relator e sessão. Texto oficial do parecer: não confirmado | reCAPTCHA no SPE; Cloudflare "Just a moment" no `atosoficiais.com.br`; robots do site proíbe ClaudeBot e anthropic-ai | Notícias: médio. Acórdãos/pareceres oficiais: depende de terceiros (LAI) |

## Observações gerais

- **Dois tribunais com API JSON aberta**: TCE-AM (a melhor, com texto integral) e TCE-RR (metadados abertos, documentos em HTML do SEI).
- **Plataformas compartilhadas**: nenhuma plataforma de jurisprudência é comum a dois destes tribunais. Em comum só o WordPress dos sites institucionais (AC, AM, RO, TO, TCM-PA) e o SEI (TCE-RR usa o SEI! para diário e documentos). O TCE-AC e o TCE-RO usam SPAs próprias com API autenticada por token.
- **Fora do modelo "Pará"**: no Pará o TCE-PA fiscaliza o Estado e o TCM-PA os municípios; as contas do governador vêm do TCE-PA e as das prefeituras do TCM-PA.
- Não há, em nenhum dos oito, um conjunto equivalente aos CSV anuais do TCU.

## Avisos sobre esta pesquisa (transparência)

1. Uma consulta ao TCE-AM (`/decisorios?strBusca=...`, sem filtros de ano) baixou cerca de 56 MB de uma vez, contra o combinado de sondagens pequenas. Foi uma única requisição; depois só foram feitas consultas filtradas e cortadas (`head -c`).
2. Uma requisição a `https://www.tcepa.tc.br/pesquisaintegrada/` foi feita antes de conferir o `Disallow: /pesquisaintegrada/` do robots.txt do TCE-PA. Devolveu redirecionamento (302) para uma página `noindex`; nada foi usado. Não repetir.
3. O código-fonte público (JavaScript) dos sites foi lido para descobrir os endereços das APIs usadas pelas próprias páginas. Nenhuma chamada exigiu burlar proteção.

---

## TCE-AC: Tribunal de Contas do Estado do Acre

**Plataforma:** WordPress no site (`tceac.tc.br/site/`); banco de jurisprudência em SPA React (Vite) com API FastAPI em `/api`; diário eletrônico em JSF/PrimeFaces; transparência em `externo.tceac.tc.br`. Não é a mesma plataforma de outro tribunal desta lista.

### Endereços testados em 2026-11-04

| Endereço | Resultado |
|---|---|
| `https://tceac.tc.br/robots.txt` e `https://www.tceac.tc.br/robots.txt` | 404 (sem regras) |
| `https://tceac.tc.br/site/` | 200, links para jurisprudência, transparência e diário |
| `http://jurisprudencia.tceac.tc.br/` | 200, redireciona para HTTPS; SPA "Jurisprudência TCE-AC" |
| `https://jurisprudencia.tceac.tc.br/api/v1/ejuris/julgamentos/overview` e `/sessoes` | **401** `{"detail":"Token nao fornecido"}` |
| `https://jurisprudencia.tceac.tc.br/api/` e `/api/v1/acordao/jurisprudencia/...` | 404 (rotas públicas não identificadas) |
| `https://tceac.tc.br/site/wp-json/wp/v2/search?search=...` e `/posts?search=...` | 200 JSON (notícias) |
| `https://tceac.tc.br/site/inicio/jurisprudencia/` | 200, "Informativo de Jurisprudência": lista de PDFs de processos em `wp-content/uploads/2026/06/Proc.-NNN.NNN.pdf` |
| `http://sistemas.tceac.tc.br/diario/` | 200 (JSF); robots.txt 404 |

### O que dá para obter

- **Acórdãos/decisões:** o banco de jurisprudência é o caminho oficial, mas a API vista no código do front exige token (rotas `/v1/ejuris/*`). Endpoint público de busca: **não confirmado**. O site traz súmulas e informativo (PDF com texto, nomes como `Proc.-142.364.pdf`, com relator no rótulo do link).
- **Parecer prévio do Governador:** só notícias. Exemplo real (WordPress, `wp-json`): "TCE-AC aprova, com ressalvas, as contas do governador ... exercício de 2022", sessão plenária de 09/10/2025, processo 144.523/2023, relator conselheiro Antonio Jorge Malheiro, decisão unânime segundo a notícia. O texto do parecer em PDF: não confirmado.
- **Contas de prefeitos:** não confirmado.
- **Formato:** JSON (notícias), HTML, PDF com texto (informativo; não foi extraído texto nesta pesquisa).

### Bloqueios

API do banco de jurisprudência exige token (401). Não há CAPTCHA registrado. Sem robots.txt.

### Esforço e recomendação

- Acórdãos: **depende de terceiros** (pedido LAI ao TCE-AC pedindo extração/lista ou liberação de API pública).
- Governador: **médio**, coletando as notícias da Comunicação por `wp-json` (posts de "contas do governador") e, a partir delas, o PDF do parecer, a confirmar.
- Recomendação: não priorizar. Incluir só o julgamento anual das contas do governador, com a notícia oficial como fonte.

---

## TCE-AM: Tribunal de Contas do Estado do Amazonas

**Plataforma:** portal WordPress (`www.tceam.tc.br`); banco de jurisprudência em Vue (`jurisprudencia.tce.am.gov.br`) sobre uma API Spring Boot (`jurisprudencia-api.tce.am.gov.br`); PDFs em `jurisprudencia-fs.tce.am.gov.br`. Sessões públicas em `dec.tceam.tc.br/consulta-sessao-publica` (não testado).

### Endereços testados em 2026-11-04

| Endereço | Resultado |
|---|---|
| `https://www.tceam.tc.br/robots.txt` | devolve a página inicial em HTML (sem robots válido) |
| `https://jurisprudencia.tce.am.gov.br/robots.txt` e `https://jurisprudencia-api.tce.am.gov.br/robots.txt` | 404 |
| `https://jurisprudencia.tce.am.gov.br/` | 200, SPA Vue; rota `/decisoriosByProcesso` |
| `GET https://jurisprudencia-api.tce.am.gov.br/processo/relatores` | 200 JSON (lista de relatores) |
| `GET .../processo/naturezas` | 200 JSON (natureza dos processos, ex.: "Prestação de Contas Anual") |
| `GET .../decisorios?strBusca=...` | 200 JSON, **sem filtro devolveu ~56 MB** (resposta truncada); não usar |
| `GET .../decisorios/byManyFields?strConteudo=...&strAnoProcesso=...` (demais parâmetros `null`) | 200 JSON, filtrável; usado com corte de 100 a 150 KB |

Parâmetros de `byManyFields` (lidos do front): `strConteudo, strAnoProcesso, strNumeroProcesso, strAnoDecisorio, strNumeroDecisorio, strRelatorDecisorio, strOrgaoJulgador, strDataSessaoInicio, strDataSessaoFim, strNatureza`. Datas de sessão no formato `AAAAMMDD`.

### O que dá para obter

- **Campos de cada decisão (JSON):** `anoProcesso, numeroProcesso, anoDecisorio, numeroDecisorio, conteudo` (texto integral do acórdão/parecer, em texto simples, sem acentos), `nomeDoArquivo, caminhoArquivo` (PDF em `jurisprudencia-fs.tce.am.gov.br/documents/...`), `dataArquivo` (mal formatada, ex.: "23-05-02025"), `tipoDecisorio` ("Acórdão", "Parecer Prévio"), `relator`, `relatorVotoDecisao`, `orgaoJulgador` ("Tribunal Pleno"), `dataSessao` (ex.: "20221206"), `natureza`, `orgao`, `objeto`, `interessados`, `partes`, `especie`, `deliberacoes` (ex.: "Aplicar Multa,Arquivar"). Em alguns registros esses campos vêm vazios (`""`); o número e o ementa podem então ser lidos do `conteudo`.
- **Acórdãos:** sim (número, data da sessão, relator, ementa dentro do texto, link do PDF).
- **Parecer prévio do Governador:** sim. Exemplos reais: "Parecer Prévio nº 96/2022 – TCE – Tribunal Pleno", órgão "Governo do Estado do Amazonas", exercício 2021 (sessão 06/12/2022); também 40/2019 (exercício 2018) e 40/2017 (exercício 2015).
- **Contas das prefeituras:** sim. Exemplo: Parecer Prévio nº 59/2024, "Prefeitura Municipal de Novo Airão", exercício 2020, relator conselheiro Luis Fabian Pereira Barbosa, recomendando aprovação com ressalvas (texto do `conteudo`).
- **Formato:** JSON UTF-8 com texto integral; PDF com texto.
- Amostra da consulta sem filtro mostrou processos de 1996 a 2026 (2026 com 35 registros), mas a cobertura completa não foi medida.

### Bloqueios

Nenhum encontrado (sem CAPTCHA, sem login, sem JS obrigatório para a API). Cuidado operacional: consulta sem filtro devolve dezenas de MB; sempre filtrar por ano/natureza e paginar por ano. A API não é documentada oficialmente (descoberta no código do front); pode mudar sem aviso.

### Esforço e recomendação

**Baixo (≤1 dia).** Coletar por ano (`strAnoProcesso`) com filtro de natureza "Prestação de Contas Anual" e `tipoDecisorio` "Parecer Prévio", uma consulta por ano, com pausa. Guardar metadados e o link do PDF; extrair do `conteudo` a ementa, o resultado ("recomendando a aprovação com ressalvas") e o relator. Melhor candidato da região para começar. Antes de produção, confirmar com o TCE-AM (LAI ou e-mail) que o uso da API é aceito.

---

## TCE-AP: Tribunal de Contas do Estado do Amapá

**Plataforma:** portal em Next.js (`www.tce.ap.gov.br`) com backend Laravel (`app.tce.ap.gov.br`, pelo caminho `App.Models.Jurisdicionado.ContaGoverno` nos arquivos), busca em `busca.tce.ap.gov.br` (Next.js, rota com `#`), arquivos em `arquivos.tce.ap.gov.br`.

### Endereços testados em 2026-11-04

| Endereço | Resultado |
|---|---|
| `https://www.tce.ap.gov.br/robots.txt` | 404 (página de erro do Next.js) |
| `https://app.tce.ap.gov.br/robots.txt` | 200: `User-agent: *` `Disallow: /` `Noindex: /` `Nofollow: /` |
| `https://busca.tce.ap.gov.br/robots.txt`, `https://arquivos.tce.ap.gov.br/robots.txt` | 404 |
| `https://www.tce.ap.gov.br/contas-de-governo` | 200, mas o corpo não tem o conteúdo (renderizado no navegador) |
| `https://www.tce.ap.gov.br/jurisprudencia` | 404 |
| `https://busca.tce.ap.gov.br/busca` | 200, SPA; a consulta é feita por um serviço de backend não identificado (o front cita `https://arquivos.tce.ap.gov.br:3000/`, não testado) |

### O que dá para obter

- **Acórdãos/decisões:** não confirmado. Não foi achado endpoint público de dados.
- **Parecer prévio do Governador:** o portal tem a página "Contas de Governo"; os arquivos ficam em `app.tce.ap.gov.br/storage/geral/...ContaGoverno...`, host cujo robots.txt proíbe tudo para qualquer robô. Conteúdo: não confirmado.
- **Contas de prefeitos:** não confirmado.

### Bloqueios

`Disallow: /` em `app.tce.ap.gov.br` (onde ficam os PDFs e provavelmente a API do portal). Páginas dependem de JavaScript. Respeitado: nada foi baixado desse host.

### Esforço e recomendação

**Depende de terceiros (LAI).** Pedir ao TCE-AP a lista de pareceres prévios do Governador (com link) e a lista de acórdãos, ou a liberação de acesso por robô. Sem isso, só curadoria manual, aceitável para as contas do Governador (um documento por ano).

---

## TCE-PA: Tribunal de Contas do Estado do Pará

**Plataforma:** Joomla (`www.tcepa.tc.br`), com módulos PHP próprios; sistemas em `sistemas.tcepa.tc.br` e `/portalservicos`. Não é a plataforma de outro tribunal desta lista.

### Regras de acesso (robots.txt de `www.tcepa.tc.br`, 2026-11-04)

```
User-agent: *
Disallow: /administrator/  /cache/  /cli/  /components/  /files/  /images/
Disallow: /includes/  /installation/  /language/  /libraries/  /logs/
Disallow: /media/  /modules/  /plugins/  /templates/  /tmp/  /pesquisaintegrada/
User-agent: SemrushBot-SA
Disallow: /
```

### Endereços testados em 2026-11-04

| Endereço | Resultado |
|---|---|
| `https://www.tcepa.tc.br/comunicacao/noticias/5825-prestacao-de-contas-anual` | 200, lista "Contas de Governo 2005 a 2025" |
| `https://www.tcepa.tc.br/contasdegoverno/2024/` | 200, HTML com 7 PDFs; caminho **permitido** pelo robots |
| `.../contasdegoverno/2024/7_resolucao_aprova_parecer_previo.pdf` | 200 `application/pdf`, 658 KB, **PDF com texto** (pdftotext extraiu) |
| `https://www.tcepa.tc.br/consulta-normas-e-jurisprudencias` | 200, mas a consulta é um iframe para `/modules/mod_consultas/consulta_normas_jurisprudencia.php` (**caminho proibido**) |
| `/components/com_pesquisa_ACRP_2023/resultado_acrp_externo.php` | caminho **proibido** (`/components/`); não acessado |
| `/images/contasirregulares/RelacaoContaIrregular.pdf` | caminho **proibido** (`/images/`); não acessado |
| `/portalservicos/processo/processoexpediente-consultar`, `sistemas.tcepa.tc.br` | não testados a fundo (sistemas fora do robots do portal; sem robots.txt próprio localizado) |

### O que dá para obter

- **Parecer prévio do Governador (permitido):** cada exercício tem página com PDFs numerados: `1_relatorio_analise_contas_governador_2024_web.pdf`, `2_versao_resumida_relatorio.pdf`, `3_parecer_mpc.pdf`, `4_relatorio_relator.pdf`, `5_manifestacao_representante_governo.pdf`, `6_voto_relator.pdf`, `7_resolucao_aprova_parecer_previo.pdf`. Exemplo real, exercício 2024: **Resolução nº 19.731** (Processo TC/008927/2025), "Parecer Prévio favorável à Aprovação das Contas do Governador do Estado, referentes ao exercício de 2024, com a formulação de recomendações ao Poder Executivo". Data da sessão e votação por conselheiro: não extraídas nesta pesquisa (provavelmente no PDF do voto; não confirmado).
- **Acórdãos/decisões:** o buscador oficial está em caminhos proibidos pelo robots. Os "Boletins de Jurisprudência" (`/jurisdicionado/boletins-de-jurisprudencia`) existem; conteúdo não avaliado.
- **Contas de prefeitos:** competência do TCM-PA (ver abaixo).
- **Formato:** HTML (índice) e PDF com texto.

### Bloqueios

Robots proíbe a consulta de jurisprudência e a pesquisa integrada. Sem CAPTCHA observado nas páginas de contas de governo.

### Esforço e recomendação

- Contas do Governador: **médio** (2 a 3 dias): ler a página do exercício, baixar a resolução (e talvez o voto), extrair número, processo, data e texto da conclusão. Poucos documentos por ano; é viável até só com curadoria.
- Acórdãos: **depende de terceiros (LAI)**, pois o caminho público está vedado a robôs.
- Recomendação: incluir as contas do Governador (padrão semelhante ao TCE-SP "Contas Anuais").

---

## TCE-RO: Tribunal de Contas do Estado de Rondônia

**Plataforma:** site WordPress (`tcero.tc.br`); SPJ (Secretaria de Processamento e Julgamento) em WordPress (`spj.tcero.tc.br`); e-Papyrus em SPA Vue (`epapyrus.tcero.tc.br`) sobre API Kong em `gw.tcero.tc.br/epapyrus-api`; processo eletrônico PCe (JSF, `pce.tce.ro.gov.br/tramita`); transparência em ASP.NET (`transparencia.tce.ro.gov.br`).

### Endereços testados em 2026-11-04

| Endereço | Resultado |
|---|---|
| `https://tcero.tc.br/robots.txt` | `Disallow: /wp-admin/` (permite `admin-ajax.php`); sitemap `wp-sitemap.xml` |
| `https://spj.tcero.tc.br/robots.txt` | `User-agent: *` `Disallow:` (vazio: tudo permitido) |
| `https://epapyrus.tcero.tc.br/robots.txt`, `https://transparencia.tce.ro.gov.br/robots.txt` | devolvem HTML (sem robots válido) |
| `https://spj.tcero.tc.br/jurisprudencia/` | 200, menu: acórdãos e pareceres, informativo, pareceres prévios (contas de governo), súmulas, acervo digitalizado 1985–2016 |
| `https://spj.tcero.tc.br/category/simplifica-tce/contas-de-governo/` | 200, posts "Simplifica TCERO: O que você precisa saber sobre as contas de Ji-Paraná em 2024" etc. (citam "Parecer Prévio PPL-TC 00008/26", processo 01217/25) |
| `https://epapyrus.tcero.tc.br/` | 200, SPA; o código chama `https://gw.tcero.tc.br/epapyrus-api/api/v1/search`, `/search/getById`, `/search/rapporteurs`, `/search/suggestions` |
| `GET https://gw.tcero.tc.br/epapyrus-api/api/v1/search/rapporteurs` | **401** `{"message":"Unauthorized"}` |
| `https://tcero.tc.br/wp-json/wp/v2/posts?search=...` | **401** |
| `https://spj.tcero.tc.br/wp-json/` | 302 (não seguiu para JSON) |

### O que dá para obter

- **Acórdãos/decisões:** pela API do e-Papyrus, mas ela exige token; não foi obtido nem se procurou obter. O SPJ publica páginas por "acórdãos e pareceres (por data)": endereço não confirmado nesta pesquisa.
- **Parecer prévio do Governador:** o SPJ tem "Pareceres prévios (Contas de Governo)" (rota `/jurisprudencia/pareceres-previos-por-assunto/`, que é uma lista por assunto, não por exercício). Lista por exercício: não confirmada.
- **Contas das prefeituras:** os posts "Simplifica TCERO" resumem o parecer prévio por município (número do parecer e do processo no resumo). Texto integral: não confirmado.
- **Formato:** HTML (WordPress) e PDF; JSON só com token.

### Bloqueios

API do e-Papyrus com token (401). `wp-json` do site principal 401.

### Esforço e recomendação

**Depende de terceiros (LAI)** para acórdãos em massa. Para as contas: **médio a alto**, lendo os posts do SPJ (HTML, robots permite) e confirmando cada um no PDF oficial. Recomendação: pedir ao TCE-RO acesso à API do e-Papyrus ou um recorte (parecer prévio do Governador e das prefeituras por exercício). Adiar.

---

## TCE-RR: Tribunal de Contas do Estado de Roraima

**Plataforma:** portal PHP próprio (`www.tcerr.tc.br`); transparência em SPA Vue com API Spring (`transparencia.tcerr.tc.br`); documentos no SEI (`sei.tcerr.tc.br`, Apache/Debian); RoraiContas em JSF (`roraicontas.tcerr.tc.br`); licitações em `sagreslicitacoes.tcerr.tc.br`. O SEI é o mesmo sistema de processo eletrônico usado por muitos órgãos públicos; entre estes oito, só o TCE-RR o expõe assim.

### Endereços testados em 2026-11-04

| Endereço | Resultado |
|---|---|
| `https://www.tcerr.tc.br/robots.txt` | 404 (sem regras) |
| `https://transparencia.tcerr.tc.br/robots.txt` | 404 (JSON de erro); `https://sei.tcerr.tc.br/robots.txt` 404 |
| `https://transparencia.tcerr.tc.br/` | 200, SPA Vue; rotas `/sessoes/decisoes-e-acordaos`, `/sessoes/jurisprudencia`, `/sessoes/jurisprudencia/processos-julgados` |
| `POST /api/sessoes/deliberacao?paginar=true&page=0&size=2` corpo `{}` | **200 JSON**; sem credencial |
| `POST /api/sessoes/deliberacao?paginar=true&page=0&size=3` corpo `{"serieId":496,"colegiados":[],"conteudoFilter":""}` | 200, filtra "Parecer Prévio": 471 itens |
| `POST /api/processos-julgados-transparencia/consultar?paginar=true&page=0&size=2` corpo com `exercicio:"2024"` | 200 JSON; **102 KB para 2 itens** (lista de documentos junto) |
| link `.../sei/controlador_externo.php?acao=md_tcerr_dp_gerar_hash&id_orgao_acesso_externo=0&cv=1293748&crc=660C5CF1` | 200 `text/html` ISO-8859-1, 387 KB, texto do Parecer Prévio; sem CAPTCHA |

### O que dá para obter

- **Deliberações (JSON):** campos `ano, anoDeliberacao, nomeSerie, numeroDocumento` (ex.: "001/2026-TCERR-PLENO"), `dataPublicacao`, `descricaoColegiado` (Pleno, 1ª Câmara, 2ª Câmara), `idProcedimento, cv, crc, link` (o `link` vem com prefixo "null"; o endereço correto usa `https://sei.tcerr.tc.br`), `conteudoDocumento` (nulo nos testes). Total na amostra: 9.112 deliberações, exercícios de 1997 a 2026. Séries: Acórdão, Decisão, Decisão Cautelar, Decisão Normativa, Decisão Preliminar, Instrução Normativa, Nota Recomendatória, Nota Técnica, **Parecer Prévio**, Publicação, Resolução, Súmula.
- **Relator, ementa e resultado:** não vêm no JSON; só no HTML do SEI. O campo `ano` é o do exercício e `dataPublicacao` a da publicação (ex.: Parecer Prévio 001/2026-TCERR-1ª CÂMARA, publicado em 21/09/2026, ano 2019).
- **Parecer prévio do Governador e das prefeituras:** estão na série "Parecer Prévio" (Pleno e Câmaras); qual parecer é do Governador e quais são de prefeituras: **não confirmado** (depende de ler o HTML).
- **Processos julgados:** `processos-julgados-transparencia/consultar` traz tipo de processo, unidade jurisdicionada, responsável (nome) e documentos publicados (parecer técnico, relatório, voto, decisão). Tem nomes de pessoas: tratar com a regra de privacidade do projeto.

### Bloqueios

Nenhum no que foi testado. A API é a que o próprio portal usa; não documentada como dados abertos.

### Esforço e recomendação

**Médio (2–4 dias):** paginar `deliberacao` por série e exercício (Acórdão e Parecer Prévio), gravar metadados e link; baixar o HTML do SEI só dos pareceres prévios e extrair relator, ente, exercício, conclusão. Sem confirmar com o tribunal, manter ritmo baixo (poucas páginas por dia, incremental pelo `id`). Segundo melhor candidato.

---

## TCE-TO: Tribunal de Contas do Estado do Tocantins

**Plataforma:** WordPress (`www.tceto.tc.br`); Portal de Jurisprudência em Laravel Livewire (`jurisprudencia.tceto.tc.br`); e-Contas (`www.tce.to.gov.br/e-contas`); pautas em `www.tce.to.gov.br/PAUTA_APREC`.

### Endereços testados em 2026-11-04

| Endereço | Resultado |
|---|---|
| `https://www.tceto.tc.br/robots.txt` | `User-agent: *` `Disallow: /sistemas_scp2/` |
| `https://jurisprudencia.tceto.tc.br/robots.txt` | `User-agent: *` `Disallow:` (tudo permitido) |
| `https://jurisprudencia.tceto.tc.br/` | 200, 373 KB; tela de pesquisa montada por Livewire (token CSRF e `wire:snapshot` no HTML); rotas `/pesquisa-decisoes`, `/jurisprudencia-temas`, `/sumulas`, `/informativos`, `/consultas`; há `api/combo-tesauro?query=` (só tesauro; não testado) |
| `https://www.tceto.tc.br/sessoes/contas-do-governador/` | 200, sem conteúdo útil no HTML (só menus) |
| `https://www.tceto.tc.br/wp-json/wp/v2/posts?search=...` | 200 JSON (notícias: entrega das contas consolidadas do Governador de 2023 e 2025) |

### O que dá para obter

- **Acórdãos/decisões:** o portal informa que a "Pesquisa de Decisões" cobre todas as resoluções, acórdãos e pareceres prévios; por relator o filtro mostra centenas por conselheiro (ex.: 550 da conselheira Doris de Miranda Coutinho, 470 do conselheiro André Luiz de Matos Gonçalves) na seleção inicial (jurisprudência selecionada). Resultado por consulta só via Livewire.
- **Parecer prévio do Governador e contas de prefeitos:** não confirmado (a página oficial não mostrou a lista).
- **Formato:** HTML dinâmico; PDF (decisões) possível, não confirmado.

### Bloqueios

JavaScript e sessão obrigatórios (Livewire); sem CAPTCHA visto. Robots permite tudo no portal de jurisprudência.

### Esforço e recomendação

**Médio a alto (a confirmar).** Automatizar Livewire é frágil (token por sessão, atualizações de snapshot) e foi deixado sem tentativa. Recomendação: pedir ao TCE-TO (LAI) uma carga de decisões do tipo parecer prévio e acórdãos das contas anuais, ou confirmar com o tribunal se há exportação.

---

## TCM-PA: Tribunal de Contas dos Municípios do Estado do Pará

**Plataforma:** WordPress (`www.tcmpa.tc.br`, também `www.tcm.pa.gov.br`); processo eletrônico SPE em JSF/Seam (`spe.tcm.pa.gov.br/etcm`); atos oficiais em plataforma de terceiros (`atosoficiais.com.br/tcmpa`).

### Regras de acesso (robots.txt de `www.tcmpa.tc.br`, 2026-11-04)

```
User-agent: *
Content-Signal: search=yes,ai-train=no,use=reference
Allow: /
User-agent: ClaudeBot / anthropic-ai / Claude-Web / GPTBot / Google-Extended / CCBot / Bytespider ...
Disallow: /
```

O robots do outro domínio (`www.tcm.pa.gov.br`) só bloqueia `/wp-admin/`. O coletor se identifica como `BrasilNaLupa-coletor` (cai em `User-agent: *`, permitido), mas o `Content-Signal ai-train=no` e o bloqueio nominal de robôs de IA pedem que o orquestrador decida se o uso é compatível (reproduzir informações oficiais com fonte é uso de referência, não treinamento; decisão do projeto).

### Endereços testados em 2026-11-04

| Endereço | Resultado |
|---|---|
| `https://www.tcmpa.tc.br/consulta-de-processos/` | 200; leva ao SPE |
| `https://spe.tcm.pa.gov.br/etcm/ConsultaPublica/listView.seam` | 200, formulário (processo, município, exercício) com **reCAPTCHA** (`sitekey` no HTML). Não prosseguido |
| `https://spe.tcm.pa.gov.br/robots.txt` | 404 |
| `https://www.tcmpa.tc.br/sessoes-de-julgamento/` | 200; os links de atos vão para `https://atosoficiais.com.br/tcmpa?...` |
| `https://atosoficiais.com.br/robots.txt` | **403** com página "Just a moment..." (desafio Cloudflare). Não contornado |
| `https://www.tcmpa.tc.br/wp-json/wp/v2/search?search=parecer prévio contas prefeito` | 200 JSON (notícias) |
| post `.../demonstrando-celeridade-tcmpa-da-parecer-favoravel-a-aprovacao-com-ressalvas-das-contas-de-2024-da-prefeitura-de-maraba/` (via `wp-json/wp/v2/posts?slug=`) | 200 JSON com texto |

### O que dá para obter

- **Pareceres prévios sobre contas de prefeitos (notícias):** o site publica uma matéria por parecer. Exemplo real (post de 24/10/2025): parecer prévio recomendando à Câmara de Marabá aprovar com ressalvas a prestação de contas de 2024 do prefeito Sebastião Miranda Filho, voto da conselheira Mara Lúcia, duas multas somando R$ 1.440,39, 53ª Sessão Ordinária do Pleno de 23/10/2025, presidida por Lúcio Vale. Outros exemplos listados pela busca: Belém (contas de 2023, parecer contrário mantido), Mojuí dos Campos (2024, reprovação), Tailândia (2024), Brejo Grande do Araguaia (2023), Tomé-Açu (2024).
- **Texto oficial (resolução/parecer) e acórdãos:** estão no SPE (reCAPTCHA) e/ou no `atosoficiais.com.br` (desafio Cloudflare). Não obtidos.
- **Formato:** JSON com HTML (notícias); processos e atos: não confirmados.

### Bloqueios

reCAPTCHA no SPE; desafio Cloudflare no `atosoficiais.com.br`.

### Esforço e recomendação

- Notícias com pareceres prévios: **médio** (2–4 dias): consultar `wp-json` por termos ("parecer prévio") e extrair município, exercício, resultado, relator e sessão do texto, sempre citando a notícia como fonte e marcando que não é o documento oficial.
- Documentos oficiais e acórdãos: **depende de terceiros (LAI)** ao TCM-PA, pedindo a lista de pareceres prévios por município e exercício (com data da sessão e link do documento).

---

## Ordem sugerida de coleta

1. **TCE-AM** (baixo): API JSON aberta com texto integral; cobre Governador e prefeituras.
2. **TCE-RR** (médio): API JSON de deliberações + HTML do SEI.
3. **TCE-PA, contas do Governador** (médio): PDFs de texto em caminho permitido.
4. **TCM-PA, via notícias** (médio) com ressalva de licença, e pedido LAI para os documentos oficiais.
5. TCE-AC, TCE-AP, TCE-RO e TCE-TO: pedido LAI antes de qualquer coletor (tokens, robots `Disallow: /` ou Livewire).

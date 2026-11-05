# Fontes oficiais dos tribunais de contas do Sudeste: TCE-ES, TCE-MG, TCE-RJ, TCM-SP e TCM-RJ

Data dos testes: 04/11/2026 (2026-11-04). Pesquisa somente de leitura: poucas requisições, no mínimo 1 s entre elas, User-Agent `BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)`, robots.txt lido antes. Nenhum CAPTCHA foi contornado. Quando algo não foi confirmado, está escrito "não confirmado". Nomes de pessoas só aparecem quando são agentes públicos em função oficial (relatores, conselheiros, governador).

## Tabela resumo

| Tribunal | Dados abertos | Acórdãos / decisões | Contas do governador / prefeito da capital | Bloqueios | Esforço |
|---|---|---|---|---|---|
| TCE-ES | Só dados da gestão do próprio tribunal (CKAN "Dados ES", `dados.es.gov.br`). Controle externo no "Painel de Controle" (SPA, API não confirmada) | Jurisprudência e consulta processual: não confirmadas (503 por limite de requisições) | Governador: página HTML com PDFs (parecer prévio, voto do relator, parecer do MP de Contas); exercício 2024 confirmado | WordPress com Wordfence: 503 após ~15 requisições em poucos minutos ("Exceeded the maximum number of requests per minute for crawlers") | Médio (contas do governador); acórdãos não avaliáveis |
| TCE-MG | Portal `dadosabertos.tce.mg.gov.br` (SPA Angular); a API por trás responde 401 e o front referencia captcha | TC Juris (`tcjuris.tce.mg.gov.br`, ASP.NET MVC) e MAPJURIS: busca HTML sem robots.txt; resposta da busca não testada | Governador: só relator/revisor de 2024 em notícia (via busca web); parecer final e página oficial não localizados | API de dados abertos exige credencial/captcha; portal só com JavaScript | Depende de terceiros (LAI) para dados estruturados; médio para TC Juris (não confirmado) |
| TCE-RJ | **Sim**: API REST aberta `dados.tcerj.tc.br/api/v1` (JSON ou CSV, ODbL), sem chave | Portal de jurisprudência é SPA Angular com APIs internas não documentadas; não testadas | **Sim, na API**: `prestacao_contas_estado` (governador, 2020-2025, FAVORÁVEL/CONTRÁRIO + processo) e `prestacao_contas_municipio` (91 municípios, 2019-2025; a capital não está) | Portais de consulta exigem JavaScript; a API não tem bloqueio | Baixo (contas); alto (acórdãos) |
| TCM-SP | Não encontrado | `portal.tcm.sp.gov.br/Acordao/Index` (formulário HTML); PDFs com texto em `jubileu.tcm.sp.gov.br`; endpoint da busca não identificado | Prefeito: parecer de 2024 favorável por unanimidade (só via notícia/busca web, não conferido em fonte oficial); PDF oficial não localizado | `Disallow: /api/` e `/gestor/`; portal novo (`/juris`) é SPA | Médio |
| TCM-RJ | Não encontrado (transparência em Power BI) | e-TCM (`etcm.tcmrio.tc.br`): busca de decisões e download de inteiro teor **proibidos pelo robots.txt**; ClaudeBot proibido por nome no site | Prefeito: parecer prévio 2024 em notícia HTML estática oficial, lida (relator, unanimidade, alertas) | robots.txt (ver seção); captcha BotDetect referenciado | Médio (notícia do parecer); decisões dependem de terceiros (LAI) |

Domínios antigos redirecionam: `www.tce.es.gov.br` para `www.tcees.tc.br`, `www.tce.rj.gov.br` para `www.tcerj.tc.br`, `www.tcm.rj.gov.br` para `www.tcmrio.tc.br`. O `www.tcemg.tc.br` não respondeu; o oficial é `www.tce.mg.gov.br`.

---

## TCE-ES — Tribunal de Contas do Estado do Espírito Santo

### Site e robots.txt
- Site: https://www.tcees.tc.br/ (WordPress).
- `https://www.tcees.tc.br/robots.txt` (04/11/2026), `User-agent: *`: `Disallow: /feed/`, `/trackback/`, `/wp-admin/`, `/wp-content/`, `/wp-includes/`, `/xmlrpc.php`, `/admportal/`, `/intranet/`; `Allow: /wp-content/uploads/`, `/wp-content/plugins/`, `/`. Os PDFs ficam em `/wp-content/uploads/` e estão liberados.

### Dados abertos
- Página: https://www.tcees.tc.br/portal-da-transparencia/dados-abertos/ (revisada pela fonte em 30/10/2026). Diz que os dados abertos de **controle externo** estão no "Painel de Controle" (https://paineldecontrole.tcees.tc.br/dadosAbertos/): SPA que só carrega com JavaScript, sem robots.txt (404). A API desse painel **não foi confirmada**.
- O que a página lista em formato aberto é a gestão do próprio TCE-ES (acordos, despesas, pessoal, licitações, listas de responsáveis com contas irregulares/inabilitados etc.), publicada na plataforma CKAN "Dados ES" (https://dados.es.gov.br/, com API CKAN). Exemplo: `https://dados.es.gov.br/dataset/lista-de-responsaveis-consultas-tcees`. Arquivos e licença não testados.

### O que dá para obter
- (a) Acórdãos/decisões: há "Jurisprudência" (https://www.tcees.tc.br/jurisprudencia/: súmulas, prejulgados, pareceres em consulta, boletim) e "Consulta Processual" (https://www.tcees.tc.br/consultas/processo/). A consulta processual devolveu 503 antes de ser examinada: formato e mecanismo **não confirmados**.
- (b) **Contas do Governador**: https://www.tcees.tc.br/consultas/contas-do-governador/?anoExercicio=2024 (HTML com PDFs). Exercício 2024, confirmado: Processo TC 04006/2025-7, relator Conselheiro Rodrigo Coelho do Carmo, responsável José Renato Casagrande; links "Parecer do MPEC", "Voto do Relator" e "Parecer Prévio". O PDF `https://www.tcees.tc.br/wp-content/uploads/formidable/145/Parecer-Previo-62_2025-1125_0006220258.pdf` (5,2 MB, assinado digitalmente em 08-09/07/2025) tem a capa "Parecer Prévio 00062/2025-8 - Plenário" em texto extraível. A conclusão (aprovação ou rejeição) não foi lida nesta sondagem: **não confirmada**. Só o exercício 2024 apareceu no seletor.
- (c) Contas dos prefeitos: não pesquisado.

### Bloqueios
- **Wordfence**: depois de cerca de 15 requisições em poucos minutos (todas com intervalo de 1,5 s ou mais), o site devolveu HTTP 503 ("Seu acesso a este site foi limitado... Motivo do bloqueio: Exceeded the maximum number of requests per minute for crawlers"). Voltou a ocorrer na consulta processual. Não foi contornado. Um coletor precisa de espaçamento bem maior (10 s ou mais, a confirmar) e poucas páginas por rodada.
- Painel de Controle: exige JavaScript.

### Plataforma
WordPress + Wordfence; CKAN estadual para dados abertos; sistemas próprios de processo.

### Esforço e recomendação
- Contas do governador: **médio** (HTML + PDF com texto; um exercício novo por ano).
- Acórdãos: não avaliável; se a consulta processual não for automatizável, pedir via LAI (https://atendimento.tcees.tc.br/ ou atendimento@tcees.tc.br).
- Recomendação: coletar uma vez por ano a página de contas do governador (1 página, 4-5 PDFs, intervalos longos); não montar coletor de acórdãos antes de testar a consulta processual manualmente.

---

## TCE-MG — Tribunal de Contas do Estado de Minas Gerais

### Site e robots.txt
- Site: https://www.tce.mg.gov.br/ (ISO-8859-1).
- `https://www.tce.mg.gov.br/robots.txt`: `User-Agent: *` / `Allow: /` (sem restrições).
- `tcjuris.tce.mg.gov.br` e `mapjuris.tce.mg.gov.br`: `/robots.txt` devolve página de erro (sem regras declaradas). `dadosabertos.tce.mg.gov.br/robots.txt`: não localizado.

### Dados abertos
- Portal: https://dadosabertos.tce.mg.gov.br/ (SPA Angular; o HTML traz só o carregador).
- No bundle `main.*.js` do front, a configuração aponta para a API `https://arabiasaudita.tce.mg.gov.br:8443/TCEMG-proxy-web/publico/apimoci/dados-abertos/` e para `.../login/captcha.jsf` (`recaptchaPublicUrl`). Um único GET na raiz dessa API devolveu **HTTP 401**. Conclusão: a API exige token, possivelmente obtido por captcha. **Nada foi feito para obter token.**
- Licença e catálogo: não confirmados.

### O que dá para obter
- (a) Decisões: **TC Juris** (https://tcjuris.tce.mg.gov.br/, versão 3.0, ASP.NET MVC; formulário `POST /Home/Busca`) e **MAPJURIS** (https://mapjuris.tce.mg.gov.br/TextualDadosProcesso). Notas taquigráficas aparecem em `https://tcnotas.tce.mg.gov.br/TCJuris/Nota/BuscarArquivo/{id}` (achado por busca web). Campos (número, data, relator, ementa, inteiro teor): **não confirmados**, a busca não foi executada.
- (b) **Contas do Governador**: notícia https://www.tce.mg.gov.br/noticia/Detalhe/1111626929 (achada por busca web, não lida por mim) informa relator Conselheiro Agostinho Patrus e revisor Conselheiro Cláudio Terrão para as contas de 2024, escolhidos em 13/12/2023. O parecer prévio final e uma página oficial de "Contas do Governador" **não foram localizados** (URLs tentadas deram 404).
- (c) Contas dos prefeitos: pareceres municipais aparecem em PDFs hospedados pelas prefeituras e em `tcnotas.tce.mg.gov.br`; caminho oficial sistemático **não confirmado**.

### Bloqueios
API de dados abertos: 401 e referência a captcha (registrado, não contornado). Portal de dados abertos exige JavaScript. TC Juris é renderizado no servidor.

### Plataforma
Sistemas próprios (TC Juris, MAPJURIS, TCNotas); não é a mesma plataforma de outro tribunal desta lista.

### Esforço e recomendação
- **Depende de terceiros (LAI)** para dados estruturados; **médio** se o TC Juris aceitar busca simples por HTML (não confirmado).
- Recomendação: teste manual de uma pessoa no TC Juris ("Prestação de Contas do Governador") para ver parâmetros e termos de uso; para dados abertos, pedir credencial e formato pelo SIC. Não montar coletor ainda.

---

## TCE-RJ — Tribunal de Contas do Estado do Rio de Janeiro

### Site e robots.txt
- Site: https://www.tcerj.tc.br/portalnovo/ (SPA Angular).
- `https://www.tcerj.tc.br/robots.txt` e `https://dados.tcerj.tc.br/robots.txt` (este com resposta Tomcat 404): no site principal, `User-agent: *` / `Disallow:` (vazio, nada proibido).

### Dados abertos (melhor fonte do conjunto)
- Portal: https://dados.tcerj.tc.br/api ; documentação interativa https://dados.tcerj.tc.br/api/v1/docs ; esquema https://dados.tcerj.tc.br/api/v1/openapi.json (lido: 41 rotas).
- Formato: JSON em `https://dados.tcerj.tc.br/api/v1/<endpoint>`; CSV com `?csv=true`. **Sem chave nem login.** Licença declarada: Open Database License (ODbL). Aviso da fonte: os dados são "conforme cadastrados pelo jurisdicionado", com completude e consistência de responsabilidade da unidade que cadastrou.
- Endpoints relevantes: `prestacao_contas_estado`, `prestacao_contas_municipio`, `penalidades_ressarcimento_estado`, `penalidades_ressarcimento_municipio` (processo, ano da condenação, valor, número da condenação, ente, órgão, data da sessão), além de licitações, contratos, despesas, saúde, educação, pessoal etc.

### O que dá para obter
- (b) **Contas do Governador** (`GET /api/v1/prestacao_contas_estado`, 6 registros; campos `Ente, Ano, Indicador, Processo, Responsavel`). Resposta real em 04/11/2026:

| Exercício | Indicador (parecer) | Processo | Responsável |
|---|---|---|---|
| 2020 | CONTRÁRIO | 101104-0/2021 | Cláudio Bomfim de Castro e Silva |
| 2021 | FAVORÁVEL | 101402-2/2022 | idem |
| 2022 | FAVORÁVEL | 104095-8/2023 | idem |
| 2023 | FAVORÁVEL | 103074-9/2024 | idem |
| 2024 | FAVORÁVEL | 103291-1/2025 | idem |
| 2025 | CONTRÁRIO | 103320-0/2026 | idem |

  A API **não traz** relator, data da sessão, ressalvas nem link do inteiro teor. O significado de "Indicador" (parecer prévio emitido) é inferido do nome do endpoint: **não confirmado em documentação**. O campo "Responsável" repete o mesmo nome em todos os exercícios; conferir com o mandato real antes de publicar.
- (c) **Contas dos prefeitos** (`GET /api/v1/prestacao_contas_municipio`, 637 registros: 91 municípios x exercícios 2019-2025; campos `Municipio, Regiao, Ano, Indicador, Processo, Responsavel`). A capital **não está** (o município do Rio de Janeiro é fiscalizado pelo TCM-RJ).
- (a) Acórdãos/decisões: o "Portal de Normas e Publicações" (https://www.tcerj.tc.br/cadastro-publicacoes/public/portal-jurisprudencia) é SPA Angular. O bundle do front referencia APIs internas (`https://www.tcerj.tc.br/cadastro-publicacoes-webapi/api/`, `.../atos-plenario-webapi-externo/api/`, `.../liana-processo-webapi/`) e a consulta `http://www.tcerj.tc.br/consulta-processo/Processo/List`. Não são documentadas como públicas e **não foram testadas** (a raiz devolveu 404). Número, relator, ementa e inteiro teor: **não confirmados**.

### Bloqueios
Nenhum na API de dados abertos. Portais de consulta exigem JavaScript.

### Plataforma
API própria com documentação OpenAPI (Swagger), mantida pela equipe de BI & Analytics/CDS/STI; portais Angular. Não é a mesma plataforma de outro tribunal da lista.

### Esforço e recomendação
- Contas do governador e dos municípios (indicador + processo): **baixo** (≤ 1 dia; JSON aberto).
- Acórdãos: **alto/indefinido** até haver API pública de jurisprudência confirmada (pedir pelo SIC ou testar manualmente).
- Recomendação: **coletar já** `prestacao_contas_estado` (e `prestacao_contas_municipio` se o site cobrir o RJ); relator e data vêm de outra fonte oficial (notícias do tribunal), rotulada à parte.

---

## TCM-SP — Tribunal de Contas do Município de São Paulo

### Site e robots.txt
- Site novo: https://portal.tcm.sp.gov.br/ (React/Next.js, SPA); legado ASP.NET MVC no mesmo host (`/Acordao/Index`, `/ConsultaProcesso`, `/Publicacoes/Index/...`, `/Pagina/...`).
- `https://portal.tcm.sp.gov.br/robots.txt`: `User-Agent: *`, `Allow: /`, `Disallow: /gestor/`, `Disallow: /api/`; `Sitemap: https://portal.tcm.sp.gov.br/sitemap.xml` (lido: poucas páginas, inclui `/juris`, `/pauta`, `/ata`, `/relatorios-de-fiscalizacao`).
- `https://jubileu.tcm.sp.gov.br/robots.txt`: 404 (sem regras declaradas).

### Dados abertos
Portal de dados abertos de controle externo: **não encontrado** (sem link na home nem no sitemap). Existência: não confirmada.

### O que dá para obter
- (a) Julgados: https://portal.tcm.sp.gov.br/Acordao/Index ("Julgados - Pesquisa Jurisprudência"). Formulário HTML com campos `NumeroTC`, `AnosList`, `TdsPlvrs`, `ExprExt`, `QqurPlvrs`, `NnhmPlvrs`, `Interessado`, `SiglaOrgaosList`, `RelatoresList`, `TiposProcessosList`, páginas de 20 itens. Sem captcha visível. O endpoint que devolve os resultados (carregados por JavaScript) **não foi identificado**; a busca não foi executada.
- PDFs: `https://jubileu.tcm.sp.gov.br/Management/AcordaoItem/Documento/{código}`. Exemplo testado (`TC0033492025`, 563 KB, 20 páginas): **PDF com texto**, contém relatório e voto do relator, ementa, "PAR-UTR-2/2026", "3.412ª Sessão Extraordinária" e "Votação unânime". Esse exemplo é o parecer das contas do **próprio TCM-SP** (TC/003349/2025, exercício 2024), não da Prefeitura; confirma o formato.
- (b) **Contas do Prefeito de São Paulo**: resultados de busca web apontam notícia da Prefeitura de que o TCM-SP emitiu parecer prévio **favorável por unanimidade** às contas de 2024, relator Conselheiro Ricardo Torres (vice-presidente), e que a Câmara Municipal as aprovou em 22/10/2025 (38 votos a favor, 4 contra, segundo imprensa). **Não conferido em fonte oficial do TCM-SP nem da Câmara.** PDF oficial do parecer da capital não localizado.
- (c) Demais prefeitos: não se aplica (o TCM-SP só fiscaliza a capital).

### Bloqueios
`/api/` proibido pelo robots.txt (não usar a API interna do portal novo). `/juris` depende de JavaScript. Nenhum CAPTCHA visto nas páginas lidas.

### Plataforma
ASP.NET MVC (legado) + Next.js (novo) + repositório de documentos "jubileu". Semelhança de nome com o "e-TCM" do TCM-RJ, mas que seja a mesma plataforma é **não confirmado**.

### Esforço e recomendação
- **Médio** (2-4 dias), condicionado a a busca de julgados responder a requisições simples (a confirmar por teste manual).
- Recomendação: uma pessoa valida no navegador a busca pelo processo da Prefeitura (sem CAPTCHA nem login) e identifica o endpoint; só então montar coletor HTML + PDF. Enquanto isso, o parecer da capital entra como link para a página oficial quando localizada.

---

## TCM-RJ — Tribunal de Contas do Município do Rio de Janeiro

### Site e robots.txt
- Site: https://www.tcmrio.tc.br/ (ASP.NET Web Forms, ISO-8859-1; a home redireciona para `/WEB/Site/Destaques.aspx`).
- `https://www.tcmrio.tc.br/robots.txt`: `User-agent: ClaudeBot` / `Disallow: /` (e vários outros robôs); `User-agent: *` só bloqueia `/ScriptResource.axd` e `/WebResource.axd`. O coletor se identifica como `BrasilNaLupa-coletor`, mas o tribunal declarou que não quer o ClaudeBot: não usar UA com "Claude" e decidir com o orquestrador.
- `https://etcm.tcmrio.tc.br/robots.txt` (processos e jurisprudência), `User-agent: *`: `Disallow: /tcmjuris/Enunciados/SumulasPorEnunciado`, `/tcmjuris/Search/RetornaDecisoes`, `/tcmjuris/Search/RetornaProximasDecisoes`, `/Processo/ArquivoPublico`, `/BotDetectCaptcha.ashx`, `/InteiroTeor/Download`. Ou seja, **a busca de decisões e o download do inteiro teor são proibidos para robôs**.
- `etcm.tcm.rj.gov.br` (domínio antigo) redireciona para `etcm.tcmrio.tc.br`.

### Dados abertos
Portal de dados abertos: **não encontrado** (o painel de transparência usa Power BI, link na página de destaques; não avaliado).

### O que dá para obter
- (a) Decisões: consulta de processos em https://etcm.tcmrio.tc.br/processo?TipoConsulta=... (formulário `POST /processo/Lista` com Interessado, Objeto, Órgão, Assunto). Tipos vistos: `ContasdeGestao`, `PorNumero`, `ProcessosEmPauta`. A pesquisa `/tcmjuris/Search/RetornaDecisoes` e `/InteiroTeor/Download` são **proibidas**. Nenhuma busca foi executada.
- (b) **Contas do Prefeito do Rio**: notícia oficial estática https://www.tcmrio.tc.br/WEB/Site/Noticia_Detalhe.aspx?noticia=17993&detalhada=2&downloads=0 (lida). Conteúdo: o Plenário votou, por unanimidade, Parecer Prévio favorável à aprovação das contas de governo da Prefeitura do exercício 2024, com ressalvas (3 Alertas, 15 Determinações, 7 Recomendações), com base no relatório e voto do Conselheiro-relator Ivan Moreira dos Santos. Citados como presentes: Luiz Antonio Guaranã (presidente), Felipe Puccioni, David Carlos Pereira Neto, Bruno Maia de Carvalho, Thiago Kwiatkowski Ribeiro e os conselheiros-substitutos Igor Fernandes, Emil Ibrahim e Dicler Forestieri Ferreira. A notícia traz o texto dos alertas, determinações e recomendações, declarações de voto (Puccioni e Bruno Maia), divergência de David Pereira Neto sobre a redação da Determinação 3 (acatada pelo relator) e a observação de que o parecer só deixa de prevalecer por 2/3 da Câmara Municipal. Data: o texto lido diz "quarta-feira (16/07)"; o ano não aparece no trecho lido (resultado de busca web indica 2025): **ano não confirmado literalmente**. O PDF/inteiro teor do parecer não foi localizado.
- (c) Demais prefeitos: não se aplica (os outros 91 municípios estão no TCE-RJ).

### Bloqueios
robots.txt acima; `BotDetectCaptcha.ashx` indica CAPTCHA BotDetect em algum fluxo do e-TCM (não acionado, não contornado). As notícias são HTML estático, sem JavaScript obrigatório.

### Plataforma
ASP.NET Web Forms (site) + ASP.NET MVC (e-TCM, módulo "tcmjuris"). Ver nota do TCM-SP sobre o nome "e-TCM".

### Esforço e recomendação
- Parecer do prefeito: **médio** (notícia HTML por exercício; extração de texto).
- Decisões individuais: **depende de terceiros (LAI)** ou consulta manual, por causa do robots.txt.
- Recomendação: coletar só a notícia/página oficial do parecer prévio da capital (uma por ano); para acórdãos, apenas link para a consulta pública, sem robô.

---

## Endereços testados (2026-11-04)

- TCE-ES: `robots.txt`; `/portal-da-transparencia/dados-abertos/`; `/consultas/contas-do-governador/?anoExercicio=2024`; PDF do parecer prévio 62/2025; `/consultas/processo/` (503); `paineldecontrole.tcees.tc.br/dadosAbertos/`.
- TCE-MG: `www.tce.mg.gov.br/robots.txt`; `dadosabertos.tce.mg.gov.br` (e API `arabiasaudita.tce.mg.gov.br:8443`, 401); `tcjuris.tce.mg.gov.br`.
- TCE-RJ: `dados.tcerj.tc.br/api/v1/openapi.json`; `/api/v1/prestacao_contas_estado`; `/api/v1/prestacao_contas_municipio`; `/api/v1/penalidades_ressarcimento_municipio`; `www.tcerj.tc.br/cadastro-publicacoes/public/portal-jurisprudencia`.
- TCM-SP: `portal.tcm.sp.gov.br/robots.txt`, `/sitemap.xml`, `/Acordao/Index`; PDF em `jubileu.tcm.sp.gov.br`.
- TCM-RJ: `www.tcmrio.tc.br/robots.txt`, `/WEB/Site/Destaques.aspx`, notícia 17993; `etcm.tcmrio.tc.br/robots.txt` e `/processo?TipoConsulta=ContasdeGestao`.

Pendências para confirmar por pessoa em navegador: busca no TC Juris (MG); consulta processual e jurisprudência do TCE-ES; busca de julgados do TCM-SP; PDF oficial do parecer prévio da capital no TCM-SP e no TCM-RJ.

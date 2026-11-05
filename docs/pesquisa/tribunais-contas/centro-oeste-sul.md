# Tribunais de contas do Centro-Oeste e do Sul: avaliação técnica das fontes oficiais

Data dos testes: 2026-11-04. Todas as chamadas foram feitas de verdade nesta data, com `curl` e `User-Agent: BrasilNaLupa-coletor/1.0 (+https://www.brasilnalupa.com.br)`, pelo menos 1,5 s entre requisições ao mesmo host. Pesquisa somente de leitura: nenhum dado foi gravado no repositório. Quando algo não pôde ser confirmado, está escrito "não confirmado". Nada foi deduzido.

Escopo: TC-DF, TCE-GO, TCE-MT, TCE-MS, TCE-PR, TCE-RS, TCE-SC e TCM-GO. Modelo de comparação: `docs/pesquisa/fontes-tcu-tce.md` (TCU e TCE-SP).

## Resumo

| Tribunal | Dados abertos | Acórdãos/decisões | Contas do governador / prefeito | Bloqueios | Esforço |
|---|---|---|---|---|---|
| **TC-DF** | API JSON pública do portal de busca (`api-busca-publica.tc.df.gov.br`), sem chave, sem documentação; robots do host libera tudo | **Sim**: número, sessão, relator, ementa, decisão, votação ("por maioria"), vínculo com o processo | Governador (DF): página WordPress por exercício com relator e PDF do "Relatório Analítico e Parecer Prévio" (RAPP); conteúdo do PDF não verificado | nenhum nos hosts testados | **Baixo** (acórdãos); médio (parecer em PDF) |
| **TCE-GO** | Sem portal de dados abertos localizado; "barramento de dados" aponta para `bo.tce.go.gov.br` (não testado) | Consulta de decisões em SPA (`decisoes.tce.go.gov.br`) cujo robots proíbe `/api/` | Governador: pastas por exercício (1995–2025) no portal Liferay, com relator; arquivos não listados na resposta estática | API da SPA vedada pelo robots; `www.tce.go.gov.br` sem robots | **Depende de terceiros (LAI)** para decisões; médio para contas do governador |
| **TCE-MT** | Não localizado; robots do site libera tudo (`Disallow:` vazio) | Documentos PDF abertos em `www.tce.mt.gov.br/processo/documento/{id}/{ano}/...`; ferramenta de consulta não localizada | Governador: página `/contas/governo` existe no sitemap mas entrega desafio anti-bot em JavaScript | **Anti-bot (Akamai) com JavaScript obrigatório** nas páginas; não contornado | **Alto / depende de terceiros** |
| **TCE-MS** | Portal de transparência (SPA Angular) sem seção de dados abertos confirmada | "Portal de Jurisprudência" (SPA) sobre repositório Alfresco com token; API interna não documentada | Governador: não confirmado. Existe rota "pareceres-previos" no portal de jurisprudência (escopo não confirmado) | JavaScript obrigatório; API exige token (`GetToken`); robots inexistente (devolve a SPA) | **Depende de terceiros (LAI)** ou alto |
| **TCE-PR** | **Sim**: CSV anuais de acórdãos (1998–2026) em `viajuris.tce.pr.gov.br`; regras de uso livres | **Sim**: tipo de ato, número, ano, classe, colegiado, entidade, interessados, sessão, **relator**, **resumo (ementa)**, termos, **URL do PDF** | Prefeitos: **sim** (atos "Parecer Prévio" e "Acórdão de Parecer Prévio", classe "Prestação de contas do prefeito municipal"). Governador: não encontrado na base (não confirmado onde está) | nenhum para os CSV; link "BaseDados" devolve 403 só a HEAD | **Baixo** |
| **TCE-RS** | **Sim**: CKAN `dados.tce.rs.gov.br` com CSV/JSON/XML de decisões por ano e lista de contas irregulares/pareceres desfavoráveis | **Parcial**: data, órgão julgador, nº do processo, tipo, jurisdicionado, magistrado (gabinete), texto da decisão e vídeo da sessão; **sem ementa, sem link do inteiro teor** | Governador: PDFs de parecer prévio 1995–2024 em `tcers.tc.br/repo/parecer_previo/`. Prefeitos: sim, no texto da decisão de "Contas Anuais" ("Parecer Favorável com Ressalva(s)") | robots do CKAN: `Crawl-Delay: 10` e `Disallow: /api/`; lista de irregulares traz CPF | **Baixo** (decisões); médio (PDFs de parecer) |
| **TCE-SC** | Existe página "APIs de dados abertos" (confirmada só por busca), mas todo o domínio devolve 403 | Não acessível | Governador: página "Contas do Estado" existe (via busca); não acessível | **403 "Access Denied" (Akamai)** em todos os hosts `tcesc.tc.br` testados | **Depende de terceiros** (autorização/LAI) |
| **TCM-GO** | Não confirmado | Páginas "Decisões" e "Súmulas" existem (via busca); não acessadas | Prefeitos: o TCM emite Parecer Prévio nas contas de governo (via busca); não acessado | **robots.txt com `Disallow: /`** para `*` | **Depende de terceiros** (autorização/LAI) |

## Observações gerais

- **Melhores candidatos**: TCE-PR (CSV anual completo com relator, ementa e link do PDF), TC-DF (API JSON com ementa, relator e votação) e TCE-RS (CKAN com CSV/JSON; faltam ementa e inteiro teor, mas traz o parecer sobre cada prefeitura).
- **Plataformas compartilhadas**: nenhuma entre os oito. Cada um tem sistema próprio (PR: ASP.NET "Viajuris"/"PIT"; RS: CKAN + WordPress; DF: WordPress + busca em Elasticsearch "forseti"; GO: Liferay + SPA; MS: Angular + Alfresco; MT e SC: bloqueio Akamai, o que é comum aos dois mas não é um sistema de dados).
- **Ressalva de método**: a lista de contas irregulares do TCE-RS traz nome e CPF completo; não foi copiada. Não publicar sem decisão editorial (ver `docs/pesquisa/fontes-tcu-tce.md`, regra sobre listas de condenados).
- Por tratar-se de tribunais estaduais/distritais, "contas do governador" é parecer prévio para a Assembleia (Câmara Legislativa no DF); o julgamento político é da casa legislativa, fonte separada.

## Desvios de procedimento (transparência sobre a própria pesquisa)

1. **TCE-RS**: antes de ler o robots de `dados.tce.rs.gov.br`, foram feitas 3 chamadas à API CKAN (`/api/3/action/package_list`, `package_search`, `package_show`), que o robots proíbe (`Disallow: /api/`). Depois disso a API não foi mais usada; os arquivos `/dados/decisoes/*.json` (permitidos) foram baixados com intervalo de 10 s. Um coletor deve usar **só** os arquivos de `/dados/` e a página HTML do dataset, nunca `/api/`.
2. **TCM-GO**: 1 requisição (resultado 404) a uma URL de `www.tcmgo.tc.br` foi feita por engano depois de lido o robots que proíbe tudo. Nenhuma outra foi feita.
3. **TCE-RS**: foi baixado 1 PDF de 38 MB (`pp-simplificado-2024.pdf`) para conferir se tem texto; tem. Também foram baixados o CSV de acórdãos do TCE-PR de 2025 (5 MB) e de 2026 (2,4 MB) e o JSON de decisões do TCE-RS de 2026 (1,9 MB).

---

## TC-DF — Tribunal de Contas do Distrito Federal

### Acesso
- Site: `https://www.tc.df.gov.br/` redireciona para `https://www2.tc.df.gov.br/` (WordPress; nginx).
- robots.txt: `www2.tc.df.gov.br/robots.txt` 404; `jurisprudencia.tc.df.gov.br/robots.txt` 404; `unidades.tc.df.gov.br/robots.txt` 404. **`api-busca-publica.tc.df.gov.br/robots.txt` (200, 2026-11-04): `User-agent: *` / `Disallow:` (vazio, libera tudo).**
- A página `jurisprudencia.tc.df.gov.br/` contém a palavra "captcha" e "cloudflare" no HTML; não foi exercitado nenhum formulário, e as chamadas à API abaixo não pediram captcha.

### Dados abertos / API
- Portal de "Dados Abertos" localizado: `https://unidades.tc.df.gov.br/distribuicao-de-processos/dados-abertos/` (transparência da distribuição de processos; API `https://api-sorteio-relator.tc.df.gov.br/`; **não testada**).
- **API usada pelo portal de busca** (`https://busca2.tc.df.gov.br/`, SPA Vue; endereços lidos no JavaScript público do portal): `https://api-busca-publica.tc.df.gov.br/jurisprudencia/?q={termo}&from={n}&maxPerPage={n}` e `/jurisprudencia/tipos`, `/boletim/`, `/publica/`. Sem chave, sem cabeçalho de autenticação. **Não é documentada oficialmente** como API aberta; é a API do próprio site, com robots que libera tudo.
- Teste: `GET .../jurisprudencia/?q=contas%20de%20governo&from=0&maxPerPage=2` devolveu JSON (Elasticsearch: `data.hits.hits[]._source`). Total mostrado: "10000, gte" (limite do contador do Elasticsearch, não o total real).
- Campos observados em `_source` (texto literal dos nomes): `documento_numero_ano` ("1687/2026"), `documento_ano`, `documento_numero`, `sessao_data`, `sessao_numero`, `sessao_tipo` ("ORDINÁRIA"), `processo_numero_completo` ("00600-00010185/2025-59"), `processo_relator`, `processo_sinopse`, `jurisprudencia_tipo_descricao` ("Decisão"), `jurisprudencia_ementa`, `jurisprudencia_ementa_voto`, `jurisprudencia_decisao` ("O Tribunal, por maioria, de acordo com o voto do Relator, decidiu: ..."), `jurisprudencia_votacao` ("Decisão por Maioria"), `jurisprudencia_assunto`, `jurisprudencia_data_publicacao`, `iddocumentoetcdf`, `documento_edoc`. Há ainda `analista` (nome de servidor do tribunal), a ser descartado.
- Documento relacionado em `https://api-etcdf.tc.df.gov.br/publico/documentos/` (endereço visto no JavaScript; **não testado**), provavelmente para o inteiro teor.

### O que dá para obter
- **(a) Acórdãos/decisões**: número/ano, data da sessão, relator, ementa, dispositivo e tipo de votação, em JSON. Inteiro teor: não confirmado (endereço `api-etcdf` não testado).
- **(b) Parecer prévio sobre as contas do Governador (do DF)**: página `https://www2.tc.df.gov.br/controle-externo/contas-de-governo/` (texto: "O TCDF, anualmente, aprecia as Contas apresentadas pelo Governo do Distrito Federal, emitindo Relatório e Parecer ..."). Uma página por exercício; busca no WordPress devolveu: 2024 (relatora Anilcéia Luzia Machado), 2023 (André Clemente Lara de Oliveira), 2022 (Antonio Renato Alves Rainha), 2021 (Márcio Michel Alves de Oliveira), 2020 (Inácio Magalhães Filho), 2019 (Manoel de Andrade), 2018 (Renato Rainha), 2017 (Márcio Michel)... A página de 2024 liga o PDF `https://www2.tc.df.gov.br/wp-content/uploads/2026/02/RAPP-24-Versao-Final-Publicacao.pdf` (6,0 MB, `Content-Type: application/pdf`). **Texto do PDF não verificado** (só os cabeçalhos foram lidos).
- Também há, na API, a decisão de 03/06/2026 (processo 10185/2025) sobre diretrizes do relatório e parecer prévio das contas do Governo (exercício seguinte); é uma decisão processual, não o parecer.
- **(c) Julgamento de contas de prefeitos**: não se aplica (DF não tem municípios).
- Formato: JSON (decisões); HTML (páginas) e PDF (relatório; texto não verificado).

### Endereços testados (2026-11-04)
`www.tc.df.gov.br` (302 → www2), `www2.tc.df.gov.br/wp-json/wp/v2/types` (200), `.../wp-json/wp/v2/pages/2481492` (200), `.../wp-json/wp/v2/search?search=contas+de+governo` (200), `.../controle-externo/contas-de-governo/` (200), `.../contas-de-governo-2024-relatora-anilceia-luzia-machado/` (200), `jurisprudencia.tc.df.gov.br/` (200), `busca2.tc.df.gov.br/` (200), `api-busca-publica.tc.df.gov.br/jurisprudencia/tipos` (200), `.../jurisprudencia/?q=...` (200), `unidades.tc.df.gov.br/distribuicao-de-processos/dados-abertos/` (200). `dados.tc.df.gov.br` e `sistemas.tc.df.gov.br` não respondem.

### Plataforma
WordPress (site e jurisprudência) + busca em Elasticsearch ("forseti") com SPA Vue. Não compartilhada com os demais tribunais deste relatório.

### Esforço e recomendação
**Baixo** para decisões (consumir o JSON paginando com `from` e `maxPerPage`, filtrando por assunto "Contas de governo"); **médio** para o parecer prévio (ler o PDF; a conferência humana do conteúdo é necessária). Por ser API interna não documentada, registrar o risco de mudança e pedir confirmação ao tribunal (e-mail da Ouvidoria/SIC) de que o uso automatizado é aceito. Respeitar intervalo mínimo de 1 s.

---

## TCE-GO — Tribunal de Contas do Estado de Goiás

### Acesso
- Site: `https://www.tce.go.gov.br/` (200); a maior parte do conteúdo reside em `https://portal.tce.go.gov.br/` (Liferay).
- robots.txt: `www.tce.go.gov.br/robots.txt` 404 (não há regras). `portal.tce.go.gov.br/robots.txt`: `User-Agent: *` / `Disallow:` (libera tudo). **`decisoes.tce.go.gov.br/robots.txt`: `User-Agent: *` / `Allow: /` / `Disallow: /api/`.**

### Dados abertos / API
- Portal de dados abertos: **não localizado**. O menu do site liga "Relatórios gerenciais e barramento de dados" (`portal.tce.go.gov.br/relatorios-gerenciais-e-barramento-de-dados` → 302 para `https://bo.tce.go.gov.br/`, não seguido) e "Calendário de prestação de base de dados" (referente a dados enviados pelos jurisdicionados, não aberto ao público).
- Consulta de decisões: `https://decisoes.tce.go.gov.br/` (SPA; HTML estático de 13 KB com "global-loader"). O conteúdo vem de uma API em `/api/`, **proibida pelo robots**. Não foi chamada.

### O que dá para obter
- **(a) Acórdãos**: só pela SPA/API vedada. **Não coletável com respeito ao robots**. Alternativa: pedido formal (LAI/SIC) de base de dados ou autorização.
- **(b) Parecer prévio do Governador**: `https://portal.tce.go.gov.br/contas-do-governador` ("Contas do Governador anteriores") lista pastas (portlet "Gerenciador de download") por exercício com o relator: 2025 – Sebastião Joaquim Pereira Neto Tejota; 2024 – Edson José Ferrari; 2023 – Helder Valin Barbosa; 2022 – Kennedy Trindade; 2021 – Celmar Rech; 2020 – Sebastião Tejota; 2019 – Carla Santillo; 2018 – Saulo Mesquita; 2017 – Tejota; 2016 – Helder Valin; etc., até "anteriores a 2000". Os arquivos dentro de cada pasta não aparecem no HTML estático (carregados por portlet/JavaScript): **conteúdo e formato dos arquivos não confirmados**. Se a pasta "2025" já contém parecer (o parecer costuma sair no ano seguinte), também não confirmado.
- **(c) Contas de prefeitos**: competência do TCM-GO (ver abaixo) para os municípios goianos, não do TCE-GO. Existe `portal.tce.go.gov.br/contas-irregulares` (lista de contas irregulares; não testada; provavelmente traz CPF).

### Endereços testados (2026-11-04)
`www.tce.go.gov.br/` (200), `.../robots.txt` (404), `.../contas-do-governador1` (404 no host `www`), `portal.tce.go.gov.br/contas-do-governador1` (200 → `/contas-do-governador`), `.../contas-do-governador2` (idem), `.../consulta-de-decisoes` (200 → `decisoes.tce.go.gov.br`), `decisoes.tce.go.gov.br/` (200), `decisoes.tce.go.gov.br/robots.txt`, `portal.tce.go.gov.br/robots.txt`.

### Plataforma
Liferay (portal) + SPA própria (decisões). Não compartilhada.

### Esforço e recomendação
**Depende de terceiros (LAI)** para acórdãos. Para o parecer do Governador: **médio**, depois de conferir manualmente, no navegador, o que há dentro das pastas; se forem PDFs estáticos listáveis, tratar como no TCE-SP. Não usar a API de `decisoes.tce.go.gov.br`.

---

## TCE-MT — Tribunal de Contas do Estado de Mato Grosso

### Acesso
- Site: `https://www.tce.mt.gov.br/` (Laravel/Vite; `build/assets/app-*.js`).
- robots.txt (200): `User-agent: *` / `Disallow:` (vazio, libera tudo).
- **Anti-bot**: a página inicial e `/contas/governo` e `/contas-de-governo-copspas` devolveram, ao `curl`, uma página com script ofuscado de verificação de navegador (`<APM_DO_NOT_TOUCH>`, desafio em JavaScript típico de Akamai Bot Manager) em vez do conteúdo. Não é CAPTCHA, mas **exige executar JavaScript**. Não contornado. Algumas rotas inexistentes (`/acordaos`, `/dados-abertos`) devolveram a página 404 normal, e `sitemap.xml` (200) foi servido sem desafio.
- Hosts que não resolveram/responderam: `apidados.tce.mt.gov.br`, `jurisprudencia.tce.mt.gov.br`, `aplicacao.tce.mt.gov.br`, `dadosabertos.tce.mt.gov.br`, `conecta.tce.mt.gov.br`, `transparencia.tce.mt.gov.br`. (Os nomes `apidados` e `conecta` foram testados por suposição; não existem ou não respondem.)

### Dados abertos / API
- Portal de dados abertos ou API: **não localizado**. O sitemap lista `servicos-transparencia`, `mapa-da-transparencia`, `observatorio-de-dados-de-saude`, `boletim-de-jurisprudencia`, `legislacao-e-jurisprudencia`, `contas-de-governo-copspas`, `contas/governo`, `resultado_contas/entidade?tipo=dp`, `julgamento/presencial`, `julgamento/virtual`, `tipos-de-processos`, `servicos.tce.mt.gov.br/consulta-item`, `servicos.tce.mt.gov.br/sessao-virtual/sustentacao-oral`. Nenhum foi aberto com sucesso (desafio anti-bot).

### O que dá para obter
- **Documentos PDF abertos**: o endereço `https://www.tce.mt.gov.br/processo/documento/{id}/{ano}/{...}/{ano}` entrega PDF assinado digitalmente, com texto (verificado em 1 exemplo: relatório e voto das contas anuais de gestão do próprio TCE-MT, exercício 2024, processo 197.616-8/2025, relator Guilherme Antonio Maluf; PDF de 37 páginas, texto extraível). Mas os identificadores não são listáveis sem a ferramenta de consulta.
- **(a) Acórdãos**: não há lista acessível a robô. Não confirmado.
- **(b) Parecer prévio do Governador**: `www.tce.mt.gov.br/contas/governo` (existe no sitemap) está atrás do desafio. Não confirmado.
- **(c) Contas de prefeitos**: `resultado_contas/entidade?tipo=dp` (existe no sitemap; não acessado por causa do desafio).

### Plataforma
Aplicação própria Laravel com proteção Akamai. O desafio é o mesmo tipo de bloqueio do TCE-SC (mesmo fornecedor de proteção, não o mesmo sistema de dados).

### Esforço e recomendação
**Alto / depende de terceiros.** Sem acesso programático permitido. Recomendado: pedido de base de dados via SIC/LAI e, em paralelo, consulta manual, no navegador, de `/contas/governo`. Não tentar burlar o desafio.

---

## TCE-MS — Tribunal de Contas do Estado de Mato Grosso do Sul

### Acesso
- Site: `https://www.tce.ms.gov.br/` (Angular 8 com renderização no servidor; qualquer rota devolve a mesma página-casca de 26 KB, inclusive `robots.txt`, `sitemap.xml`, `/jurisprudencia` e `/contas-governador`). Ou seja, **não existe robots.txt** (a resposta é HTML) e as rotas não confirmam conteúdo.
- Portal de transparência: `https://transparencia.tce.ms.gov.br/` (SPA Angular; `/dados-abertos` devolve só a casca; seção de dados abertos **não confirmada**).
- Portal de jurisprudência: `https://jurisprudencia.tce.ms.gov.br/` (SPA, "Portal de Jurisprudência"). O JavaScript público do portal referencia `https://jurisprudencia-api.tce.ms.gov.br/` e rotas internas `api/Alfresco/GetToken`, `api/Alfresco/Query`, `api/Alfresco/NodesChildren`, `api/Alfresco/NodesContent/`. **Ou seja, o conteúdo está num repositório Alfresco acessado com token.** A API não foi chamada: não há documentação de uso público e exige obter token.

### O que dá para obter
- **(a) Acórdãos**: só pela SPA/API com token. Não coletável de forma legítima sem autorização. Não confirmado se há texto/ementa estruturados.
- **(b) Parecer prévio do Governador**: não confirmado. O portal de jurisprudência tem as rotas `/pareceres` e `/pareceres-previos` (escopo não confirmado: pode ser parecer prévio sobre contas de prefeitos).
- **(c) Contas de prefeitos**: idem, não confirmado.
- Formato: não confirmado (Alfresco costuma servir PDF).

### Endereços testados (2026-11-04)
`www.tce.ms.gov.br` (200: robots.txt, sitemap.xml, /jurisprudencia, /contas-governador, todos a casca da SPA), `transparencia.tce.ms.gov.br/` e `/dados-abertos` (200, casca), `transparencia.tce.ms.gov.br/robots.txt` (casca), `jurisprudencia.tce.ms.gov.br/` (200), `main.*.js` do portal de jurisprudência. Não respondem: `dadosabertos.tce.ms.gov.br`, `api.tce.ms.gov.br`, `sistemas.tce.ms.gov.br`.

### Plataforma
Angular + Alfresco (CMIS). Não compartilhada com os demais deste relatório.

### Esforço e recomendação
**Depende de terceiros (LAI)**, ou **alto** se o tribunal liberar a API. Pedir ao tribunal (SIC `esic.tce.ms.gov.br`) base de dados de acórdãos e parecer prévio das contas do Governador. Não usar o `GetToken`.

---

## TCE-PR — Tribunal de Contas do Estado do Paraná

### Acesso
- Sites: `https://www1.tce.pr.gov.br/` e `https://www.tce.pr.gov.br/` (mesma página, 200); `https://servicos.tce.pr.gov.br/` (ASP.NET).
- robots.txt: `www.tce.pr.gov.br/robots.txt` e `www1...` devolvem página em branco/redirecionam para 404 por JavaScript (sem regras utilizáveis); `servicos.tce.pr.gov.br/robots.txt` 404; `pit.tce.pr.gov.br/robots.txt` devolve página de erro; **`viajuris.tce.pr.gov.br/robots.txt` (200): `User-agent: *` / `Disallow:` (vazio, libera tudo).**
- Bloqueios: nenhum CAPTCHA/login nas páginas e arquivos testados. A área "Área Restrita" do sistema de jurisprudência exige login, mas os dados abertos não.

### Dados abertos / API
- Páginas: `https://viajuris.tce.pr.gov.br/DadosAbertos/DadosAbertos` ("TCE-PR - Consulta de Bases", conjunto "Acórdãos", frequência de atualização "Semanal", espectro "Ano atual", grupo "Jurisprudência") e `https://viajuris.tce.pr.gov.br/DadosAbertos/DadosAbertos/BaseDados` (lista os arquivos anuais).
- **Arquivos**: `https://viajuris.tce.pr.gov.br/DadosAbertos/DadosAbertos/DownloadArquivo?nomeArquivo={ANO}_acordaos_base_de_dados.csv`, de 1998 a 2026. Testado: 2026 (2,4 MB; `Content-Disposition` com o nome do arquivo) e 2025 (5,0 MB). Sem credencial. A página "Base de Dados" mostrou datas de atualização dos arquivos (o de 2026 constava como 05/06/2026; a página do conjunto indicava "Atualizado em: 30/10/2026"); as sessões do CSV de 2026 baixado vão de 01/2026 a 05/2026, portanto **o CSV pode estar defasado em relação ao rótulo da página**: verificar na implementação.
- Dicionário de dados: `.../DownloadArquivo?nomeArquivo=dicionario_de_dados.xlsx` (18 KB, data de atualização 15/08/2023).
- Regras de uso (`https://servicos.tce.pr.gov.br/servicos/arquivos/dadosabertos/dados_abertos_tcepr_regras_de_utilizacao.pdf`): dados públicos, "livre para qualquer finalidade ou atividade, no limite das restrições legais"; sem garantia de qualidade/atualidade.
- Formato: CSV `;`, UTF-8 com BOM, 24 colunas. Cabeçalho literal: `DsTipoAto; NrAto; AnoAto; SgUnidAdm; DsClasseProcessual; DsSubClasseProcessual; NrProcesso; AnoProcesso; DsTitulo; DsResumo; NmCategoriaPublicacao; DsColegiado; DsEntidade; DsInteressado; DsVeiculoPublicacao; NmAdvogados; DtPublicacaoDOE; DtSessao; NrDOE; NmRelator; Termos; ReferenciaLegislativas; DsTema; UrlPDF`.
- Exemplo real (2026, encurtado): `DsTitulo = "Acórdão 27/2026 da Secretaria Primeira Câmara"`, `DsClasseProcessual = "CERTIDÃO LIBERATÓRIA"`, `DsColegiado = "Primeira Câmara"`, `NmRelator = "IVAN LELIS BONILHA"`, `DtSessao = "26/01/2026 12:00:00"`, `UrlPDF = https://viajuris.tce.pr.gov.br/Arquivos/2026/1/000200472.pdf`.
- Sistemas relacionados: `https://pit.tce.pr.gov.br/Processos/ProcessosConsulta/Consulta` (consulta de processos), `.../Dados/DadosConsulta/Consulta` (dados abertos do PIT; **não explorado**), `https://viajuris.tce.pr.gov.br/Pesquisa/PesquisaAcordaos` (pesquisa de acórdãos/pareceres prévios, formulário com filtros de relator, colegiado, classe, entidade, sessão).

### O que dá para obter
- **(a) Acórdãos**: **sim**, número/ano, colegiado, classe, entidade, interessados (nomes de particulares: tratar com cuidado), data da sessão, **relator**, **resumo** (campo `DsResumo`, preenchido em parte dos atos; vazio no exemplo acima), termos e **link do PDF** do inteiro teor. Volume: 1.369 atos em 2026 (até 05/2026) e 3.868 em 2025. Mix em 2026: 1.193 "Acórdão", 174 "Acórdão de Parecer Prévio", 2 "Parecer Prévio".
- **(b) Parecer prévio do Governador**: **não encontrado** na base de acórdãos (busca por "governador" e "Governo do Estado" em 2025 só devolveu acórdãos sobre outros assuntos, como recurso de agravo, consulta e "Prestação de contas anual" da Representação do Governo do Estado em Brasília). Onde o parecer das contas do Governador é publicado: **não confirmado**; procurar em `www1.tce.pr.gov.br` (conteúdo do site, não testado).
- **(c) Prefeitos**: **sim**. Atos de classe "PRESTAÇÃO DE CONTAS DO PREFEITO MUNICIPAL" (174 em 2026), tipo "Parecer Prévio" ou "Acórdão de Parecer Prévio", com entidade (município), relator, data da sessão e `UrlPDF`. Exemplo: "Parecer Prévio 14/2026", MUNICÍPIO DE SIQUEIRA CAMPOS, sessão 26/01/2026, PDF `https://viajuris.tce.pr.gov.br/Arquivos/2026/2/000200509.pdf`. A conclusão (favorável/desfavorável) está só no PDF; não foi lida. Não confirmado o formato do PDF (texto ou digitalizado).

### Endereços testados (2026-11-04)
`www.tce.pr.gov.br/` (200), `www1.tce.pr.gov.br/` (200), `servicos.tce.pr.gov.br/` (200), `viajuris.tce.pr.gov.br/robots.txt` (200), `.../Pesquisa/PesquisaAcordaos` (200), `.../DadosAbertos/DadosAbertos` (200), `.../DadosAbertos/DadosAbertos/BaseDados` (200 por GET; HEAD devolveu 403), `.../DownloadArquivo?nomeArquivo=2026_acordaos_base_de_dados.csv` (200, HEAD e GET), `...2025_...csv` (200), `...dicionario_de_dados.xlsx` (200), `pit.tce.pr.gov.br/Dados/DadosConsulta/Consulta` (200), PDF das regras de uso (200). Não respondem: `dadosabertos.tce.pr.gov.br`.

### Plataforma
ASP.NET MVC ("Sistema de Jurisprudência TCEPR"/"Viajuris" e "PIT"). Não compartilhada.

### Esforço e recomendação
**Baixo.** Coletor semanal: baixar o CSV do ano corrente (e do anterior), comparar por `DsTipoAto`+`NrAto`+`AnoAto`+`DsColegiado` (o número não é único por colegiado: usar o `UrlPDF` como chave estável), gravar metadados e link do PDF, não copiar o PDF. Mapear só "Parecer Prévio" e "Acórdão de Parecer Prévio" para o módulo de contas de prefeitos; conclusão exige ler o PDF (médio, com conferência). Para o Governador, localizar a fonte (pendência).

---

## TCE-RS — Tribunal de Contas do Estado do Rio Grande do Sul

### Acesso
- Site: `https://tcers.tc.br/` (WordPress; Cloudflare). robots.txt (200): `User-agent: *` / `Content-Signal: search=yes,ai-train=no,use=reference` / `Allow: /` e, em outro grupo, `Disallow: /wp-admin/`; bloqueia crawlers de treinamento de IA pelo nome (Amazonbot, Applebot-Extended etc.). **O sinal de conteúdo diz `ai-train=no`**: o uso do projeto é de consulta e referência, não treinamento; manter assim.
- Portal de dados: `https://dados.tce.rs.gov.br/` (CKAN). robots.txt (200): `User-agent: *` / `Disallow: /dataset/rate/` / `Disallow: /revision/` / `Disallow: /dataset/*/history` / **`Disallow: /api/`** / **`Crawl-Delay: 10`**.
- `portal.tce.rs.gov.br/robots.txt`: `User-agent: *` / `Disallow: /aplicprod/`. A pesquisa de jurisprudência (`https://portal.tce.rs.gov.br/app/pesquisa/jurisprudencia/pesquisa`) é uma SPA; API por trás: não identificada. `www1.tce.rs.gov.br` e `pesquisa.tce.rs.gov.br` não responderam.

### Dados abertos
- Catálogo CKAN com **73.440 conjuntos** (a maioria, balancetes e despesas de municípios). Licença: o conjunto de contas irregulares declara "Creative Commons Attribution"; o de decisões 2026 não informa licença (campo vazio).
- **Decisões** (`decisoes-2011` ... `decisoes-2026`): arquivos `https://dados.tce.rs.gov.br/dados/decisoes/{ANO}.csv|.json|.xml` ("Decisões proferidas pelos órgãos julgadores do TCE-RS"). Testado: `2026.json` (1,9 MB; `Last-Modified: 04 Oct 2026`; 2.576 decisões; sessões até 30/09/2026). Sem credencial. Campos do JSON: `ANO_SESSAO, DATA_SESSAO, TIPO_SESSAO, COD_ORGAO_JULGADOR, ORGAO_JULGADOR, NUMERO_SESSAO, NR_PROCESSO, COD_TIPO_PROCESSO, TIPO_PROCESSO, COD_ORGAO, NOME_ORGAO, COD_GABINETE, GABINETE, COD_MAGISTRADO, MAGISTRADO, EXTRA_PAUTA, RETIRADO_PAUTA, SOLICITACAO_VISTA, DECISAO, LINK_VIDEO_SESSAO`. **Não há ementa, número de acórdão nem link do inteiro teor.** `DECISAO` é texto livre com marcas HTML (`<b>`), geralmente nomeando o responsável (pessoa física) e o dispositivo.
- Órgãos julgadores em 2026: Segunda Câmara 802, Primeira Câmara 625, Tribunal Pleno 529, Primeira Câmara Especial 345, Segunda Câmara Especial 234, Tribunal Pleno - Sessão Administrativa 41.
- **Contas julgadas irregulares e pareceres prévios desfavoráveis**: `.../dados/decisoes/contas-irregulares.csv|.json|.xml` (atualização diária, desde 01/01/2008, base na Lei 9.504/1997 art. 11 §5º). Traz nome, **CPF completo**, `LINK_ACORDAO` (aponta para `www1.tce.rs.gov.br/portal/page/portal/tcers/consultas/processos_detalhes?p_processo=...`, host que não respondeu), `NR_PROCESSO`, `DT_TRANSITO_JULGADO`, órgão e exercício. **Nunca gravar o CPF.**
- Página análoga de favoráveis: `https://tcers.tc.br/contas-julgadas-regulares-e-pareceres-previos-favoraveis/` (existe; formato dos dados não confirmado).

### O que dá para obter
- **(a) Acórdãos/decisões**: metadados e dispositivo curto, sem ementa nem link do inteiro teor. Inteiro teor: só via pesquisa de jurisprudência (SPA; não coletável sem API conhecida).
- **(b) Parecer prévio do Governador**: `https://tcers.tc.br/parecer-previo/` lista PDFs por exercício: `https://tcers.tc.br/repo/parecer_previo/pp_1995.pdf` ... `pp_2003.pdf`, `PP2019.pdf`, `PP_2020.pdf`, `pp-simplificado-2023.pdf`, `pp-simplificado-2024.pdf` (último). PDF de 2024 (versão simplificada): 38 MB, **com texto extraível**; a primeira página lista os conselheiros (presidente Marco Antonio Lopes Peixoto etc.). Conclusão e votação do Pleno: não lidas. Parecer de 2025: não consta (ainda não publicado em 2026-11-04).
- **(c) Prefeitos**: sim, em `DECISAO` dos processos de tipo "Contas Anuais" (368 em 2026), por exemplo "Parecer Favorável", "Parecer Favorável com Ressalva(s)", com órgão julgador e magistrado. É o parecer prévio de cada prefeito, por pessoa citada no texto (nome de agente público no cargo; conferir o cargo antes de publicar).
- Formatos: JSON/CSV/XML (decisões), PDF com texto (parecer do Governador).

### Endereços testados (2026-11-04)
`tcers.tc.br/robots.txt`, `tcers.tc.br/`, `tcers.tc.br/parecer-previo/`, `tcers.tc.br/contas-julgadas-regulares-e-pareceres-previos-favoraveis/`, `tcers.tc.br/wp-sitemap.xml`, `tcers.tc.br/repo/parecer_previo/pp-simplificado-2024.pdf`, `dados.tce.rs.gov.br/robots.txt`, `dados.tce.rs.gov.br/dados/decisoes/2026.json` (HEAD, faixa e completo), `.../contas-irregulares.json` (faixa), `.../2026.csv` (não baixado), e as 3 chamadas à `/api/3/action/...` descritas em "Desvios de procedimento".

### Plataforma
CKAN (portal de dados) + WordPress (site) + SPA própria (jurisprudência). Não compartilhada.

### Esforço e recomendação
**Baixo** para as decisões (baixar o JSON do ano; respeitar `Crawl-Delay: 10` e nunca usar `/api/`; descobrir a lista de arquivos pelo HTML da página do dataset). Limite: sem ementa/inteiro teor. **Médio** para o parecer do Governador (PDF por exercício; ler a conclusão e a votação com conferência). Para prefeitos: usar `DECISAO` de "Contas Anuais" e linkar a pesquisa oficial.

---

## TCE-SC — Tribunal de Contas do Estado de Santa Catarina

### Acesso
- Hosts testados: `www.tcesc.tc.br` (`/robots.txt`, `/apis-dados-abertos`), `servicos.tcesc.tc.br` (`/robots.txt`, `/endpoints-portal-transparencia/municipios.php`), `consulta.tce.sc.gov.br/`. **Todos devolveram `HTTP 403` "Access Denied" (Akamai/EdgeSuite)** ao `curl` com o User-Agent do projeto. `sistemas.tcesc.tc.br` não respondeu.
- **Bloqueio anti-bot por reputação/cliente, não é CAPTCHA.** Não foi contornado (nem trocando User-Agent, nem por outro cliente). Sem acesso ao robots.txt, não é possível afirmar quais regras valem.

### O que se sabe (somente por busca web, **não confirmado por acesso direto**)
- Existe a página "apis dados abertos" em `https://www.tcesc.tc.br/apis-dados-abertos`, descrevendo endpoints do Portal da Transparência em `servicos.tcesc.tc.br/endpoints-portal-transparencia/` (exemplo: `municipios.php`). Escopo e licença: não confirmados.
- Existe a página "Contas do Estado" (`https://www.tcesc.tc.br/content/contas-do-estado-0`) que, segundo o resultado de busca, reúne os pareceres prévios do Pleno sobre as contas do Governo desde 1996, com processo, relator e resultado da votação. Notícias oficiais: parecer prévio pela aprovação das contas de 2024 (sessão do Pleno de 04/06/2025, decisão unânime, 2 ressalvas, 16 recomendações) e de 2025 (relator Luiz Roberto Herbst, aprovação com 1 ressalva e 21 recomendações). Estes dados vêm do texto dos resultados de busca; não foram verificados nas páginas.
- Há "Informativo de jurisprudência" mensal em PDF (por exemplo edição 127, fevereiro de 2025) e relatórios das contas em PDF sob `/sites/default/files/...` (por exemplo o relatório do relator das contas de 2021). Não verificados.

### Plataforma
Drupal (aparente pelo caminho `/sites/default/files/`) + Akamai. Sistema de consulta de processos/jurisprudência: não identificado.

### Esforço e recomendação
**Depende de terceiros.** Enviar ao tribunal um pedido (SIC/Ouvidoria) de liberação do coletor identificado ou de base de dados de acórdãos e dos pareceres prévios; enquanto isso, só consulta manual no navegador. Não tentar burlar o Akamai.

---

## TCM-GO — Tribunal de Contas dos Municípios do Estado de Goiás

### Acesso
- Site: `https://www.tcmgo.tc.br/` (WordPress).
- robots.txt (200, 2026-11-04), conteúdo literal relevante (`robots.txt generated at http://www.mcanerin.com`):
  ```
  User-agent: *
  Disallow: /wp-admin/
  User-agent: Googlebot
  Disallow:
  (... Googlebot-image, Googlebot-mobile, MSNBot, Slurp, yahoo-mmcrawler, psbot com Disallow vazio ...)
  User-agent: *
  Disallow: /
  ```
  Como há dois grupos `User-agent: *`, valem as duas regras juntas (RFC 9309): **`Disallow: /` para todos os robôs que não sejam os buscadores nominalmente liberados**. O coletor do projeto não está liberado. **Coleta automatizada proibida.**
- Por isso nenhuma página do site foi acessada, com a exceção descrita em "Desvios de procedimento" (1 requisição que devolveu 404). O que segue vem de resultados de busca web (títulos e trechos), **não confirmado por acesso direto**.

### O que se sabe (somente por busca web)
- Existem as páginas `https://www.tcmgo.tc.br/site/decisoes/` (decisões: acórdãos, pareceres prévios e cautelares, por pesquisa livre ou palavras-chave, e Diário Oficial de Contas por data e jurisdicionado) e `https://www.tcmgo.tc.br/site/jurisprudencia/sumula/` (enunciados de súmula).
- Nas contas dos prefeitos, o TCM-GO emite **Parecer Prévio** (julgado pela Câmara Municipal; apenas nas contas anuais de governo) e **Acórdão** para os demais fins (contas de gestão), conforme trechos de decisões do próprio tribunal. O Diário Oficial de Contas é publicado em PDF (por exemplo edição 2619 de 04/02/2026).
- Dados abertos/API: não localizados.

### Plataforma
WordPress + Diário Oficial de Contas em PDF. Sistema da consulta de decisões: não identificado.

### Esforço e recomendação
**Depende de terceiros.** Pedido ao tribunal (SIC/Ouvidoria) de autorização de coleta ou de base de dados de pareceres prévios e acórdãos sobre contas dos prefeitos goianos. Sem resposta, só consulta manual no navegador.

---

## Sugestão de ordem de implementação

1. **TCE-PR**: CSV anual (baixo). Cobre prefeitos paranaenses com PDF.
2. **TC-DF**: API JSON (baixo), confirmar uso com o tribunal; parecer do Governador por PDF (médio).
3. **TCE-RS**: arquivos de `/dados/decisoes/` (baixo); parecer do Governador em PDF (médio).
4. **TCE-GO**: conferência manual da pasta "Contas do Governador"; pedido de dados para decisões.
5. **TCE-MT, TCE-MS, TCE-SC, TCM-GO**: pedido formal (SIC/LAI) de base de dados ou autorização; nenhum caminho automático permitido nesta data.

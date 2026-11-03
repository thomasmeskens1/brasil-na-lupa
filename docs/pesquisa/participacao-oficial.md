# Canais oficiais de participação: e-Cidadania (Senado) e enquetes (Câmara)

Pesquisa feita em **03/11/2026**, com o User-Agent honesto do coletor
(`brasil-na-lupa-coletor/1.0 (... Brasil na Lupa; Node.js)`), lendo o robots.txt de cada host antes
de qualquer outra requisição. Tudo abaixo foi visto nas páginas oficiais citadas. Nada foi deduzido.
O que não foi verificado aparece como **não verificado**.

Objetivo (diretriz 4.1): em vez de abaixo-assinado próprio, o site leva o visitante aos canais
oficiais de participação e mostra os números oficiais desses canais, sempre com fonte e data de coleta.

## 1. Senado Federal: Portal e-Cidadania

Página "Sobre": https://www12.senado.leg.br/ecidadania/sobre (acesso em 03/11/2026). O portal é
"administrado pela Coordenação do Programa e-Cidadania, unidade vinculada à Secretaria de Comissões
da Secretaria-Geral da Mesa do Senado Federal, conforme regulamentado pela Resolução do Senado
Federal nº 19 de 2015". As três ferramentas, nas palavras da página:

- **Ideia Legislativa**: "permite enviar e apoiar ideias legislativas, que são sugestões de alteração
  na legislação vigente ou de criação de novas leis. As ideias que receberem 20 mil apoios no prazo
  de quatro meses serão encaminhadas para a Comissão de Direitos Humanos e Legislação Participativa
  (CDH), onde receberão parecer. Além disso, qualquer ideia legislativa pode ser adotada por
  senadores ou deputados e transformada em projetos de lei."
  Página da ferramenta: https://www12.senado.leg.br/ecidadania/principalideia (03/11/2026), que diz
  "Com 20 mil apoios, sua ideia pode ser debatida e virar projeto de lei no Senado" e "Senadores e
  deputados podem adotar qualquer ideia e apresentá-la como projeto de lei, mesmo sem apoios". Cada
  ideia mostra "N apoios confirmados", "Meta de 20.000 apoios" e "Apoios abertos até <data>".
  As ideias que chegam à CDH viram Sugestão Legislativa (SUG): relatório oficial em
  https://www12.senado.leg.br/ecidadania/documentos/home/resultados/sugestoes-legislativas-sug.
- **Evento Interativo**: "permite participar de audiências públicas, sabatinas e outros eventos
  abertos", com transmissão ao vivo e espaço para comentários de usuários cadastrados.
  https://www12.senado.leg.br/ecidadania/principalaudiencia
- **Consulta Pública**: "permite opinar sobre projetos de lei, propostas de emenda à Constituição,
  medidas provisórias e outras proposições em tramitação no Senado Federal até a sanção,
  promulgação, envio à Câmara dos Deputados ou arquivamento."
  https://www12.senado.leg.br/ecidadania/principalmateria. A página de cada matéria diz que "Esta e
  TODAS as outras proposições que tramitam no Senado estão abertas para receber opiniões conforme a
  Resolução 26/2013".

### 1.1 Página da consulta de cada matéria

`https://www12.senado.leg.br/ecidadania/visualizacaomateria?id=<CÓDIGO DA MATÉRIA>`. O `id` é o
mesmo código da matéria em `https://www25.senado.leg.br/web/atividade/materias/-/materia/<CÓDIGO>`
(a própria página do e-Cidadania leva a esse endereço em "Ver tramitação e mais informações"), que é
o `proposicao.codigo_materia` de `dados/senado/votacoes/*.json`.

Marcadores vistos no HTML (03/11/2026):

| Situação | O que a página mostra | Exemplo |
|---|---|---|
| Consulta aberta | "Você apoia essa proposição?", botões SIM/NÃO, contadores `contabilizacao-favor` e `contabilizacao-contra`, "Votos apurados até 03/11/2026 19:39:13" | id 175871 (MPV 1394/2026): SIM 525.337, NÃO 81.553 |
| Consulta encerrada | "TRAMITAÇÃO ENCERRADA", "RESULTADO FINAL:", contadores, "Este texto não é mais passível de votação." | id 164914 (PLP 68/2024): SIM 49, NÃO 424 |
| Matéria sem consulta | "Tipo de Matéria não passível de votação!" e nenhum contador | id 167955 (MSF 3/2025) |

Há também trechos com contadores **dentro de comentários HTML** (`<!-- ... 10+ ... -->`), que o
coletor descarta.

### 1.2 Dados abertos do e-Cidadania

A página de relatórios https://www12.senado.leg.br/ecidadania/documentos/home/resultados lista,
entre outros, "Relatório da Consulta Pública", "Relatório das Ideias Legislativas", "Relatório dos
Eventos Interativos", "Relatório de número de votos em uma proposição por Unidade Federativa" e o
arquivo **"Todas as proposições com votos na consulta pública (CSV)"**:

- Link: https://www12.senado.leg.br/ecidadania/documentos/home/resultados/todas-as-proposicoes-com-votos-na-consulta-publica-csv
- Redireciona (HTTP 302) para
  `https://www.senado.gov.br/bi-arqs/Arquimedes/ecidadania/DadosAbertos/Proposições-com-votos.csv`
  (o cabeçalho `Location` vem com bytes UTF-8 crus; o coletor corrige antes de seguir).
- 03/11/2026: 34.124.722 bytes, `Last-Modified: Tue, 03 Nov 2026 10:30:33 GMT`, com ETag.
  Codificação Latin-1, separador `;`, aspas duplas, campos com quebra de linha.
- Primeira linha: `"Dados atualizados até 02/11/2026"`. Colunas: `CÓD. MATÉRIA; NOME DA MATÉRIA;
  EMENTA; AUTORIA; STATUS ATUAL; UF DO CIDADÃO; VOTO SIM; VOTO NÃO; TOTAL` (uma linha por matéria e
  UF; números com ponto de milhar; UF inclui `N/Inf` e `ZZ`).
- Nesta data todas as 153.657 linhas tinham `STATUS ATUAL` = "Descontinuado" e só 43 das 168
  matérias do site apareciam no arquivo. Ficaram de fora, por exemplo, a 167182 (página: RESULTADO
  FINAL, SIM 0, NÃO 0) e matérias com consulta aberta. Por isso o arquivo **não serve como fonte
  principal**: o coletor usa a página de cada matéria e, com `--csv`, confere a soma das UFs do
  arquivo com a página (164914: soma SIM 49, NÃO 424 = página, "confere").
- O arquivo não informa por que uma matéria está ou não está nele (**não verificado**).

### 1.3 robots.txt e termos

- `www12.senado.leg.br/robots.txt` (03/11/2026): `User-agent: *` com `Disallow:` vazio (nada
  proibido); só o Googlebot tem restrições (`/*sendto_form$`, `/*folder_factories$`). Sem Crawl-delay.
- `www.senado.gov.br/robots.txt`: HTTP 404 (sem regras declaradas).
- `www25.senado.leg.br/robots.txt` tem `Crawl-delay: 10` (não é usado por este coletor).
- `legis.senado.leg.br` respondeu **403** ("Request forbidden by administrative rules") ao nosso
  User-Agent já no robots.txt. Não foi contornado; o coletor não usa esse host.
- Termos de Uso do e-Cidadania (https://www12.senado.leg.br/ecidadania/termo, 03/11/2026): tratam
  de cadastro (gov.br), dados pessoais, moderação e responsabilidade. Não encontramos cláusula sobre
  leitura automatizada das páginas públicas. O item 20 diz que "O Senado Federal pode divulgar [...]
  o nome e outros dados cadastrais do autor de ideia, comentário, opinião, apoio, voto": **o coletor
  não lê nem grava nomes, comentários ou dados de cidadãos**, só os totais SIM/NÃO (diretriz 12).
- Nenhum captcha foi encontrado nas páginas lidas (o voto exige login gov.br, que o site não usa).

## 2. Câmara dos Deputados: enquetes e e-Democracia

### 2.1 Página "Participe"

https://www.camara.leg.br/participe (03/11/2026), seções "Debates Interativos", "Enquetes",
"Outras formas de participação" e "Dados". Sobre enquetes, o texto oficial diz:

> "Você pode opinar sobre qualquer proposta legislativa, indicando os pontos positivos e negativos ou
> votando nas opiniões de outros cidadãos. As enquetes não têm rigor científico, pois não
> representam uma amostra da sociedade. Por isso, cabe ao relator decidir se vai considerar as
> opiniões dos participantes ao sugerir mudanças no texto da proposta. Há enquetes específicas para o
> texto original da proposta e para cada mudança no texto, como substitutivo e emenda."

Sobre debates interativos: "As comissões temáticas da Câmara promovem debates interativos, com a
participação online dos cidadãos. Na página de cada reunião, você pode mandar perguntas para os
convidados e também votar nas perguntas feitas por outros usuários."

"Sugira uma proposta legislativa"
(https://www2.camara.leg.br/atividade-legislativa/participe/sugira-um-projeto, 03/11/2026):
"Entidades da sociedade civil organizada podem apresentar sugestões de lei para a Comissão de
Legislação Participativa (CLP). Os deputados votam essas sugestões e, caso sejam aprovadas, elas
passam a tramitar na Câmara como uma proposta de autoria da CLP." Cidadão individual não envia
sugestão por esse canal; quem envia são ONGs, associações, sindicatos e outras entidades cadastradas.

### 2.2 Enquete de cada proposição

- Página da enquete: `https://www.camara.leg.br/enquetes/<idProposicao>`. O número é o mesmo
  `id` da proposição nos Dados Abertos (conferido: `/enquetes/2483164` é a PEC 2/2025 e
  `https://dadosabertos.camara.leg.br/api/v2/proposicoes/2483164` devolve PEC 2/2025).
- Pergunta "Qual sua opinião sobre a <proposição>?" com cinco opções: "Concordo totalmente",
  "Concordo na maior parte", "Estou indeciso", "Discordo na maior parte", "Discordo totalmente".
- Resultados: `https://www.camara.leg.br/enquetes/<id>/resultados`, tabela "Opção / Participações /
  Percentual" e o rótulo literal "Resultado parcial desde 06/02/2025" (enquete aberta) ou
  "Resultado final desde 04/05/2018" (exemplo: id 104402, PRC 4/2003). A mesma página lista
  comentários de cidadãos, que o coletor **não** lê nem grava.
- id inexistente (ex.: 999999999) responde HTTP 500. O coletor trata como "sem enquete"
  e grava só o link com "Informação não disponível em fonte oficial".
- **Sem dados abertos estruturados**: o script da página (`/enquetes/js/enquete.js`) só monta os
  endereços `/resultados`, `/votar` e `/red/...`; `https://dadosabertos.camara.leg.br/api/v2/enquetes`
  responde 405. A única fonte é o HTML da página de resultados.

### 2.3 e-Democracia e Wikilegis

`https://edemocracia.camara.leg.br/`, `/wikilegis/` e `/audiencias/` respondem **302 para
https://www.camara.leg.br/participe** (03/11/2026). Ou seja, o portal e-Democracia e o Wikilegis
não estão mais disponíveis como plataformas próprias nesse endereço. O site não aponta para eles.

### 2.4 robots.txt e termos

- `www.camara.leg.br/robots.txt` (03/11/2026): grupos específicos para robôs de IA (GPTBot,
  anthropic-ai, Claude-Web, CCBot etc.), ferramentas de SEO e buscadores regionais. O nosso agente
  (`brasil-na-lupa-coletor`) cai no grupo `User-agent: *`, que proíbe, entre outros, `/comentarios/*`,
  `/agenda?*`, `/deputados/*/*` e `/*.pdf`, mas **não proíbe `/enquetes/`**. Sem Crawl-delay no
  grupo `*`. O coletor não é robô de treino de IA: lê só os totais oficiais para exibição com link.
- Termo de uso específico das enquetes: **não verificado** (a página "Participe" só liga o "Termo de
  Uso" dos debates interativos:
  https://www2.camara.leg.br/atividade-legislativa/participe/termo-de-uso-dos-debates-interativos).
- Nenhum captcha encontrado na página de resultados.

## 3. Como o site usa isso

- Coletor: `scripts/coleta/participacao/coletar.mjs` (Node 20+, sem dependências, no máximo 2
  requisições simultâneas, pausa de 1 s, tempo limite de 20 s por requisição, retentativas,
  robots.txt primeiro, 401/403/captcha interrompem sem contorno, gravação atômica que não regrava sem
  mudança). Testes offline: `node --test scripts/coleta/participacao/testes.mjs`.
- Saída: `dados/participacao/senado/<código da matéria>.json` e
  `dados/participacao/camara/<idProposicao>.json`, com o link oficial, os números copiados da página,
  o rótulo oficial (RESULTADO FINAL / "Resultado parcial desde ..."), a fonte e a data de coleta.
  Sem número disponível: só o link e "Informação não disponível em fonte oficial".
- Consultas e enquetes encerradas não mudam e não são revisitadas (salvo `--forcar`). A Câmara tem
  ~1.400 proposições no site; o coletor visita até 300 por execução (`--limite`), começando pelas
  nunca verificadas.
- Na página: o resultado é sempre rotulado como consulta/enquete oficial, "não é votação nem
  pesquisa", com o mesmo tratamento visual para todas as opções (sem verde/vermelho).

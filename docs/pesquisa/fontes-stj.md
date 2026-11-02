# Fontes oficiais do STJ: avaliação técnica

Data dos testes: 02/11/2026. Todas as chamadas abaixo foram feitas de verdade nesta data. Trechos de resposta foram copiados e encurtados com "…".
Scripts e respostas brutas estão no scratchpad da sessão (`pesquisa-stj/`: `icms.py`, `h2t.py`, `raw/`, `icms-temas.json`, `icms-decisoes.txt`).
Nenhum dado aqui foi deduzido. Quando um item não foi verificado, isso está escrito.

## Resumo rápido

| Fonte | Chave? | Formato | Atualização observada | Serve para |
|---|---|---|---|---|
| Portal de Dados Abertos (CKAN) `dadosabertos.web.stj.jus.br` | não | JSON, CSV, ZIP, GZ | diária ou mensal, conforme o conjunto | **base principal**: temas, acórdãos, íntegras, pautas, distribuição |
| Precedentes qualificados (`Temas.csv` + `Processos.csv`) | não | CSV UTF-8 | arquivo único substituído (último: 25/10/2026) | tema, questão, tese, situação, órgão, datas, relator, processos paradigma |
| Espelhos de acórdãos (um conjunto por órgão julgador) | não | JSON mensal | mês M publicado no fim do mês M+1 | **resultado do julgamento**: unanimidade ou maioria, vencidos, quem acompanhou, ausentes, presidente |
| Íntegras de decisões terminativas e acórdãos | não | JSON (metadados) + ZIP de TXT | diária, com atraso (último arquivo: 13/10/2026) | texto completo, inclusive o dispositivo com a votação |
| Página "Precedentes Qualificados" `processo.stj.jus.br/repetitivos/...` | não | HTML | "Última atualização" por tema | link público para cada tema (respondeu 200 sem bloqueio) |
| SCON (pesquisa de jurisprudência e súmulas) `scon.stj.jus.br` | — | HTML | — | **bloqueado para robôs** (403 "Verificação automática em andamento") |
| Consulta processual `processo.stj.jus.br/processo/pesquisa/` | — | HTML | — | **bloqueada para robôs** (mesma página 403) |
| Ministros em atividade `www.stj.jus.br/web/verMinistrosSTJ?parametro=1` | não | HTML | versão "de 14/08/2026" | nome completo, UF de naturalidade, cargo de direção |
| Composição dos colegiados (PDF) | não | PDF | "Composição – 26/10/2026" | órgão, turma, seção, presidente de cada colegiado |
| API Pública do DataJud (CNJ), índice `api_publica_stj` | chave pública | JSON (Elasticsearch) | contínua | andamento processual (movimentos); **não traz votos** |

Conclusão principal: **dá para automatizar quase tudo** que o site precisa para os temas repetitivos (tese, relator, órgão, datas e o texto oficial da votação). A única etapa que precisa de conferência humana é transformar o texto do resultado ("por maioria, vencidos os Srs. Ministros…") em lista de votos por ministro, porque esse dado só existe como texto corrido, não como campo.

---

## 1. Portal de Dados Abertos do STJ

- **URL:** `https://dadosabertos.web.stj.jus.br` (plataforma CKAN).
- **API:** a API padrão do CKAN funciona sem chave: `GET /api/3/action/package_list`, `GET /api/3/action/package_show?id=<conjunto>`. Cada recurso (arquivo) tem URL fixa de download.
- **Licença:** `license_id: "cc-by"` ("Creative Commons Atribuição") em precedentes qualificados, espelhos, íntegras, atas de distribuição e acervo. O conjunto `pautas-futuras` está **sem licença declarada** (campo vazio).
- **Limites:** nenhum 429 e nenhum cabeçalho de limite de taxa nas cerca de 40 chamadas feitas. O servidor grava cookies de afinidade (`DADOSABERTOS_AFF`, `ckan`), mas eles não são exigidos.
- **Codificação:** os JSON vêm em UTF-8. Os dicionários CSV vêm em UTF-8 com BOM e usam `;` como separador. `Temas.csv` usa `,`.

### Conjuntos existentes (`package_list`, 02/11/2026)

```
acervo-em-tramitacao, api-publica-datajud, atas-de-distribuicao, diarias-e-passagens, diarias-e-passagens-enfam,
espelhos-de-acordaos-corte-especial, espelhos-de-acordaos-primeira-secao, espelhos-de-acordaos-primeira-turma,
espelhos-de-acordaos-quarta-turma, espelhos-de-acordaos-quinta-turma, espelhos-de-acordaos-segunda-secao,
espelhos-de-acordaos-segunda-turma, espelhos-de-acordaos-sexta-turma, espelhos-de-acordaos-terceira-secao,
espelhos-de-acordaos-terceira-turma, folha-de-pagamento-de-pessoal, integras-de-decisoes-terminativas-e-acordaos-2008-2020,
integras-de-decisoes-terminativas-e-acordaos-do-diario-da-justica, pautas-futuras, penalidades-fornecedores,
plano-estrategico-stj, precedentes-qualificados
```

**Não existe conjunto de súmulas** no portal (ver seção 3).

| Conjunto | Conteúdo | Arquivos | Atualização (`metadata_modified` / último arquivo) |
|---|---|---|---|
| `precedentes-qualificados` | temas repetitivos, controvérsias, IAC, SIRDR, PUIL e relevância | `Temas.csv` (2,6 MB), `Processos.csv` (1,1 MB), 2 dicionários | 25/10/2026 (arquivo substituído) |
| `espelhos-de-acordaos-<órgão>` (10 conjuntos) | acórdãos selecionados pela Secretaria de Jurisprudência, com campos tratados | 1 JSON por mês (ex.: `20260930.json`) + ZIP da carga inicial | `20260930.json` publicado em 29/10/2026 |
| `integras-de-decisoes-terminativas-e-acordaos-do-diario-da-justica` | texto completo e metadados de acórdãos e decisões terminativas | `metadadosAAAAMMDD.json` + `textosAAAAMMDD.zip` (2.648 recursos) | último dia disponível: 13/10/2026 (enviado em 28/10/2026) |
| `pautas-futuras` | processos incluídos em pauta de sessões futuras | `pautas_futuras_AAAAMMDD.json.gz` | 24/10/2026 |
| `atas-de-distribuicao` | processos distribuídos no dia (base da ata publicada no Diário da Justiça) | `ataAAAAMMDD.json` (1.033 recursos) | 25/10/2026 |
| `acervo-em-tramitacao` | processos em tramitação ao fim do dia | `processos_tramitando_AAAAMMDD.json.gz` | 23/10/2026 |
| `api-publica-datajud` | ponteiro para a API do CNJ, com a chave pública no campo `extras.APIKey` | — | — |

Atraso observado: em 02/11/2026, o arquivo mais novo de cada conjunto tinha de 8 dias (pautas e distribuição) a cerca de 20 dias (íntegras). Os espelhos chegam com cerca de 1 mês de atraso.

---

## 2. Temas repetitivos, IAC e demais precedentes qualificados

### 2.1 Arquivo `Temas.csv` (Dados Abertos)

- **URL:** `https://dadosabertos.web.stj.jus.br/dataset/4238da2f-c07b-4c1a-b345-4402accacdcf/resource/df29da13-7d6b-41ba-ad96-cd1a5bbd191c/download/temas.csv`
- **Tamanho:** 2.410 linhas. Por `tipoPrecedente`: `Tema` 1.505, `Controvérsia` 837, `PUIL` 27, `IAC` 23, `SIRDR` 11, **vazio 7**.
- **Campos:** `sequencialPrecedente, tipoPrecedente, numeroPrecedente, dataPrimeiraAfetacao, dataJulgamento, dataPublicacaoAcordao, situacao, informacoesComplementares, questaoSubmetidaAJulgamento, teseFirmada, anotacoesNUGEPNAC, delimitacaoJulgado, entendimentoAnterior, referenciaLegislativa, referenciaSumular, sumulaOriginada, audienciaPublica, dataAudienciaPublica, orgaoJulgador, Assuntos, numeroRepercussaoGeralSTF, descricaoRepercussaoGeral`
- `orgaoJulgador` vem como sigla: `S1` 1.322, `S2` 522, `S3` 369, `CE` 190, vazio 7.
- `situacao` (principais valores): `Trânsito em Julgado` 1.073, `Vinculada a Tema` 470, `Cancelada` 334 e `Cancelado` 200 (duas grafias), `Afetado` 107, `Acórdão Publicado` 62, `Acórdão Publicado - RE Pendente` 48, `Em Julgamento` 21, `Relevância reconhecida` 5…
- `Assuntos` usa a Tabela Processual Unificada do CNJ, por exemplo `5946- ICMS/ Imposto sobre Circulação de Mercadorias`. **É o melhor filtro para ICMS** (códigos 5946, 5947 "ICMS/Importação", 10556 "Exclusão - ICMS").

### 2.2 Arquivo `Processos.csv` (processos paradigma)

- 5.562 linhas, ligadas a `Temas.csv` por `sequencialPrecedente`.
- **Campos úteis:** `Processo` (ex.: `REsp 2133933`), `numeroRegistro`, `ministroRelator`, `leadingCase` (S/N), `dataAfetacao`, `dataJulgamento`, `dataPbulicacaoAcordao` (sic), `siglaTribunalOrigem`, `origemUF`, `processoSTF`, `Desafetação`, `Embargos de Divergência`.
- O **relator fica neste arquivo, não no de temas**. Há casos em que o relator é um cargo e não um nome: `"ministroRelator": "PRESIDENTE DA COMISSÃO GESTORA DE PRECEDENTES"` (relevância 1475).

### 2.3 Problemas de qualidade encontrados (guardar como vêm e anotar)

1. **Linhas duplicadas:** 37 pares (tipo, número) aparecem duas vezes em `Temas.csv`, como os Temas 1276, 1364 e 1419. Os processos também se repetem em dobro. Deduplicar pela linha inteira.
2. **`tipoPrecedente` vazio** em 7 linhas, como a nº 1477 (`situacao: "Relevância reconhecida"`). A página oficial classifica esse número na aba **"Relevância (1)"**. Exibir o tipo da página oficial, ou "Informação não disponível em fonte oficial".
3. **Divergência de UF entre o CSV e a página oficial:** no Tema 1364, o CSV traz `REsp 2150894` com `origemUF: RS`, e a página mostra `REsp 2150894/SC`. O CSV traz `REsp 2150097` com `PE`, e a página mostra `REsp 2150097/CE`. Seguir a regra do esquema: guardar como a fonte traz e anotar em `lacunas`.
4. Datas de julgamento e de publicação ficam vazias enquanto o tema não foi julgado. Não preencher.

### 2.4 Página oficial de cada tema (link público)

- **URL (testada, HTTP 200, ISO-8859-1, sem bloqueio):**
  `https://processo.stj.jus.br/repetitivos/temas_repetitivos/pesquisa.jsp?novaConsulta=true&tipo_pesquisa=T&cod_tema_inicial=1369&cod_tema_final=1369`
- Traz os mesmos dados do CSV e mais alguns: "Ramo do direito", "RRC Sim", "Trânsito em Julgado" por processo e **"Última atualização: 06/07/2026"**. Exemplo real (Tema 1369):
  ```
  Tema Repetitivo 1369 | Situação Acórdão Publicado | Órgão julgador PRIMEIRA SEÇÃO | Ramo do direito DIREITO TRIBUTÁRIO
  Tese Firmada: A Lei Complementar n. 87/1996 (Lei Kandir) disciplina de forma suficiente a cobrança de ICMS-DIFAL …
  Anotações NUGEPNAC: … Afetação na sessão eletrônica iniciada em 6/8/2025 e finalizada em 12/8/2025 (Primeira Seção) …
  REsp 2133933/DF | Tribunal de Origem TJDFT | Relator AFRÂNIO VILELA | Afetação 18/08/2025 | Julgado em 10/06/2026 | Acórdão publicado em 03/07/2026
  ```
- **Não há API nem JSON** nesta página. Ela só serve como link para o leitor e para conferência. A coleta usa o CSV.
- Para a relevância 1477, a mesma URL com `tipo_pesquisa=T` respondeu "Relevância (1)", mas listou 0 documentos. O parâmetro que abre a aba "Relevância" **não foi verificado**.

---

## 3. Súmulas

- **SCON** (`https://scon.stj.jus.br/SCON/sumstj/` e `pesquisar.jsp?b=SUMU…`): **HTTP 403** com a página "Verificação automática em andamento… Enable JavaScript and cookies to continue" (Coordenadoria de Segurança e Defesa Cibernética do STJ). É uma barreira anti-robô deliberada. **Não foi contornada nem deve ser.**
- O Portal de Dados Abertos **não tem conjunto de súmulas**.
- **Alternativas oficiais:**
  - `Temas.csv`, campos `sumulaOriginada` (súmula criada a partir de um tema) e `referenciaSumular`. São automatizáveis, mas cobrem só as súmulas ligadas a temas.
  - A "Revista de Súmulas" (`www.stj.jus.br/publicacaoinstitucional/index.php/sumstj/…`) apareceu numa busca na web. **O acesso não foi testado.**
- **Recomendação:** tratar súmulas por **curadoria manual**. Uma pessoa consulta o SCON no navegador e registra o número, o enunciado, o órgão, a data de aprovação e o link. O volume é pequeno: poucas súmulas novas por ano.

---

## 4. Resultado do julgamento: quem decidiu e como votou

### 4.1 Espelhos de acórdãos (Dados Abertos), a melhor fonte

- **URL (Primeira Seção):** `https://dadosabertos.web.stj.jus.br/dataset/espelhos-de-acordaos-primeira-secao`. Existem conjuntos iguais para a Corte Especial, as três Seções e as seis Turmas.
- **Formato:** JSON, um arquivo por mês, com uma lista de objetos. Tamanhos de 20 a 129 acórdãos por mês na Primeira Seção.
- **Atenção à cobertura:** só entram os acórdãos "cuja ementa mostre novidades quanto a teses jurídicas ou à representatividade de Ministro Relator e/ou Órgão Julgador" (descrição oficial). **Não é a lista de todos os acórdãos.** Para os temas repetitivos de 2025 e 2026 testados, todos os acórdãos de mérito já publicados até setembro de 2026 estavam lá.
- **Campos (dicionário oficial):** `id, numeroProcesso, numeroRegistro, siglaClasse, descricaoClasse, nomeOrgaoJulgador, ministroRelator, ementa, tipoDeDecisao, dataDecisao (AAAAMMDD), decisao, jurisprudenciaCitada, notas, informacoesComplementares, termosAuxiliares, teseJuridica, tema, referenciasLegislativas[], acordaosSimilares[], dataPublicacao`.
- O dicionário define `decisao` como o "Resultado final do julgamento, com informações sobre a **votação (unânime ou por maioria)**, bem como **ausências de Ministros**, sustentações orais e tese firmada". Pela definição de `ministroRelator`, quando o relator fica vencido o campo traz o relator **do acórdão**.
- **Não há campos separados** para "vencidos", "acompanharam" ou "ausentes". Tudo vem em **texto corrido**, com quebras de linha no meio das frases (normalizar os espaços antes de buscar "por unanimidade").

**Caso real 1, unanimidade (Tema 1369, `20260731.json`):**
```json
"siglaClasse": "REsp", "numeroProcesso": "2133933", "nomeOrgaoJulgador": "PRIMEIRA SEÇÃO", "ministroRelator": "AFRÂNIO VILELA",
"dataDecisao": "20260610", "dataPublicacao": "DJEN       DATA:03/07/2026",
"decisao": "… acordam os Ministros da Primeira Seção, por unanimidade, negar provimento ao recurso especial, nos termos do voto do Sr. Ministro Relator.
 Foi aprovada, por unanimidade, a seguinte tese jurídica no tema repetitivo 1369: … Os Srs. Ministros Francisco Falcão, Maria Thereza de Assis Moura,
 Marco Aurélio Bellizze, Sérgio Kukina, Regina Helena Costa, Paulo Sérgio Domingues e Teodoro Silva Santos votaram com o Sr. Ministro Relator.
 Ausente, justificadamente, o Sr. Ministro Benedito Gonçalves.",
"teseJuridica": "\"A Lei Complementar n. 87/1996 (Lei Kandir) disciplina de forma suficiente …\"",
"tema": "1. Tema Repetitivo 1369\n Situação do tema: Acórdão Publicado"
```

**Caso real 2, maioria com vencido e relator do acórdão diferente (Tema 1265, `20250630.json`):**
```
REsp 2097166 | ministroRelator: HERMAN BENJAMIN | dataDecisao 20250514 | DJEN 23/06/2025
"… prosseguindo o julgamento, preliminarmente, por maioria, vencidos os Srs. Ministros Mauro Campbell Marques e Teodoro Silva Santos,
 rejeitar a proposta de desafetação e, no mérito, por maioria, vencido o Sr. Ministro Mauro Campbell Marques, dar provimento ao recurso
 especial, nos termos do voto do Sr. Ministro Relator. Lavrará o acórdão o Sr. Ministro Gurgel de Faria. (RISTJ, Art. 52, IV, b)
 Foi aprovada, por maioria, a seguinte tese jurídica no tema 1265: … Os Srs. Ministros Benedito Gonçalves, Sérgio Kukina, Paulo Sérgio
 Domingues, Afrânio Vilela e Francisco Falcão votaram com o Sr. Ministro Relator. Não participaram do julgamento os Srs. Ministros
 Marco Aurélio Bellizze e Maria Thereza de Assis Moura."
```
Este caso mostra o que o modelo de dados precisa suportar:
- uma votação separada para a **preliminar** e outra para o **mérito**, com vencidos diferentes;
- o ministro que **lavra o acórdão**;
- a diferença entre "ausente, justificadamente" e "não participaram do julgamento";
- registros como "(voto-vista)" e "(com acréscimo de fundamentação)", que aparecem no Tema 1317.

Outras expressões reais encontradas: `"Presidiu o julgamento o Sr. Ministro Paulo Sérgio Domingues."`, `"em Sessão Virtual de 17/06/2026 a 23/06/2026"`, `"Luís Carlos Gambogi (Desembargador Convocado do TJMG)"` (íntegras, Quarta Turma). Ou seja, **nem todo votante é ministro**.

Na amostra da Primeira Seção de julho e agosto de 2026 (142 acórdãos), 137 foram por unanimidade e 5 por maioria. O guia oficial da Primeira Seção diz que "O Ministro Presidente só vota em caso de empate (Art. 21, VI do RISTJ)". Por isso o presidente **não** deve ser contado como voto, salvo se o texto disser que votou.

### 4.2 Íntegras de decisões terminativas e acórdãos (Dados Abertos)

- `metadadosAAAAMMDD.json`: `SeqDocumento, dataPublicacao, tipoDocumento (ACÓRDÃO|DECISÃO), numeroRegistro, processo, dataRecebimento, dataDistribuição, NM_MINISTRO, recurso, teor ("Concedendo", …), descricaoMonocratica, assuntos ("00287.03603.03632.")`.
- **Divergência:** o dicionário chama o campo de relator de `ministro`, mas o JSON real usa `NM_MINISTRO`.
- `textosAAAAMMDD.zip`: um `.txt` por `SeqDocumento`, em UTF-8 com `<br>`. O texto do acórdão começa com o mesmo parágrafo de votação do espelho (`ACÓRDÃO<br>Vistos e relatados … por unanimidade … votaram com a Sra. Ministra Relatora.<br>Presidiu o julgamento…`).
- Exemplo: 13/10/2026 tinha 2.644 documentos (898 acórdãos, 1.746 decisões). O ZIP de 09/10/2026 tinha 100 TXT e 512 KB.
- **Uso:** cobre os acórdãos que não entram nos espelhos e as **decisões monocráticas** (de um só ministro, sem votação: registrar como ato individual). Processos em segredo de justiça não aparecem.
- A "certidão de julgamento" não apareceu separada nos TXT testados. **Não foi verificado** se ela existe na íntegra completa do acórdão (a página de inteiro teor fica no host que bloqueia robôs).

### 4.3 Pautas, distribuição e DataJud (apoio)

- **`pautas-futuras`:** `numeroRegistro, dataSessão, dataPublicacaoPauta, orgaoJulgador (T4…), processo, tipoPeticao, Relator, segredoDeJustica, partes[…]` (8.855 itens em 24/10/2026). Não traz o assunto. Para saber se o processo é de ICMS, é preciso cruzar pelo `numeroRegistro`. **Traz nomes de partes, CNPJ e advogados: não exibir** (diretriz 12).
- **`atas-de-distribuicao` e `acervo-em-tramitacao`:** servem para saber a quem um processo foi distribuído. Não foram detalhados.
- **DataJud (CNJ):** `POST https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search` com `Authorization: APIKey <chave pública do campo extras>`. Testado: HTTP 200 e mais de 10.000 recursos com assunto 5946. Devolve classe, assuntos, órgão (gabinete do relator) e `movimentos` (Recebimento, Distribuição, Publicação…). **Não traz resultado nem votos.** Os acentos vieram corrompidos em alguns nomes de órgão (`"SECRETARIA JUDICIÃ\u0081RIA"`). Uso opcional.

---

## 5. Recorte do piloto: ICMS (STJ, julgados ou afetados de 01/01/2025 a 02/11/2026)

**Método** (`icms.py`, automatizável): ler `Temas.csv` e manter as linhas em que `Assuntos`, `questaoSubmetidaAJulgamento`, `teseFirmada` ou `referenciaLegislativa` contêm "ICMS" ou "87/1996" e em que alguma das datas (afetação, julgamento, publicação) é igual ou posterior a 2025-01-01. Em seguida, cruzar com `Processos.csv` para obter o relator e com os espelhos para obter o texto da votação. Nenhuma controvérsia, IAC, SIRDR ou PUIL de ICMS teve data a partir de 2025 (as controvérsias de ICMS do CSV estão "Vinculada a Tema" ou "Cancelada", sem datas).

Todos os itens são da **Primeira Seção** (`S1`). Link oficial de cada tema: `https://processo.stj.jus.br/repetitivos/temas_repetitivos/pesquisa.jsp?novaConsulta=true&tipo_pesquisa=T&cod_tema_inicial=<N>&cod_tema_final=<N>`. Esse link foi testado nos Temas 1369 e 1364.

### 5.1 Grupo A: a questão submetida ou a tese menciona o ICMS

| Tema | Situação (CSV 25/10/2026) | Relator (processo paradigma) | Julgado / publicado | Tese firmada (texto oficial) | Resultado (espelho) |
|---|---|---|---|---|---|
| 1304 | Acórdão Publicado - RE Pendente | Teodoro Silva Santos (REsp 2119311) | 10/12/2025 / 17/12/2025 | "Não é possível excluir o ICMS, o PIS e a COFINS da base de cálculo do IPI, a partir do conceito de 'valor da operação' inserto no art. 47, II, a, do CTN; e no art. 14, II, da Lei 4.502/1964." | unanimidade; 7 acompanharam; ausente Gurgel de Faria |
| 1363 | Afetado (não julgado) | Marco Aurélio Bellizze (REsp 2203730) | — | sem tese. Questão: "Definir se a Nota Fiscal Eletrônica (NF-e) pode ser equiparada à Guia de Informação e Apuração do ICMS (Difal) - GIA/ICMS, para a constituição do crédito tributário." 6 processos, todos do TJSP | afetação 03/06/2025 |
| 1364 | Acórdão Publicado | Paulo Sérgio Domingues (REsp 2150894) | 14/10/2026 / 20/10/2026 | "É vedada a apuração de créditos da contribuição ao PIS e da COFINS, no regime não cumulativo, sobre o valor do ICMS que tenha incidido sobre a operação de aquisição, nos termos do art. 3º, § 2º, III, das Leis 10.637/2002 e 10.833/2003, incluído pela Lei 14.592/2023." | **ainda sem espelho do mérito** (o arquivo de outubro sai por volta do fim de novembro); a afetação foi unânime |
| 1369 | Acórdão Publicado | Afrânio Vilela (REsp 2133933) | 10/06/2026 / 03/07/2026 | "A Lei Complementar n. 87/1996 (Lei Kandir) disciplina de forma suficiente a cobrança de ICMS-DIFAL em operações interestaduais destinadas a consumidor final contribuinte do imposto antes da entrada em vigor da Lei Complementar n. 190/2022." | unanimidade; 7 acompanharam; ausente Benedito Gonçalves |
| 1372 | Acórdão Publicado | Gurgel de Faria (REsp 2174178) | 20/08/2026 / 28/08/2026 | "O ICMS-DIFAL (Diferencial de Alíquotas do Imposto sobre a Circulação de Mercadorias e Serviços) não compõe a base de cálculo da Contribuição ao PIS e da COFINS." Com modulação: efeitos a partir de 15/03/2017 | unanimidade; 7 acompanharam; ausente Bellizze; presidiu Paulo Sérgio Domingues |
| 1416 | Afetado (não julgado) | Regina Helena Costa (REsp 2221127) | — | sem tese. Questão: se os créditos presumidos de ICMS concedidos como incentivo fiscal podem ser excluídos das bases do IRPJ e da CSLL, antes e depois da Lei 14.789/2023 | afetação 16/03/2026 (CSV) |
| 1477 (Relevância) | Relevância reconhecida | Afrânio Vilela (REsp 2234803) | — | sem tese. Questão: direito ao crédito de ICMS (arts. 19, 20 e 33, I, da LC 87/1996) na compra de combustíveis, lubrificantes, pneus e peças para frota própria por contribuinte cuja atividade-fim não é o transporte | data 16/10/2026; `tipoPrecedente` vazio no CSV |

### 5.2 Grupo B: código de assunto ICMS no CSV, mas a questão é processual

| Tema | Relator | Julgado / publicado | Tese (resumo literal) | Resultado |
|---|---|---|---|---|
| 1265 | Herman Benjamin (lavrou Gurgel de Faria) | 14/05/2025 / 23/06/2025 | honorários por apreciação equitativa quando a exceção de pré-executividade só exclui o excipiente do polo passivo | **maioria**: vencido Mauro Campbell Marques (mérito); na preliminar, vencidos Mauro Campbell Marques e Teodoro Silva Santos |
| 1273 | Paulo Sérgio Domingues | 10/09/2025 / 03/10/2025 | o prazo decadencial do art. 23 da Lei 12.016/2009 não se aplica a mandado de segurança contra norma que interfira em obrigações tributárias sucessivas | unanimidade; ausente Francisco Falcão |
| 1317 | Gurgel de Faria | 12/11/2025 / 24/12/2025 | a extinção dos embargos à execução fiscal por adesão a programa de recuperação fiscal com honorários já incluídos não enseja nova condenação em honorários | unanimidade; Paulo Sérgio Domingues com voto-vista |
| 1429 | Maria Thereza de Assis Moura | 20/08/2026 / 27/08/2026 | ônus de sucumbência e repetição do indébito ligados à modulação do Tema 986/STJ | unanimidade; ausente Bellizze |

### 5.3 Grupo C: ICMS citado só na fundamentação (encontrado pela ementa dos espelhos)

- **Tema 1276** (CPRB na base do PIS e da Cofins; relator Bellizze; julgado em 09/09/2026) e **Tema 1419** (honorários em ação rescisória ligada ao Tema 69/STF; relatora Maria Thereza; julgado em 20/08/2026). Nos dois, o CSV não tem assunto ICMS. Ficam fora do recorte, salvo decisão de curadoria.

**Para decisão humana:** quais grupos aparecem na seção de ICMS do site. Pelo critério "mudanças de ICMS que afetam SP", o Grupo A é o candidato natural. O Tema 1363 (6 processos do TJSP) e o Tema 1369 (DIFAL) são os mais ligados ao ICMS. A ligação com uma decisão da seção de ICMS (`relacionados`) só deve ser feita quando o documento oficial citar a mesma norma: por exemplo, `referenciasLegislativas` do espelho do Tema 1369 cita `LEG:FED LCP:000087 ANO:1996` e `LEG:FED LCP:000190 ANO:2022`.

---

## 6. Composição: ministros, órgãos e cargos

| Fonte | URL | O que traz | Formato |
|---|---|---|---|
| Ministros em atividade | `https://www.stj.jus.br/web/verMinistrosSTJ?parametro=1` | **32 nomes** completos, UF de naturalidade e cargo de direção ("Luis Felipe Salomão - Presidente", "Mauro Luiz Campbell Marques - Vice-Presidente e Corregedor-Geral da Justiça Federal", "Benedito Gonçalves - Diretor-Geral da ENFAM") | HTML (ISO-8859-1), versão "de 14/08/2026" |
| Currículo individual | `https://www.stj.jus.br/web/verCurriculoMinistro?parametro=1&cod_matriculamin=0001194` | página por ministro, com **código de matrícula** estável | HTML (não detalhado) |
| Composição dos colegiados | `https://www.stj.jus.br/sites/portalp/SiteAssets/Paginas/Institucional/Composicao/Composicao-do-STJ.pdf` | "Composição – 26/10/2026": Plenário por antiguidade (**"33. (vago)"**), Corte Especial (15), as três Seções, as seis Turmas com data de ingresso e o biênio da presidência, membros convocados ("Luís Carlos Balbino Gambogi**", "Vaga do Min. Marco Buzzi") | PDF em várias colunas (o link no portal tem o título desatualizado "Composição atualizada em 29/11/2023") |
| Guias por órgão | `…/Composicao/1_secao_online.pdf`, `1_turma_online.pdf` … `6_turma_online.pdf`, `corte_especial_online.pdf` | presidente e biênio, ordem de votação, regra do voto do presidente | PDF ("ATUALIZADO: AGOSTO/2026") |

Exemplo do PDF de 26/10/2026, Primeira Seção (Direito Público): Francisco Falcão, Maria Thereza de Assis Moura, Herman Benjamin, Marco Aurélio Bellizze, Sergio Kukina, Regina Helena Costa, Gurgel de Faria* (presidente de 15/1/2026 a 14/1/2028), Paulo Sérgio Domingues, Teodoro Silva Santos, Afrânio Vilela. Primeira Turma: Herman Benjamin (ingresso em 25/8/2026), Sergio Kukina* (presidente), Regina Helena Costa, Gurgel de Faria, Paulo Sérgio Domingues. Segunda Turma: Francisco Falcão, Maria Thereza de Assis Moura, Marco Aurélio Bellizze, Teodoro Silva Santos*, Afrânio Vilela.

Dificuldades:
- O PDF muda de layout e as colunas se misturam no `pdftotext -layout`.
- Os nomes nos acórdãos ("Sérgio Kukina", "Gurgel de Faria") diferem dos nomes completos ("Sérgio Luíz Kukina", "Luiz Alberto Gurgel de Faria") e às vezes do PDF ("Sergio Kukina", sem acento).
- É preciso manter uma **tabela de nomes alternativos por ministro**, montada por curadoria e só com grafias que aparecem em documento oficial.
- A composição muda com o tempo (ex.: Herman Benjamin entrou na Primeira Turma em 25/8/2026). Guardar `periodos[]` com data de início, conforme o documento.

---

## 7. Estratégia de coleta recomendada

### Automatizável (rotina diária, diretriz 13)

1. **`precedentes-qualificados`:** baixar `Temas.csv` e `Processos.csv`, deduplicar, filtrar por assunto e texto (ICMS no piloto) e gravar tema, questão, tese, situação, órgão, datas, relator e processos. Detectar mudança de `situacao` ou de tese e registrar a data de coleta.
2. **`espelhos-de-acordaos-*`:** para cada processo paradigma, procurar o acórdão pelo `numeroRegistro` nos JSON mensais e guardar `decisao` (texto literal), `ementa`, `teseJuridica`, `referenciasLegislativas`, `dataDecisao` e `dataPublicacao`. Classificar automaticamente "por unanimidade" ou "por maioria" (busca literal com espaços normalizados).
3. **Íntegras (`metadados` + `textos`):** cobrem o que os espelhos não trazem e as decisões monocráticas (registrar como "decisão monocrática", ato individual, sem voto).
4. **Pautas futuras:** avisar que um tema acompanhado entrou em pauta (`numeroRegistro` + `dataSessão`), sem exibir as partes.
5. **Ministros:** baixar a página de ministros em atividade (HTML simples) e verificar mudanças.
6. **Extração preliminar dos votos:** separar no texto `decisao` as listas "votaram com o Sr. Ministro Relator", "vencido(s) o(s) Sr(s). Ministro(s)…", "Ausente(s), justificadamente…", "Não participaram…", "Presidiu…" e "Lavrará o acórdão…". O resultado fica marcado como **"pendente de conferência"**.

### Exige curadoria (pessoa ou agente revisor, sempre comparando com o texto)

- **Conferir cada voto individual** extraído do texto antes de publicar. A diretriz 5 só permite atribuir voto com registro oficial nominal. O registro existe (o acórdão nomeia cada ministro), mas está em texto livre, com variações (preliminar × mérito, voto-vista, desembargador convocado, relator vencido).
- **Súmulas:** o SCON bloqueia robôs, então o registro é manual.
- **Composição por órgão:** o PDF é difícil de ler por máquina, então a tabela é mantida manualmente, com data.
- **Grafias de nomes** de cada ministro (tabela de nomes alternativos).
- **Escolha de quais temas entram no ICMS** (grupos A, B e C acima) e ligação com as decisões existentes, só quando o documento citar a mesma norma.
- **Divergências entre fontes** (UF do processo, tipo vazio, linhas duplicadas): registrar em `lacunas`, sem corrigir.
- **Fundamentação dos votos vencidos:** o espelho só diz quem ficou vencido. O motivo está no inteiro teor (voto vencido), num host que bloqueia robôs. Até haver acesso oficial automatizável, exibir "Informação não disponível em fonte oficial" ou fazer a extração manual com link.

### O que não fazer

- Não tentar passar pela verificação anti-robô do SCON nem da consulta processual.
- Não exibir partes, CNPJ ou advogados vindos das pautas ou do DataJud.
- Não contar o presidente do colegiado como voto quando o texto não disser que ele votou.

---

## 8. Modelo de dados mínimo (no estilo de `dados/esquema.json`)

Pasta proposta: `dados/stj/` (dono: coletor `scripts/coleta/stj`; votos conferidos: curadoria).

```json
{
  "ministro_stj": {
    "_arquivo": "dados/stj/ministros.json → { atualizado_em, fonte, itens: ministro_stj[] }",
    "id": "código de matrícula do STJ (cod_matriculamin), ex.: '0001194'; null se a fonte não trouxer",
    "nome": "nome completo como na página oficial",
    "nomes_nos_acordaos": ["grafias encontradas em documentos oficiais, ex.: 'Sérgio Kukina', 'Sergio Kukina'"],
    "cargo": "Presidente | Vice-Presidente | … | null",
    "em_exercicio": true,
    "periodos": [{ "orgao": "Primeira Seção | Primeira Turma | Corte Especial | …", "inicio": "AAAA-MM-DD|null", "fim": "AAAA-MM-DD|null", "presidente": false, "fonte": "fonte" }],
    "url_oficial": "https://www.stj.jus.br/web/verCurriculoMinistro?…",
    "fonte": "fonte"
  },
  "julgamento_stj": {
    "_arquivos": "índice: dados/stj/julgamentos/indice-<ano>.json; detalhe: dados/stj/julgamentos/<id>.json",
    "id": "kebab-case estável, ex.: stj-tema-1369 | stj-resp-2133933-2026-06-10",
    "tipo_precedente": "Tema Repetitivo | IAC | Relevância | Controvérsia | SIRDR | PUIL | Súmula | Acórdão | Decisão monocrática | null",
    "numero": "1369",
    "orgao": "Primeira Seção",
    "situacao": "texto da fonte, ex.: 'Acórdão Publicado'",
    "questao": "questaoSubmetidaAJulgamento (literal)",
    "tese": "teseFirmada (literal) | null",
    "assuntos": ["5946- ICMS/ Imposto sobre Circulação de Mercadorias"],
    "referencias_legislativas": ["LEG:FED LCP:000087 ANO:1996"],
    "datas": { "afetacao": "AAAA-MM-DD|null", "julgamento": "AAAA-MM-DD|null", "publicacao": "AAAA-MM-DD|null", "transito_em_julgado": "AAAA-MM-DD|null" },
    "processos": [{ "processo": "REsp 2133933", "numero_registro": "202401143008", "relator": "AFRÂNIO VILELA", "paradigma": true, "tribunal_origem": "TJDFT", "uf_origem": "DF" }],
    "sessoes": "votacao_stj[] — afetação, preliminar, mérito, embargos de declaração…",
    "relacionados": ["ids de decisões de dados/icms/ ligadas por norma citada"],
    "termos": ["tema repetitivo", "acórdão", "relator"],
    "fontes": ["fonte[]: Temas.csv, Processos.csv, espelho JSON, página do tema"],
    "lacunas": ["Ex.: 'UF do REsp 2150894 diverge: CSV RS × página oficial SC'"]
  },
  "votacao_stj": {
    "etapa": "afetacao | preliminar | merito | embargos | outro",
    "processo": "REsp 2133933",
    "data": "AAAA-MM-DD",
    "sessao_virtual": { "inicio": "AAAA-MM-DD", "fim": "AAAA-MM-DD" },
    "tipo": "colegiada | monocratica",
    "resultado_texto": "trecho literal do campo 'decisao' (ex.: 'por unanimidade, negar provimento ao recurso especial')",
    "unanimidade": "true | false | null (só com 'por unanimidade' ou 'por maioria' literal no texto)",
    "relator": "nome como no texto",
    "relator_acordao": "quem 'lavrará o acórdão', quando diferente; senão null",
    "presidente": "quem 'presidiu o julgamento', quando o texto disser; senão null",
    "votos": [{ "ministro_id": "…|null", "nome": "como no texto", "voto": "relator | acompanhou-relator | vencido", "observacao": "voto-vista | com acréscimo de fundamentação | Desembargador Convocado do TJMG | null" }],
    "ausentes": [{ "nome": "…", "motivo_texto": "Ausente, justificadamente | Não participaram do julgamento" }],
    "texto_integral": "campo 'decisao' completo, literal",
    "conferencia": "pendente | conferido (por quem e quando)",
    "fonte": "fonte (espelho JSON do mês ou TXT de íntegras + link do tema)"
  }
}
```

Regras adicionais propostas para `esquema.json`:
- `votos` só é preenchido a partir de nomes que aparecem literalmente no texto oficial. Um voto que o texto não nomeia **não existe** no registro. O placar não é calculado por dedução (ex.: "Seção tem 10, logo…").
- Uma decisão monocrática fica com `tipo: "monocratica"` e `votos: []`, e é exibida como ato individual.
- Uma votação nova aberta na rotina automática (`conferencia: "pendente"`) só é exibida depois de conferida.
- Datas do espelho em `AAAAMMDD` e `"DJEN DATA:03/07/2026"` são convertidas para ISO. O texto bruto é guardado em `fonte`.

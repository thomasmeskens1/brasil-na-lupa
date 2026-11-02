# Fontes oficiais do STF: avaliação técnica

Data dos testes: 02/11/2026. Todas as chamadas abaixo foram feitas de verdade nesta data. Trechos de resposta foram copiados e encurtados com "…".
Scripts e respostas brutas ficaram no scratchpad da sessão (`pesquisa-stf/`: `parse_todostemas.py`, `filtra_icms.py`, `jur_busca.py`, `resumo_sv.py`, `decisoes_aba.py`, `raw/`, `out/`).
Nada aqui foi deduzido. Quando algo não foi verificado, isso está escrito. O STJ é tratado por outro agente (`pesquisa-stj`); aqui ele só aparece no modelo de dados comum.

## Resumo

| Fonte | URL | Formato | API? | Atualização | Serve para |
|---|---|---|---|---|---|
| Lista de todos os temas de RG (repercussão geral) | `portal.stf.jus.br/jurisprudenciaRepercussao/todostemas.asp` | HTML (5 MB, uma página) | não; HTML estável e fácil de ler | não informada (tema 1498 já aparece) | número, título, descrição, assuntos, leading case + `incidente`, relator, situação, data da tese |
| Tese do tema | `…/jurisprudenciaRepercussao/verTeseTema.asp?numTema=N` | HTML **cp1252** | não | — | texto literal da tese |
| **Votação do Plenário Virtual** | `sistemas.stf.jus.br/repgeral/votacao?sessaoVirtual={incidente}` (e `?oi=`, `?tema=`) | **JSON** | sim (não documentada; é a usada pelo portal) | em tempo real | **voto de cada ministro** em sessão virtual: acompanha, diverge, ressalva, vista, destaque, suspeito, impedido, links dos votos em PDF |
| Abas do processo | `portal.stf.jus.br/processos/abaDecisoes.asp?incidente=` (e `abaAndamentos`, `abaPautas`, `abaSessao`…) | fragmento HTML | não | em tempo real | **certidão de julgamento** (texto oficial: unanimidade ou maioria, vencidos, tese, sessão) |
| Pesquisa de jurisprudência | `jurisprudencia.stf.jus.br/api/search/search` (POST) | JSON (Elasticsearch) | sim (não documentada; é a usada pelo site) | contínua (campo `dg_atualizado_em`) | acórdãos **já publicados**: ementa, ata/decisão, tese, relator, links do inteiro teor e do DJe; súmulas (inclusive vinculantes) |
| Corte Aberta: dados abertos | `transparencia.stf.jus.br/extensions/dados_abertos/dados_abertos.html` | XLSX/CSV gerados no navegador (Qlik Sense) + dicionários ODS | não há arquivo estático; o motor Qlik responde só dentro de um navegador | **diária** (apps recarregados em 02/11/2026 entre 09h11 e 12h03 UTC) | decisões de 2000 a 2026, RG (temas, andamentos, votos de admissibilidade), controle concentrado, Plenário Virtual, pautas, "Informação à sociedade" (placar, voto vencedor, votos divergentes) |
| Pauta (calendário, pautas temáticas) | `portal.stf.jus.br/pauta/services/*.asp` | JSON | sim (não documentada) | em tempo real | sessões virtuais e presenciais, pauta temática "ICMS" |
| Composição | `portal.stf.jus.br/textos/verTexto.asp?servico=bibliotecaConsultaProdutoBibliotecaPastaMinistro&pagina=ComposicaoAtual` e `…servico=sobreStfComposicaoTurma&pagina=principal` | HTML | não | manual (páginas datadas 18/10/2025 e 06/08/2026) | ministros, cargos e turmas |

Licença: **nenhuma das páginas testadas declara uma licença** de reutilização. O Programa Corte Aberta foi criado pela Resolução STF nº 774/2022 com o objetivo de "garantir que os dados da Corte sejam disponibilizados a todos os cidadãos". Licença formal: **não verificada**. Recomendação: citar o STF como fonte, com link e data de coleta (diretriz 2).

**robots.txt** de `portal.stf.jus.br`: `User-agent: * / Disallow: /processos`. As abas do processo (`/processos/aba*.asp`, `/processos/detalhe.asp`) estão nesse caminho. `sistemas.stf.jus.br/robots.txt` respondeu 403, `transparencia.stf.jus.br/robots.txt` respondeu 400 e `jurisprudencia.stf.jus.br/robots.txt` devolve a página do aplicativo (não existe). Ver a estratégia na seção 9.

Limites de acesso: cerca de 60 requisições espaçadas nos domínios `portal`, `sistemas` e `jurisprudencia`, sem nenhum bloqueio ou 429. O motor Qlik (`wss://transparencia.stf.jus.br/app/…`) **recusou com 403 (awselb)** a conexão feita fora do navegador (Node). No Chrome, dentro da página do painel, funcionou.

---

## 1. Corte Aberta: painéis e dados abertos

- Hotsite: `https://portal.stf.jus.br/hotsites/corteaberta/`, criado pela Resolução nº 774/2022 (`https://www.stf.jus.br/arquivo/djEletronico/DJE_20220510_090.pdf`).
- Painéis: `https://transparencia.stf.jus.br/extensions/corte_aberta/corte_aberta.html`, todos em Qlik Sense. Painéis encontrados em `qliksense.js`: acervo, decisões, repercussão geral, controle concentrado, recebidos/baixados, distribuídos, Covid-19, reclamações, taxa de provimento, omissão inconstitucional, pauta do Plenário, pauta das Turmas, Plenário Virtual, Informação à sociedade e dados abertos.
- **Página de dados abertos** (`…/extensions/dados_abertos/dados_abertos.html`): uma tabela com "Base | Descrição | xlsx | csv | Dicionário de dados". Os botões xlsx e csv **não são links para arquivos**. Eles chamam `data-qcmd="exportar_padrao"` / `exportar_objeto_tabela` e o Qlik gera o arquivo na hora. Os dicionários são ODS estáticos em `https://www.stf.jus.br/arquivo/cms/publicacaoBOInternet/anexo/link_download/dados_abertos/ods/dicionario_<Base>.ods`, todos baixados com sucesso (HTTP 200).

Bases oferecidas (texto da página):

| Grupo | Bases |
|---|---|
| Acervo | Processos; Partes |
| Decisões | 2000–2004 … 2020–2024; 2025; 2026 ("monocráticas e colegiadas") |
| Repercussão Geral | Temas ("desde a Emenda Regimental nº 21/2007"); Suspensão nacional; Representativo da controvérsia |
| Controle Concentrado (ADC, ADI, ADO, ADPF) | Acervo; Decisões; Processos; Legitimados; Amicus Curiae; Atos processuais |
| Recebidos, Baixados, Registrados e Distribuídos | por faixa de anos até 2026 |
| Plenário Virtual | Decisões; Tempo para decisão |
| Pautas | Pauta do Plenário; Pauta das Turmas |
| Outras | Ações Covid-19; Reclamações; Omissão inconstitucional; **Informação à sociedade – Julgados** |

Campos úteis, conforme os dicionários (exemplos copiados dos ODS):

- **Decisões 2026**: `idFatoDecisao`, `Processo`, `Relator atual`, `Relator decisão`, `Origem decisão` (1ª TURMA | 2ª TURMA | MONOCRÁTICA | PLENÁRIO VIRTUAL - RG | TRIBUNAL PLENO | TRIBUNAL PLENO - SESSÃO VIRTUAL), `Ambiente julgamento`, `Data da decisão`, `Tipo decisão`, `Andamento decisão` ("Agravo regimental não provido"), `Observação do andamento` (texto da certidão: "Decisão: O Tribunal, por unanimidade, negou provimento…"), `Assuntos do processo`.
- **RG – Temas**: `Número tema`, `Título tema`, `Descrição tema`, `Tese`, `Processo paradigma`, `Relator atual`, `Relator admissibilidade`, `Situação repercussão geral` (RG reconhecida – mérito julgado | … | RG negada – matéria infraconstitucional…), `Data admissibilidade RG`, `Data julgamento tema`, `Assunto`, `Decisão julgamento tema` (texto longo), `Link Processo`.
- **Controle Concentrado – Decisões**: `Processo`, `Data da decisão`, `Descrição` ("JULGAMENTO DO PLENO - PROCEDENTE"), `Andamento agrupado`, `Subgrupo` (Decisão Final | Liminar…), `Observação` ("O TRIBUNAL, POR MAIORIA, JULGOU PROCEDENTE… VEN[CIDO]…").
- **Plenário Virtual – Decisões**: processo, órgão julgador, relator, data, `Observação andamento` ("A Turma, por maioria, deu provimento…, vencidos os Ministros…"). **Não traz o voto de cada ministro.**
- **Pauta do Plenário**: classe, número, relator, sessão (presencial ou virtual), `Pedido Vista`, `Ministro Vista`, `Data Vista`, `Data Pauta`.
- **Informação à sociedade – Julgados** (178 registros; o mais recente é de 19/08/2026): `Processo`, `tema_rg`, `relator`, `votacao` (Unânime | Maioria), `placar` ("(10X1)", "7x4"), `voto_prevaleceu`, `votos_divergentes` (nomes), `fatos`, `questoes_juridicas`, `fundamentos_decisao`, `resultado`, `tese`, `link` (PDF do boletim). É **seleção editorial** ("julgamentos… de maior relevância, a partir de outubro de 2023"), não cobre todos os julgamentos.

Modelo interno lido pela API do Qlik, dentro do navegador (`getTablesAndKeys`):

| App (id de produção) | Tabelas (linhas) | Recarga |
|---|---|---|
| RG `d00163a8-…` | Tema 1498; **Julgamento 9818** (voto de cada ministro só na **admissibilidade**: questão constitucional, RG, reafirmação); Andamentos 132652; Texto 1476; Processo 1498 | 2026-11-02 09:12 UTC |
| Controle Concentrado `c47ea922-…` | DIM_PROCESSO 8716; FATO_OCORRENCIA_PROCESSO 193363; POLO_ATIVO/PASSIVO; AMICUS_CURIE; … | 2026-11-02 09:17 UTC |
| Plenário Virtual `ffe3adc6-…` | DECISOES_SGE 308543; JULGAMENTO_PV 142748; PARTES | 2026-11-02 12:00 UTC |
| Informação à sociedade `3a17c6b0-…` | LISTA_JULGADOS 178 | 2026-11-02 12:03 UTC |
| Decisões `023307ab-…` | FATO_DECISAO 3004016; DIM_PROCESSO 2266250 | 2026-11-02 09:11 UTC |

Dificuldades:
- Não há download estático nem API REST. O arquivo é gerado pelo Qlik no navegador, e o websocket do motor recusa clientes fora do navegador (403). Para automatizar seria preciso um navegador automatizado (Playwright) abrindo a página e usando a API JS do Qlik (`require(['js/qlik'])` → `openApp` → hipercubo), como foi feito neste teste. Isso funciona, mas é frágil: a sessão caiu ("Not connected") depois de abrir vários apps.
- Erro de chave observado em "Informação à sociedade": um registro "Pet 5.465" aponta para o boletim da Pet 13157 (PDF `Pet.13157ED…`). Deve ser guardado como veio, com anotação em `lacunas`.
- A base "Controle Concentrado – Processos" diz ser de processos "finalizados a partir de 2000", mas o campo `Assunto relacionado` registra **só o assunto principal**. A busca por "ICMS" nesse campo deixou de fora ADIs sobre ICMS cujo assunto principal é outro (ex.: ADI 7616, 7476, 6319). Para fazer recortes por tema, é melhor buscar no texto da decisão.

## 2. Repercussão Geral (RG)

**a) Lista completa: `https://portal.stf.jus.br/jurisprudenciaRepercussao/todostemas.asp`**
Uma única página HTML (UTF-8, 4,97 MB) com a tabela `#listagem-repercussao-geral`: Tema | Título | Leading Case | Relator | Situação Atual | Tese / Data Tese. Cada linha traz:
```
<a href="verAndamentoProcesso.asp?incidente=2549049&numeroProcesso=559937&classeProcesso=RE&numeroTema=1">0001</a>
… title="Recurso extraordinário em que se discute…"><strong>Ver Descrição</strong>
… title="10561-DIREITO TRIBUTÁRIO | … <br>10556-… | Exclusão - ICMS"><strong>Ver Assuntos</strong>
<a href="/processos/detalhe.asp?incidente=2549049">RE&nbsp;559937</a>   MIN. ELLEN GRACIE
<p class="text-success"><strong>Há repercussão geral</strong></p>21/03/2013 … Trânsito em Julgado
onclick="window.open('verTeseTema.asp?numTema=1', …)">21/03/2013
```
O parser (`parse_todostemas.py`) extraiu **1.498 temas**, do 1 ao 1498. Os temas novos (1497, 1498) vêm com título e descrição vazios e relator "MINISTRO PRESIDENTE Plenário Virtual"; ficam como lacuna.
O `incidente` é o identificador interno do processo e serve de chave para todas as outras fontes.

**b) Tese literal: `verTeseTema.asp?numTema=1266`.** HTML em **windows-1252**, enquanto `todostemas.asp` está em UTF-8. É preciso decodificar cada página com a codificação certa. Exemplo: "I - É Constitucional o art. 3º da Lei Complementar 190/2022…".

**c) Painel Qlik de RG**, que tem os mesmos dados e também `Decisão julgamento tema`. Ver a seção 1.

**d) Julgamento de mérito de um tema** (resultado e votos): usar o processo paradigma (`incidente`) nas fontes 3 e 4.

Limite: a coluna "Tese / Data Tese" traz a data da tese. Em temas de reafirmação de jurisprudência, essa data coincide com a do julgamento virtual. Exemplo: tema 1367, "Há repercussão geral com reafirmação de Jurisprudência 04/02/2025".

## 3. Plenário Virtual: voto de cada ministro (testado)

O portal monta a aba "Sessão virtual" com chamadas AJAX a `sistemas.stf.jus.br`. A resposta é JSON aberto, sem chave e sem cookie:

- `GET https://sistemas.stf.jus.br/repgeral/votacao?oi={incidente}` → lista os incidentes do processo (o principal e os recursos, ex.: "RE 1426271 ED").
- `GET https://sistemas.stf.jus.br/repgeral/votacao?sessaoVirtual={incidente}` → todas as **listas de julgamento** daquele incidente.
- `GET https://sistemas.stf.jus.br/repgeral/votacao?tema={n}` → votação da **admissibilidade** de RG (questão constitucional, RG, reafirmação), com o voto de cada ministro.

Teste real: **RE 1426271 (Tema 1266, DIFAL do ICMS), incidente 6590904.**
```
"listasJulgamento":[{ "id":220633, "nomeLista":"121-2025", "julgado":false,
  "ministroRelator":{"codigo":"50","descricao":"MIN. ALEXANDRE DE MORAES"},
  "votoRelator":{"link":"https://digital.stf.jus.br/decisoes-monocraticas/api/public/votos/418229/conteudo.pdf"},
  "sessao":{"numero":12,"ano":2025,"colegiado":{"codigo":"TP","descricao":"Plenário"},
            "dataInicio":"17/10/2025","dataFim":"21/10/2025","tipoSessao":{"descricao":"Sessão Ordinária"}},
  "votos":[
   {"ministro":{"codigo":"51","descricao":"MIN. NUNES MARQUES"},"dataVoto":"17/10/2025",
    "tipoVoto":{"codigo":"13","descricao":"Acompanho a ressalva"},"acompanhandoMinistro":{"codigo":"54","descricao":"MIN. FLÁVIO DINO"}, "textos":[…]},
   {"ministro":{"codigo":"42","descricao":"MIN. CÁRMEN LÚCIA"},"tipoVoto":{"codigo":"8","descricao":"Acompanho a divergência"},
    "acompanhandoMinistro":{"codigo":"49","descricao":"MIN. EDSON FACHIN"}},
   {"ministro":{"codigo":"49","descricao":"MIN. EDSON FACHIN"},"tipoVoto":{"codigo":"7","descricao":"Divirjo do relator"}}, …]}]
```
Tipos de voto vistos (`tipoVoto.codigo` e descrição): 7 "Divirjo do relator", 8 "Acompanho a divergência", 9 "Acompanho o relator", 10 "Acompanho o relator com ressalvas", 11 "Suspeito", 13 "Acompanho a ressalva". O script do portal (`/processos/listasJulgamento.js`) também trata "impedido", "vista" e "destaque". A lista traz ainda `ministroVista`, `ministroDestaque`, `textoDecisao`, o relatório e o voto do relator em PDF, e as sustentações orais. Cada ministro tem um **código estável** (36 Gilmar Mendes, 42 Cármen Lúcia, 44 Dias Toffoli, 45 Luiz Fux, 48 Luís Roberto Barroso, 49 Edson Fachin, 50 Alexandre de Moraes, 51 Nunes Marques, 52 André Mendonça, 53 Cristiano Zanin, 54 Flávio Dino).

Outros testes: RE 1426271 ED (incidente 7178355; 9 votos "Acompanho o relator"; relator fora da lista), ADI 7822 (7271290) e RE 1362742 (6317237).

**Problemas encontrados (importantes):**
1. **`julgado` não é confiável.** No RE 1426271 a lista final (sessão de 17 a 21/10/2025) vem com `"julgado": false`, mas a aba Decisões registra "22/10/2025 Julgado mérito de tema com repercussão geral". O mesmo acontece no RE 1362742.
2. **Votos repetidos em listas antigas.** Listas de sessões anteriores (ex.: sessão 23/2025, de 01 a 08/08/2025) mostram votos com `dataVoto` posterior (17/10/2025). Para atribuir votos, use só a **última lista** de cada incidente e confira o resultado com a certidão.
3. **Julgamento presencial não tem voto estruturado.** Quando há **destaque**, o processo sai do virtual e vai ao plenário físico. Exemplo: ADI 7822, destaque do Min. Luiz Fux na lista de 13/03/2026 e julgamento final presencial em 24/09/2026. O JSON fica com votos parciais de uma sessão que não terminou. Nesse caso, a única fonte do resultado é a **certidão** (seção 4), que diz quem ficou vencido, mas não traz o voto de cada ministro.
4. Votos de ministros que já saíram do tribunal aparecem com o nome deles (ex.: Barroso "Suspeito" no RE 1362742).

Conclusão: **é possível obter o voto de cada ministro de forma estruturada, mas só em sessão virtual**, e sempre conferindo com a certidão oficial.

**Pauta do Plenário Virtual** (JSON do portal):
- `GET /pauta/services/calendario-service.asp?dados=calendarios&mes=11&ano=2026` →
  `{"diasPresenciais":[4,5],"julgamentosVirtuais":[{"dataInicial":"06/11/2026","dataFinal":"13/11/2026","qtdProcessosPlenario":"91",…}]}`
- `GET /pauta/services/processo-service.asp?classe=ADI&numero=7822` → todas as passagens do processo pela pauta: `listaProcesso "764-2025"`, `idListaJulgamento`, `ambienteSessao "V"`, `situacaoProcessoSessao`, e o enquadramento na pauta temática `{"numero":"4","descricao":"ICMS"}`.
- `GET /pauta/services/pauta-service.asp?dados=pautas-tematicas` → 24 pautas temáticas, sendo a **nº 4 "ICMS"**. `…&dados=pauta-tematica&numero=4` → ADIs e REs de ICMS agrupados por subtema (substituição tributária, guerra fiscal…). Atenção: há relatores desatualizados (ex.: "MIN. ROSA WEBER", que já se aposentou). Serve como **lista de pendentes**, não como resultado.

## 4. Ações de controle concentrado (ADI, ADC, ADPF, ADO)

- **Andamento e decisões:** `https://portal.stf.jus.br/processos/abaDecisoes.asp?incidente={id}` (e `abaAndamentos.asp`). Devolve um fragmento HTML com data, tipo ("Procedente", "Julgado mérito de tema com repercussão geral"), órgão ("TRIBUNAL PLENO - SESSÃO VIRTUAL" ou "TRIBUNAL PLENO") e o texto da certidão. Exemplo real (ADI 7822, 24/09/2026):
  > "Decisão: (Julgamento conjunto ADIs 7.822, 7.830, 7.844 e 7.848) O Tribunal, por maioria, … julgou procedentes as ações diretas, para declarar inconstitucional o § 5º do art. 5º do Anexo I do Decreto estadual n. 45.490/2000, de São Paulo… Tudo nos termos do voto da Ministra Cármen Lúcia (Relatora), vencidos os Ministros Luiz Fux, André Mendonça e Nunes Marques. … Ausente, justificadamente, o Ministro Gilmar Mendes. … Plenário, 24.9.2026."
- Para descobrir o `incidente`, use `GET /processos/listarProcessos.asp?classe=ADI&numeroProcesso=3973`, que responde 302 para `detalhe.asp?incidente=2565571`.
- **Acórdão publicado** (ementa, ata, tese, inteiro teor, DJe): API de jurisprudência (seção 4.1).
- **Corte Aberta – Controle Concentrado**: decisões, legitimados, amici curiae e atos processuais, com recarga diária (seção 1).
- A certidão traz **unanimidade ou maioria, vencidos, relator, redator do acórdão, ausentes, impedidos e a sessão**, mas só como **texto livre**. Extrair esses itens por expressão regular funciona na maioria dos casos (`por (maioria|unanimidade)`, `vencid[oa]s? …`), mas falha em decisões com várias partes. Ex.: ADI 7373, unanimidade no mérito e maioria na modulação, "vencido o Ministro Edson Fachin". Por isso, a classificação final **exige curadoria**.

### 4.1 API de jurisprudência (`jurisprudencia.stf.jus.br`)
`POST https://jurisprudencia.stf.jus.br/api/search/search` com `Content-Type: application/json`, sem chave. O corpo é uma consulta **Elasticsearch** completa (copiada do site). A base é escolhida por `post_filter.term.base` (`acordaos`, `sumulas`, `decisoes`…). Exemplo usado:
```json
{"size":100,"from":0,
 "query":{"bool":{"filter":[{"query_string":{"default_operator":"AND","fields":["titulo","ementa_texto","decisao_texto","acordao_ata","documental_tese_texto","documental_indexacao_texto"],"query":"ICMS"}},
                            {"range":{"julgamento_data":{"gte":"2025-01-01"}}}]}},
 "post_filter":{"bool":{"must":[{"term":{"base":"acordaos"}}]}},
 "sort":[{"julgamento_data":"desc"}]}
```
Resultado: **685 acórdãos** com "ICMS" julgados desde 01/01/2025 (ARE 432, RE 170, Rcl 28, ADI 27, AR 17…). Campos: `titulo`, `julgamento_data`, `publicacao_data`, `relator_processo_nome`, `relator_acordao_nome`, `orgao_julgador`, `is_repercussao_geral_merito`, `documental_tese_tema_texto`, `documental_tese_texto`, `acordao_ata`, `ementa_texto`, `inteiro_teor_url`, `dje_url`, `acompanhamento_processual_url`, `externo_seq_objeto_incidente` (= `incidente`), `dg_atualizado_em`.
Limites: só aparecem acórdãos **já publicados**. Os temas 843 e 1113 e as ADIs 3973 e 7822 (julgados em set/out de 2026) ainda não estavam lá. O campo `julgamento_is_sessao_virtual` veio `null` em julgamentos virtuais (ex.: ADI 7476, "Sessão Virtual de 7.2.2025 a 14.2.2025"). Não use esse campo; use o texto da ata.

## 5. Súmulas vinculantes

Mesma API, filtro `titulo: vinculante` e `base: sumulas` → **63 súmulas vinculantes**. A mais recente: "Súmula vinculante 63 | julgamento 2025-09-26 | publicação 2025-10-01 | O tráfico privilegiado (art. 33, § 4º, da Lei 11.343/2006) não configura crime hediondo…". Campos: `sumula_numero`, `sumula_texto`, `situacao_sumula`, `is_vinculante`, `julgamento_data`, `publicacao_data`, `processo_precedente_texto`, `documental_legislacao_citada_texto`, `aprovacao_url`. Para SV 62 e SV 61, `publicacao_data` veio `null` e fica como lacuna. Também existe a página `https://portal.stf.jus.br/jurisprudencia/aplicacaosumula.asp`. A API **não traz** votação da proposta de súmula (PSV). Ela só pode ser vista no processo PSV (abas, seção 4), o que exige curadoria. Nenhuma súmula vinculante foi editada sobre ICMS no período 2025–2026; a busca encontrou apenas SV 62 (dez/2024, COFINS) e SV 63.

## 6. Composição atual

- Plenário (página "Composição Atual", atualizada em 2025-10-18): Edson Fachin (Presidente), Alexandre de Moraes (Vice-Presidente), Gilmar Mendes (Decano), Cármen Lúcia, Dias Toffoli, Luiz Fux, Nunes Marques, André Mendonça, Cristiano Zanin, Flávio Dino. **São 10 nomes.** A página não informa uma 11ª cadeira nem vaga; isso deve ficar como "Informação não disponível em fonte oficial" até ser verificado.
- Turmas (página atualizada em 2026-08-06): **Primeira Turma**: Flávio Dino (Presidente), Cármen Lúcia, Alexandre de Moraes, Cristiano Zanin. **Segunda Turma**: Luiz Fux (Presidente), Gilmar Mendes, Dias Toffoli, Nunes Marques, André Mendonça.
- Histórico de composições: `https://portal.stf.jus.br/ostf/plenario/composicao.asp` (link no menu; não foi testado).
- As páginas são HTML sem API, e a página `…MinistroApresentacao` monta o conteúdo por JS. As duas URLs acima respondem com o conteúdo completo via curl.
- O código do ministro (seção 3) é a chave estável. A tabela `MINISTRO_RELATOR` do Qlik (314 linhas) também tem ID, turma e sigla. A relação entre os dois códigos não foi verificada.

## 7. Recorte do piloto: ICMS julgado de 01/01/2025 a 02/11/2026

Como os casos foram achados: (a) os 1.498 temas filtrados por "ICMS" ou "Circulação de Mercadorias" em título, descrição ou assunto (83 temas), com data de 2025 ou 2026; (b) a API de acórdãos (classes ADI/ADC/ADO/ADPF e RE com mérito de RG); (c) o Qlik Decisões 2025–2026 (classes ADI/ADC/ADO/ADPF com "ICMS" na observação); (d) o Qlik Controle Concentrado (assunto principal); (e) o Qlik "Informação à sociedade". Os casos recentes foram conferidos na aba Decisões (certidão).
Nenhuma ADC, ADO ou ADPF sobre ICMS foi encontrada no período. Itens marcados "conferir" precisam de curadoria para confirmar se o ICMS é o tema central.

### 7.1 Repercussão geral: mérito julgado (ICMS central)

| Tema | Leading case (incidente) | Relator | Data | Resultado oficial (resumo literal) | Tese (início) |
|---|---|---|---|---|---|
| 1367 | RE 1490708 (6907815) | Min. Presidente (Barroso) | 03/02/2025 (virtual, reafirmação) | "por unanimidade… reafirmou a jurisprudência" | transferência entre estabelecimentos / modulação da ADC 49 |
| 1367 (ED) | RE 1490708 RG-ED (7171579) | Barroso (relator); redator Dias Toffoli | 25/08/2025 | "por maioria, acolheu os embargos… vencidos os Ministros Luís Roberto Barroso (Presidente e Relator), Alexandre de Moraes e Cármen Lúcia" | "A modulação dos efeitos estabelecida no julgamento da ADC nº 49/RN-ED não autoriza a cobrança do ICMS…" |
| 1383 | RE 1473645 (6816098) | Min. Presidente | 21/03/2025 (virtual) | "por unanimidade… Impedido o Ministro Luiz Fux" | anterioridade na redução de benefício fiscal |
| 1386 | RE 1506320 (6992177) | Min. Presidente | 11/04/2025 (virtual) | "por unanimidade… reafirmou" | depósito ao FOT (Rio de Janeiro) |
| 1266 | RE 1426271 (6590904) | Alexandre de Moraes | 22/10/2025 (sessão virtual extraordinária, 17 a 21/10/2025) | "por maioria… vencidos os Ministros Edson Fachin (Presidente) e Cármen Lúcia"; quanto à tese, "parcialmente vencidos o Ministro Alexandre de Moraes (Relator), apenas quanto ao item III…" | "I - É Constitucional o art. 3º da Lei Complementar 190/2022…" (DIFAL) |
| 1258 | RE 1362742 (6317237) | Dias Toffoli | 08/09/2026 (virtual, 28/08 a 04/09/2026) | "por maioria… vencidos os Ministros Alexandre de Moraes, Flávio Dino, Cármen Lúcia e Edson Fachin (Presidente)" | "O art. 155, § 2º, inciso X, alínea b… não enseja a anulação do crédito do ICMS…" |
| 1113 | RE 990115 (5035916) | Cristiano Zanin | 28/09/2026 (virtual, 18 a 25/09/2026) | "por maioria… vencidos os Ministros Flávio Dino e Gilmar Mendes" | "Não incide ICMS sobre a subvenção econômica… Subclasse Residencial Baixa Renda…" (recorrente: SIESP) |
| 843 | RE 835818 (4630911) | Marco Aurélio (relator); redator Edson Fachin | 07/10/2026 (**presencial**) | "por maioria… vencidos os Ministros Alexandre de Moraes, Gilmar Mendes, Nunes Marques e Luiz Fux" | "Surge incompatível… a inclusão, na base de cálculo da Cofins e da contribuição ao PIS, de créditos presumidos do… ICMS" |

Também ligados ao ICMS: Tema 1394 (RE 1542700), **RG negada** (questão infraconstitucional), 07/05/2025. Tema 1413 (RE 1554371, ICMS e responsabilidade de marketplace), **RG reconhecida em 09/08/2025, mérito pendente**.
Descartados por citarem ICMS só de passagem: Tema 816 (ISS), 1186 (CPRB), 1153 (IPVA), 1217 (juros municipais), 1415 (contribuição previdenciária).

### 7.2 Controle concentrado: decisão final (ICMS central ou citado na ementa)

| Ação (incidente) | Relator | Data | Votação (certidão/ata) | Objeto (da ementa/ata) |
|---|---|---|---|---|
| ADI 7616 (6888507) | Cristiano Zanin | 17/02/2025 | unanimidade; procedente em parte | Lei 18.665/2023 (CE), ICMS |
| ADI 7476 (6761946) | Alexandre de Moraes | 17/02/2025 | unanimidade; procedente | Lei 2.657/1996 (RJ), substituição tributária |
| ADI 6150 (5713043) | André Mendonça | 25/04/2025 | unanimidade; procedente | Lei 19.849/2019 (PR), parcelamento de ICMS e honorários |
| ADI 3837 ED-segundos (7061218) | Nunes Marques | 09/06/2025 | unanimidade | repasse de ICMS aos municípios |
| ADI 5635 ED-segundos (6853877) | Luís Roberto Barroso | 12/08/2025 | unanimidade; embargos rejeitados | FEEF e FOT (RJ) |
| ADI 4854 (4303620) | Nunes Marques | 25/08/2025 | unanimidade; improcedente | Lei 13.711/2011 (RS), devedor contumaz de ICMS |
| ADI 3929 (2541046) | Nunes Marques | 08/09/2025 | unanimidade; procedente | Resolução do Senado 7/2007, sobre as Leis de SP 7.003/1990 e 7.646/1991 (conferir) |
| ADI 7379 (6621618) e ED (7398738) | Gilmar Mendes | 22/09/2025 e 27/10/2025 | unanimidade; improcedente; ED rejeitados | Lei 17.649/2018 (SC), ICMS sobre telecomunicações |
| ADI 6250 (5810909) | Nunes Marques | 29/09/2025 | unanimidade; improcedente | art. 155, § 4º, I da Constituição (ICMS sobre petróleo) |
| ADI 6319 (5855990) | Cristiano Zanin | 02/12/2025 | unanimidade; procedente, com modulação | LC 631/2019 (MT), benefícios sem convênio do CONFAZ |
| ADI 5553 (5011612) e ADI 7755 (7103152), julgamento conjunto | Edson Fachin (relator); redator Cristiano Zanin | 18/12/2025 (presencial) | **maioria**; improcedentes; "vencidos os Ministros Edson Fachin… e Cármen Lúcia…, e os Ministros André Mendonça e Flávio Dino" | incentivos fiscais a agrotóxicos (ICMS e IPI) |
| ADI 7112 ED (6537586) | André Mendonça | 25/02/2026 | unanimidade; rejeitados | alíquotas de ICMS sobre energia e telecomunicações; embargos do Governador de SP |
| ADI 7634 (6909279) | Luiz Fux | 04/03/2026 | unanimidade; procedente | LC 210/2023 (RJ), adicional do FECP sobre comunicação |
| ADI 7716 (7034909) | Dias Toffoli | 04/03/2026 | unanimidade; improcedente | Lei 7.611/2004 (PB), adicional do FCP |
| ADI 7077 (6346293) e ED (7594894) | Flávio Dino | 04/03/2026 e 28/09/2026 | unanimidade | alíquotas de energia e comunicações (RJ), Tema 745 |
| ADI 7513 (6791695) | Cristiano Zanin | 09/03/2026 | unanimidade; improcedente | Lei 6.374/89 (interessado: Governador de SP), devedor contumaz |
| ADI 7816 (7254398) | Cristiano Zanin | 09/04/2026 | unanimidade; procedente em parte | Lei 4.731/2002 (SE), FECEP sobre telecomunicações |
| ADI 7630 (6900143) | Cármen Lúcia | 16/06/2026 | unanimidade; improcedente | "ICMS Educacional" (MG) |
| ADI 7632 (6907396) | André Mendonça | 29/06/2026 | unanimidade; improcedente | FECOEP (AL) sobre telecomunicações |
| ADI 7373 (6611522) | Nunes Marques | 29/06/2026 | unanimidade no mérito; maioria na modulação ("vencido o Ministro Edson Fachin") | LC 269/2022 (PI), benefício para cerveja com caju |
| ADI 7815 (7254397) e ED (7708266) | Cármen Lúcia | 15/09/2026 e 20/10/2026 | unanimidade | Lei 7.098/1998 (MT), FECEP sobre telecomunicações |
| ADI 7822 (7271290), 7830 (7286480), 7844 (7303474), 7848 (7320152), julgamento conjunto | Cármen Lúcia | 24/09/2026 (**presencial**) | **maioria**; "vencidos os Ministros Luiz Fux, André Mendonça e Nunes Marques"; tese "É inconstitucional ato unilateral de Estado Federado que revogue… benefícios… relativos a ICMS…" | **Decreto de SP 45.490/2000 (RICMS)**, alterado pelo Decreto 67.383/2022 |
| ADI 3973 (2565571) | Luiz Fux | 28/09/2026 (virtual, 18 a 25/09/2026) | **maioria**; procedente; "vencidos os Ministros Flávio Dino e Gilmar Mendes" | Convênio ICMS 60/2007 (CONFAZ), subvenção de energia |

Citam ICMS de passagem (conferir antes de incluir): ADI 5465 (Lei 14.946/2013 de SP, trabalho escravo e cassação da inscrição no ICMS; maioria, "vencido parcialmente o Ministro Dias Toffoli"; 09/04/2025), ADI 4065 (Lei Orgânica do DF, benefícios fiscais; 03/06/2025) e ADI 7894 (fundo de infraestrutura do PI; 16/03/2026).
Encerradas sem decisão de mérito (Qlik CC): ADI 7619 "Não conhecido(s)" (18/02/2025), ADI 7065 "Extinto o processo" (23/05/2025), ADI 7173 "Prejudicado" (10/12/2025).

Os links oficiais de cada item são `https://portal.stf.jus.br/processos/detalhe.asp?incidente={incidente}`. Para acórdãos publicados, use também `inteiro_teor_url` e `dje_url` da API (salvos em `out/icms_cc_rg_acordaos.json`).
Relevância direta para SP (o que a fonte diz): ADIs 7822/7830/7844/7848 (decreto de SP), ADI 7112 ED (embargos do Governador de SP), ADI 7513, ADI 3929 (leis de SP), Tema 1367 (RE contra acórdão do TJ-SP), Tema 1113 (recorrente SIESP).

## 8. O que é automatizável e o que exige curadoria

| Item | Automatizável? | Como |
|---|---|---|
| Lista de temas de RG, situação, relator, leading case, data | sim | `todostemas.asp` (parser pronto) |
| Tese literal do tema | sim | `verTeseTema.asp` (cp1252) |
| Acórdãos publicados (ementa, ata, tese, links) | sim | API de jurisprudência (POST) |
| Súmulas vinculantes | sim | API, `base: sumulas` |
| Pauta e calendário das sessões | sim | `pauta/services/*.asp` (JSON) |
| **Voto de cada ministro em sessão virtual** | sim, com conferência | `sistemas.stf.jus.br/repgeral/votacao?sessaoVirtual=` (última lista; ignorar `julgado`) |
| Certidão de julgamento (texto oficial do resultado) | sim (coleta) | `abaDecisoes.asp`, disponível no mesmo dia do julgamento |
| Unanimidade ou maioria e vencidos | **parcial** | regex na certidão; casos com várias partes (mérito × modulação × tese) exigem curadoria |
| Voto de cada ministro em sessão **presencial** | **não** | não há fonte estruturada; só a certidão (vencidos) e o vídeo/notas, que não são usados |
| Recorte temático (ICMS central × citação de passagem) | **curadoria** | a busca encontra candidatos; um curador confirma pela ementa |
| Bases da Corte Aberta (CSV/XLSX) | difícil | só por navegador automatizado com a API JS do Qlik; o websocket recusa clientes fora do navegador (403) |
| Composição | semi | HTML simples; mudanças são raras e devem ser revisadas manualmente |

## 9. Estratégia de coleta recomendada

1. **Rotina diária** (`scripts/coleta/stf`), na seguinte ordem:
   a. API de jurisprudência: acórdãos com `dg_atualizado_em` ou `publicacao_data` dos últimos N dias nas classes ADI/ADC/ADO/ADPF e RE/ARE com `is_repercussao_geral_merito`, mais as súmulas.
   b. `todostemas.asp`: comparar com o dia anterior e detectar mudança de situação ou tese.
   c. Para cada processo novo ou alterado, chamar `sistemas.stf.jus.br/repgeral/votacao?oi=` e `?sessaoVirtual=`, que dão os votos.
   d. Ler a certidão de julgamento na aba Decisões. Isso cobre julgamentos ainda sem acórdão, como os dos temas 843 e 1113.
2. **robots.txt**: `/processos` está em `Disallow`. Recomenda-se coletar as abas **só para os processos já selecionados** (dezenas por dia, não varredura), com User-Agent identificado e intervalo entre chamadas. Antes de colocar em produção, o orquestrador deve decidir se pede autorização ou orientação ao STF (Ouvidoria ou Corte Aberta). Fontes sem essa restrição: API de jurisprudência e `sistemas.stf.jus.br`.
3. **Curadoria** (agente `curadoria-stf`, que seria o dono de `dados/stf/`):
   - confirmar que o tema é ICMS (ou o tema do recorte);
   - classificar `votacao_tipo` e `vencidos` a partir da certidão, copiando os nomes literalmente;
   - em decisões com várias partes, registrar cada parte (mérito, tese, modulação) como uma votação separada;
   - se os votos do Plenário Virtual divergirem da certidão, prevalece a certidão e a divergência vai para `lacunas`.
4. Corte Aberta: usar como **conferência** (contagens e listas de decisões do ano), não como fonte principal, até existir download estático.
5. Ausência de dado: quando faltar voto individual (julgamento presencial), exibir "Informação não disponível em fonte oficial" para os votos e mostrar só o que a certidão diz (diretriz 5: voto individual só com registro oficial).

## 10. Modelo de dados mínimo (compatível com `dados/esquema.json`; comum a STF e STJ)

Proposta de pastas: `dados/stf/` e `dados/stj/`, com o mesmo formato:
```json
"julgamento": {
  "_arquivo": "dados/<tribunal>/julgamentos/<id>.json; índice dados/<tribunal>/julgamentos/indice-<ano>.json",
  "id": "stf-adi-7822-2026-09-24 (kebab-case estável)",
  "tribunal": "STF | STJ",
  "processo": { "classe": "ADI", "numero": "7822", "incidente": "7271290 (id oficial; no STJ, o registro do processo)", "url": "…detalhe.asp?incidente=7271290" },
  "processos_conjuntos": ["ADI 7830", "ADI 7844", "ADI 7848"],
  "tipo_precedente": "repercussao-geral | controle-concentrado | sumula-vinculante | recurso-repetitivo | sumula | outro",
  "tema": { "numero": 1266, "titulo": "…", "url": "…" },
  "orgao_julgador": "Tribunal Pleno | 1ª Turma | 2ª Turma | Corte Especial | Primeira Seção …",
  "ambiente": "virtual | presencial",
  "sessao": { "inicio": "AAAA-MM-DD", "fim": "AAAA-MM-DD", "lista": "764-2025|null" },
  "data_julgamento": "AAAA-MM-DD (data do andamento oficial)",
  "relator": { "ministro_id": "53", "nome": "Cristiano Zanin" },
  "redator_acordao": { "ministro_id": "…", "nome": "…" },
  "resultado": "texto curto como a fonte traz: Procedente | Improcedente | Procedente em parte | Provido …",
  "certidao": { "texto": "citação literal da decisão", "url": "…abaDecisoes / DJe" },
  "tese": { "texto": "literal", "url": "…" },
  "normas_julgadas": ["Decreto 45.490/2000 (SP), art. 5º, § 5º do Anexo I"],
  "votacoes": [
    {
      "parte": "mérito | tese | modulação | embargos",
      "tipo": "nominal | unanimidade-registrada | maioria-registrada",
      "vencidos": [{ "ministro_id": "45", "nome": "Luiz Fux" }],
      "ausentes": [], "impedidos": [], "suspeitos": [],
      "votos": [{ "ministro_id": "51", "nome": "Nunes Marques", "voto": "Acompanho a ressalva", "voto_codigo": "13",
                  "acompanha": "54", "data": "AAAA-MM-DD", "texto_url": "…conteudo.pdf" }],
      "votos_origem": "plenario-virtual | null",
      "placar": { "maioria": 6, "vencidos": 4 }
    }
  ],
  "decisoes_relacionadas": ["ids em dados/icms/decisoes.json (ex.: o decreto de SP julgado)"],
  "fontes": ["fonte[]"],
  "lacunas": ["Ex.: 'Voto individual não disponível em fonte oficial (julgamento presencial)'"]
}
"ministro": { "_arquivo": "dados/<tribunal>/ministros.json", "id": "código oficial (STF: 50)", "nome": "…", "cargo": "Presidente | Vice-Presidente | Decano | Ministro(a)", "turma": "1ª | 2ª", "em_exercicio": true, "url_oficial": "…" }
```
Regras propostas (seguem as diretrizes):
- `votos` só é preenchido quando a fonte é a votação do Plenário Virtual. Caso contrário, fica vazio e `lacunas` explica o motivo.
- `vencidos`, `ausentes` e `impedidos` vêm literalmente da certidão.
- `placar` só existe quando contado de `votos` ou declarado na fonte (ex.: "(10X1)" em "Informação à sociedade"). Nunca é calculado como 11 − vencidos.
- No `decisao` atual do piloto ICMS, um julgamento entra com `caminho: "stf"` (novo valor), `instrumento: "Acórdão em ADI"` e `votacoes[].casa: "stf"` + `votacao_ref` = id do julgamento. O enum `votacoes.tipo` precisa ganhar `maioria-registrada`, o que é uma decisão do orquestrador.
- No STJ, o mesmo formato serve para recursos repetitivos (tema, tese, órgão = seção), mas a fonte de votos será diferente; ver o relatório do `pesquisa-stj`.

## 11. Pendências não verificadas
- Licença formal dos dados do STF.
- Se existe ministro nomeado para a 11ª cadeira (a página oficial lista 10 nomes).
- Página de histórico de composições (`/ostf/plenario/composicao.asp`).
- Se `sistemas.stf.jus.br/repgeral/votacao` tem limite de taxa (nenhum foi observado em cerca de 10 chamadas).
- ADI 3929: se as leis de SP citadas tratam de ICMS (a ementa cita ICMS 2 vezes; é preciso ler o inteiro teor).

# Fontes oficiais federais: avaliação técnica

Data dos testes: 02/11/2026 (todas as chamadas abaixo foram feitas de verdade nesta data; trechos de resposta copiados e encurtados com "…").
Scripts e respostas brutas ficaram no scratchpad da sessão (`pesquisa-fontes-federais/`). Nenhum dado aqui foi deduzido: quando um item não foi verificado, isso está escrito.

Resumo rápido:

| Fonte | Chave? | Formato | Facilidade | Observação principal |
|---|---|---|---|---|
| Câmara: API v2 | não | JSON/XML | fácil | votos nominais, orientações e presença completos; arquivos anuais (bulk) atualizados toda madrugada |
| Câmara: cota parlamentar | não | CSV em ZIP | fácil | o endpoint da API veio **vazio** em 2026; usar o ZIP anual |
| Senado: API Dados Abertos | não | JSON/XML/CSV | média | `/votacao` (novo) tem voto por senador; vários serviços antigos foram **desativados em 01/02/2026** |
| Congresso: vetos | não | JSON/XML | difícil | votos de sessão conjunta trazem só **nome + UF + partido truncado**, sem código do parlamentar |
| Congresso: MPs | não | JSON | fácil | `processo?sigla=MPV` (Senado) e `proposicoes?siglaTipo=MPV` (Câmara) |
| Planalto (ccivil_03) | não | HTML/PDF | difícil | única fonte da **exposição de motivos**; sem API, HTML da era FrontPage; exige User-Agent completo |
| DOU (in.gov.br) | não | HTML com JSON embutido / XML em ZIP | média | página `leiturajornal` traz JSON com o texto de cada ato do dia |
| INLABS (Imprensa Nacional) | cadastro gratuito | XML + PDF | média | estava em "Manutenção Programada" no dia do teste |
| LexML | — | — | bloqueado | desafio JavaScript anti-robô (página "Verificação de segurança — Senado Federal") |
| Senado: legislação (normas) | não | JSON | fácil | lista leis do ano, publicação no DOU e vetos vinculados |
| Portal da Transparência (CGU) | **sim** na API; não no download | JSON / CSV em ZIP | fácil (via ZIP) | autor da emenda vem por **nome** e código próprio, não pelo ID da Câmara/Senado |

---

## 1. Câmara dos Deputados — API de Dados Abertos v2

- **URL base:** `https://dadosabertos.camara.leg.br/api/v2`
- **Documentação:** OpenAPI em `https://dadosabertos.camara.leg.br/api/v2/api-docs` (versão "0.4.347 - 10/26/2026"), 78 caminhos.
- **Formato:** JSON (cabeçalho `Accept: application/json`) ou XML. Listas vêm em `{"dados":[…],"links":[self,next,first,last]}`.
- **Chave:** não precisa.
- **Paginação:** `pagina` + `itens`. A documentação diz "por padrão 15 itens, limite de 100". Testado: `proposicoes?itens=150` devolveu 100; `deputados?itens=500` devolveu 500 (o limite não vale para todos os endpoints). O total vem no cabeçalho `x-total-count` (ex.: 513 deputados; 1.767 proposições apresentadas em out/2026).
- **Limites:** 25 requisições seguidas, uma depois da outra, sem nenhum 429. Não há cabeçalho de limite de taxa; as respostas trazem `retry-after: 30` e `cache-control: public, max-age=1800` (30 min).
- **Restrição importante:** `/votacoes` aceita no máximo 3 meses entre `dataInicio` e `dataFim`:
  `{"status":400,"detail":"A diferença entre as datas não pode ser maior que 3 meses"}`
- **Licença/termos:** o OpenAPI não declara licença (`info.license` = nulo). O texto diz que a versão "é ainda incompleta, sujeita a mudanças". Licença formal: **não verificada**. São dados públicos divulgados pela própria Câmara; citar a Câmara como fonte com link e data.
- **Instabilidade observada:** `GET /deputados/204501/despesas` sem filtro deu `upstream request timeout`; com `ano=2026` ou `ano=2025` voltou `x-total-count: 0` para 3 deputados diferentes, embora o ZIP de 2026 tenha 120.750 lançamentos. **Não usar a API para despesas.**

### Endpoints úteis (chamadas reais)

**Deputados**
```
GET /deputados?itens=2&ordem=ASC&ordenarPor=nome
{"dados":[{"id":204379,"nome":"Acácio Favacho","siglaPartido":"MDB","siglaUf":"AP","idLegislatura":57,
 "urlFoto":"https://www.camara.leg.br/internet/deputado/bandep/204379.jpg","email":"dep.acaciofavacho@camara.leg.br"},…]}
```
Detalhe: `/deputados/{id}`; histórico de partido/mandato: `/deputados/{id}/historico`; frentes: `/deputados/{id}/frentes`.

**Votações por data (e por órgão)**
```
GET /votacoes?dataInicio=2026-09-01&dataFim=2026-10-31&idOrgao=180&itens=200   (180 = Plenário; 96 votações)
GET /votacoes?dataInicio=2026-10-01&dataFim=2026-10-31&ordem=DESC&ordenarPor=dataHoraRegistro
{"id":"2620905-56","data":"2026-10-28","siglaOrgao":"PLEN","proposicaoObjeto":null,
 "descricao":"Aprovada a Redação Final, assinada pela relatora, Dep. Benedita da Silva (PT/RJ).","aprovacao":1}
```
- O `id` da votação é `{idProposição}-{sequência}`.
- Na lista, `proposicaoObjeto` costuma vir `null`. O vínculo confiável fica em `/votacoes/{id}` (`objetosPossiveis`, `ultimaApresentacaoProposicao`) ou no arquivo anual `votacoesProposicoes`.
- O placar só existe **dentro do texto** de `descricao` ("Sim: 252; Não: 176; Total: 428."). Para contar, use os votos individuais.

**Votação nominal: votos de cada deputado**
```
GET /votacoes/2236186-60/votos      (PLP 281/2019, 14/10/2026)  → 429 votos, numa única página
{"tipoVoto":"Sim","dataRegistroVoto":"2026-10-14T20:52:43",
 "deputado_":{"id":220588,"nome":"Roberto Duarte","siglaPartido":"REPUBLICANOS","siglaUf":"AC","idLegislatura":57,…}}
```
Votação simbólica: `GET /votacoes/2620905-56/votos` → `{"dados":[]}`. Isso combina com a diretriz 5: uma lista vazia quer dizer **simbólica**, e não se atribui voto a ninguém.

**Orientação de bancada**
```
GET /votacoes/2236186-60/orientacoes
{"orientacaoVoto":"Não","codTipoLideranca":"B","siglaPartidoBloco":"Governo"},
{"orientacaoVoto":"Sim","codTipoLideranca":"P","siglaPartidoBloco":"NOVO","codPartidoBloco":37901},
{"orientacaoVoto":"","codTipoLideranca":"B","siglaPartidoBloco":"Oposição"} …
```
`orientacaoVoto` vazio quer dizer que não houve orientação. Mostrar "sem orientação registrada", sem interpretar.

**Proposições**
```
GET /proposicoes?siglaTipo=PLP&numero=281&ano=2019        → id 2236186
GET /proposicoes/2236186
{"siglaTipo":"PLP","numero":281,"ano":2019,"ementa":"Dispõe sobre os regimes de resolução…",
 "statusProposicao":{"dataHora":"2026-10-15T00:00","siglaOrgao":"CCP","regime":"Urgência (Art. 155, RICD)",
   "descricaoSituacao":"Aguardando Deliberação",…},
 "keywords":"Diretrizes, Regime de Resolução, …",
 "urlInteiroTeor":"https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=1851535",
 "texto":null,"justificativa":null}
GET /proposicoes/2236186/autores   → {"nome":"Poder Executivo","tipo":"Órgão do Poder Executivo","proponente":1}
GET /proposicoes/2236186/temas     → {"codTema":40,"tema":"Economia"}, {"codTema":70,"tema":"Finanças Públicas e Orçamento"} …
GET /proposicoes/2236186/tramitacoes → 39 itens (sequencia, dataHora, siglaOrgao, despacho, descricaoSituacao)
GET /proposicoes/2236186/votacoes  → 12 votações
GET /proposicoes/{id}/relacionadas → pareceres (RRL), emendas (EMC), documentos
```
- **Justificativa:** os campos `justificativa` e `texto` vêm **sempre nulos** (testado em PLP 281/2019 e PL 5704/2026). A justificativa do autor só existe **dentro do PDF** do inteiro teor (`urlInteiroTeor`, `content-type: application/pdf`). No PL 5704/2026 o texto extraído do PDF traz "… Art. 12. Esta Lei entra em vigor … **JUSTIFICAÇÃO** A presente proposição institui …". Dá para separar pelo título "JUSTIFICAÇÃO", que é padronizado.
- Para MPV, o inteiro teor da Câmara é a **página do DOU** (o PDF começa com "Seção 1 … Nº 193, terça-feira, 13 de outubro de 2026") e **não inclui a exposição de motivos**. Ela fica no Planalto (seção 4).

**Presença em plenário**
```
GET /eventos/83057            → "Sessão Deliberativa Extraordinária Semipresencial", 14/10/2026, situacao "Encerrada"
GET /eventos/83057/deputados  → 502 deputados
```
Arquivo anual `eventosPresencaDeputados-2026.csv` (colunas `idEvento;uriEvento;dataHoraInicio;idDeputado;uriDeputado`). **Não verificado:** se a lista do evento distingue "presente" de "convocado". O campo não existe; tratar como "registrado no evento", conforme o nome do arquivo oficial ("Presença").

### Arquivos em massa (bulk), por ano: testados com HEAD em 02/11/2026

Todos com `last-modified` na madrugada de 02/11/2026, ou seja, **regerados diariamente**:

| Arquivo | Tamanho | Last-Modified (GMT) |
|---|---|---|
| `https://dadosabertos.camara.leg.br/arquivos/votacoes/json/votacoes-2026.json` | 8,5 MB | 06:54 |
| `…/arquivos/votacoesVotos/csv/votacoesVotos-2026.csv` | 17,6 MB | 07:03 |
| `…/arquivos/votacoesOrientacoes/csv/votacoesOrientacoes-2026.csv` | 0,45 MB | 07:04 |
| `…/arquivos/votacoesProposicoes/csv/votacoesProposicoes-2026.csv` | 2,9 MB | 08:24 |
| `…/arquivos/proposicoes/json/proposicoes-2026.json` | 74 MB | 04:32 |
| `…/arquivos/proposicoesAutores/csv/proposicoesAutores-2026.csv` | 14,9 MB | 05:36 |
| `…/arquivos/proposicoesTemas/csv/proposicoesTemas-2026.csv` | 3,1 MB | 05:24 |
| `…/arquivos/eventosPresencaDeputados/csv/eventosPresencaDeputados-2026.csv` | 9,7 MB | 03:45 |
| `…/arquivos/deputados/json/deputados.json` | 3,6 MB | 04:00 |
| `https://www.camara.leg.br/cotas/Ano-2026.csv.zip` (cota parlamentar) | 4,5 MB (46 MB descompactado) | 10:16 |

Padrão de URL: `/arquivos/{conjunto}/{csv|json|xml|xlsx|ods}/{conjunto}-{ano}.{ext}`. CSV separado por `;`, aspas, UTF-8 com BOM.
Cabeçalho de `votacoesVotos`: `"idVotacao";"uriVotacao";"dataHoraVoto";"voto";"deputado_id";…;"deputado_siglaPartido";…;"deputado_siglaUf"`.
O arquivo traz o **partido do deputado no momento do voto**, o que é importante quando alguém troca de partido.

**Cota parlamentar (CEAP):** `Ano-2026.csv` tem 120.750 linhas; último `datEmissao` = 2026-10-29. Colunas: `txNomeParlamentar; cpf; ideCadastro; … txtDescricao; txtFornecedor; txtCNPJCPF; datEmissao; vlrDocumento; vlrGlosa; vlrLiquido; numMes; numAno; … nuDeputadoId; ideDocumento; urlDocumento`.
Dificuldades: (a) a coluna `cpf` deve ser **descartada na coleta** (diretriz 12: só dados do exercício da função); (b) há linhas de lideranças (ex.: "LIDERANÇA DO GOVERNO NA CÂMARA") sem deputado; (c) a codificação parece não ser UTF-8, já que os acentos saíram corrompidos na leitura como UTF-8. Testar `latin-1`/`cp1252` antes de importar; (d) `urlDocumento` aponta para o PDF da nota (`…/cota-parlamentar/documentos/publ/2812/2026/8044688.pdf`).

---

## 2. Senado Federal — Dados Abertos Legislativos

- **URL base:** `https://legis.senado.leg.br/dadosabertos`
- **Documentação:** OpenAPI 3.1 em `https://legis.senado.leg.br/dadosabertos/v3/api-docs` (157 caminhos). Diz: "API de acesso público, sem necessidade de autenticação".
- **Formato:** cabeçalho `Accept: application/json` ou sufixo `.json`/`.xml`/`.csv`. **Duas gerações convivem:** a nova (JSON "plano", ex.: `/votacao`, `/processo`) e a antiga (JSON espelho do XML, com `noNamespaceSchemaLocation`/`Metadados`). Alguns endereços `.json` respondem 301 para `/dadosabertos/dados/…json` (arquivo estático); é preciso seguir o redirecionamento (`curl -L`).
- **Limites (texto oficial):** "Mais de 10 requisições por segundo estão sujeitas a receber o erro HTTP 429". Pede para evitar horários redondos (00:00, 01:15 …). Em picos, 503. Cache das respostas: `max-age=900` (15 min).
- **Depreciação:** muitos serviços antigos trazem `"Descontinuacao":{"DataDepreciacao":"2025-03-18","DataDesativacaoCompleta":"2026-02-01","UrlServicoSubstituto":…}`, inclusive `plenario/lista/votacao/{ini}/{fim}`, `materia/atualizadas`, `senador/{codigo}/votacoes` e `materia/votacoes/{codigo}`. Ainda respondem, mas **não devem ser usados**.
- **Licença:** o OpenAPI não declara licença nem termos (`license`/`termsOfService` nulos). **Não verificado.**

### Endpoints úteis (chamadas reais)

**Senadores em exercício**
```
GET /senador/lista/atual.json
{"ListaParlamentarEmExercicio":{"Parlamentares":{"Parlamentar":[{"IdentificacaoParlamentar":{"CodigoParlamentar":"5672",
 "NomeParlamentar":"Alan Rick","SiglaPartidoParlamentar":"REPUBLICANOS","UfParlamentar":"AC",
 "Bloco":{"NomeBloco":"Bloco Parlamentar Aliança"},…},"Mandato":{…}}…
```
Também: `/senador/{codigo}`, `/senador/{codigo}/mandatos`, `/filiacoes`, `/licencas`, `/senador/afastados`.

**Votações nominais com voto de cada senador (serviço novo)**
```
GET /votacao?dataInicio=2026-10-01&dataFim=2026-10-31        → 3 votações (62 no ano até 31/10)
[{"identificacao":"PEC 221/2019","idProcesso":9056435,"codigoMateria":174386,"dataSessao":"2026-10-14",
  "descricaoVotacao":"Votação nominal da Proposta de Emenda à Constituição nº 221, de 2019, em primeiro turno.",
  "resultadoVotacao":"A","votacaoSecreta":"N","sequencialVotacao":4420,
  "totalVotosSim":null,"totalVotosNao":null,
  "informeLegislativo":{"texto":"… Proposta aprovada em 1º turno (Sim: 75; Não: 1; Presidente: 1; Total: 77). …"},
  "votos":[{"codigoParlamentar":5672,"nomeParlamentar":"Alan Rick","siglaPartidoParlamentar":"REPUBLICANOS",
            "siglaUFParlamentar":"AC","siglaVotoParlamentar":"Sim"},…81 itens]}]
```
- Só há votações **nominais**. As simbólicas aparecem apenas no texto da tramitação.
- Os campos `totalVotos*` vieram **nulos**. O placar oficial está em `informeLegislativo.texto` ou em `orientacaoBancada` (`qtdVotosSim: 75, qtdVotosNao: 1`).
- Códigos de voto encontrados: `Sim`, `Não`, `P-NRV`, `Presidente (art. 51 RISF)`, `AP`, `LS`, `NCom`. A tabela oficial de significados está em `GET /plenario/lista/tiposComparecimento` (ex.: `AP` = "Atividade parlamentar", `AUS` = "Comunicação de ausência", `L2` = "Licença saúde"). Mostrar sempre a **descrição oficial**, nunca a sigla.
- Votação secreta (`votacaoSecreta: "S"`): não há voto individual, e o site não pode atribuir voto.
- Filtros: `idProcesso`, `sigla/numero/ano`, `codigoParlamentar`, `codigoSessao`.

**Orientação de bancada no Senado**
```
GET /plenario/votacao/orientacaoBancada/20261014
{"votacoes":[{"codigoVotacaoSve":13340,"sequencialVotacao":4420,"siglaTipoMateria":"PEC","numeroMateria":221,
  "qtdVotosSim":75,"qtdVotosNao":1,"qtdVotosAbstencao":0,"quorumFinal":78,"presidenteSessao":"Davi Alcolumbre",
  "orientacoesLideranca":[{"dataHora":"2026-10-14T21:48:22","partido":"B.Feminina","voto":"SIM"},
                          {"partido":"MDB","voto":"SIM"},…],"votosParlamentar":[…],"votosLideranca":[…]}]}
```
Ligação com `/votacao` pelo campo `sequencialVotacao` (4420 nos dois). Também existe por período: `/plenario/votacao/orientacaoBancada/{ini}/{fim}`.

**Processos (matérias) — serviço novo**
```
GET /processo/9056435
{"identificacao":"PEC 221/2019","apelido":"Fim da escala 6x1","situacaoAtual":"TRANSFORMADA EM NORMA JURÍDICA",
 "autoriaIniciativa":[{"autor":"Reginaldo Lopes","siglaPartido":"PT","siglaEnte":"CD",…}],
 "classificacoes":[{"descricaoHierarquia":"Política Social / Trabalho e Emprego / Jornada de Trabalho"}],
 "deliberacao":{"data":"2026-10-14","tipoDeliberacao":"Aprovada pelo Plenário","destino":"À promulgação"},
 "normaGerada":{"tipo":"Emenda Constitucional Numerada","numero":141,"dataAssinatura":"2026-10-16",
   "veiculoPublicacao":"[Diário Oficial da União - Edição Extra  de 16/10/2026] (p. 2, col. 2)"},…}
GET /processo?sigla=PL&dataInicioApresentacao=2026-10-01&dataFimApresentacao=2026-10-31   → 60 processos
GET /processo?numdias=2      → processos atualizados nos últimos 2 dias (máx. 30) — base da coleta incremental
```
Atenção: o parâmetro `dataInicioUltimaAtualizacao` **não existe** e é ignorado sem erro (devolveu 10.943 processos, desde 1949). Para coleta incremental use `numdias`; o retorno traz `dataUltimaAtualizacao` e `ultimaInformacaoAtualizada` (ex.: `"EVENTO_LEGISLATIVO"`).

**Documentos, pareceres, emendas e texto (justificação)**
```
GET /processo/documento?idProcesso=9056435   → 52 documentos
 tipos: EMENDA 37, REQUERIMENTO 4, LISTAGEM_RELATORIO 3, RELATORIO 2, PARECER 2, PROPOSTA_EMENDA_CONSTITUICAO 1, AVULSO_INICIAL 1 …
 {"siglaTipo":"PARECER","identificacao":"P.S 59/2026 - CCJ",
  "descricao":"Da COMISSÃO DE CONSTITUIÇÃO, JUSTIÇA E CIDADANIA, sobre a Proposta de Emenda à C…",
  "urlDocumento":"https://legis.senado.leg.br/sdleg-getter/dadosabertos/documento/d400a810-…"}
```
- Pareceres de comissão e de plenário ("Parecer nº 207, de 2026-Plen/SF, por meio de notas taquigráficas") vêm com autor e link do PDF.
- A justificação do autor fica no PDF do documento iniciador ou no `AVULSO_INICIAL`; não há campo estruturado (mesma situação da Câmara).
- Também: `/processo/emenda`, `/processo/relatoria`, `/processo/prazo`.

**Votações em comissão:** `/votacaoComissao/comissao/CCJ?dataInicio=20261001&dataFim=20261031` respondeu 200 **sem nenhuma votação** no período. Não houve como confirmar o formato com dados reais.

---

## 3. Congresso Nacional — vetos, sessões conjuntas e MPs

O Congresso não tem API própria: tudo passa pela **mesma API do Senado** (`casa` = `CN`).

**Vetos**
```
GET /materia/vetos/2026.json  (301 → /dadosabertos/dados/ListaVetosAnoCN2026.json)
{"Veto":[{"Codigo":"18769","Materia":{"Sigla":"VET","Numero":"55","Ano":"2026","EmTramitacao":"Sim",
  "Ementa":"Veto parcial aposto ao Projeto de Lei nº 2.951, de 2024, …"},
  "MateriaVetada":{"Sigla":"PL","Numero":"2951","Ano":"2024", "NormaGerada":{…}},…}]}
GET /processo?sigla=VET&ano=2026 → 55 vetos: 37 "SOBRESTANDO A PAUTA DO CONGRESSO NACIONAL", 17 "PRONTO PARA DELIBERAÇÃO DO PLENÁRIO", 1 "INCLUÍDA EM ORDEM DO DIA"
```
**Resultado de veto, com razões e votos:**
```
GET /plenario/resultado/veto/17570.json     (VET 29/2025 – licenciamento ambiental)
 "Mensagem":{"Numero":"1097","Ano":"2025","UrlPlanalto":"https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/Msg/Vep/VEP-1097-25.htm"},
 "PdfsResultadoVotacao":[{"URL":"https://legis.senado.leg.br/siscon/api/portalcn/pdfResultadoNominalDestaque/1757",
                          "Descricao":"Resultado dos destaques da Sessão Conjunta em 27/11/2025"}],
 "Dispositivos":[59 itens: {"Codigo":"46051","Descricao":"inciso XXXV do \"caput\" do art. 3º",
   "RazaoVeto":"A proposição legislativa contraria o interesse público e incorre em vício de inc…",
   "Situacao":"Rejeitado","PossuiVotos":"Sim","TipoVotacao":"Painel","DataSessao":"2025-11-27"}]
GET /plenario/resultado/veto/dispositivo/46051.json
 "Votacao":{"Sessao":"SESSÃO CONJUNTA Nº 026 - 27/11/2025",
   "Camara":{"Voto":[464 itens {"NomeParlamentar":"Adail Filho","PartidoParlamentar":"Republican","UfParlamentar":"AM","TipoVoto":"Não"}]},
   "Senado":{"Voto":[69 itens {"NomeParlamentar":"Alan Rick","PartidoParlamentar":"Republican","UfParlamentar":"AC","TipoVoto":"Não"}]}}
```
- **Vantagem:** a razão do veto de **cada dispositivo** (`RazaoVeto`) vem estruturada, e é a justificativa oficial do Executivo. O link da mensagem de veto no Planalto também vem pronto.
- **Dificuldade:** os votos não trazem o **código do parlamentar**, só nome, UF e partido **truncado** ("Republican"). É preciso ligar ao cadastro por (nome parlamentar normalizado + UF + Casa + data da sessão), com conferência manual para homônimos. Quando a ligação for ambígua, não atribuir o voto: exibir "Informação não disponível em fonte oficial".
- `/plenario/resultado/veto/{codigo}` deu 404 ("O recurso socilicitado não existe") para códigos que não existem (18500, 18400). `/plenario/resultado/veto/materia/{codigoMateriaVetada}` deu 404 para 166424; o caminho por código do veto é o que funciona.

**Sessões conjuntas:** `GET /plenario/agenda/cn/20260901/20261031.json` lista as sessões (ex.: 13/10/2026, "SESSÃO SOLENE", `CodigoSessao` 588625, "Encerrada"). `GET /plenario/resultado/cn/{data}` traz o resultado dos itens de pauta. Para 01/10/2026 veio só o cabeçalho, porque não houve sessão. O caminho `sessao/lista/CN/…` não existe (404).

**Medidas provisórias**
```
Senado/CN: GET /processo?sigla=MPV&ano=2026 → 66 MPVs
 {"apelido":"Crédito Extraordinário - Ações de proteção e defesa civil…","autoria":"Presidência da República",
  "casaIdentificadora":"CN","dataDeliberacao":"2026-06-01","dataUltimaAtualizacao":"2026-10-14T17:53:26.545",…}
Câmara:    GET /proposicoes?siglaTipo=MPV&ano=2026&ordem=DESC&ordenarPor=id
 2648616 MPV 1398 "Abre crédito extraordinário, em favor do Ministério da Integração…" — situação "Pronta para Pauta"
 GET /proposicoes/{id}/relacionadas → RRL (parecer da comissão mista), EMC (emendas), DOC
```
Prazos constitucionais da MP: `/processo/prazo?idProcesso=…` (endpoint existe no OpenAPI; não testado com dados).

---

## 4. Presidência (Planalto) e Diário Oficial da União

### 4.1 Planalto — `https://www.planalto.gov.br/ccivil_03/`
- **Sem API e sem arquivo estruturado.** HTML estático gerado por "Microsoft FrontPage 6.0", com `charset=iso8859-1` em parte das páginas.
- **Exige User-Agent completo.** Com `User-Agent: Mozilla/5.0` a conexão foi derrubada (`schannel: recv returned error 56`, HTTP 000). Com `Mozilla/5.0 (Windows NT 10.0; Win64; x64)` as páginas responderam 200. A raiz `https://www.planalto.gov.br/` às vezes devolve só 1,7 KB, e `legislacao.presidencia.gov.br` respondeu "SEI indisponível temporariamente".
- Padrões de URL confirmados (200):
  - Lei: `/ccivil_03/_ato2023-2026/2026/lei/L15526.htm`
  - MP: `/ccivil_03/_ato2023-2026/2026/mpv/mpv1396.htm` (atenção à caixa: `2025/Mpv/mpv1300.htm` e `2025/mpv/mpv1303.htm` funcionam os dois)
  - Mensagem de veto: `/ccivil_03/_ato2023-2026/2025/Msg/Vep/VEP-1097-25.htm`; na página da lei aparece `../msg/vep/vep-794-26.htm`
  - **Exposição de motivos:** link dentro da página da MP, ex.: `<a href="../exm/exm-mp-1396-26.pdf">Exposição de Motivos` → `/ccivil_03/_ato2023-2026/2026/exm/exm-mp-1396-26.pdf` (PDF, 351 KB). Na MP 1303/2025 aparece como `../Exm/Exm-1303-25.pdf`, ou seja, **o nome do arquivo não segue padrão fixo**.
- Conteúdo do PDF da EM (extraído com `pdftotext`): "EXM nº 2018/2026 — Brasília, 04 de setembro de 2026. Senhor Presidente da República, 1. Submetemos à consideração de Vossa Excelência a proposta de Medida Provisória que dispõe sobre a autenticação, a identificação e o bloqueio de chamadas telefônicas…". O PDF tem texto selecionável, sem necessidade de OCR (reconhecimento de imagem), e parágrafos numerados.

**Como obter a exposição de motivos de forma estruturada:** não existe fonte oficial estruturada. O caminho reproduzível é:
1. Descobrir o ato pelo Senado (`/processo?sigla=MPV`, `/legislacao/lista`) ou pela Câmara (`proposicoes?siglaTipo=MPV`).
2. Montar a URL da página do ato no Planalto (padrão acima).
3. Pegar o `href` do link cujo texto começa com "Exposição de Motivos".
4. Baixar o PDF e extrair o texto, guardando o PDF original (hash + data de coleta) e mostrando o link oficial.
5. Separar os parágrafos numerados ("1.", "2.", …), sem resumir.

Para PL do Executivo enviado à Câmara, a EM costuma vir junto da Mensagem no inteiro teor. **Não verificado** neste teste; o caso testado foi MPV, em que a Câmara guarda só a página do DOU.

### 4.2 DOU — página de leitura (`in.gov.br/leiturajornal`)
```
GET https://www.in.gov.br/leiturajornal?data=03-11-2025&secao=do1
 → HTML com <script id="params" type="application/json"> contendo "jsonArray": 411 atos
 chaves: artType, content, editionNumber, hierarchyStr, numberPage, pubDate, pubName, title, urlTitle …
 {"pubName":"DO1","urlTitle":"lei-n-15.247-de-31-de-outubro-de-2025-666156485","numberPage":"5",
  "title":"LEI Nº 15.247, DE 31 DE OUTUBRO DE 2025","pubDate":"03/11/2025",
  "content":"LEI Nº 15.247, DE 31 DE OUTUBRO DE 2025 Dispõe sobre o Compromisso Nacional Criança Alfabetizada …"}
```
- Seções: `do1`, `do2`, `do3`, edições extras `do1e`, `do1a`, `do1esp`… Em 30/10/2026 o `jsonArray` veio **vazio**; em 29/10/2026 veio com 338 atos. Repetir a coleta quando vier vazio.
- `artType` permite filtrar `Lei`, `Decreto numerado`, `Medida Provisória`, `Mensagem` (vetos). O link permanente é `https://www.in.gov.br/web/dou/-/{urlTitle}`.
- É HTML com JSON embutido, não uma API documentada, e pode mudar sem aviso.

### 4.3 DOU — base de dados XML (dados abertos)
- Página: `https://www.in.gov.br/acesso-a-informacao/dados-abertos/base-de-dados`. Diz que publica "em formato aberto XML … compactação … ZIP", organizado em Ano > Mês, com nomes `S01MMAAAA` (S01/S02/S03 = seção, mês, ano). Aviso na página: "**Excepcionamento para o mês de outubro de 2026** os arquivos serão atualizados diariamente", com sufixo `HHmmss` no nome. Fora disso, a publicação é **mensal**.
- Os links dos ZIPs são carregados por JavaScript (portal Liferay) e não apareceram no HTML. Também está no catálogo `dados.gov.br/dados/organizacoes/visualizar/imprensa-nacional-in`. **URL direta de download não verificada.**

### 4.4 INLABS — `https://inlabs.in.gov.br/`
- Pelo repositório oficial `github.com/Imprensa-Nacional/inlabs`: acesso "livre e gratuito desde 1º de janeiro de 2020" ao XML e PDF das edições completas, **somente dos últimos 4 meses**. Exige cadastro (login) e o repositório traz scripts de download automático.
- No dia do teste a página mostrava "**Manutenção Programada — Imprensa Nacional - INLABS**". O conteúdo do XML não foi verificado.

### 4.5 LexML — `https://www.lexml.gov.br/busca/SRU?...`
- O SRU (busca padronizada) respondeu HTML "Verificação de segurança — Senado Federal", com desafio JavaScript ("JavaScript is required"). **Inviável para coleta automática hoje.**
- `normas.leg.br/?urn=…` é uma aplicação web; `normas.leg.br/api/normas` deu 404.

### 4.6 Alternativa estruturada para normas: API do Senado (legislação)
```
GET /legislacao/lista?tipo=LEI&ano=2026   (96 KB)
 {"id":"44095919","tipo":"LEI-n","numero":"15526","normaNome":"Lei nº 15.526 de 29/09/2026",
  "ementa":"Altera a Lei nº 8.171, … para aperfeiçoar o marco legal do seguro rural.","dataassinatura":"29/09/2026"}
GET /legislacao/44095919
 "urlDocumento":"https://normas.leg.br/?urn=urn:lex:br:federal:lei:2026-09-29;15526",
 "publicacoes":[{"fonte":"Diário Oficial da União  de 30/09/2026","pagina":"2","coluna":"2"}],
 "vides":[{"nomeNormaPosterior":"Mensagem de Veto Parcial nº 794 de 29/09/2026","comentario":"Veto",
           "itens":{"item":[{"dispositivo":"Art. 6, caput, Inciso 3, Alínea d ","comentario":"Veto"}]}}…]
```
Traz o número, a data, a publicação no DOU, a URN LexML (identificador padronizado) e as **relações com outras normas** (veto, alteração, revogação). É a melhor fonte estruturada de "norma". O texto integral fica no Planalto ou no DOU.

---

## 5. Portal da Transparência (CGU) — emendas parlamentares

**API** (`https://api.portaldatransparencia.gov.br/api-de-dados/emendas?ano=2026&pagina=1`)
```
HTTP/1.1 401
{"Erro na API":"Chave de API não informada! Para obter a chave acesse http://www.portaldatransparencia.gov.br/api-de-dados/cadastrar-email"}
```
- **Precisa de chave** (cadastro por e-mail, enviada no cabeçalho `chave-api-dados`). Ela deve ficar como variável de ambiente na Vercel, nunca no repositório.
- Limite oficial: "No período de 6:00 às 23:59, o Portal aceita 400 requisições por minuto. Já no período das 00:00 às 5:59, são aceitas 700". O próprio portal recomenda: "Para acesso ao conjunto completo de dados … sugerimos utilizar as planilhas".

**Download em massa (sem chave)**: recomendado
```
GET https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares/UNICO
 → 302 → https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/emendas-parlamentares/EmendasParlamentares.zip
 32,5 MB, Last-Modified: Fri, 30 Oct 2026 04:48:48 GMT
 EmendasParlamentares.csv               47 MB   (emendas por ano: 2023 6.110 · 2024 6.990 · 2025 6.310 · 2026 5.776)
 EmendasParlamentares_Convenios.csv     26 MB
 EmendasParlamentares_PorFavorecido.csv 183 MB
```
Cabeçalho: `"Código da Emenda";"Ano da Emenda";"Tipo de Emenda";"Código do Autor da Emenda";"Nome do Autor da Emenda";"Número da emenda";"Localidade de aplicação do recurso";"Código Município IBGE";…;"Nome Função";…;"Valor Empenhado";"Valor Liquidado";"Valor Pago";…`
- Codificação **latin-1**, separador `;`, decimal com vírgula ("1450000,00").
- **Dificuldade:** o autor vem como **nome em maiúsculas** ("ANA PAULA LIMA", "CARLOS PORTINHO") ou bancada ("BANCADA DE TOCANTINS"), com código próprio da CGU, **sem ID da Câmara ou do Senado**. Exige uma tabela de equivalência curada (nome + cargo + ano), com revisão manual dos casos ambíguos. Há registros antigos "Sem informação".
- Frequência: o `Last-Modified` indica atualização periódica (o último arquivo era de 30/10). A periodicidade oficial está na página "Origem e atualização" e **não foi confirmada**.

---

## 6. Estratégia de coleta recomendada

Princípio: **arquivo em massa para a carga inicial e a reconciliação; API para o incremental do dia; HTML/PDF só onde não houver alternativa** (Planalto, DOU). Toda resposta bruta é guardada (com data de coleta, URL e hash) antes de virar dado, para cumprir as diretrizes 2 e 13.

Execução: um job agendado diário (GitHub Actions ou Vercel Cron) que grava JSON versionado no repositório ou num banco, e o site lê os dados já processados. Horário sugerido: **entre 08h30 e 09h00 de Brasília, com minutos "quebrados"** (ex.: 08:37). Os arquivos da Câmara ficam prontos por volta de 05:30 (horário de Brasília), e o Senado pede para evitar horários redondos.

| Etapa | Fonte | Frequência | Como |
|---|---|---|---|
| Parlamentares | Câmara `deputados.json` (bulk) + Senado `/senador/lista/atual` e `/senador/afastados` | diária | substitui o cadastro inteiro; guarda histórico de partido |
| Votações e votos da Câmara | bulk `votacoes-{ano}.json`, `votacoesVotos-{ano}.csv`, `votacoesOrientacoes-{ano}.csv`, `votacoesProposicoes-{ano}.csv` | diária | baixa o ano corrente inteiro (≈30 MB), compara por `idVotacao`; nas 2 primeiras semanas de janeiro, baixa também o ano anterior |
| Dia corrente da Câmara (opcional) | API `/votacoes?dataInicio=hoje-3&dataFim=hoje` + `/votacoes/{id}/votos` | diária / sob demanda | só para cobrir o intervalo antes do bulk; o bulk prevalece |
| Proposições da Câmara | bulk `proposicoes-{ano}.json` (+ autores, temas); `/proposicoes/{id}` e `/tramitacoes` só para as que tiveram votação ou mudança | diária | justificativa: baixa o PDF de `urlInteiroTeor` uma vez e extrai o trecho após "JUSTIFICAÇÃO" |
| Presença da Câmara | bulk `eventosPresencaDeputados-{ano}.csv` | diária | — |
| Cota parlamentar | `cotas/Ano-{ano}.csv.zip` | diária | descarta a coluna `cpf` na leitura |
| Senado: processos | `/processo?numdias=2` (com folga) → `/processo/{id}` + `/processo/documento?idProcesso=` | diária | `numdias` vai até 30, o que permite recuperar falhas de até 30 dias |
| Senado: votos | `/votacao?dataInicio=hoje-7&dataFim=hoje` + `/plenario/votacao/orientacaoBancada/{ini}/{fim}` | diária | ligação pelo `sequencialVotacao`; reconciliação mensal com o ano inteiro |
| Vetos (CN) | `/processo?sigla=VET&ano=` + `/materia/vetos/{ano}` → `/plenario/resultado/veto/{codigo}` → `/dispositivo/{codigo}` | diária (lista) / quando `Situacao` mudar | voto ligado por nome + UF + Casa, com fila de revisão manual |
| MPs | `/processo?sigla=MPV&ano=` (Senado) + Câmara `siglaTipo=MPV` | diária | ao surgir MP nova, busca a página no Planalto e o PDF da EM |
| Normas | Senado `/legislacao/lista?tipo=LEI&ano=` (e DEC, MPV, EMC) + DOU `leiturajornal` (do1, do1e) do dia | diária | o DOU dá o texto e a data de publicação; o Senado dá as relações (vetos, alterações) |
| Exposição de motivos e razões de veto | Planalto (HTML/PDF) | quando surgir MP, PL do Executivo ou veto novo | User-Agent completo, 1 requisição/s, nova tentativa em caso de erro; guarda o PDF |
| Emendas parlamentares | ZIP da CGU | semanal (ou diária comparando `Last-Modified`) | só baixa quando o `Last-Modified` mudar |

Boas práticas comuns: `If-Modified-Since`/HEAD antes de baixar arquivos grandes; no máximo 2–5 requisições/s por fonte; espera crescente entre tentativas em 429/503/timeout; seguir 301; registrar falhas; nunca preencher lacunas (sem dado oficial = "Informação não disponível em fonte oficial").

---

## 7. Modelo de dados mínimo

Convenções: toda entidade carrega `fonte_url`, `fonte_orgao` e `coletado_em`; IDs oficiais são preservados e nunca recriados; texto oficial é guardado literalmente.

```ts
// Parlamentar — uma linha por pessoa por Casa
Parlamentar {
  id: string                 // "camara:204379" | "senado:5672"
  casa: "CD" | "SF"
  id_oficial: string         // Câmara: id; Senado: CodigoParlamentar
  nome_parlamentar: string   // nome de urna/parlamentar
  nome_civil?: string
  uf: string
  foto_url?: string
  filiacoes: { partido: string; inicio?: string; fim?: string }[]  // Senado /filiacoes; Câmara /historico
  em_exercicio: boolean
  fonte_url; coletado_em
}

// Proposição — PL, PLP, PEC, MPV, PDL, VET …
Proposicao {
  id: string                 // "camara:2236186" | "senado:9056435"
  casa: "CD" | "SF" | "CN"
  sigla_tipo: string; numero: number; ano: number
  ementa: string
  apelido?: string           // Senado "apelido" (ex.: "Fim da escala 6x1")
  autores: { tipo: "parlamentar"|"orgao"; parlamentar_id?: string; nome: string; proponente: boolean }[]
  temas: string[]            // Câmara /temas; Senado classificacoes.descricaoHierarquia
  situacao_atual: string; situacao_data: string
  inteiro_teor_url?: string
  equivalentes: string[]     // mesma matéria na outra Casa (Senado traz identificacaoProcessoInicial)
  norma_gerada_id?: string
  fonte_url; coletado_em
}

Tramitacao { proposicao_id; sequencia; data_hora; orgao; descricao; despacho; fonte_url }

// Votação — uma deliberação registrada
Votacao {
  id: string                 // "camara:2236186-60" | "senado:4420" | "cn:veto-dispositivo:46051"
  casa: "CD" | "SF" | "CN"
  orgao: string              // PLEN, CCJ …
  data_hora: string
  proposicao_id?: string     // objeto votado (quando a fonte informa)
  descricao_oficial: string  // texto literal
  modo: "nominal" | "simbolica" | "secreta"   // Câmara: votos vazios = simbólica; Senado: votacaoSecreta
  resultado: string          // literal ("Aprovada…", "A", "Rejeitado")
  placar?: { sim: number; nao: number; abstencao?: number; outros?: Record<string, number>;
             origem: "contagem_votos" | "texto_oficial" }
  orientacoes: { bancada: string; orientacao: string | null }[]
  fonte_url; coletado_em
}

// Voto — só existe se a votação for nominal
Voto {
  votacao_id; parlamentar_id: string | null   // null quando a ligação por nome for ambígua (vetos CN)
  nome_na_fonte: string; partido_na_fonte: string; uf_na_fonte: string
  voto_codigo: string        // literal: "Sim", "Não", "AP", "P-NRV" …
  voto_descricao: string     // descrição oficial (tiposComparecimento) — exibida ao leitor
  registrado_em?: string
}

Presenca { evento_id; casa; data; parlamentar_id; fonte_url }   // Câmara eventosPresencaDeputados

// Norma — lei, LC, EC, decreto, MP publicada
Norma {
  id: string                 // URN LexML: "urn:lex:br:federal:lei:2026-09-29;15526"
  tipo: string; numero: string; data_assinatura: string
  ementa: string
  publicacao: { veiculo: "DOU"; data: string; edicao?: string; pagina?: string; url?: string }[]
  texto_url: string          // Planalto ccivil_03 ou in.gov.br/web/dou/-/{urlTitle}
  origem_proposicao_id?: string
  relacoes: { tipo: "veto"|"altera"|"revoga"|"regulamenta"; norma_id: string; dispositivo?: string }[]
  fonte_url; coletado_em
}

// Justificativa — texto oficial das razões de quem decidiu ou propôs
Justificativa {
  id; alvo: { tipo: "proposicao"|"norma"|"veto_dispositivo"|"votacao"; id: string }
  tipo: "justificacao_autor" | "exposicao_motivos" | "razoes_veto" | "parecer" | "voto_em_separado" | "declaracao_voto"
  autor: string              // ex.: "Poder Executivo", "Dep. Fulano", "CCJ/SF"
  documento: string          // ex.: "EXM nº 2018/2026", "P.S 59/2026 - CCJ", "MSG 1097/2025"
  data?: string
  texto: string              // literal, extraído do documento; nunca resumido nesta camada
  documento_url: string      // PDF/HTML oficial
  documento_sha256: string
  coletado_em
}

EmendaParlamentar { codigo_emenda; ano; tipo; autor_nome_fonte; autor_codigo_cgu; parlamentar_id?: string;
  funcao; subfuncao; programa; acao; localidade; valor_empenhado; valor_liquidado; valor_pago; fonte_url; coletado_em }

DespesaCota { parlamentar_id; ano; mes; tipo_despesa; fornecedor; cnpj_cpf_fornecedor; data_emissao;
  valor_documento; valor_glosa; valor_liquido; documento_url; fonte_url; coletado_em }   // sem CPF do deputado
```

---

## 8. Dificuldades e riscos, em ordem de impacto

1. **Justificativas não são estruturadas** em nenhuma das fontes. Câmara e Senado: no PDF do inteiro teor ou do avulso (seção "JUSTIFICAÇÃO"). Executivo: PDF da EM no Planalto, com nome de arquivo variável. Exceção boa: as **razões de veto por dispositivo** vêm estruturadas no CN (`RazaoVeto`).
2. **Votos de vetos sem ID de parlamentar**, com partido truncado. Exige ligação por nome + UF e fila de revisão manual.
3. **Planalto frágil:** sem API, HTML legado em ISO-8859-1, corte de conexão com User-Agent curto, links com caixa variável.
4. **Senado em migração:** serviços antigos desativados oficialmente em 01/02/2026, mas ainda respondendo; parâmetros desconhecidos são ignorados sem erro (risco de achar que filtrou); totais nulos em `/votacao`.
5. **LexML bloqueado** por desafio anti-robô; **INLABS** em manutenção no dia; links do XML do DOU só via JavaScript.
6. **Câmara:** limite de 3 meses em `/votacoes`; `proposicaoObjeto` costuma vir nulo; endpoint de despesas vazio ou com timeout (usar o ZIP); a CEAP traz CPF (descartar).
7. **Emendas (CGU):** autor sem ID oficial das Casas; latin-1; API com chave (evitável com o ZIP).
8. **Licenças:** nenhuma das APIs testadas declara licença no próprio metadado. Antes de publicar, confirmar os termos nas páginas institucionais. Até lá, atribuir sempre a fonte com link e data.

## Correções posteriores (02/11/2026, coletor da Câmara)

- O CSV da Cota para o Exercício da Atividade Parlamentar (`Ano-<ano>.csv.zip`) é UTF-8 com BOM, não latin-1.
- Desde agosto de 2025 o arquivo em massa da cota não traz os lançamentos "PASSAGEM AÉREA - SIGEPA"; o total por deputado fica abaixo do exibido na página oficial (`/cota-parlamentar/sumarizado`), que é coletada à parte e exibida como total oficial.
- A presença em Plenário não sai só do arquivo em massa (`eventosPresencaDeputados` registra apenas presenças): a frequência diária com ausências e ausências justificadas vem do serviço oficial `SitCamaraWS ListarPresencasDia`.

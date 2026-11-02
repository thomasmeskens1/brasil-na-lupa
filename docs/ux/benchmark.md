# Benchmark de UX/UI: produtos cívicos e de transparência

Projeto: **Placar do Poder** (antigo "Voto em Quem").
Pesquisa feita em 2026-11-02. Todas as datas de acesso abaixo são 2026-11-02.
Objetivo: aumentar a adesão do público, principalmente no celular, sem ferir as `diretrizes.md`: neutralidade, fonte oficial em tudo, nenhum juízo de valor, mesmo tratamento para todos, LGPD.

Problemas apontados pelo usuário e que orientam o estudo:

1. o site atual parece "zero user friendly";
2. fora do período eleitoral, o brasileiro se envolve pouco com política;
3. cartões titulados por sigla ("PL 3467/2025") não chamam atenção. O título precisa dizer **o que muda na vida da pessoa**, sem perder a neutralidade nem inventar nada.

---

## 1. Método e limites

- Páginas visitadas diretamente, com robots.txt conferido antes. Onde o robots.txt **bloqueia o nosso agente** (GovTrack, Vote Smart e Parltrack bloqueiam `ClaudeBot`), as páginas não foram visitadas. As informações sobre esses sites vêm de fontes secundárias (Wikipédia, imprensa, páginas dos próprios mantenedores em outros domínios), indicadas como tal.
- Alguns sites recusaram o acesso: TheyWorkForYou (HTTP 503), Portal da Transparência (HTTP 405) e a lista de votações do OpenParliament (HTTP 403). Nenhum bloqueio foi contornado. Nesses casos foram usados os blogs e os comunicados oficiais dos mantenedores.
- Números de audiência só aparecem quando há fonte, com o ano informado. Nenhum foi estimado.
- As APIs de dados abertos da Câmara e do Senado foram consultadas diretamente para responder se existem resumos oficiais em linguagem simples (seção 4).

### Contexto Brasil: celular primeiro

- **60% dos usuários de internet no Brasil acessaram a rede apenas pelo celular** (TIC Domicílios 2024, Cetic.br). Resumo executivo: https://cetic.br/media/docs/publicacoes/2/20250512115624/tic_domicilios_2024_resumo_executivo.pdf ; tabela C16A: https://www.cetic.br/en/tics/domicilios/2024/individuos/C16A/ (acesso em 2026-11-02).
- Segundo reportagens sobre a mesma pesquisa (reportagem, não fonte primária), esse uso exclusivo pelo celular é muito maior nas classes D e E e no Nordeste (75%) e no Norte (72%). Exemplo: https://convergenciadigital.com.br/internet/em-20-anos-brasil-trocou-lan-house-pelo-celular (acesso em 2026-11-02).
- Consequência para o projeto: páginas leves, legíveis sem zoom e que funcionem com plano de dados limitado. O compartilhamento por aplicativo de mensagem é o principal canal de chegada de novos leitores (inferência de design, não um dado medido).

---

## 2. Tabela comparativa

Legenda da coluna "Visita": **D** = página visitada diretamente; **S** = só fontes secundárias (robots.txt bloqueia ou o site recusou o acesso).

### 2.1 Proposta, público e navegação

| Produto | Quem mantém | Proposta e público | Navegação no celular (o que se observou) | Visita |
|---|---|---|---|---|
| **Infoleg** (app da Câmara) | Câmara dos Deputados | Atividade legislativa para público geral e profissionais: deputados, agenda, proposições, sessões ao vivo | App nativo. Seções por agenda, deputados e proposições. Busca por tipo, número e ano | D: https://www2.camara.leg.br/aplicativos/ |
| **App "Câmara dos Deputados"** | Câmara | Notícias legislativas "mais fáceis de entender". O usuário escolhe temas (Meio Ambiente, Educação, Economia) | Personalização por tema. A própria página diz que "uma inteligência artificial resume as propostas" | D: mesma URL |
| **Orçamento Aberto** (Infoleg Orçamento) | Câmara | Execução das emendas parlamentares | Busca por nome do parlamentar ou partido | D: mesma URL; https://www2.camara.leg.br/infoleg/aplicativo/orcamento |
| **Portal da Câmara**, lista de deputados | Câmara | Busca de deputados | Filtros por Nome, Partido, UF, Legislatura e Sexo | D: https://www.camara.leg.br/deputados/quem-sao |
| **App Senado Digital** e portal do Senado | Senado Federal | Sessões, votações e proposições, com notificações push | Página de votação por matéria (ver 2.2) | D: https://www12.senado.leg.br/institucional/appsenadodigital ; https://www25.senado.leg.br/web/atividade/materias/-/materia/129049/votacoes |
| **Portal da Transparência** | CGU (Controladoria-Geral da União) | Gastos do governo federal. Desde jan/2026, emendas "desde a indicação até o pagamento", sem cadastro | Painéis interativos, mapas, gráficos por UF e por área | S (HTTP 405): https://agenciagov.ebc.com.br/noticias/202601/governo-do-brasil-lanca-servico-para-que-o-cidadao-acompanhe-emendas-parlamentares |
| **Radar do Congresso** | Congresso em Foco (imprensa) | Perfis com presença, votações, gastos, discursos, processos e "índice de governismo" | Não documentado | D (2021): https://www.congressoemfoco.com.br/congresso-em-foco/radar-do-congresso-ja-tem-mais-de-320-mil-acessos/ |
| **Basômetro** | Estadão Dados (imprensa) | Taxa de "governismo" por parlamentar | Gráfico de pontos coloridos por partido. Não confirmamos se ainda é atualizado | S (reportagens) |
| **Ranking dos Políticos** | Organização da sociedade civil | Nota e ranking de parlamentares | Não avaliado (fora do modelo neutro) | S: https://www.infomoney.com.br/?p=237907 |
| **Operação Serenata de Amor / Rosie** e **Querido Diário** | Open Knowledge Brasil | Rosie: robô que aponta suspeitas na cota parlamentar. Querido Diário: busca em diários oficiais municipais (cerca de 350 cidades) | Busca de texto completo, com o trecho destacado e download em PDF ou TXT | S: https://docs.queridodiario.ok.org.br/en/latest/what-is-it.html ; https://tictec.mysociety.org/empowering-citizens-how-querido-diario-is-making-brazilian-city-policies-accessible/ |
| **GovTrack.us** (EUA) | Civic Impulse, LLC | Acompanhar o Congresso: projetos, votos e perfis | Não visitado | S: https://en.wikipedia.org/wiki/GovTrack ; https://www.patreon.com/govtrack/posts/govtrack-marks-114642637 |
| **TheyWorkForYou** (Reino Unido) | mySociety | "Como votou seu deputado": discursos e votos. Público geral e ONGs | Busca por CEP (postcode). Perfis redesenhados em 2025, que, segundo a mySociety, "work better on mobile" | S (HTTP 503): https://www.mysociety.org/2025/10/23/theyworkforyou-update-a-richer-view-of-parliament/ |
| **ProPublica Represent** (EUA) | ProPublica | Votos e perfis do Congresso (2016–2024) | **Descontinuado**. Resta um arquivo de jul/2024 | D: https://projects.propublica.org/represent/ |
| **abgeordnetenwatch.de** (Alemanha) | Parlamentwatch e.V. | Perguntas públicas a parlamentares, votações nominais, comissões e rendas extras | Menu "Politiker:innen suchen", "Parlamente" e subpáginas Abgeordnete, Fragen & Antworten, Abstimmungen | D: https://www.abgeordnetenwatch.de/bundestag |
| **OpenParliament.ca** (Canadá) | Voluntários, com apoio da Open North | Debates (Hansard), projetos e votos | "Find your MP" por CEP. A home mostra a última sessão e os votos recentes ("Passed/Failed"). Rodapé: "This is not a government site." | D: https://openparliament.ca/ |
| **Vote Smart** (EUA) | ONG apartidária | Perfis de candidatos, votos, finanças, discursos, questionário, avaliações de grupos de interesse | Não visitado | S: https://en.wikipedia.org/wiki/Vote_Smart |
| **Parltrack** (UE) | Projeto aberto (AGPL, ODbL) | Acompanhar processos legislativos do Parlamento Europeu e eurodeputados | Não visitado | S: https://directory.civictech.guide/listing/parltrack |

### 2.2 Como apresentam votação, perfil, gasto e fontes; engajamento e linguagem

| Produto | Votação | Perfil | Gasto | Fontes | Engajamento | Linguagem |
|---|---|---|---|---|---|---|
| Senado (portal) | Placar com "Votos sim", "Votos não", "Abstenções", "Presidente", "Impedidos" e "Total (Presentes)". Mapas "Por nome", "Por partido" e "Por UF". Tabela Parlamentar / Voto / **Obs.**, que traz o motivo oficial da ausência ("art. 43, I - Licença saúde", "Não Compareceu"). Botão "Exportar CSV" | — | — | É a própria fonte. Lista de votação nominal em arquivo | Push no app | Técnica, com artigos do Regimento |
| Infoleg / Câmara | Sessões ao vivo com contagem de presença. Ficha de tramitação | Contatos, agenda, liderança, frentes | Orçamento Aberto (emendas) | É a própria fonte. A ficha liga a notícias da Agência Câmara | Notificação de sessões e reuniões escolhidas | Técnica no Infoleg. "Simples" no app geral, mas feita por IA |
| Portal da Transparência | — | — | Emendas "da indicação ao pagamento". Mapas e comparação por UF e área | Dados abertos, API (376,5 milhões de consultas em 2024, segundo a CGU) | Sem cadastro | Administrativa |
| Radar / Basômetro | Voto "a favor ou contra o governo" e índice de governismo | Presença, votos, gastos, discursos, processos | Gastos parlamentares | Dados da Câmara e do Senado | — | Jornalística |
| GovTrack | Páginas de votação. Votos perdidos ("missed votes", com explicações vindas da ProPublica) | Histórico de votos, presença comparada aos pares, ideologia. "Report cards" com ranking, quatro deles **retirados em jul/2024** por não serem confiáveis | — | Vários tipos de resumo: CRS, conferência partidária e equipe própria | Alertas por e-mail personalizados, "trackers" por projeto, calendário de comissões | Resumos quinzenais em "plain language" (Patreon) |
| TheyWorkForYou | Agrupa votos em "policy lines" ("Assisted Dying", "Publicly Owned Railways") | Frases como "generally voted for" e "always voted against". Compara com o partido (divergência = divisão mais extrema que 60/40). Desde 2025, discursos próximos ao voto e anotações | — | Links para o Hansard. Formulário para reportar erro | Alertas por e-mail de deputado, palavra-chave ou votos, a partir do CEP | Simples. A redação das policies é debatida em público no GitHub "to expunge any bias" |
| abgeordnetenwatch | Só votações nominais. Ja / Nein / Enthaltung / **"Nicht abgestimmt"**. Perfil mostra "Dafür gestimmt" ou "Dagegen gestimmt" | Fotos, partido, perguntas e respostas, rendas extras. Estatística de resposta por bancada ("antwortranking") | Rendas extras | Glossário "ABC" com fontes. Open Data/API | Newsletter "Keine Abstimmung mehr verpassen", botão "Benachrichtigen", perguntar ao deputado, cartazes compartilháveis (#wahrplakat) | Glossário claro e neutro (https://www.abgeordnetenwatch.de/node/4907) |
| OpenParliament | Lista numerada com "Passed/Failed" | Por CEP | — | Links para debates por data e orador | Alertas (rodapé). Resumo de debate gerado por computador, com aviso de que "may contain errors or fabrications" | Simples. Destaque "word of the day" |
| Vote Smart | Histórico de votos | Biografia, "Political Courage Test" (respostas caíram de 72% em 1996 para 20% em 2016), avaliações de grupos de interesse | Finanças de campanha | Agregados | VoteEasy (comparar a própria posição com a de candidatos) | Simples |
| Parltrack | Por processo (dossier) | Processos e emendas por eurodeputado | — | Coleta diária em várias fontes do Parlamento Europeu. Base completa em JSON | Alertas por **e-mail ou RSS** por processo | Técnica |

### 2.3 Audiência (somente números com fonte)

| Produto | Número | Fonte (acesso em 2026-11-02) |
|---|---|---|
| Portal da Transparência | 28.579.831 acessos, 17,7 milhões de usuários e cerca de 200 milhões de páginas vistas em 2024, recorde desde 2004 | CGU, publicado em 17/01/2025: https://www.gov.br/cgu/pt-br/assuntos/noticias/2024/12/portal-da-transparencia-registra-o-maior-numero-acessos-da-historia-em-2024 |
| abgeordnetenwatch.de | "über 4,6 Mio. Menschen" em 2025; 4,3 milhões em 2024; taxa de resposta de 73% em 2025 | Jahreskurzbericht: https://www.abgeordnetenwatch.de/node/19 |
| TheyWorkForYou | "over six million page views each year" na última década; 7,8 milhões em 2021; 13 milhões no último ano eleitoral | mySociety, 04/07/2023: https://www.mysociety.org/2023/07/04/learning-from-the-way-people-use-theyworkforyou/ |
| Radar do Congresso | "mais de 320 mil visualizações de páginas" (2021) | Congresso em Foco, 22/04/2021: URL na tabela 2.1 |
| GovTrack, Vote Smart, OpenParliament, Parltrack, apps da Câmara e do Senado | Nenhum número com fonte encontrado | — |

Aprendizado da mySociety com esses dados: quem chega por buscador ou rede social cai direto na página de votos e **pula o resumo**. Por isso o contexto (comparação com o partido) foi levado para a própria página de votos. As páginas mais vistas são o resumo e o histórico de votos dos deputados, com pico em eleições.

---

## 3. Como os produtos de referência titulam projetos e votações em linguagem simples

| Produto | De onde vem o título simples | Como garantem a neutralidade |
|---|---|---|
| Congress.gov / GovTrack (EUA) | **Resumos do CRS** (Congressional Research Service), órgão do próprio Congresso, com atribuição legal desde 1935 de produzir resumos "authoritative, objective, nonpartisan" de cada projeto apresentado, revistos a cada mudança de texto. Cerca de 12 analistas escrevem os resumos e há fila de espera. O GovTrack republica o CRS e soma resumos próprios, identificados | Autoria institucional e apartidária, com o tipo de resumo identificado. Em jun/2026, o diretor do CRS informou que em um teste com seis modelos de IA **menos de 3%** dos resumos atingiram o padrão de precisão e objetividade. Fontes: https://blogs.loc.gov/law/2024/05/a-congress-gov-interview-with-barbara-perkins-head-legislative-analysis-and-services-section/ ; https://news.bgov.com/bloomberg-government-news/ai-bill-summary-test-deemed-flop-by-congressional-research-head |
| TheyWorkForYou | **Equipe editorial** agrupa votos em "policies" de nome curto e simples | Redação debatida em público no GitHub. Termos carregados ("bedroom tax") evitados. Convenção fixa (voto "for" = alíquota maior). Votos "neutral" catalogados sem pontuar. Formulário de correção. A própria mySociety reconhece que o rótulo "consistently" pode enganar. Fontes: https://www.mysociety.org/2024/04/23/improving-the-focus-of-theyworkforyous-voting-summaries/ ; https://www.mysociety.org/2026/07/01/theyworkforyou-voting-summaries-update-july-2026/ |
| abgeordnetenwatch | Título da votação dado pela redação, com glossário | Só votações nominais; ausência com termo neutro |
| OpenParliament | Resumo gerado por computador | Aviso explícito de possível erro ou invenção, com pedido de avaliação |
| App "Câmara dos Deputados" | Resumo por IA, segundo a própria Câmara | Não documentado |
| Senado | Campos oficiais **apelido** e **explicação da ementa** (seção 4) | São dados oficiais do Senado |

**Conclusão para o Placar do Poder:** o padrão confiável é o do CRS, um resumo **oficial**, identificado e com data. A redação própria (TheyWorkForYou) só funciona com regras públicas e revisão aberta. Resumo por IA está fora de questão: contraria as diretrizes 1 e 10, e o próprio CRS o reprovou.

---

## 4. Resumos oficiais em linguagem simples nos dados abertos

Consultas feitas em 2026-11-02.

### Senado Federal: há campos oficiais úteis, mas com cobertura parcial

- API nova `https://legis.senado.leg.br/dadosabertos/processo/{id}` (a antiga `/materia/{codigo}` informa depreciação em 2025-03-18 e desativação completa prevista para 2026-02-01, mas ainda respondia na data da consulta):
  - `apelido`: nome popular oficial. Exemplo do PLC 38/2017: "Reforma Trabalhista".
  - `conteudo.explicacaoEmenta`: explicação oficial da ementa. Exemplo: "Reforma trabalhista." Também aparece na página da matéria como "Explicação da Ementa:".
  - `conteudo.assuntoGeral` / `assuntoEspecifico` (ex.: "Social" / "Trabalho e emprego") e `classificacoes` com hierarquia temática (ex.: "Política Social / Educação / Educação Básica").
  - `documento.indexacao`: palavras-chave oficiais.
- **Cobertura:** na lista de PLs de 2025 (887 processos), só **5** têm `apelido`. Numa amostra de sete PLs de 2024–2025, nenhum tinha `explicacaoEmenta`. Os campos existem sobretudo nas matérias de grande repercussão. A **classificação temática**, ao contrário, apareceu nos casos testados.
- A página da matéria liga a notícias da **Agência Senado** (ex.: `senado.leg.br/noticias/materias/2017/12/22/retrospectiva-2017-reforma-trabalhista-mobilizou-senadores`).

### Câmara dos Deputados: não há resumo simples estruturado

- `GET https://dadosabertos.camara.leg.br/api/v2/proposicoes/{id}` traz `ementa`, `ementaDetalhada` e `keywords` (indexação). Na amostra, `ementaDetalhada` estava vazia (PEC 3/2021, PEC 45/2019, PL 3467/2025) ou era técnica: "Altera as Leis nº 10.703 de 2003 e 12.965 de 2014." no PL 2630/2020. Nenhum campo de "explicação".
- `GET .../proposicoes/{id}/temas` traz temas oficiais (ex.: "Direito Constitucional", "Processo Legislativo e Atuação Parlamentar").
- A ficha de tramitação liga às notícias da **Agência Câmara** sobre a proposição (`https://www.camara.leg.br/proposicoesWeb/prop_noticias?idProposicao={id}`). Os títulos são populares (ex.: "Câmara conclui a votação da PEC das Prerrogativas; proposta segue para o Senado"). Esse vínculo **não está na API v2**: só aparece no HTML da ficha.
- A ementa costuma começar por um verbo que já diz o efeito ("Institui o Mapa de Vulnerabilidade Educacional…", "Altera a Lei nº 11.947… para estimular…"). Em muitos casos, o trecho depois de "para" ou "a fim de" é o "o que muda" escrito pelo próprio autor.

### Recomendação de hierarquia para o título do cartão (proposta, a validar pelo orquestrador)

1. **Apelido oficial** (Senado `apelido`), quando existir.
2. **Ementa oficial encurtada sem paráfrase**: corta-se a parte técnica ("Altera a Lei nº X, de AAAA,") e mantém-se, literalmente, a finalidade declarada ("…para estimular a compra de alimentos da agricultura familiar na merenda escolar" só se for essa a redação; senão, a frase exata da ementa). Essa regra é mecânica, pública e igual para todos, o que respeita a diretriz 6.
3. **Explicação oficial** (Senado `explicacaoEmenta`) como subtítulo, quando existir.
4. **Manchete da Agência Câmara ou da Agência Senado**, opcional e sempre marcada: "Como a Agência Câmara (órgão de comunicação da Câmara) descreveu", com link e data. Cabe ao orquestrador decidir se as agências contam como fonte oficial pela diretriz 3. São órgãos da Casa, mas produzem texto jornalístico.
5. **Selo de tema** vindo da classificação oficial (Câmara `temas`, Senado `classificacoes`), escrito para leigos ("Educação", "Trabalho e emprego"). É o tema, não a sigla, que atrai.
6. A sigla e o número ("PL 3467/2025") descem para a linha de metadados do cartão, junto com fonte e data.

---

## 5. Padrões recomendados (14)

Cada padrão traz quem já usa e como adaptar ao Placar do Poder (Next.js, celular primeiro).

### P1. Cartão "o que muda" titulado pelo efeito, com a sigla rebaixada
- **Quem usa:** Congress.gov e GovTrack (resumo CRS), TheyWorkForYou (policies de nome simples), Senado (`apelido`).
- **Adaptação:** componente `CartaoDecisao` com: (1) selo de tema; (2) título segundo a hierarquia da seção 4; (3) linha "Como foi decidido": votação nominal, simbólica, colegiado ou ato individual (diretriz 5); (4) resultado oficial ("Aprovado", "Rejeitado") e placar quando houver; (5) rodapé com "PL 3467/2025 · Fonte: Câmara · coletado em dd/mm/aaaa". Toda a área do cartão é clicável, com alvo de toque de pelo menos 44 px. Sem adjetivos.

### P2. "Quem me representa" por UF e município
- **Quem usa:** TheyWorkForYou e OpenParliament (busca por CEP), Câmara (filtro por UF).
- **Adaptação:** seletor de UF e município (hoje SP e Atibaia), guardado só no `localStorage`, sem envio ao servidor (diretriz 12 e LGPD). Busca por CEP só se o CEP for resolvido sem enviar dado a terceiros (ex.: tabela estática). A lista resultante segue ordem alfabética (diretriz 6).

### P3. Placar visual e completo, em ordem neutra
- **Quem usa:** Senado (Sim / Não / Abstenção / Presidente / Impedidos / Total; mapas "Por nome", "Por partido", "Por UF"), OpenParliament ("Passed/Failed").
- **Adaptação:** barra horizontal única com as contagens oficiais e rótulos em texto (não depender só de cor), nos tons neutros da diretriz 11. Abaixo, abas "Por nome / Por partido / Por UF" com ordem alfabética. Sem destacar "quem traiu o partido" nem um "lado vencedor".

### P4. Ausência com o motivo oficial
- **Quem usa:** Senado (coluna "Obs.": "art. 43, I - Licença saúde", "art. 13, caput - Atividade parlamentar", "Não Compareceu"); abgeordnetenwatch ("Nicht abgestimmt" como termo neutro).
- **Adaptação:** exibir o motivo oficial em linguagem simples, com o artigo do Regimento entre parênteses ("De licença médica (art. 43, I do Regimento Interno do Senado Federal)"). Sem motivo oficial: "Não registrou voto". Nunca "faltou" nem "fugiu".

### P5. Contexto completo onde o leitor chega
- **Quem usa:** TheyWorkForYou levou o contexto para a página de votos porque quem vem de buscador ou rede social pula o resumo.
- **Adaptação:** cada página de votação, perfil ou ato é autossuficiente: o que foi decidido, como, resultado, fonte e um link "Entenda o caminho desta proposta". Metadados (`generateMetadata`) com título simples e descrição neutra, para bom resultado em buscador e boa prévia em aplicativo de mensagem.

### P6. Perfil em seções curtas com navegação fixa
- **Quem usa:** TheyWorkForYou (perfis redesenhados em 2025 "work better on mobile"), Infoleg (seções), abgeordnetenwatch.
- **Adaptação:** no perfil do parlamentar, barra de abas fixa no topo (Votos · Presença · Gastos · Proposições), cada aba com âncora própria. Primeiro bloco: nome, partido e UF, cargo, período, sem foto grande que pese no carregamento (usar `next/image` com tamanho fixo). Mesmo layout e mesmo nível de detalhe para todos (diretriz 6).

### P7. Glossário embutido
- **Quem usa:** abgeordnetenwatch (ABC das votações, com fontes).
- **Adaptação:** componente `Termo` (`<details>`/`<summary>` acessível, sem depender de passar o mouse) para siglas e termos técnicos (diretriz 9), mais uma página `/glossario`. A primeira ocorrência na página traz o nome completo.

### P8. Fonte e data sempre a um toque
- **Quem usa:** todos os oficiais. abgeordnetenwatch cita fontes no glossário. O Senado oferece CSV.
- **Adaptação:** manter o `FonteLink` em todo cartão e bloco ("Ver documento oficial ↗ · coletado em …"). Na votação, link para a lista nominal oficial e "Baixar dados (CSV)" quando a fonte oferecer.

### P9. "Esta semana": feed cronológico do que foi decidido
- **Quem usa:** OpenParliament (home com a última sessão e os votos recentes), GovTrack (resumos quinzenais), abgeordnetenwatch (newsletter semanal).
- **Adaptação:** home com uma lista vertical "Decidido nos últimos 7 dias", reunindo todas as esferas (Congresso, Executivo, SP, Atibaia, STF/STJ) em ordem cronológica, com filtro por esfera em botões horizontais roláveis. Sem o "mais polêmico". Responde à pergunta "por que voltar hoje?" fora da eleição.

### P10. Navegação por tema da vida
- **Quem usa:** app "Câmara dos Deputados" (temas como Meio Ambiente, Educação, Economia), classificação temática do Senado.
- **Adaptação:** páginas `/temas/[tema]` alimentadas **só** pela classificação oficial (Câmara `temas`, Senado `classificacoes`), mapeadas para cerca de 10 rótulos simples (Impostos e preços, Saúde, Educação, Trabalho, Segurança…). Tabela de correspondência pública na Metodologia. O ICMS entra em "Impostos e preços".

### P11. Linha do tempo do caminho da decisão
- **Quem usa:** ficha de tramitação da Câmara, emendas "da indicação ao pagamento" no Portal da Transparência.
- **Adaptação:** linha do tempo vertical (melhor no celular que a horizontal) com etapas oficiais datadas (apresentação, comissões, plenário, sanção ou veto), cada uma com link. Etapa sem dado: "Informação não disponível em fonte oficial".

### P12. Seguir sem cadastro (RSS, calendário e favoritos locais)
- **Quem usa:** Parltrack (alertas por RSS), TheyWorkForYou e GovTrack (e-mail), Infoleg e App Senado Digital (push).
- **Adaptação:** e-mail e push exigem guardar dado do visitante, o que vai além do que a diretriz 12 permite hoje ("nada além da medição de audiência sem identificação"). Por isso: (a) feeds RSS/Atom por tema, parlamentar e esfera, gerados estaticamente (route handlers do Next.js); (b) "Seguir" que guarda favoritos só no aparelho (`localStorage`) e mostra "novidades desde a sua última visita"; (c) `.ics` com a agenda oficial de sessões. Alertas por e-mail ficam para decisão explícita do usuário, com revisão da Política de Privacidade.

### P13. Compartilhar a decisão inteira, não um recorte
- **Quem usa:** abgeordnetenwatch (#wahrplakat, cartazes compartilháveis), todos os sites (prévia em rede social).
- **Adaptação:** botão "Compartilhar" com Web Share API (que abre o WhatsApp nativo no celular) e alternativa "copiar link". Imagem de prévia por votação (`opengraph-image.tsx`) com título simples, placar completo, fonte e data. **Diferente do #wahrplakat**, o usuário não escolhe quais votos aparecem: a imagem mostra a decisão inteira.

### P14. Leve, rápido e com correções visíveis
- **Quem usa:** TheyWorkForYou (formulário para reportar erro), Portal da Transparência (dados abertos e API).
- **Adaptação:** geração estática ou ISR com payload mínimo e listas paginadas ("carregar mais"), pensando no público só-celular e com plano de dados limitado (TIC 2024). Selo "Corrigido em dd/mm" com nota na página afetada (diretriz 13) e link "Encontrou um erro?" (formulário sem dados pessoais obrigatórios).

---

## 6. Padrões a evitar

| Padrão | Exemplo | Por que evitar (diretriz) |
|---|---|---|
| Notas, rankings e "melhores ou piores" parlamentares | Ranking dos Políticos (nota com critérios próprios; crítica de viés econômico liberal em reportagem de 2018); "report cards" do GovTrack, quatro retirados em jul/2024 por não serem confiáveis | Juízo de valor (4); critério não oficial (1) |
| Índices de ideologia ou de "governismo" como destaque | Ideologia do GovTrack (por coautoria); Basômetro e Radar ("a favor ou contra o governo") | Classifica o político; muda de sentido a cada governo (4, 6) |
| Resumo ou título gerado por IA | App da Câmara ("uma inteligência artificial resume"); OpenParliament (aviso de "fabrications"); teste do CRS com menos de 3% de aprovação | Pode inventar (1); o site não menciona IA (10) |
| Agregações do tipo "sempre votou a favor de X" | "generally/consistently voted for" do TheyWorkForYou, rótulo que a própria mySociety admite poder enganar | Exige escolher quais votos contam, o que é edição com risco de viés (4, 6) |
| Recorte escolhido pelo usuário para compartilhar | #wahrplakat (até 5 votos escolhidos, com propósito declarado de crítica) | Gera peça de campanha com a marca do site (4) |
| Cores de partido | Basômetro (pontos na cor do partido) | Diretriz 11 |
| Robôs de "suspeita" ou de "denúncia" | Rosie (aponta "irregularidades" na cota) | Inferência não oficial (1). Mostrar só os dados da cota e as decisões oficiais (CGU, TCU, Câmara) |
| Previsões | "Prognosis" do GovTrack (chance de aprovação, Skopos Labs) | Suposição (1) |
| Avaliações de grupos de interesse e quizzes de afinidade | Vote Smart (interest group ratings, VoteEasy) | Fonte não oficial e julgamento terceirizado (1, 4) |
| Rankings de resposta ou de "assiduidade" | "antwortranking" do abgeordnetenwatch | Ranking implícito. Mostrar números de presença com motivos oficiais, sem ordenar do melhor ao pior (4, 6) |
| Enquetes de opinião e votação popular | App da Câmara (enquetes), votação do Prêmio Congresso em Foco | Não é papel do site e cria placar de popularidade (4) |
| Mapas de ruas e de distritos | Mapas de distrito do GovTrack | Diretriz 11 |
| Cadastro e e-mail como requisito | Alertas do TheyWorkForYou e do GovTrack | Diretriz 12 (LGPD) só permite medição sem identificação. Ver P12 |
| Sigla como título | Listas do Infoleg e da Câmara ("PL 3467/2025") | Não comunica o impacto. Ver P1 e seção 4 |

---

## 7. Fontes consultadas (todas acessadas em 2026-11-02)

- Câmara: https://www2.camara.leg.br/aplicativos/ ; https://www.camara.leg.br/deputados/quem-sao ; https://dadosabertos.camara.leg.br/api/v2/proposicoes/2270800 (e `/temas`) ; https://dadosabertos.camara.leg.br/api/v2/proposicoes/2646600 ; https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=2270800 ; https://www.camara.leg.br/proposicoesWeb/prop_noticias?idProposicao=2270800
- Senado: https://www25.senado.leg.br/web/atividade/materias/-/materia/129049/votacoes ; https://www25.senado.leg.br/web/atividade/materias/-/materia/129049 ; https://legis.senado.leg.br/dadosabertos/processo?codigoMateria=129049 ; https://legis.senado.leg.br/dadosabertos/processo/5252519 ; https://legis.senado.leg.br/dadosabertos/processo?sigla=PL&ano=2025 ; https://legis.senado.leg.br/dadosabertos/materia/129049 ; https://www12.senado.leg.br/institucional/appsenadodigital
- CGU e governo: https://www.gov.br/cgu/pt-br/assuntos/noticias/2024/12/portal-da-transparencia-registra-o-maior-numero-acessos-da-historia-em-2024 ; https://agenciagov.ebc.com.br/noticias/202601/governo-do-brasil-lanca-servico-para-que-o-cidadao-acompanhe-emendas-parlamentares
- Cetic.br: https://cetic.br/media/docs/publicacoes/2/20250512115624/tic_domicilios_2024_resumo_executivo.pdf ; https://www.cetic.br/en/tics/domicilios/2024/individuos/C16A/
- Sociedade civil e imprensa (Brasil): https://www.congressoemfoco.com.br/congresso-em-foco/radar-do-congresso-ja-tem-mais-de-320-mil-acessos/ ; https://www.infomoney.com.br/?p=237907 (reportagem) ; https://docs.queridodiario.ok.org.br/en/latest/what-is-it.html ; https://tictec.mysociety.org/empowering-citizens-how-querido-diario-is-making-brazilian-city-policies-accessible/
- mySociety / TheyWorkForYou: https://www.mysociety.org/2023/07/04/learning-from-the-way-people-use-theyworkforyou/ ; https://www.mysociety.org/2025/03/13/updating-theyworkforyous-voting-summaries/ ; https://www.mysociety.org/2025/10/23/theyworkforyou-update-a-richer-view-of-parliament/ ; https://www.mysociety.org/democracy/theyworkforyou-email-alerts/ ; https://www.mysociety.org/2024/04/23/improving-the-focus-of-theyworkforyous-voting-summaries/ ; https://www.mysociety.org/2026/07/01/theyworkforyou-voting-summaries-update-july-2026/
- abgeordnetenwatch: https://www.abgeordnetenwatch.de/bundestag ; https://www.abgeordnetenwatch.de/node/19 ; https://www.abgeordnetenwatch.de/node/4907 ; https://www.abgeordnetenwatch.de/node/3146 ; https://www.abgeordnetenwatch.de/ueber-uns/mehr/international
- OpenParliament: https://openparliament.ca/ (robots.txt só bloqueia `/search`)
- GovTrack (robots.txt bloqueia o agente; só fontes secundárias): https://en.wikipedia.org/wiki/GovTrack ; https://www.patreon.com/govtrack/posts/govtrack-marks-114642637 ; https://wlos.com/news/nation-world/government-transparency-site-pulls-page-naming-kamala-harris-most-liberal-senator-government-transparency-site-govtrack-removed-a-2019-page-naming-vice-president-kamala-harris-as-that-years-most-liberal-senator
- CRS / Congress.gov: https://blogs.loc.gov/law/2024/05/a-congress-gov-interview-with-barbara-perkins-head-legislative-analysis-and-services-section/ ; https://news.bgov.com/bloomberg-government-news/ai-bill-summary-test-deemed-flop-by-congressional-research-head
- ProPublica: https://projects.propublica.org/represent/ ; https://projects.propublica.org/represent/states
- Vote Smart (robots.txt bloqueia o agente): https://en.wikipedia.org/wiki/Vote_Smart
- Parltrack (robots.txt bloqueia o agente): https://directory.civictech.guide/listing/parltrack ; https://data.europa.eu/sites/default/files/report/2011_eu_parltrack_tracking_the_european_parliament.pdf

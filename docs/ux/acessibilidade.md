# Auditoria de acessibilidade — Brasil na Lupa

Data: 03/11/2026 · Referências: WCAG 2.2 nível AA, eMAG 3.1 e Lei Brasileira de Inclusão (Lei 13.146/2015, art. 63).

## Como foi medido

- Build de produção local (`next build` + `next start`), Chrome headless controlado pelo Chrome DevTools Protocol.
- **axe-core 4** (o pacote já instalado no projeto como dependência do ESLint; nada novo foi instalado), regras `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` e `best-practice`, com movimento reduzido emulado (as animações de entrada deixam o texto semitransparente por alguns décimos de segundo e geram falso alarme de contraste).
- **Leitor de tela simulado**: árvore de acessibilidade completa (`Accessibility.getFullAXTree`) de cada página: títulos e níveis, regiões (landmarks), controles sem nome, nomes ambíguos ("Ver", "Mostrar mais 50"), nomes de link repetidos, papéis de tabela no celular e siglas sem nome por extenso.
- Larguras: **390 px** (celular, toque) e **1366 px** (computador).
- Páginas (12 + 14 extras): início, Congresso, votação nominal (`/congresso/votacoes/camara/2438459-113`, 435 votos), perfil de deputado (`/congresso/camara/parlamentares/204379`), Estados, ICMS, decisão do ICMS (`/impostos/icms/congresso-lc-227-2026`), Justiça, tema do STJ (`/justica/stj/temas/1265`), Tribunais de Contas, Agenda, Quem me representa; extras: Metodologia, Acessibilidade, Executivo, vetos, veto 29/2025, medidas provisórias, senadores, composição, comparar, SP, Atibaia, STF, Quem me representa/SP, Impostos.
- Teste de interação (com a síntese de voz substituída por um registro do que seria falado): leitura em voz alta de 4 páginas, controles e atalhos, foco depois de "Mostrar mais", abertura animada com teclado e balão de glossário com Enter/Esc.

## Resultado

| Medida | Antes | Depois |
|---|---|---|
| Violações do axe (12 páginas × 2 larguras) | **82 nós** em 4 regras | **0** |
| `region` (conteúdo fora de regiões: faixa "Dados atualizados") | 48 | 0 |
| `listitem` (`<li>` dentro de `<li>` na pauta da Agenda) | 20 | 0 |
| `aria-prohibited-attr` (`aria-label` em `<span>` do contador) | 10 | 0 |
| `landmark-unique` (duas buscas sem nome; "2026" repetido no perfil) | 4 | 0 |
| Nomes de botão ambíguos ("Ver", "Mostrar mais 50") | 18 | 0 |
| Páginas extras (14 × 2) | não medido | **0** (10 nós de `landmark-unique` em Quem me representa/SP corrigidos e remedidos) |
| Um `h1` por página / saltos de nível de título | ok / 0 | ok / 0 |
| Títulos de página (`<title>`) únicos | 26 de 26 | 26 de 26 |
| Tabela no celular (votação, 390 px) | tabela | tabela: 1 table, 51 rows, 4 columnheader, 50 rowheader, 150 cell |

## Problemas e correções

Status: **corrigido**, **parcial** (corrigido na interface, falta nos dados) ou **pendente**.

| # | Problema | Critério WCAG / eMAG | Página | Correção | Status |
|---|---|---|---|---|---|
| 1 | Faixa "Dados oficiais atualizados" e botão Ouvir fora de qualquer região | 1.3.1 (boa prática `region`); eMAG 1.2 | todas | Faixa virou `<aside aria-label="Atualização dos dados e leitura em voz alta">` (layout) | corrigido |
| 2 | Só um link de salto; sem atalhos do eMAG | 2.4.1; eMAG 1.5 e "atalhos de teclado" dos elementos padronizados | todas | `<nav aria-label="Atalhos de acessibilidade">` com "Pular para o conteúdo [1]", "Ir para o menu [2]", "Ir para o rodapé [4]" (`accesskey`); `main`, `nav` e `footer` recebem foco (`tabindex=-1`); visíveis ao focar, acima da abertura | corrigido |
| 3 | Sem página de acessibilidade | eMAG 3.1, elementos padronizados ("página sobre a acessibilidade"); LBI art. 63 | — | Nova página `/acessibilidade` (atalhos, Ouvir, recursos, contato) e link no rodapé | corrigido |
| 4 | Link do logotipo lido só como "Brasil na Lupa" | 2.4.4 | todas | Texto oculto ", página inicial" | corrigido |
| 5 | Menu "TCU" sem nome por extenso | 3.1.4 (AAA) / diretriz 9 | todas | `<abbr title>` + texto oculto "(Tribunais de Contas)" | corrigido |
| 6 | Contador animado com `aria-label` em `<span>` (proibido) e risco de ler números intermediários | 4.1.2; 1.3.1 | início | Número final em texto oculto; contagem animada `aria-hidden` | corrigido |
| 7 | Duas regiões de busca sem nome na mesma página | 1.3.1, 2.4.6 | início | `aria-label` em cada `form role=search` | corrigido |
| 8 | Resultado da busca em `h3` logo depois do `h1` (salto 1→3) | 1.3.1, 2.4.6 | início | Grupos de resultado em `h2` (classe `titulo-simples`, mesma aparência) | corrigido |
| 9 | Autocompletar: botão "Ver" sem contexto; opção ativa só com fundo sutil; sem Home/End; anúncio sem singular | 2.4.4, 2.4.7, 4.1.3 | início, Quem me representa | "Ver os representantes" (oculto), contorno neon na opção ativa, Home/End, rolagem até a opção ativa, "1 resultado"/"n resultados" e instrução das setas no `aria-live` | corrigido |
| 10 | "Mostrar mais 50" sem dizer o quê; foco não ia ao item novo em 12 listas | 2.4.4, 2.4.3 | votação, perfil, ICMS, vetos, MPs, STJ, STF, Estados, Atibaia, TCU, comparar | Componente único `MostrarMais` (`components/lista/MostrarMais.tsx`): "Mostrar mais 50 votos", foco no primeiro item novo, anúncio "Mostrando 100 de 435 votos" por `aria-live` | corrigido |
| 11 | `<li>` dentro de `<li>` (pauta da última sessão) | 1.3.1 | Agenda | `ItemDaPauta` virou `<div>` | corrigido |
| 12 | Links "votação 1", "votação 2" repetidos sem contexto | 2.4.4 | Agenda | Texto oculto "de {título do item}" | corrigido |
| 13 | Seções "2026" repetidas (presença e gastos) | 1.3.1 (`landmark-unique`) | perfil de deputado | Títulos com "Presença em"/"Gastos da cota em" ocultos | corrigido |
| 14 | Seções de cargo com o mesmo nome (em exercício e aguardando posse) | 1.3.1 (`landmark-unique`) | Quem me representa/UF | Rótulo "… (aguardando posse)" | corrigido |
| 15 | Placar lido como "Sim 330 Não 104" (sem pausa) | 1.3.1, 1.1.1 | cartões e detalhes de votação | Dois-pontos e vírgulas ocultos: "Sim: 330, Não: 104, Abstenção: 0…"; barra continua `aria-hidden` (a legenda é o dado); "Antes: … ; Depois: …" no antes/depois | corrigido |
| 16 | Link de fonte repetido ("Oficial CONFAZ (abre em nova aba)" 8×) | 2.4.4 | ICMS e listas de cartões | Nome do documento entra no link (texto oculto) | corrigido |
| 17 | Título cortado ("…") era o nome do link e do `h1` | 2.4.4, 2.4.6 | cartões e cabeçalho de decisão | Título inteiro em texto oculto; trecho cortado `aria-hidden`; "ler tudo (título completo)" | corrigido |
| 18 | Rótulo visual da tabela-lista (`::before`) lido junto com o cabeçalho da coluna | 1.3.1 | todas as tabelas no celular | `content: attr(data-rotulo) / ""` (texto alternativo vazio) | corrigido |
| 19 | Balão de glossário: `role=dialog` sem mover o foco | 4.1.2, 2.1.1 | todas com `<Termo>` | Disclosure com Popover API (`aria-expanded` nativo, `aria-controls`), definição como `aria-describedby` do termo, foco vai ao balão ao abrir, Esc fecha e devolve o foco; "Fechar a explicação de …" | corrigido |
| 20 | Contorno de campos e botões com 2,6:1 | 1.4.11 (3:1) | todas | Token `--cor-borda-forte` de `#5c5c68` para `#74747f` (3,8:1 sobre o cartão, 4,1:1 sobre o fundo, 3,4:1 sobre superfície 2) | corrigido |
| 21 | Texto de exemplo (placeholder) com a cor padrão do navegador | 1.4.3 | buscas | `::placeholder` com `--cor-texto-apoio` (6,7:1) | corrigido |
| 22 | Abertura animada: Tab durante a abertura focava o link de salto escondido atrás dela | 2.4.11, 2.1.2 | todas (carga completa) | Qualquer tecla ou foco encerra a abertura na hora; a camada é `aria-hidden` (o leitor de tela encontra o conteúdo desde o início); movimento reduzido continua sem abertura | corrigido |
| 23 | Siglas da interface sem nome por extenso ("API") | 3.1.4 / diretriz 9 | Metodologia, Atibaia | "interface de programação (API)", "dados abertos do TCE-SP" | corrigido |
| 24 | Siglas dentro de textos oficiais transcritos (ADI, RE, LC, IPI, CTN, CPC, RICD, REQ, PDL, IBGE, SAAE, VET…) | 3.1.4 / diretriz 9 | ICMS, STF, Agenda, Atibaia, Executivo | A leitura em voz alta expande as principais; na tela, falta envolver as siglas dos dados com `<Termo>`/`<abbr>` na geração (`scripts/gerar-*.mjs`) | parcial |
| 25 | Nomes em caixa alta vindos das fontes ("HERMAN BENJAMIN") | 3.1 (legibilidade; alguns leitores soletram) | STJ, TCU | — (grafia oficial; `rotulos.ts` do TCU já converte) | pendente |

Itens conferidos sem problema: `lang="pt-BR"`, zoom liberado, foco visível (`:focus-visible` neon de 3 px) em todos os controles, alvos de toque (`target-size` sem falhas), contraste de todos os textos (inclusive cinzas de apoio sobre os cartões: 5,9:1 a 6,7:1; texto sobre o neon: 15,9:1), tabelas com `caption`, `scope="col"` e `scope="row"`, botão de menu com `aria-expanded`/`aria-controls` e Esc, filtros com `aria-expanded` e contagem em `aria-live`, imagens com `alt` (logotipo, fotos oficiais) e figurinhas/ícones com `aria-hidden`.

## Leitura em voz alta ("Ouvir esta página")

Arquivos: `web/src/components/ouvir/BotaoOuvir.tsx` (controles), `extrair.ts` (o que é lido) e `normalizar.ts` (como é falado). Testes: `web/tests/ouvir/normalizar.test.mjs` (72 casos) — rodar com `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test "tests/ouvir/*.test.mjs"` dentro de `web/`.

- **O que lê**: só o `#conteudo`, na ordem do documento, em blocos (título, parágrafo, item, par "termo: definição", linha de tabela "Partido: MDB; Estado: AP; Voto: Sim"). Pula menus, buscas, botões, campos, figurinhas, `aria-hidden`, conteúdo escondido (detalhes fechados, itens ainda não mostrados) e texto só para leitor de tela; lê o `alt` das imagens e o nome por extenso de `<abbr>` na primeira vez. Usa `textContent` (sem a caixa alta do CSS).
- **Títulos**: "Título da página: …", "Seção: …", "Subtítulo: …", com pausa depois.
- **Normalização pt-BR**: "PL 1234/2025" → "Projeto de Lei 1234 de 2025"; "R$ 1,64" → "um real e sessenta e quatro centavos"; "R$ 2,5 bilhões" → "dois vírgula cinco bilhões de reais"; "15/12/2025" → "15 de dezembro de 2025" (dia 1 → "primeiro"); "397 × 3" → "397 a 3"; "12,5%" → "doze vírgula cinco por cento"; "art. 5º, § 2º" → "artigo quinto, parágrafo segundo"; "nº" → "número"; "14h30" → "14 horas e 30 minutos"; siglas de órgãos (STF, STJ, TCU, CONFAZ, ALESP, CPC, IBS…) por extenso na primeira vez, sem repetir quando o texto já traz "Nome (SIGLA)"; links viram "endereço do site".
- **Voz**: a melhor pt-BR disponível (naturais/neurais/on-line primeiro, depois Google, depois as do sistema).
- **Controles** (todos `.botao-mini`): Ouvir/Pausar/Continuar (o mesmo botão, o foco não se perde), Trecho anterior, Próximo trecho, Velocidade (0,75×, 1×, 1,25×, 1,5×; guardada neste aparelho) e Parar. Estado anunciado em `role=status`.
- **Atalhos**: Alt+Shift+O ouvir/pausar/continuar; Alt+Shift+X parar (Esc nos controles); Alt+Shift+→/← próximo/anterior; Alt+Shift+↑/↓ velocidade (`aria-keyshortcuts` e página `/acessibilidade`).
- **Destaque**: o bloco em leitura recebe `.ouvir-lendo` (contorno neon) e é rolado para a tela (sem animação com movimento reduzido).
- **Robustez**: frases de até 200 caracteres (o Chrome corta falas longas); pausa implementada como cancelar e retomar do mesmo trecho (o `pause()` nativo falha com vozes on-line); para ao trocar de página ou sair dela.

## O que falta

1. Siglas dentro dos textos oficiais (item 24): envolver na geração dos dados com `<Termo>` ou `<abbr>`.
2. Teste com leitores de tela reais (NVDA + Chrome, VoiceOver no iPhone, TalkBack no Android); esta auditoria usou a árvore de acessibilidade do Chrome.
3. Páginas do cadastro (`/entrar`, `/minha-conta`, `/privacidade`) e reações ficaram fora desta rodada (outro agente estava nelas).
4. Teste automatizado de acessibilidade na integração contínua (o script de auditoria desta rodada pode virar um teste com axe-core).

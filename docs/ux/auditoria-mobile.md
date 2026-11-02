# Auditoria mobile de UX/UI — Placar do Poder

Data: 02/11/2026 · Escopo: somente análise (nenhuma alteração no site) · Build de produção local (`next build` + `next start`), Chrome headless com emulação mobile via CDP (toque, user agent Android, DPR 2) em **360×800** e **390×844**.

Páginas auditadas: Início (`/`), `/impostos/icms`, decisão `/impostos/icms/congresso-lc-227-2026`, `/congresso`, votação nominal `/congresso/votacoes/camara/2438459-113` (435 votos), perfil `/congresso/camara/parlamentares/204379`, `/executivo/vetos`, veto longo `/executivo/vetos/vet-29-2025` (59 dispositivos, o maior de 2025), `/justica/stj/temas/1265` e `/metodologia`.

Capturas de referência: `docs/ux/capturas/` (15 PNG, 360 px de largura, DPR 2).

> O header do site ainda exibe "Voto em Quem". O projeto passa a se chamar **Placar do Poder**: a troca deve ser feita em `web/src/app/layout.tsx` (marca no header e `metadata.title`).

---

## 1. Resumo executivo

A base técnica é boa. Nenhuma página transborda na horizontal, nenhum texto falha no contraste AA, o CLS é 0, o LCP fica entre 1,3 e 2,1 s em 4G lenta com CPU 4× mais lenta, há link "Pular para o conteúdo", foco visível, `lang="pt-BR"` e zoom liberado. **O problema é de produto e de arquitetura da informação, não de engenharia.** No celular, o site parece um arquivo de documentos, não um serviço que responde perguntas:

1. **Os títulos falam a língua do Diário Oficial, não a do leitor.** "PDL 274/2026" aparece três vezes seguidas como título de cartão. "Veto 55/2026 — Projeto de Lei (PL) 2951/2024", "Votação: PLP 108/2024 em 15/12/2025" e "Tema Repetitivo 1265 do STJ" também são títulos. O leitor comum não sabe o que mudou na vida dele. Só a linha do tempo do ICMS (parte dela) já usa títulos no formato certo ("Novo valor do ICMS da gasolina a partir de 01/02/2027: R$ 1,64 por litro").
2. **A resposta principal fica abaixo da dobra.** Na votação nominal, o placar começa em 1.670 px (2,1 telas) e a lista de votos em 2.600 px (3,3 telas). A primeira dobra é ocupada por cinco caixas empilhadas, entre elas "Horário: Informação não disponível em fonte oficial". No perfil do deputado, "como votou" começa em 990 px, depois de foto grande, nome civil em caixa-alta e e-mail.
3. **As páginas são longas demais para o polegar.** O veto 29/2025 mede **140 telas** (112 mil px). A lista do ICMS mede 50 telas (71 cartões sem paginação nem busca). O perfil do deputado e o tema do STJ medem 16 telas cada.
4. **As tabelas não foram pensadas para 360 px.** Na decisão do ICMS, a coluna "Depois" (o dado mais importante do site) fica fora da tela: a tabela tem 841 px dentro de 326 px. Os nomes de deputados quebram no meio da palavra ("Favach / o"). Há rolagem dentro de rolagem (tabelas com `max-h` dentro da página), e quatro filtros empilhados ocupam uma tela inteira antes do primeiro resultado.
5. **O texto é pequeno.** A maior parte do conteúdo usa 14 px (`text-sm`), os dados de fonte e de coleta usam 12 px e o selo "OFICIAL" usa 11,2 px. Botões, selects e chips têm 34 px de altura (abaixo dos 44–48 px recomendados para toque).
6. **A Início não mostra nada acontecendo.** Não há últimas decisões, busca ou entrada "Como votou meu deputado?". A primeira dobra é só texto institucional, e o botão do destaque fica cortado no limite da tela.
7. **Não há como compartilhar.** Não há imagem de compartilhamento (Open Graph) por decisão nem botão de compartilhar, e WhatsApp é o canal de distribuição número 1 no Brasil.

Os ganhos maiores e mais baratos estão em três frentes: **(a)** um cartão padrão com título em linguagem simples e dado-chave (seção 4); **(b)** um bloco "Resumo" na primeira dobra das páginas de detalhe; **(c)** tabelas que viram listas no celular, com filtros recolhidos. Nenhuma dessas mudanças exige abrir mão das diretrizes: fonte visível, neutralidade, lacunas explícitas e nenhuma menção a IA.

---

## 2. Medições

### 2.1 Peso, desempenho e tamanho (360×800)

| Página | HTML gzip / sem compressão | JS gzip (arquivos) | Nós DOM | Altura (telas) | LCP* | CLS |
|---|---|---|---|---|---|---|
| Início | 5 KB / 19 KB | 145 KB (9) | 110 | 2,4 | 1,32 s | 0 |
| ICMS (lista) | 35 KB / 249 KB | 142 KB (8) | 1.601 | **50,4** | 1,94 s | 0 |
| Decisão ICMS (LC 227/2026) | 40 KB / 224 KB | 143 KB (9) | **5.298** (967 linhas de tabela) | 10,9 | 2,13 s | 0 |
| Congresso | 10 KB | 146 KB (9) | 414 | 8,8 | 1,46 s | 0 |
| Votação 2438459-113 | 25 KB / 144 KB | 146 KB (9) | 2.918 | 5,2 (+ rolagem interna) | 1,51 s | 0 |
| Deputado 204379 | 30 KB / 215 KB | 149 KB (10) + foto 40 KB | 903 | 16,6 | 1,52 s | 0 |
| Vetos (lista) | 29 KB | 142 KB (8) | 496 | 20,2 | 1,50 s | 0 |
| Veto 29/2025 | **50 KB / 842 KB** | 145 KB (9) | 3.541 | **140** | 1,96 s | 0 |
| STJ Tema 1265 | 16 KB / 139 KB | 147 KB (9) | 561 | 16,2 | 1,46 s | 0 |
| Metodologia | 8 KB | 140 KB (7) | 164 | 5,7 | 1,40 s | 0 |

\* Rede "Slow 4G" emulada (150 ms RTT, 1,6 Mbit/s) e CPU 4×, servidor local, cache desligado. Valores aproximados: não incluem latência de CDN real nem o script da Vercel Analytics, que não carrega localmente.

O JavaScript tem cerca de 145 KB gzip (~483 KB descompactados) em todas as páginas, inclusive nas totalmente estáticas (Metodologia, Início). O HTML do veto 29/2025 tem 842 KB descompactados porque o payload RSC duplica o texto. Em celulares de entrada, isso pesa mais no parse e na memória do que no download.

### 2.2 Acessibilidade e toque (360×800)

| Página | Alvos interativos | < 24 px (alt. ou larg.) | 24–43 px | Textos < 12 px | Contraste < AA |
|---|---|---|---|---|---|
| Início | 12 | 9 (links de texto e rodapé) | 3 (marca, Menu 86×34, botão do destaque 36 px) | 0 | 0 |
| ICMS | 148 | 69 (links de fonte com 16 px de altura) | 8 (chips 34 px) | 35 nós | 0 |
| Decisão ICMS | 36 | 13 | 18 | 70 | 0 |
| Congresso | 44 | 21 | 21 | 112 | 0 |
| Votação | 450 | 13–46 | **341–353** (links de nomes, selects 34–35 px) | 21 | 0 |
| Deputado | 85 | 57 | 25 | 133 | 0 |
| Veto 29/2025 | 181 | 10 | 119 | 433 | 0 |
| STJ 1265 | 53 | 38 (incl. `summary` com 20 px) | 15 | 98 | 0 |

- **WCAG 2.5.8 (AA, 24 px):** a maioria dos casos abaixo de 24 px são links dentro de frases ou com espaçamento suficiente, que se enquadram nas exceções. Há falhas reais ou limítrofes: `summary` "Texto oficial completo da decisão" (294×20) no STJ e migalhas de pão com 15 px de altura e alvos próximos. Para um público geral em celular, a meta de produto deve ser **44 px** (WCAG 2.5.5 AAA / Apple HIG / Material 48 dp).
- **Distribuição de tamanho de fonte (caracteres visíveis):** 14 px é o tamanho dominante em todas as páginas de conteúdo. No veto 29/2025 são 127 mil caracteres em 14 px contra 466 em 16 px. Na Início, 16 px é o tamanho do texto principal (bom).
- **Contraste:** nenhuma falha. A paleta de `globals.css` está bem calibrada (a medição percorreu todos os nós de texto visíveis).
- **Foco e teclado:** `:focus-visible` com 3 px, tabelas roláveis com `tabIndex=0` e `role=region`, `aria-live` nos contadores de filtro, Esc fecha o menu. Tudo certo.
- **Zoom:** `width=device-width, initial-scale=1`, sem `maximum-scale`. Tudo certo.

### 2.3 Legibilidade (índice Flesch adaptado ao português, aproximado)

| Página | Flesch PT | Palavras/frase | Leitura |
|---|---|---|---|
| Início | 57 | 18 | média |
| ICMS (lista) | 60 | 15 | média |
| Vetos (lista) | 66 | **26,8** | frases longas (ementas literais) |
| STJ 1265 | 60 | 11 | média, mas vocabulário jurídico ("exceção de pré-executividade", "polo passivo") |
| Metodologia | 46 | 18 | difícil |
| Veto 29/2025 | **34** | 20,5 | muito difícil (texto legal literal) |

As páginas de votação dão índice alto (93) só porque são listas de nomes; o índice não serve para elas. Há siglas sem nome completo em títulos e cartões, o que contraria a diretriz 9: PDL, PL, PLP, RICD, MPV, PEC (Congresso); GLP, CNAE, RICMS (ICMS); CPC (STJ).

### 2.4 Tempo até a resposta principal (posição vertical em 360×800; a dobra termina em 800 px)

| Pergunta do leitor | Onde está a resposta | Posição |
|---|---|---|
| "O que mudou?" (decisão ICMS) | Tabela "O que mudou", coluna **Depois** | Seção a 741 px, mas a coluna Depois **fica fora da tela** (rolagem horizontal escondida) |
| "Quem decidiu?" (decisão ICMS) | Seção "Quem decidiu" | 1.011 px |
| "Qual foi o placar?" (votação) | Seção "Placar" | **1.670 px (2,1 telas)** |
| "Como votou meu deputado?" (votação) | Busca na tabela de votos | **2.600 px (3,3 telas)**, mais 4 filtros empilhados (~570 px) antes do 1º nome |
| "Como votou este deputado?" (perfil) | Tabela de votos | 990 px, mais 3 filtros; a coluna "voto" fica cortada à direita (tabela de 640 px em 326 px) |
| "O Congresso manteve o veto?" (veto 29/2025) | "Situação dos dispositivos" | 1.409 px; o detalhe ocupa 140 telas |
| "O que o STJ decidiu?" (tema 1265) | Tese firmada | 1ª dobra, mas só em texto jurídico literal |
| "O que aconteceu de novo?" (Início) | Não existe | — |

---

## 3. Problemas priorizados (impacto × esforço)

Legenda: **Impacto** A/M/B (alto/médio/baixo) na adesão mobile · **Esforço** A/M/B · Captura em `docs/ux/capturas/`.

| # | Problema | Impacto | Esforço | Captura | Código responsável |
|---|---|---|---|---|---|
| 1 | Títulos de cartão e de página em jargão (número da proposição em vez do assunto). Títulos idênticos em sequência ("PDL 274/2026" ×3). Cartões de voto mostram só a descrição procedimental ("Rejeitado o Requerimento.") e escondem a ementa, que já está nos dados | **A** | B–M | 06, 13, 07, 15 | `features/congresso/componentes/ItemVotacao.tsx`; `app/executivo/vetos/page.tsx:21` (título ignora `assunto_congresso`, que já existe: "Marco Legal do Seguro Rural"); `app/congresso/votacoes/[casa]/[id]/page.tsx` (`titulo()`); `features/justica/componentes/CartaoTema.tsx`, `JulgamentoStj.tsx` |
| 2 | Primeira dobra das páginas de detalhe sem a resposta: 5 caixas de ficha empilhadas, incluindo "Horário: Informação não disponível…"; placar e votos a 2–3 telas | **A** | M | 07, 08 | `app/congresso/votacoes/[casa]/[id]/page.tsx` (`ficha` em `dl grid-cols-1`); `app/impostos/icms/[id]/page.tsx`; `app/executivo/vetos/[id]/page.tsx` |
| 3 | Na tabela "O que mudou", a coluna **Depois** fica fora da tela em 360 px (tabela de 841 px). O dado mais importante do site está escondido atrás de uma rolagem horizontal sem indicação | **A** | B | 05 | `features/icms/componentes/DetalheDecisao.tsx` (`TabelaMudancas`) |
| 4 | Páginas gigantes: veto 29/2025 com 140 telas (59 dispositivos expandidos, cada um com texto vetado e razões); ICMS com 71 cartões em 50 telas, sem busca nem paginação; o explicativo "Quem pode mudar" ocupa 2,5 telas antes da lista | **A** | M | 14, 03, 04 | `app/executivo/vetos/[id]/page.tsx` + `features/executivo/componentes/Dispositivo.tsx`; `app/impostos/icms/page.tsx` + `QuemPodeMudar.tsx` / `LinhaDoTempo.tsx` |
| 5 | Início sem conteúdo vivo: sem "últimas decisões", sem busca, sem "Como votou meu deputado?". Impostos não aparece em "Seções disponíveis". O botão do destaque fica cortado na dobra | **A** | M | 01 | `app/page.tsx` |
| 6 | Tabelas de votos no celular: rolagem dentro da rolagem (`max-h-[32rem]`/`[28rem]`/`[40rem]`), que prende o dedo; nomes partidos no meio ("Favach / o") por causa de `overflow-wrap: anywhere` em `.lk`; tabela do perfil cortada à direita | **A** | B–M | 09, 11 | `app/globals.css` (`.lk`); `TabelaRegistros.tsx`, `VotosDoParlamentar.tsx`, `VotosIndividuais.tsx`, `DetalheVotacao.tsx` (`Orientacoes`), `ListaParlamentares.tsx` |
| 7 | Filtros empilhados (busca + 3 selects ≈ 570 px) antes do primeiro resultado em votação, perfil e vetos | M | B | 09, 11, 13 | `TabelaRegistros.tsx`, `VotosDoParlamentar.tsx`, `FiltroLista.tsx` |
| 8 | Tipografia pequena: conteúdo em 14 px; fonte e data de coleta (exigência das diretrizes 2 e 13) em 12 px (`.meta`); selo "OFICIAL" em 11,2 px | M | B | 07, 13 | `app/globals.css` (`.meta`, `.tag-fonte`, `.tabela`); uso disseminado de `text-sm` |
| 9 | Alvos de toque abaixo de 44 px: botão Menu (86×34), selects e inputs (34–35 px), chips do ICMS (34 px), `summary` (20 px), links de fonte (15–19 px), migalhas (15 px), rodapé (15 px) | M | B | 01, 04, 15 | `components/NavPrincipal.tsx`; classe `CAMPO` em `TabelaRegistros.tsx` e afins; `globals.css` (`details > summary`); `FonteLink.tsx`; `layout.tsx` (rodapé) |
| 10 | Perfil do deputado: foto de 240 px, nome civil em caixa-alta e e-mail ocupam a dobra; o "Resumo dos registros" começa a 1,7 tela; os gastos têm dois totais e um parágrafo de 9 linhas antes da tabela | M | M | 10, 12 | `app/congresso/[casa]/parlamentares/[id]/page.tsx`; `GastosCota.tsx` |
| 11 | Sem compartilhamento: não há `opengraph-image` por decisão, votação ou veto, nem botão "Compartilhar" (Web Share API). O preview no WhatsApp fica genérico | **A** (adesão) | M | — | `app/**/[id]/` (não existe `opengraph-image.tsx`); `layout.tsx` (sem `openGraph`) |
| 12 | Navegação: não há busca global; o botão "Menu" não muda para "Fechar" e o menu aberto empurra o conteúdo; em `/impostos/icms` a migalha "Impostos" não é link; páginas longas sem índice nem "voltar ao topo" | M | B–M | 02, 03 | `NavPrincipal.tsx`; `app/impostos/icms/page.tsx` |
| 13 | Votações procedimentais (requerimento, urgência, redação final) com o mesmo peso visual das votações de mérito; várias votações da mesma proposição no mesmo dia aparecem como cartões soltos | M | M | 06 | `app/congresso/page.tsx`; `ItemVotacao.tsx` |
| 14 | Peso desnecessário: 145 KB gzip de JS em páginas estáticas; HTML de 842 KB no veto; 967 linhas de tabela (3×435 votos) renderizadas de uma vez na decisão do ICMS | M | M | — | Componentes `"use client"` de filtro (`TabelaRegistros.tsx` etc.); `app/impostos/icms/[id]/page.tsx` + `features/icms/componentes/Votacoes.tsx` |
| 15 | Siglas sem nome completo em títulos e metadados de cartões (PDL, PLP, RICD, MPV, GLP, CNAE, CPC); termos do placar ("Outros", "Art. 17", "Prejudicado") explicados longe de onde aparecem | M | B | 06, 08, 15 | `features/congresso/rotulos.ts` (`nomeTipoProposicao` já existe e não é usado no cartão); `features/executivo/rotulos.ts` |
| 16 | Orientações de bancada com nomes truncados da fonte ("Bloco AvanSolidPrd…") em tabela alta, logo antes dos votos | B | B | 08 | `DetalheVotacao.tsx` (`Orientacoes`) |

**Ordem sugerida de execução:** #3, #6 (correção de `.lk`) e #8/#9 (CSS) são correções de 1 dia. Depois vêm #1 + seção 4 (cartão padrão), #2 (bloco Resumo), #5 (Início) e #11 (compartilhamento). Por último, #4, #7, #10, #13 e #14.

---

## 4. Cartões e listas: avaliação e formato proposto

### 4.1 Critério

Fora de período eleitoral, o leitor só para de rolar se o cartão disser em uma linha **o que muda para ele**, com um número quando houver, e **quem decidiu**, sempre de forma neutra e com a fonte a um toque. "PL 1234/2025" não passa nesse filtro.

### 4.2 Como cada lista se sai hoje

| Lista | Título atual (exemplo real) | Nota | Comentário |
|---|---|---|---|
| ICMS — linha do tempo (`LinhaDoTempo.tsx`) | "Novo valor do ICMS da gasolina a partir de 01/02/2027: R$ 1,64 por litro" | **Boa** | É o modelo a seguir. Falta mostrar o "antes" (R$ 1,57) no próprio cartão. O resumo repete números de ato ("Convênios ICMS 127/2026 e 128/2026"). |
| ICMS — decretos do governador | "Decreto 69.292/2025: Prorrogação de benefícios do regulamento do ICMS e nova regra para couro e calçados" | Regular | O número do ato vem antes do assunto. "Regulamento do ICMS" é jargão. |
| ICMS — decisões do Congresso | "Reforma tributária: Comitê Gestor do IBS, saldos credores de ICMS e correntes de combustíveis na cobrança única" | Fraca | Três assuntos técnicos. "Saldos credores" e "correntes" sem explicação. |
| Congresso — votações recentes (`ItemVotacao.tsx`) | "PDL 274/2026" + "Rejeitado o Requerimento." | **Ruim** | O título é só a sigla. A descrição é procedimental. A ementa (já coletada) não aparece. Três cartões iguais seguidos. |
| Perfil — votos do deputado (`VotosDoParlamentar.tsx`) | "PLP 281/2019" + "Rejeitada a Subemenda Substitutiva…" | **Ruim** | Igual ao anterior, e ainda em tabela cortada. |
| Vetos (`app/executivo/vetos/page.tsx`) | "Veto 55/2026 — Projeto de Lei (PL) 2951/2024" + ementa literal com 3 leis citadas | **Ruim** | `assunto_congresso` ("Marco Legal do Seguro Rural") já existe e não é usado na lista. "Não apreciados: 3" é jargão. |
| STJ/STF — temas (`CartaoTema.tsx`) | "Tema Repetitivo 1265 do STJ" | **Ruim** | Sem assunto no título. A tese literal é a única descrição. |
| Início — seções | "Congresso Nacional", "Executivo federal" | Regular | Descreve seções, não decisões. Não há nenhum fato no cartão. |

### 4.3 Formato de cartão padrão: "Cartão de Decisão"

Um único componente para todas as listas (ex.: `components/CartaoDecisao.tsx`), com os mesmos campos em todas as seções (diretriz 6: mesmo tratamento para todos):

```
┌──────────────────────────────────────────────┐
│ [selo do caminho]  ·  data da decisão        │ ← meta, 14 px
│ TÍTULO EM LINGUAGEM SIMPLES (o que muda)     │ ← 18 px, semibold, link do cartão inteiro
│ Subtítulo: para quem / desde quando          │ ← 15–16 px
│ ┌ DADO-CHAVE ─────────────────────────────┐  │
│ │ R$ 1,57 → R$ 1,64 por litro              │  │ ← antes → depois, ou placar
│ │  ou  Sim 330 ▇▇▇▇▇▇▇▇▇▁▁▁ Não 104        │  │
│ └─────────────────────────────────────────┘  │
│ Quem decidiu: CONFAZ · sem voto de deputados │
│ [OFICIAL] Convênio ICMS 127/2026 · coletado  │ ← selo de fonte, alvo ≥ 44 px
│ em 02/11/2026                     Compartilhar│
└──────────────────────────────────────────────┘
```

**Regras de redação do título** (para não ferir as diretrizes 1, 4 e 9):

1. Montar o título a partir de **campos estruturados** sempre que possível: item + antes → depois + data de vigência; casa + resultado + assunto. Isso evita interpretação.
2. Quando o título precisar de redação (assunto de lei, tese judicial), criar um campo de dados próprio de **título simples**, escrito pela curadoria a partir do texto oficial. A regra é só reformular, sem acrescentar fato. O texto oficial fica visível na página de detalhe com o rótulo "texto oficial".
3. Verbos factuais e neutros: *aprova, rejeita, veta, derruba o veto, mantém o veto, passa de X para Y, prorroga, revoga, decide que*. Use "sobe" ou "cai" só quando o documento traz os dois números. Não use adjetivos ("polêmico", "histórico", "benefício a…", "aumento abusivo").
4. Assunto antes do número do ato. O número vai para a meta ou para o selo de fonte ("PDL 274/2026 · Projeto de Decreto Legislativo").
5. Toda sigla do título tem nome completo no próprio cartão ou é trocada pelo nome (diretriz 9).
6. Votação procedimental leva o rótulo "Etapa:" (ex.: "Etapa: pedido de urgência"), para não ser confundida com a aprovação do conteúdo.
7. Placar como "placar" (metáfora do nome Placar do Poder): barra horizontal em **tons neutros** (cinza escuro e cinza claro, com rótulos de texto, sem verde ou vermelho e sem cor de partido), ordem fixa Sim · Não · Abstenção · Outros, igual para todos.

### 4.4 Exemplos reescritos com dados reais do site

**1. ICMS da gasolina (CONFAZ, Convênio ICMS 127/2026)**
- Título: **ICMS da gasolina passa de R$ 1,57 para R$ 1,64 por litro em 01/02/2027**
- Subtítulo: Vale para gasolina e etanol anidro misturado a ela.
- Dado-chave: R$ 1,57 → **R$ 1,64** por litro
- Quem decidiu: CONFAZ (secretarias de Fazenda dos estados e do DF) · sem votação de deputados ou senadores
- Fonte: [OFICIAL] Convênio ICMS 127/2026 · coletado em 02/11/2026

**2. Diesel e gás de cozinha (Convênio ICMS 128/2026)**
- Título: **ICMS do diesel passa de R$ 1,17 para R$ 1,30 por litro em 01/02/2027**
- Subtítulo: No gás de cozinha (GLP, gás liquefeito de petróleo), passa de R$ 1,47 para R$ 1,54 por quilo.
- Quem decidiu: CONFAZ · sem votação de deputados ou senadores

**3. Votação nominal 2438459-113 (PLP 108/2024)**
- Título: **Câmara aprova texto do Senado que cria o Comitê Gestor do IBS, novo imposto da reforma tributária**
- Subtítulo: Projeto de Lei Complementar (PLP) 108/2024 · resultado: aprovada
- Dado-chave: Sim **330** ▇▇▇▇▇▇▇▇▁▁▁ Não **104** · Outros 1
- Quem decidiu: deputados federais, em votação nominal · **Veja como votou cada deputado**
- Data: 15/12/2025 · [OFICIAL] Página da votação na Câmara · coletado em 02/11/2026

**4. Cartão hoje "PDL 274/2026 — Rejeitado o Requerimento." (votação simbólica, 28/10/2026)**
- Título: **Acordo do Mercosul sobre medidas de proteção a mulheres em situação de violência**
- Subtítulo: Etapa: requerimento (pedido de procedimento) · **rejeitado** em votação simbólica, sem voto individual registrado
- Meta: Projeto de Decreto Legislativo (PDL) 274/2026 · Câmara dos Deputados · 28/10/2026
- Agrupamento sugerido: "3 votações sobre este projeto em 28/10/2026" num só cartão, com as etapas listadas dentro dele.

**5. Cartão hoje "PL 5542/2026 — Aprovado, por unanimidade, o Requerimento de Urgência (Art. 155 do RICD)."**
- Título: **Monitoração eletrônica nas medidas protetivas da Lei Maria da Penha: Câmara aprova urgência**
- Subtítulo: Etapa: pedido de urgência, que acelera a tramitação. Esta votação não decidiu o conteúdo do projeto.
- Meta: Projeto de Lei (PL) 5542/2026 · votação simbólica · 28/10/2026 · termo "Regimento Interno da Câmara (RICD)" por extenso

**6. Veto 55/2026 (lista de vetos)**
- Título: **Seguro rural: presidente veta 3 trechos da nova lei**
- Subtítulo: Marco Legal do Seguro Rural · Lei nº 15.526, de 29/09/2026
- Dado-chave: 3 trechos vetados · **aguardando análise do Congresso** (a fonte registra "Não apreciado")
- Quem decidiu: Presidente da República (ato individual) · depois, o Congresso Nacional

**7. Veto 29/2025 (licenciamento ambiental)**
- Título: **Licenciamento ambiental: Congresso derruba o veto em 52 dos 59 trechos**
- Subtítulo: 52 trechos voltam a fazer parte da Lei nº 15.190/2025; 7 ficaram prejudicados (termo explicado na página)
- Dado-chave (placar de dispositivos): Derrubados **52** · Prejudicados **7** · Mantidos **0**
- Quem decidiu: Presidente da República (veto, 08/08/2025) → Congresso Nacional (sessão conjunta, 27/11/2025)

**8. STJ, Tema Repetitivo 1265**
- Título (campo de título simples, a revisar pela curadoria): **Cobrança de dívida pelo poder público: se uma pessoa é excluída da cobrança, o juiz fixa os honorários do advogado por equidade, não pelo valor cobrado**
- Subtítulo: Tese firmada pelo Superior Tribunal de Justiça (STJ) · situação: trânsito em julgado (decisão definitiva)
- Quem decidiu: órgão colegiado do STJ · relator e resultado conforme a fonte
- Fonte: [OFICIAL] Página do tema no STJ · a tese literal aparece logo abaixo, com o rótulo "texto oficial"

**9. Perfil — cartão do deputado (em busca e listas)**
- Título: **Acácio Favacho (MDB-AP)**
- Dados-chave: voto registrado em **425 de 722** votações nominais coletadas · cota parlamentar em 2026: **R$ 421.271,79** (página oficial da Câmara)
- Ação: "Ver como votou"

**10. Decreto do governador de SP 69.292/2025**
- Título: **SP prorroga benefícios de ICMS e muda a regra para couro e calçados**
- Meta: Decreto estadual 69.292/2025 · ato individual do governador · sem votação de deputados

---

## 5. Recomendações por página

### Início (`app/page.tsx`)
- Primeira dobra (360×800), nesta ordem: uma frase de proposta (1 linha: "Quem decidiu, como votou e o que muda, com a fonte oficial"); **campo de busca** ("Busque um deputado, um imposto ou uma lei"); atalho **"Como votou meu deputado?"** (seletor de estado → lista); **3 Cartões de Decisão mais recentes** de todas as seções, em ordem cronológica e com o mesmo formato para todas.
- Mover o parágrafo "O site não classifica…" para uma linha curta abaixo do título, com link para Metodologia.
- Incluir Impostos/ICMS em "Seções disponíveis" e reduzir os cartões de seção a 1 linha cada.

### Votação (`app/congresso/votacoes/[casa]/[id]/page.tsx`)
- Bloco **Resumo** acima da dobra: título simples (seção 4), resultado + barra de placar, data, casa, tipo de votação com explicação de 1 linha e selo de fonte.
- Logo abaixo: **"Como votou seu deputado"**, com busca por nome e chips de estado (UF). O resultado aparece como cartão (nome, partido-UF, voto em destaque), não como linha de tabela.
- Transformar a ficha de 5 caixas numa linha de meta ("Plenário · 15/12/2025 · votação nominal"). Esconder campos sem dado (horário) da ficha e listá-los em "O que a fonte oficial não informa", que já existe.
- Orientações de bancada e "O que foi votado" (texto literal) vão para `details` recolhidos, com resumo de 1 linha.
- Índice fixo de âncoras abaixo do header: Placar · Votos · Orientações · Fontes.

### Decisão do ICMS (`app/impostos/icms/[id]/page.tsx`, `DetalheDecisao.tsx`)
- `TabelaMudancas` no celular (< 640 px) vira uma lista de cartões: **Item** / "Antes R$ 1,57 → Depois R$ 1,64 por litro" / "a partir de 01/02/2027". Assim não há rolagem horizontal.
- As 3 tabelas de 435 votos: mostrar só placar + "Ver votos (435)" e carregar a tabela sob demanda (ou link para a página da votação, que já existe).

### Lista do ICMS (`app/impostos/icms/page.tsx`)
- Colocar a **linha do tempo primeiro**. "Quem pode mudar o ICMS" vira um `details` ou um carrossel de 4 cartões curtos.
- Busca por produto ("gasolina", "energia") e paginação ou "Mostrar mais" a cada 10 itens.
- Mostrar antes → depois no cartão quando `mudancas` tiver valores.

### Perfil do deputado (`app/congresso/[casa]/parlamentares/[id]/page.tsx`)
- Cabeçalho compacto: foto de 64–72 px ao lado de nome, partido-UF e cargo. Nome civil e e-mail vão para "Dados oficiais" recolhido.
- Faixa de resumo com 3 números (votos registrados 425/722 · presença em Plenário · cota no ano), cada um com link para a seção.
- Votos como lista de Cartões de Decisão com o voto do deputado em destaque ("Votou: Sim") e filtros recolhidos.
- Gastos: um número em destaque (o total da página oficial) e a divergência entre totais em "Por que há dois totais?" (`details`). Categorias com só a primeira letra maiúscula na exibição, mantendo o rótulo oficial acessível.

### Vetos e veto longo (`app/executivo/vetos/page.tsx`, `[id]/page.tsx`, `Dispositivo.tsx`)
- Título da lista = `assunto_congresso` + verbo + contagem (seção 4, exemplos 6 e 7).
- No detalhe: o placar de dispositivos ("Derrubados 52 · Prejudicados 7 · Mantidos 0") no topo; os dispositivos como lista **recolhida** (1 linha: trecho + situação), com filtro por situação. Texto vetado e razões só ao expandir. Isso reduz 140 telas para cerca de 15.

### STJ/STF (`features/justica/componentes/*`)
- Título com o assunto (campo de título simples revisado pela curadoria). "Questão submetida" e "Tese" literais logo abaixo, com rótulo "texto oficial".
- `summary` com área mínima de 44 px.

### Global (`app/globals.css`, `layout.tsx`, `NavPrincipal.tsx`, `FonteLink.tsx`)
- Corpo do texto em 16 px no celular; `.meta` com mínimo de 13–14 px; `.tag-fonte` com mínimo de 12 px.
- Controles (`input`, `select`, chips, Menu, `summary`) com `min-height: 44px`. Links de fonte como bloco com `py-2`.
- `.lk { overflow-wrap: anywhere }` → `break-word` (ou aplicar `anywhere` só em links que são URLs). Isso corrige "Favach / o".
- Tabelas: remover `max-h-*` com rolagem interna no celular (rolagem única da página) e usar cabeçalho fixo via `position: sticky` relativo à página. Abaixo de 640 px, preferir lista de cartões.
- Filtros: uma busca visível + botão "Filtros (n)" que abre um `details` ou uma folha inferior; chips dos filtros ativos com "×".
- Menu: rótulo "Fechar" quando aberto, sobreposto ao conteúdo (sem empurrar a página), mais **busca global** no header.
- Compartilhamento: `opengraph-image.tsx` por decisão, votação e veto, reproduzindo o Cartão de Decisão (título, dado-chave, quem decidiu, fonte e data). Botão "Compartilhar" com `navigator.share` e fallback "copiar link". Nada de rastreamento além da medição de audiência já prevista (diretriz 12).
- Marca: "Placar do Poder" no header e no `metadata.title`.
- Desempenho: manter os componentes de filtro como ilhas cliente pequenas; avaliar se o bundle comum (~145 KB gzip) pode ser reduzido nas páginas sem interação. Paginar o que hoje tem centenas de linhas.

---

## 6. Heurísticas de Nielsen (síntese)

| Heurística | Situação |
|---|---|
| 1. Visibilidade do estado | Boa: contadores "Mostrando X de Y" com `aria-live`, seção atual marcada no menu e data de coleta sempre presente. |
| 2. Correspondência com o mundo real | **Fraca**: títulos por número de ato, termos regimentais ("Subemenda Substitutiva Global", "aposto", "não apreciado", "Art. 17"). |
| 3. Controle e liberdade | Média: migalhas de pão presentes; páginas longas sem índice nem "voltar ao topo"; filtros sem "limpar tudo". |
| 4. Consistência | Média: cada seção tem um cartão diferente (linha do tempo, `ItemVotacao`, cartão de veto, cartão de tema). |
| 5. Prevenção de erros | Boa: lacunas explícitas e avisos de "não é o voto" em votação secreta e orientação. |
| 6. Reconhecer em vez de lembrar | Fraca: siglas sem nome nos cartões; termos explicados no fim da página, longe do uso. |
| 7. Flexibilidade e eficiência | Fraca no celular: sem busca global, sem atalho "meu deputado", filtros longos. |
| 8. Estética e minimalismo | **Fraca**: excesso de texto literal expandido; campos sem dado ocupando a dobra. |
| 9. Ajudar a reconhecer e corrigir erros | Boa: "Nenhum registro com esses filtros". Falta sugerir limpar os filtros. |
| 10. Ajuda e documentação | Boa (Metodologia, termos explicados), mas difícil (Flesch 46). |

## 7. O que já está bem (manter)

Não há transbordamento horizontal da página em nenhuma das 10 páginas, nas duas larguras. O contraste é AA em 100% dos textos medidos. O CLS é 0 e o LCP fica abaixo de 2,2 s em 4G lenta com CPU 4×. Há link "Pular para o conteúdo", foco visível de 3 px, `lang` correto e zoom permitido. Tabelas têm `caption` e regiões roláveis focáveis. Lacunas da fonte são declaradas, o tipo de votação vem sempre explicado e a paleta é neutra, sem cor de partido. Os títulos da linha do tempo do ICMS para combustíveis já estão no formato certo.

## 8. Limitações da medição

- O LCP e o CLS foram medidos com servidor local e rede emulada. Em produção (CDN da Vercel) o LCP tende a ser menor, mas o custo de parse em aparelhos de entrada não aparece aqui.
- O índice Flesch adaptado é uma aproximação por contagem de sílabas por vogais. Serve para comparar páginas, não como nota absoluta.
- Alvos de toque contados pela caixa do elemento. Links inline em frases entram na contagem, mas são exceção da WCAG 2.5.8.
- Não houve teste com usuários reais nem leitor de tela (TalkBack/VoiceOver). Recomenda-se uma rodada curta de teste com 5 pessoas sobre as três tarefas: "o que mudou?", "quem decidiu?" e "como votou meu deputado?".

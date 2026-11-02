# Placar do Poder — engajamento e retorno no celular (estudo de UX e produto)

Estudo apenas analítico (nenhum código ou dado alterado). Data: 02/11/2026.
Base: `diretrizes.md`, `dados/esquema.json`, `web/src/app`, `web/src/features`, `web/src/components`.
Nome do projeto: **Placar do Poder** (o código e os metadados ainda usam "Voto em Quem" — trocar em
`layout.tsx`, `metadata` e textos fixos é pré-requisito dos cartões de compartilhamento).

Premissa do usuário: o site está pouco amigável e o brasileiro se envolve pouco com política fora de
eleição. Logo, a porta de entrada não pode ser a sigla ("PL 1234/2026"), e sim **o que muda na vida da
pessoa** — dito com os números do documento oficial, sem opinião (seção 3).

Objetivo: aumentar a **adesão** (primeira visita que vira uso, e uso que vira retorno), sobretudo no celular,
sem ferir as diretrizes: neutralidade total, nenhum juízo de valor, nunca recomendar voto, fonte oficial e
data de coleta sempre visíveis, e LGPD (nada além de audiência sem identificação — diretriz 12).

---

## 1. Diagnóstico do estado atual

| Ponto | Situação hoje | Efeito na adesão |
|---|---|---|
| Home (`app/page.tsx`) | Texto institucional + destaque ICMS + cartões de seção | Explica *o que é* o site, mas não leva a uma resposta em 1 toque. Nenhum dado "vivo" (última votação, última mudança) |
| Navegação (`NavPrincipal`) | 8 itens atrás de "Menu" no celular | Seções organizadas por **instituição**; o público pensa por **pergunta** ("meu deputado", "meu imposto", "minha cidade") |
| Busca | Buscas locais por seção (`BuscaVotacoes`, `BuscaNormas`, `BuscaTemas`, `ListaParlamentares` com filtro de UF) | Não há busca única; quem chega pela home não sabe em qual seção procurar |
| Metadados | `generateMetadata` só com `title` e `description` | **Sem imagem Open Graph**: no WhatsApp o link aparece sem prévia visual, o que reduz cliques |
| Retorno | Nenhum mecanismo (sem RSS, PWA, alertas) | Dados mudam diariamente, mas o visitante não fica sabendo |
| Medição | `<Analytics />` só com visualizações de página | Não é possível saber se a pessoa encontrou o que buscava ou compartilhou |
| Privacidade (`app/privacidade`) | Diz "não há formulários" e "sem cookies" | Qualquer recurso novo de e-mail ou push exige **atualizar a política antes** |
| Títulos | Votação aparece como "PLP 186/2026" + ementa jurídica; ICMS já tem bons títulos ("Novo valor do ICMS da gasolina… R$ 1,47 por litro") | A sigla não diz nada ao leigo; o título ICMS mostra que o padrão "o que muda + quanto + quando" já funciona no site |
| Densidade | Tabelas, filtros e termos técnicos logo no primeiro nível | Sensação de "zero user friendly": o detalhe chega antes da resposta |
| Pontos fortes | Fontes com `FonteLink` (selo "Oficial"/"PDF"/"Reportagem"), linguagem explicada, `NAO_DISPONIVEL` explícito | Base de confiança excelente — é o diferencial a ser exibido no compartilhamento |

---

## 2. Jornadas principais no celular e como encurtá-las

Contagem de toques estimada a partir da home atual, em um celular.

| # | Jornada (como o público pergunta) | Caminho hoje | Toques hoje | Proposta | Toques |
|---|---|---|---|---|---|
| J1 | "Como votou o deputado/senador do meu estado?" | Menu → Congresso → Deputados → filtro UF → nome → perfil → rolar até votos | 6–7 | Atalho "Meu estado" na home (UF escolhida uma vez, guardada só no aparelho) → lista da bancada → perfil | 2–3 |
| J2 | "Como votou fulano?" (nome conhecido) | Menu → Congresso → Deputados/Senadores → digitar | 4 | **Busca única** na home: digitar o nome → resultado direto (deputado federal, senador, deputado estadual de SP) | 1–2 |
| J3 | "O que mudou no imposto que eu pago?" | Destaque ICMS → lista → decisão | 2–3 | Entrada por **produto** ("gasolina", "energia elétrica", "medicamentos") usando o campo `mudancas[].item` → cartão antes/depois | 2 |
| J4 | "O que decidiram na minha cidade?" | Menu → Atibaia | 2 | Bloco "Minha cidade" só aparece para quem escolheu Atibaia; para outras cidades, mensagem honesta: "Por enquanto, o site cobre o município de Atibaia" | 1 |
| J5 | "O que foi votado esta semana?" | Menu → Congresso → votações | 3 | Faixa "Últimas decisões" na home (cronológica, todas as fontes) | 1 |
| J6 | "Recebi este link no WhatsApp" (entrada mais comum) | Cai numa página profunda, sem contexto | — | Cabeçalho de contexto + "o que é este site" em 1 linha + "ver mais deste político/tema" | — |

### 2.1 Entrada por localidade sem guardar dado pessoal

- **Recomendado: seletor de UF (27 botões) e, para SP, município.** UF e município não identificam ninguém;
  guardar em `localStorage` apenas `{ uf: "SP", municipio: "atibaia" }`, com botão "Esquecer minha escolha".
  Nada é enviado ao servidor nem ao Analytics como dado do visitante.
- **CEP: só se for resolvido no próprio aparelho.** Uma tabela estática de faixas de CEP por UF/município
  (pública, de poucos KB) permite converter o CEP **localmente**, sem requisição. O CEP digitado é descartado
  na hora; guarda-se só a UF/município. Não usar APIs de CEP de terceiros (envio do dado para fora) nem
  geolocalização do navegador (pedido de permissão assusta e é desproporcional).
- Na prática, como a cobertura estadual/municipal é só SP/Atibaia, o seletor de UF resolve 90% do valor;
  CEP é opcional e de baixa prioridade.
- Texto do seletor (neutro, transparente): *"Escolha seu estado para ver primeiro a bancada dele. A escolha fica
  só neste aparelho; o site não recebe essa informação."*

### 2.2 Busca única

- Índice estático gerado no build (os scripts `gerar-*.mjs` já produzem JSON): nomes de parlamentares
  (Câmara, Senado, ALESP), títulos de decisões ICMS, MPs, vetos, temas STJ/STF, atos de Atibaia.
  Carregado sob demanda (ao focar no campo), dividido por tipo para manter leve no 4G.
- Resultados agrupados por tipo, em **ordem neutra** (alfabética; diretriz 6), nunca por "popularidade".
- Normalização sem acento (já existe `normalizar` em `ListaParlamentares`); sinônimos do glossário
  ("MP" → "medida provisória", "STF" → "Supremo Tribunal Federal").
- Sem registro de termos buscados com identificação; no Analytics, só a **categoria** do resultado clicado.

### 2.3 Atalhos por pergunta na home

Trocar a vitrine institucional por "perguntas" de entrada (texto neutro, sem verbo de opinião):
"Como votou meu deputado", "O que mudou no ICMS", "Decisões em Atibaia", "Julgamentos do STF e STJ",
"Medidas provisórias e vetos". A ordem fixa deve ser justificada (ex.: ordem da diretriz de fases) e
não mudar conforme assunto em alta, para não criar destaque editorial.

---

## 3. Padrão editorial de títulos: "o que muda na sua vida", neutro e verificável

### 3.1 Fórmula

```
[QUEM decidiu] + [VERBO do resultado] + [O QUE muda, em palavras do dia a dia]
               + [PARA QUEM, se o documento disser] + [QUANTO] + [QUANDO / etapa]
```

Cada pedaço é **preenchido a partir de um campo oficial**, nunca escrito livremente:

| Pedaço | Campo de origem (exemplos do `esquema.json`/dados) | Regra |
|---|---|---|
| Quem | `orgao`, `casa`, `caminho` | Nome do órgão por extenso ou forma popular fixa ("Câmara", "Senado", "Presidência", "CONFAZ (conselho dos secretários de Fazenda)", "STF") |
| Verbo | `resultado`, `tipo`, `instrumento`, `situacao` | Só do léxico fechado (3.3), escolhido por regra: `resultado=aprovada` → "aprova"; MP → "edita medida provisória que…"; veto → "veta"; tema com tese → "decide/fixa" |
| O que muda | `ementa`, `mudancas[].item`, `tese`, `questao` | Paráfrase **curta e fiel** da ementa/tese, com palavras do glossário; nada que não esteja no texto oficial |
| Para quem | ementa/tese/`mudancas[].item` | Só se o documento nomear o grupo (ex.: "Microempreendedor Individual", "servidores municipais"). Proibido deduzir ("afeta todos os motoristas") |
| Quanto | `mudancas[].antes/depois/unidade`, `placar`, valores da ementa | Todo número do título tem de existir, idêntico, no campo de origem |
| Quando / etapa | `datas.vigencia`, `data`, `prazos`, descrição ("primeiro turno", "ressalvados os destaques") | Etapa obrigatória quando não for decisão final: "em 1º turno", "texto principal", "falta votar no Senado" (só se a tramitação oficial disser) |

Limites: manchete de cartão até ~90 caracteres; título de página até ~120. Se faltar campo para
"quanto" ou "para quem", o pedaço é **omitido** — nunca estimado (diretriz 1).

### 3.2 Como o título simples convive com o nome oficial

```
Câmara aprova texto principal que muda o limite de faturamento     ← título simples (h1 / manchete)
e de empregados do MEI, por 461 a 4
Projeto de Lei Complementar 186/2026 · votação nominal · 14/10/2026 ← linha oficial (subtítulo fixo)
Texto oficial (ementa): "Altera a Lei Complementar nº 123, …"      ← nível 2, literal, entre aspas
Fonte: Câmara dos Deputados ↗ · coletado em 02/11/2026             ← sempre visível
```

- O nome oficial **por extenso** (diretriz 9: "Projeto de Lei Complementar", não "PLP") fica sempre
  logo abaixo, no cartão e na página; a sigla aparece só no link e na busca.
- O título simples é rotulado internamente como "resumo do Placar do Poder"; a ementa entre aspas é
  o texto do órgão. O leitor distingue os dois pela tipografia e pela palavra "Texto oficial".
- `<title>`/`og:title` = título simples; `og:description` = linha oficial + fonte. A busca indexa os dois.
- Proposta de campos novos no esquema (para o orquestrador decidir): `titulo_simples`,
  `titulo_simples_derivacao` (lista campo→pedaço), `titulo_simples_revisao` (data, situação).
  Sem `titulo_simples` aprovado, a interface usa o título oficial — o padrão nunca bloqueia a publicação.

### 3.3 Regras de neutralidade do título

- **Léxico fechado de verbos**: aprova, rejeita, edita, veta, mantém o veto, derruba o veto (termo
  oficial do Congresso), sanciona, decide, fixa tese, muda, passa de X para Y, sobe/cai (**só** quando
  calculado de `antes` e `depois` do mesmo documento), prorroga, isenta (termo da norma), autoriza gasto.
- **Proibido**: adjetivos e advérbios avaliativos (histórico, polêmico, abusivo, absurdo, finalmente,
  às pressas, silenciosamente), metáforas de conflito (vitória, derrota, goleada, virada, trator, manobra,
  rasteira, "governo sofre", "oposição impõe"), "a favor/contra" o país/o povo/o trabalhador, "pacote",
  "farra", "bomba", "taxação" (usar o termo da norma), perguntas retóricas, exclamações, caixa alta, emojis.
- **Sem dedução de efeito**: "ICMS da gasolina passa de R$ 1,57 para R$ 1,64 por litro" (dado); nunca
  "gasolina vai ficar mais cara" (o preço na bomba não está no documento).
- **Sem nome de político no título** de votação coletiva (o relator/autor aparece na ficha); nome só
  em ato individual (decreto, MP, veto, sanção), sempre pelo cargo + nome, igual para todos.
- **Simetria**: o mesmo modelo de frase para o mesmo tipo de decisão, qualquer que seja o partido ou o
  governo; "aprova" e "rejeita" têm o mesmo peso tipográfico.
- **Placar só com votação nominal** (diretriz 5). Simbólica: "aprovado em votação simbólica (sem
  registro de votos individuais)". Colegiado: "decisão do CONFAZ por unanimidade registrada". Ato
  individual: sem placar.

### 3.4 Metáfora do placar (marca "Placar do Poder")

Permitido, por ser descritivo: **placar** (só votação nominal: "461 × 4"), **resultado oficial**
("aprovada"/"rejeitada", palavra do órgão), **quem votou** (lista completa), **etapa** ("1º turno",
"falta o Senado"). Proibido, por atribuir vencedor/perdedor ou torcida: vencedor, perdedor, vitória,
derrota, goleada, virada, empate técnico, "time do governo/da oposição", cartão vermelho, torcida,
artilheiro, ranking. Visual: placar em tipografia grande e tons neutros iguais para Sim e Não; sem
cores de clube/partido. Em decisões sem votação nominal, o espaço do placar mostra o **caminho**
("Decisão individual do presidente da República"), para não simular disputa onde não houve.

### 3.5 Revisão automática + curadoria

1. **Geração por modelo** (template por tipo de decisão) a partir dos campos — primeira versão automática.
2. **Linter de título** (roda no build/CI, falha o item, não o site):
   - todo número e toda data do título existem no campo de origem (comparação literal após normalização);
   - verbo pertence ao léxico do tipo; nenhuma palavra da lista proibida (lista versionada no repositório);
   - toda sigla tem forma extensa na página; comprimento dentro do limite; sem nome de particular
     (diretriz 12) nem identificador técnico (diretriz 10);
   - etapa presente quando `situacao`/descrição indicar decisão não final;
   - **teste de simetria**: trocar partido/governo/órgão nos dados de teste não muda a frase além dos
     nomes; conjunto-ouro de títulos aprovados como teste de regressão.
3. **Curadoria humana por amostra e para todo título editado à mão**: checagem de fidelidade
   (título × ementa/tese) e de neutralidade pelos três analistas de viés (esquerda, centro, direita —
   diretriz 7), que **só vetam**, nunca reescrevem. Basta um veto fundamentado para voltar ao título
   oficial até nova redação.
4. **Registro**: cada título guarda origem (automático/editado), data de revisão e histórico; correções
   seguem a página de Correções (diretriz 13) e regeneram o cartão.

### 3.6 Dez exemplos reais reescritos

Dados de `dados/` em 02/11/2026. "Hoje" = como aparece no site/dado; "Proposto" = título simples;
a linha oficial vai no subtítulo.

| # | Seção | Hoje | Proposto (título simples) | Linha oficial (subtítulo) | Observação de verificação |
|---|---|---|---|---|---|
| 1 | ICMS · CONFAZ | Novo valor do ICMS da gasolina a partir de 01/02/2027: R$ 1,64 por litro | Imposto estadual na gasolina passa de R$ 1,57 para R$ 1,64 por litro em 1º de fevereiro de 2027 | Convênio ICMS 127/2026 · CONFAZ · decisão de colegiado | `mudancas[0].antes/depois/vigencia`; "imposto estadual" = glossário de ICMS; não diz "gasolina mais cara" |
| 2 | ICMS · ALESP | ICMS Educação: novos critérios para dividir entre os municípios a parte do ICMS ligada à educação | Cidades de SP passam a receber 100% do ICMS Educação conforme a qualidade do ensino (antes, 50%) | Lei estadual 18.381/2025 (Projeto de Lei 1.055/2025) · ALESP · votação nominal | `mudancas[0]` 50% → 100%; placar da ALESP entra só se registrado em `votacoes` |
| 3 | Câmara | PLP 186/2026 + "Aprovada a Subemenda Substitutiva Global…" | Câmara aprova texto principal que muda o limite de faturamento e de empregados do MEI, por 461 a 4 | Projeto de Lei Complementar 186/2026 · votação nominal · 14/10/2026 | "texto principal" vem de "ressalvados os destaques"; o novo limite **não** está na ementa → sem número |
| 4 | Câmara | PLP 281/2019 + "Rejeitada a Subemenda Substitutiva…" | Câmara rejeita texto do relator sobre regras para bancos, seguradoras e corretoras em crise: 252 votos Sim não bastaram (eram necessários 257) | Projeto de Lei Complementar 281/2019 · votação nominal · 14/10/2026 | "em crise" = paráfrase de "regimes de resolução" → validar no glossário; 257 = maioria absoluta (art. 69 da Constituição), citar com link; rejeitou-se a **subemenda**, não necessariamente o projeto |
| 5 | Senado | PEC 221/2019 (ementa) | Senado aprova em 1º turno, por 75 a 1, redução da jornada semanal máxima com 2 dias de descanso remunerado, sem redução de salário | Proposta de Emenda à Constituição 221/2019 · votação nominal · 14/10/2026 | Tudo da ementa; "1º turno" da descrição; o 2º turno (também 75 a 1) gera título próprio; próxima etapa só se a tramitação oficial informar |
| 6 | Executivo · MP | MPV 1398/2026 + "Abre crédito extraordinário…" | Presidência autoriza, por medida provisória, gasto extra de R$ 300 milhões com defesa civil para atingidos por desastres climáticos; Congresso tem até 19/12/2026 para votar | Medida Provisória 1.398/2026 · ato individual · 21/10/2026 | Valor e órgão da ementa; finalidade do campo do Senado (`apelido_senado`, fonte oficial); prazo de `prazos[]` |
| 7 | Executivo · veto | VET 9/2026 + "Veto parcial aposto ao PLN 15/2025…" | 37 trechos do Orçamento federal de 2026 vetados pela Presidência aguardam decisão do Congresso | Veto parcial 9/2026 ao Orçamento de 2026 (Lei 15.346/2026) · ato individual | `quantidade_dispositivos_fonte`=37, todos "Não Apreciado"; quando o Congresso votar, o título muda para "mantém/derruba X de 37 trechos" com placar por dispositivo |
| 8 | Justiça · STJ | Tema 999 + "Possibilidade de aplicação da regra definitiva…" | Quem já contribuía para o INSS antes de 26/11/1999 pode ter o benefício calculado pela regra definitiva quando ela for mais vantajosa, decidiu o STJ | Tema Repetitivo 999 · Primeira Seção do STJ · recurso ao STF pendente | Tese literal no nível 2; "recurso pendente" vem de `situacao` e é obrigatório (decisão não definitiva) |
| 9 | Justiça · STF | Tema 999: "Imprescritibilidade da pretensão de reparação civil de dano ambiental." | Não há prazo final para pedir na Justiça a reparação de dano ambiental, decidiu o STF | Tema 999 de repercussão geral · Recurso Extraordinário 654.833 · decisão definitiva (trânsito em julgado em 19/08/2020) | Paráfrase da tese "É imprescritível…"; "imprescritível" no glossário; data de `situacao` |
| 10 | Atibaia | Decreto 11.576 + "Dispõe sobre a opção de antecipação de 50%…" | Servidores da Prefeitura de Atibaia podem pedir metade do 13º salário no mês do aniversário | Decreto municipal 11.576/2026 · Prefeitura de Atibaia · ato individual · 26/01/2026 | Tudo da ementa ("opção" → "podem pedir"); sem nome de particular |

Contraexemplos (reprovados pelo linter): "Câmara dá goleada e aprova MEI" (metáfora proibida);
"Governo aumenta imposto da gasolina de novo" (o CONFAZ é colegiado dos estados; "de novo" é avaliativo;
dedução); "STF protege o meio ambiente para sempre" (juízo de valor); "Deputados derrubam proteção a
bancos" (dedução sobre o efeito de uma subemenda rejeitada).

---

## 4. Esboço — home mobile (360 px)

```
┌────────────────────────────────────┐
│ Placar do Poder             [Menu] │  cabeçalho fixo (já existe)
├────────────────────────────────────┤
│ O que foi decidido, quem decidiu   │  manchete curta (2 linhas)
│ e por quê. Fonte oficial em tudo.  │
│                                    │
│ ┌────────────────────────────────┐ │
│ │ 🔍 Buscar político, lei, tema… │ │  BUSCA ÚNICA (foco abre teclado)
│ └────────────────────────────────┘ │
│                                    │
│ Seu estado: [ SP ▾ ]  esquecer     │  opcional, salvo só no aparelho
│ ┌────────────────────────────────┐ │
│ │ Bancada de SP                  │ │  aparece se UF escolhida
│ │ 70 deputados federais ›        │ │
│ │ 3 senadores ›                  │ │
│ │ 94 deputados estaduais ›       │ │  (só SP)
│ └────────────────────────────────┘ │
│                                    │
│ ── Desde sua última visita ──      │  só se houver visita anterior
│ 4 votações novas · 2 mudanças ICMS │  (calculado no aparelho)
│ [ver novidades]                    │
│                                    │
│ Últimas decisões                   │  ordem cronológica, todas as fontes
│ ┌────────────────────────────────┐ │
│ │ CÂMARA · votação nominal       │ │  rótulo de caminho (diretriz 5)
│ │ Câmara aprova texto principal  │ │  TÍTULO SIMPLES (seção 3)
│ │ que muda o limite do MEI       │ │
│ │ PLACAR  461 × 4                │ │  placar oficial, sem cor partidária
│ │ Proj. de Lei Complementar      │ │  linha oficial por extenso
│ │ 186/2026 · 14/10 · Câmara ↗    │ │  fonte + data sempre visíveis
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ CONFAZ · decisão de colegiado  │ │
│ │ Imposto na gasolina passa de   │ │
│ │ R$ 1,57 para R$ 1,64 por litro │ │  antes → depois do documento
│ │ em 1º/02/2027                  │ │
│ │ Convênio ICMS 127/2026·CONFAZ ↗│ │
│ └────────────────────────────────┘ │
│ [ver todas as decisões]            │
│                                    │
│ Por onde começar                   │
│ [Como votou meu deputado      ›]   │  atalhos por pergunta,
│ [O que mudou no ICMS          ›]   │  alvo de toque ≥ 44 px
│ [Medidas provisórias e vetos  ›]   │
│ [Julgamentos do STF e STJ     ›]   │
│ [Decisões em São Paulo        ›]   │
│ [Decisões em Atibaia          ›]   │
│                                    │
│ Acompanhe sem cadastro             │
│ [Instalar no celular] [RSS]        │  PWA / feeds
│                                    │
│ Dados atualizados em 02/11/2026,   │  carimbo global de coleta
│ 06:10. Como coletamos › Correções ›│
└────────────────────────────────────┘
```

Regras do esboço: nenhuma cor associada a partido; "Últimas decisões" sem curadoria editorial (puramente
cronológica, mesma regra para todas as casas); textos curtos com detalhe a um toque.

---

## 5. Compartilhamento (WhatsApp primeiro)

### 5.1 Cartões Open Graph por página

- Implementar `opengraph-image.tsx` (Next.js `ImageResponse`) nas rotas dinâmicas já existentes:
  votação (`congresso/votacoes/[casa]/[id]`), parlamentar (`congresso/[casa]/parlamentares/[id]`,
  `sao-paulo/deputados/[id]`), decisão ICMS (`impostos/icms/[id]`), MP, veto, temas STJ/STF.
  Gerar estaticamente no build sempre que possível (custo zero por acesso).
- Formato 1200×630 (padrão), PNG/JPEG < 300 KB (o WhatsApp descarta imagens grandes), conteúdo
  importante na **zona central quadrada** (o WhatsApp recorta para quase quadrado em algumas telas).
- Completar `openGraph`/`twitter` em `generateMetadata`: `og:title` = título simples aprovado (seção 3;
  na falta dele, o título oficial), `og:description` = linha oficial + fonte + data, `og:url` canônica,
  `og:site_name="Placar do Poder"`, `og:locale=pt_BR`.

### 5.2 Esboço — cartão horizontal (1200×630)

```
┌──────────────────────────────────────────────────────────────┐
│ PLACAR DO PODER · decisões com fonte oficial                 │ faixa neutra (cinza-azulado)
├──────────────────────────────────────────────────────────────┤
│ CÂMARA DOS DEPUTADOS · votação nominal · 14/10/2026          │ caminho + data da decisão
│                                                              │
│ Câmara aprova texto principal que muda o limite de           │ TÍTULO SIMPLES (seção 3),
│ faturamento e de empregados do MEI                           │ 2 linhas, fonte grande
│ Projeto de Lei Complementar 186/2026                         │ linha oficial por extenso
│                                                              │
│   PLACAR        SIM 461   ×   NÃO 4                          │ números grandes, MESMA cor
│   Abstenção 0 · Obstrução 0                                  │ placar completo
│   Resultado oficial: aprovada (ressalvados os destaques)     │ palavra do órgão + etapa
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Fonte: Câmara dos Deputados · coletado em 02/11/2026         │ fonte + coleta SEMPRE
│ Quem votou e justificativas: [domínio]/v/c2635476-36         │ link curto impresso
└──────────────────────────────────────────────────────────────┘
```

Variante **parlamentar**: nome, cargo, partido/UF (texto, sem logotipo partidário), "N votações nominais
registradas desde AAAA", "presença em Plenário: X de Y sessões (fonte Câmara)". **Sem** foto grande em
destaque (evita parecer santinho), **sem** frase "votou a favor de/contra" e sem índices compostos.

Variante **ICMS**: título simples ("Imposto estadual na gasolina passa de R$ 1,57 para R$ 1,64 por
litro em 1º/02/2027"); no lugar do placar, "ANTES R$ 1,57 → DEPOIS R$ 1,64 por litro"; caminho
"Decisão de colegiado — CONFAZ"; linha oficial "Convênio ICMS 127/2026".

Variante **ato individual** (MP, decreto, veto): sem placar; o bloco mostra o caminho ("Decisão
individual da Presidência da República") e, se houver, o prazo oficial ("Congresso tem até 19/12/2026").

### 5.3 Cartão vertical (Stories/Status/TikTok — 1080×1920)

```
┌────────────────────────┐
│ PLACAR DO PODER        │
│                        │
│ SENADO FEDERAL         │
│ votação nominal        │
│ 14/10/2026 · 1º turno  │ etapa obrigatória
│                        │
│ Senado aprova redução  │ TÍTULO SIMPLES
│ da jornada semanal     │ (até 5 linhas)
│ máxima, com 2 dias de  │
│ descanso remunerado,   │
│ sem redução de salário │
│ Proposta de Emenda à   │ linha oficial
│ Constituição 221/2019  │
│                        │
│   SIM 75  ×  NÃO 1     │ placar, mesma cor
│ Resultado: aprovada    │
│                        │
│ ────────────────────── │
│ Fonte: Senado Federal  │
│ coletado em 02/11/2026 │
│                        │
│ [domínio]/v/s7106      │ (Status do WhatsApp não tem link
│ [QR code]              │  clicável: link + QR impressos)
└────────────────────────┘
  zona de segurança: 250 px livres no topo e na base (interface do app cobre)
```

Gerado sob demanda por botão "Baixar imagem para Status/Stories" (rota de imagem com
`?formato=vertical`), usando Web Share API Level 2 (`navigator.share({ files })`) quando disponível.

### 5.4 Textos prontos neutros

Botão "Compartilhar" usa `navigator.share` (abre a folha nativa, onde o WhatsApp é o primeiro destino);
fallback: link `https://wa.me/?text=` + "Copiar link". Texto montado **só com campos do documento**:

> Placar do Poder: Câmara aprova texto principal que muda o limite de faturamento e de empregados do MEI
> (Projeto de Lei Complementar 186/2026, votação nominal em 14/10/2026). Placar oficial: Sim 461, Não 4.
> Quem votou e fonte oficial: [domínio]/v/c2635476-36

> Placar do Poder: Imposto estadual (ICMS) na gasolina passa de R$ 1,57 para R$ 1,64 por litro em
> 1º/02/2027 (Convênio ICMS 127/2026, decisão do CONFAZ). Documento oficial: [domínio]/i/confaz-convenio-127-2026

Regras: nenhum adjetivo, nenhum emoji de reação, nenhuma hashtag partidária, nenhum "veja como fulano
traiu/defendeu"; o usuário pode editar o texto no app dele — o site só fornece a versão neutra.

### 5.5 Links curtos

Rotas curtas estáveis no próprio domínio (sem encurtador de terceiro que rastreia): `/v/c{id}` (votação
Câmara), `/v/s{id}` (Senado), `/p/{id}` (parlamentar), `/i/{id}` (ICMS), redirecionando 308 para a
URL canônica. Parâmetro de origem opcional `?o=wa` apenas para contar no Analytics o canal (sem identificador
individual; não gerar IDs únicos por compartilhamento, que permitiriam rastrear cadeias de envio).

### 5.6 Proteções anti-recorte e anti-propaganda (regras do cartão)

1. Fonte oficial e data de coleta **dentro da imagem** (não só no texto do post) — sobrevivem a print e reenvio.
2. Rótulo do caminho (nominal/simbólica/colegiado/ato individual) sempre no cartão (diretriz 5).
3. Placar completo (todas as opções, inclusive abstenção/obstrução/ausência), nunca só um lado.
4. Cores neutras idênticas para Sim/Não; nenhuma cor de partido; nenhum ícone de "polegar".
5. Cartão de **parlamentar individual** nunca mostra um único voto isolado como manchete; mostra o voto
   dentro do contexto da votação (proposição + placar) e link para a lista completa.
6. Sem foto em destaque, sem número de urna, sem slogan, sem "vote", "apoie", "cobre", "eleja".
7. Marca d'água discreta com URL e data de geração; a imagem é regenerada quando há correção
   (diretriz 13) e mostra "corrigido em DD/MM/AAAA".
8. Mesmo modelo para todos (diretriz 6): não existe cartão "especial" para nenhum político/partido.

---

## 6. Retorno sem conta

| Mecanismo | Como funciona | Dados pessoais | Esforço |
|---|---|---|---|
| **"Desde sua última visita"** | `localStorage` guarda a data da última visita; a home compara com um `novidades.json` estático (gerado no build, lista de itens com data de coleta) e mostra contagem | Nenhum (fica no aparelho) | Baixo |
| **Seguir sem conta** | Botão "Acompanhar este político/tema" guarda IDs no `localStorage`; página "Acompanhando" lista novidades desses IDs | Nenhum | Baixo/médio |
| **RSS/Atom** | Feeds estáticos: geral, por casa, por parlamentar, ICMS, STF, STJ, Atibaia | Nenhum | Baixo |
| **PWA instalável** | `app/manifest.ts`, ícones, service worker com cache das páginas visitadas (leitura offline) | Nenhum | Baixo/médio |
| **Web Push opcional** | Só após clique explícito em "Receber aviso"; assinatura guarda endpoint + tópicos, sem nome/e-mail. iOS só funciona com o PWA instalado (iOS 16.4+) | O endpoint de push é dado técnico pseudônimo → exige base legal (consentimento), política atualizada, botão de cancelar e exclusão automática de assinaturas inválidas | Médio/alto (precisa backend: Vercel Functions + KV) |
| **E-mail semanal** | Dupla confirmação (double opt-in), consentimento específico, link de descadastro em todo envio, retenção mínima, operador com DPA | E-mail é dado pessoal → consentimento (art. 7º, I e art. 8º LGPD), registro do consentimento, direitos do titular | Alto |

Recomendação: começar por **local + RSS + PWA** (zero dado pessoal, compatível com a política atual).
Push e e-mail só depois, e somente com a Política de Privacidade revisada **antes** do lançamento, já que
hoje ela afirma que não há formulários nem coleta. O conteúdo de qualquer aviso segue o mesmo padrão
neutro do cartão ("Nova votação nominal registrada: … Fonte: …").

Cuidado com "seguir": a lista de quem o visitante acompanha revela preferência política (dado sensível,
art. 5º, II, LGPD — "opinião política"). Por isso ela **nunca** sai do aparelho, e o push por político
deve preferir tópicos genéricos ou, se por político, nunca vincular a assinatura a qualquer identificador
adicional e documentar isso na política.

---

## 7. Linguagem: três níveis de profundidade

```
Nível 1 — manchete (1 linha, leitura de 3 s)
  "Câmara aprova texto principal que muda o limite do MEI, por 461 a 4" (título simples, seção 3)
Nível 2 — o que mudou (3–5 linhas, tocar para abrir)
  ementa oficial · antes → depois com números do documento · quem decidiu · caminho
Nível 3 — detalhe e fonte
  votos individuais · orientações de bancada · justificativas oficiais (autor e contrárias)
  · documento oficial ↗ · data de coleta · histórico de correções
```

- Resumo em linguagem simples: limitado ao que o documento diz (campo `resumo`, até 50 palavras, já no
  esquema). Frases curtas, voz ativa, números com unidade ("R$ 1,64 por litro"), datas por extenso no
  nível 1 ("29 de outubro").
- **Glossário contextual**: termo sublinhado pontilhado abre um balão/"bottom sheet" com a definição de
  `dados/icms/glossario.json` (expandir para um glossário geral). No celular, abrir por toque, fechar
  por toque fora/Esc; a primeira ocorrência na página vem por extenso (diretriz 9), as seguintes podem
  usar a sigla com balão.
- Usar `<details>/<summary>` para níveis 2 e 3 (acessível, funciona sem JavaScript).
- Evitar "jargão de neutralidade" que soa defensivo; uma frase fixa basta: "Quem julga é o leitor."

---

## 8. Confiança sem poluir

1. **Selo de fonte compacto** (evolução do `FonteLink`): `Oficial · Câmara ↗ · coletado 30/10` em uma
   linha cinza, no rodapé de cada cartão. Tocar abre um painel com título do documento, órgão, URL
   completa e data/hora da coleta.
2. **Carimbo global** no rodapé da home e de cada seção: "Dados atualizados em DD/MM/AAAA às HH:MM"
   (de `meta.json` / `atualizado_em`), com link "Como coletamos".
3. **Página "Correções"** pública e cronológica (diretriz 13) + aviso na página afetada; erros
   reconhecidos aumentam credibilidade.
4. **"Informação não disponível em fonte oficial"** com estilo próprio discreto (já existe `.lacuna`):
   mostrar a lacuna é sinal de honestidade, não deve ser escondido.
5. Bloco fixo e curto "Como este site funciona" no primeiro acesso (descartável, lembrado no aparelho):
   *fontes oficiais · mesmo critério para todos · sem classificação de votos · sem cadastro.*
6. Domínio próprio `.br` e e-mail de contato no domínio, quando possível (o contato atual é Gmail).
7. Transparência sobre quem mantém o site e financiamento ("sem patrocínio partidário"), na página Sobre.

---

## 9. Métricas com Vercel Web Analytics (sem identificar pessoas)

Observações: eventos personalizados (`track()` de `@vercel/analytics`) exigem plano Pro ou superior e têm
limite de propriedades por evento — conferir o plano. **Nunca** enviar nome de político, termo digitado,
UF escolhida associada a comportamento, ou qualquer ID de visitante. Propriedades só com **categorias**.

| Evento | Propriedades (categóricas) | Pergunta que responde |
|---|---|---|
| `busca_resultado_clicado` | `tipo` (deputado, senador, dep_estadual, icms, mp, veto, stf, stj, atibaia), `posicao` (1–3, 4–10, 10+) | A busca única resolve? |
| `busca_sem_resultado` | `tipo_busca` (geral) | Onde falta cobertura (sem guardar o termo) |
| `atalho_home` | `atalho` (meu_deputado, icms, mp_vetos, justica, sp, atibaia) | Quais jornadas o público quer |
| `uf_escolhida` | nenhuma (só contagem) — não enviar a UF | Adoção do recurso de localidade |
| `compartilhar` | `metodo` (nativo, whatsapp, copiar), `pagina` (votacao, parlamentar, icms, mp, veto, tema) | Viralização por tipo de conteúdo |
| `imagem_baixada` | `formato` (horizontal, vertical) | Uso em Status/Stories |
| `fonte_aberta` | `orgao` (camara, senado, confaz, …) | As pessoas checam a fonte? (métrica de confiança) |
| `nivel_expandido` | `nivel` (2, 3), `pagina` | Profundidade de leitura |
| `glossario_aberto` | `secao` | Onde a linguagem ainda é difícil |
| `novidades_vistas` | `faixa` (1–5, 6–20, 20+) | O retorno funciona |
| `acompanhar` | `tipo` (politico, tema) — sem ID | Interesse em seguir |
| `pwa_instalado` / `rss_clicado` | `feed` (geral, casa, tema) — nunca feed de político específico | Canais de retorno |

Indicadores derivados: taxa de chegada por `?o=wa` (referenciador), % de visitas com `fonte_aberta`,
proporção de páginas profundas como entrada, visitas recorrentes estimadas pela contagem de
`novidades_vistas` (sem identificar pessoas). Atualizar a seção 2 da Política de Privacidade descrevendo
os eventos (são agregados e sem identificação, mesma base legal).

---

## 10. Riscos e mitigações

| Risco | Exemplo | Mitigação |
|---|---|---|
| **Título simples vira manchete opinativa** | Paráfrase escorrega para efeito deduzido ("gasolina mais cara") ou adjetivo | Fórmula preenchida por campos, linter (números/datas literais, léxico fechado, lista proibida, simetria), veto dos três analistas, volta automática ao título oficial |
| **Metáfora do placar sugere disputa** | "Placar" em decreto ou leitura de "time vencedor" | Placar só em votação nominal; vocabulário de vencedor/perdedor proibido; cores iguais para Sim e Não; ato individual mostra o caminho, não placar |
| **Recorte de cartão** | Print só da linha "Fulano: Sim" circulando como "Fulano votou para aumentar imposto" | Fonte, data, caminho e placar completo dentro da imagem; cartão de parlamentar sem voto isolado como manchete; link curto + QR impressos; página de destino mostra contexto completo |
| **Adulteração de imagem** | Alguém edita o número do placar | Página "Verificar cartão": o link curto impresso leva ao dado vivo; rodapé "confira no link"; cada cartão tem ID e data de geração |
| **Desinformação por desatualização** | Cartão antigo reenviado após correção | Imagem regenerada após correção com "corrigido em"; página destino sempre mostra a versão atual e o histórico |
| **Uso eleitoral do site** | Campanha usa cartões como peça de propaganda | Cartões sem foto, slogan, número, cor ou chamada a votar; modelo idêntico para todos; Termos de Uso pedindo que reproduções mantenham a fonte; não aceitar parcerias com partidos/campanhas |
| **Legislação eleitoral 2028 (municipal — Atibaia!) e 2030** | Lei 9.504/1997 (arts. 36, 36-A, 57-A a 57-J) e resoluções do TSE (ex.: 23.610/2019 sobre propaganda; 23.600/2019 sobre pesquisas, inclusive vedação de enquetes no período eleitoral; regras de 2024 sobre conteúdo sintético) | **Nunca** criar enquetes, "quiz de afinidade com candidato" ou ranking de políticos; não impulsionar (pagar anúncio de) conteúdo sobre candidatos — impulsionamento eleitoral é restrito a candidatos, partidos e coligações; não usar imagens geradas/alteradas de pessoas reais; durante o período eleitoral, revisar a home para não destacar candidatos (manter ordem cronológica/alfabética); consulta jurídica eleitoral antes de agosto de 2028 |
| **Desequilíbrio aparente** | "Últimas decisões" mostra sequência de vitórias de um grupo | Critério puramente cronológico e público ("ordenado pela data da decisão"); nada de "mais compartilhados" ou "em alta" |
| **Dado sensível (opinião política)** | Lista de "seguindo" ou push por político revela preferência | Tudo local; push apenas por tópico genérico na primeira versão; Analytics sem ID de político |
| **Particulares em Atibaia** | Cartão de ato municipal exibe nome de permissionário | Gerador de cartão usa só os campos já tratados ("[nome de particular omitido]"); teste automático que falha se o cartão contiver campo com nome de particular |
| **Termos de Uso/Responsabilidade** | Cartão usado fora de contexto em processo/disputa | Termos de Uso com licença de reprodução condicionada à manutenção de fonte e data |

---

## 11. Recomendações priorizadas (impacto × esforço)

Impacto: A (alto), M (médio), B (baixo). Esforço: B (dias), M (1–2 semanas), A (mais de 2 semanas ou backend novo).

| Prio | Recomendação | Impacto | Esforço | Depende de |
|---|---|---|---|---|
| 1 | Padrão editorial de títulos simples (seção 3): modelos por tipo + linter + curadoria por veto; nome oficial por extenso no subtítulo | A | M | — |
| 2 | Imagens Open Graph por página com a marca Placar do Poder (votação, parlamentar, ICMS, MP, veto, temas) + `openGraph` completo | A | B/M | 1 |
| 3 | Botão "Compartilhar" (Web Share + WhatsApp + copiar) com texto pronto neutro gerado só de campos oficiais | A | B | 1, 2 |
| 4 | Home mobile por perguntas + "Últimas decisões" cronológica com título simples, placar/antes→depois, fonte e data | A | M | 1 |
| 5 | Busca única na home (índice estático no build, ordem neutra, indexa título simples e nome oficial) | A | M | — |
| 6 | Atalho "Meu estado" (UF guardada só no aparelho, sem CEP/geolocalização) | A | B | 4 |
| 7 | Política anti-recorte e Termos de Uso de reprodução; testes que barram cartões sem fonte/data, com nome de particular ou vocabulário proibido | A (risco) | B | 2 |
| 8 | Métricas de adesão com `track()` categórico + atualização da Política de Privacidade | M/A | B | Plano Vercel Pro |
| 9 | "Desde sua última visita" e "Acompanhar" com `localStorage` + `novidades.json` estático | M/A | B/M | 4 |
| 10 | Três níveis de profundidade (`<details>`) + glossário contextual em balão, glossário geral | M | M | — |
| 11 | Selo de fonte compacto, carimbo global de atualização e página pública de Correções | M | B | — |
| 12 | PWA instalável + feeds RSS/Atom (geral, por casa, por tema, por parlamentar) | M | B/M | — |
| 13 | Links curtos no próprio domínio (`/v/…`, `/p/…`, `/i/…`) com `?o=wa` | M | B | 2 |
| 14 | Cartão vertical para Status/Stories com QR e link impresso | M | M | 2 |
| 15 | Web Push opcional por tópico (requer backend, consentimento e política nova) | M | A | 8, 12 |
| 16 | E-mail semanal com dupla confirmação e LGPD completa | B/M | A | 8 |
| 17 | Revisão jurídica eleitoral e "modo período eleitoral" antes de ago/2028 | A (risco) | B | — |

Sequência sugerida: **Fase 1 (2–3 semanas)**: 1, 2, 3, 7, 11, 13, 8 (e troca do nome no código).
**Fase 2**: 4, 5, 6, 9. **Fase 3**: 10, 12, 14. **Fase 4 (opcional)**: 15, 16. Item 17 com data marcada.

### Critérios de sucesso sugeridos

- Prévia com imagem em 100% das páginas de detalhe (validar no WhatsApp e no depurador de compartilhamento do Facebook).
- Jornada J1 em até 3 toques; J2 em até 2.
- Crescimento da fração de visitas com referenciador WhatsApp e de `compartilhar` por 1.000 visualizações.
- `fonte_aberta` em pelo menos uma parcela crescente das visitas a páginas de detalhe (sinal de confiança).
- Zero cartão publicado sem fonte e data (teste automático); 100% dos títulos simples aprovados pelo linter.

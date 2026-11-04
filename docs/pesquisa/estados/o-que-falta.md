# O que falta para acompanhar cada estado

Situação em **03/11/2026**. O site já acompanha SP, AM, PI, PB, RO, RN, ES, RS, MG, SE e BA. Este arquivo trata das 16 unidades da Federação que ainda aparecem como "Em breve". Ele resume a pesquisa de 02/11/2026 (arquivos `<uf>.md` e `resumo-*.md` desta pasta) e o que foi feito nesta rodada.

**Como ler.** "Acompanhar" quer dizer mostrar, com fonte oficial e data de coleta, quatro coisas: os deputados, os projetos com o andamento, o resultado das votações (e o voto de cada deputado quando houver votação nominal registrada) e as leis e decretos. O que a fonte oficial não publica aparece como "Informação não disponível em fonte oficial". Nada é deduzido.

**Esforço** (trabalho de uma pessoa com o padrão de coletor do projeto):
- **baixo**: até 1 dia (a fonte tem API aberta ou o coletor já existe);
- **médio**: 2 a 4 dias (raspagem de páginas HTML ou extração de PDF com texto);
- **alto**: 1 semana ou mais (PDF digitalizado, OCR, conferência humana de cada votação);
- **depende de terceiros**: só anda com resposta a pedido pela Lei de Acesso à Informação (LAI) ou com liberação do órgão.

**Pedidos pela LAI já redigidos** (em `docs/pesquisa/pedidos-lai/`, nenhum enviado): MT, MS, GO, RJ, PR e DF.

## Resumo

| UF | Situação depois desta rodada | Deputados | Projetos | Votações e voto de cada deputado | Leis e decretos | O que falta (principal) | Esforço |
|---|---|---|---|---|---|---|---|
| **AC** | Coletor pronto (SAPL) | Sim | Sim | Resultado: sim. Voto nominal: só em vetos | Leis: não (o SAPL não tem as de 2026). Decretos: bloqueados pelo robots.txt | Ligar no workflow; leis e decretos por curadoria ou LAI | baixo + depende de terceiros |
| **AL** | Coletor pronto (SAPL) | Sim | Sim | O SAPL parou em 2019: só registros de 2019, nenhum da legislatura atual | Leis: sim. Decretos: só no Diário Oficial | Ligar no workflow; coletor do Diário Oficial; votos por LAI | baixo + médio |
| **AP** | Falta coletor | Página HTML | Página HTML (eLegis) | Resultado na ata em texto; sem voto nominal | Leis no eLegis; decretos no Diário Oficial (JSON) | Raspador do eLegis e do Diário Oficial | médio |
| **CE** | Falta coletor | Página HTML | Página HTML (sistema antigo) | 60 votações nominais em PDF (2023–2026) | Diário Oficial em PDF | Raspador de projetos; leitor dos PDFs de votação com conferência | médio a alto |
| **DF** | Coletor pronto (API do PLe) | Sim (sem partido) | Sim | Só nas atas (PDF); a API não traz | Sim, leis e decretos com publicação no Diário Oficial | Ligar no workflow; votos dependem da LAI já redigida | baixo + depende de terceiros |
| **GO** | Bloqueado no Legislativo | Página HTML | **Bloqueado** (robots.txt proíbe tudo) | Bloqueado | API aberta da Casa Civil, com razões de veto | Coletor de normas e vetos (fácil); Legislativo depende da LAI já redigida | baixo + depende de terceiros |
| **MA** | Falta coletor | API aberta | API aberta | Votação simbólica; sem dado estruturado | API aberta | Coletor da API ALEMALEGIS | baixo a médio |
| **MS** | Parcial, com barreira | Nos relatórios de votação | **Bloqueado** (CAPTCHA) | Publicado como imagem dentro do PDF do Diário | Diário Oficial em PDF e Governadoria | OCR com conferência humana; LAI já redigida pede os dados abertos | alto + depende de terceiros |
| **MT** | Parcial, com barreira | Página HTML | Só página por página (robots.txt proíbe as listas); API exige credencial | Não publicado em formato aberto | Diário Oficial (IOMAT) com busca em JSON | Coletor de normas; credencial da API pedida na LAI já redigida | médio + depende de terceiros |
| **PA** | Falta coletor | Página HTML | Página HTML (formulário) | Voto nominal em HTML (só em parte das matérias) | API aberta do Banco de Leis | Raspador das votações e coletor da API de leis | médio |
| **PE** | Coletor pronto (dados abertos da ALEPE) | Sim (só nome e partido) | Sim, com resultado de cada discussão e número da lei | Resultado: sim. Voto de cada deputado: não publicado | Sim, leis e decretos do Executivo | Ligar no workflow; votos nominais (raros) só em ata | baixo + alto (votos) |
| **PR** | Coletor pronto (API da ALEP) | Sim (nome e partido, página HTML) | Sim, com resultado de cada turno e lei gerada | Resultado: sim. Voto de cada deputado: **bloqueado** (robots.txt e CAPTCHA) | Leis, LCs, resoluções, decretos legislativos e ECs: sim. Decretos do governador: só no Diário Oficial | Votos dependem da LAI já redigida; coletor de decretos do Diário Oficial | depende de terceiros + médio |
| **RJ** | Difícil | Página HTML | Sistema antigo (Lotus Notes) | Só o placar nas notas taquigráficas | Leis: sistema antigo. Decretos: PDF com acesso dificultado | Raspador do sistema antigo; votos e decretos pela LAI já redigida | alto + depende de terceiros |
| **RR** | Coletor pronto (SAPL) | Sim | Sim | Nenhum voto lançado no SAPL; resultado só na ata digitalizada | Leis: sim. Decretos: só no Diário Oficial | Ligar no workflow; atas por curadoria | baixo + alto (votações) |
| **SC** | Falta coletor | Página HTML | Página HTML (e-Legis) | Voto nominal publicado em HTML ("extrato de votação"), sem partido | Sistema de leis da ALESC (leis e decretos) | Raspador do e-Legis e do sistema de leis | médio |
| **TO** | Coletor pronto (SAPL) | Sim (sem partido no SAPL) | Sim | Sem sessões no SAPL desde 12/05/2026; nenhum voto | Leis: sim (até jul/2026). Decretos: só no Diário Oficial | Ligar no workflow; Diário da Assembleia por curadoria | baixo + alto (votações) |

## Estado por estado

### Acre (AC)
- **Feito nesta rodada:** o coletor SAPL agora inclui a Assembleia do Acre (`sapl.al.ac.leg.br`). Coleta deputados, projetos, sessões, resultado das votações, votos nominais e normas. Coleta real pequena gravada em `dados/estados/ac/`.
- **O que a fonte tem:** o voto de cada deputado só aparece nas votações de vetos (42 itens nominais; os últimos são de março de 2026). As demais votações são simbólicas, só com os totais; o voto de cada deputado fica "Informação não disponível em fonte oficial". Na coleta pequena: 100 votações (out/2025 a ago/2026), 89 simbólicas e 11 nominais, 6 delas já com os votos de cada deputado; as outras completam nas próximas execuções.
- **O que falta:**
  1. Incluir `ac` no workflow (comando abaixo). Esforço baixo.
  2. Leis e decretos de 2026: o SAPL do Acre não tem normas recentes. O Diário Oficial e o portal LEGIS proíbem a coleta automática no robots.txt, e o banco de leis da Assembleia (Legisla-e) só funciona com JavaScript. Saída: curadoria manual no navegador ou pedido pela LAI à Casa Civil e à Assembleia, pedindo a liberação ou uma cópia dos dados. **Pedido ainda não redigido.** Depende de terceiros.

### Alagoas (AL)
- **Feito nesta rodada:** coletor SAPL ampliado para `sapl.al.al.leg.br`, com coleta real pequena em `dados/estados/al/`.
- **O que a fonte tem:** projetos e leis em dia. As votações registradas no SAPL vão só até 13/12/2019, fora da legislatura atual. A primeira página lida trouxe 100 registros de votação de 15/05/2019 (resultado e totais, ainda sem o tipo de votação); eles ficam guardados como a fonte traz, mas não há nenhuma votação da legislatura 2023–2027.
- **O que falta:**
  1. Incluir `al` no workflow. Esforço baixo.
  2. Decretos do governador: só no Diário Oficial do Estado, que tem uma lista de edições em JSON e o PDF de cada edição. Falta escrever o coletor e separar os decretos dentro do PDF. Esforço médio.
  3. Votos: a própria Assembleia recebe pedidos pela LAI de votações nominais, sinal de que não publica esse dado. **Pedido ainda não redigido.** Depende de terceiros.

### Amapá (AP)
- **O que a fonte tem:** o sistema eLegis da Assembleia mostra projetos, atas e leis em páginas HTML, sem API (o sistema se diz "em implantação"). A ata traz o resultado ("unanimidade dos presentes") e a lista de ausentes, sem voto nominal. O Diário Oficial usa a mesma plataforma do Amazonas, com lista em JSON e PDF.
- **O que falta:** escrever um raspador do eLegis (projetos, atas e leis) e um coletor do Diário Oficial para os decretos. O voto de cada deputado fica "Informação não disponível em fonte oficial". Esforço médio.

### Ceará (CE)
- **O que a fonte tem:** projetos em páginas HTML do sistema antigo (`www2`), com andamento e número da lei. Há 60 votações nominais publicadas entre 2023 e 2026, cada uma em PDF, com um índice em CSV no Portal da Transparência. O Diário Oficial sai em PDF com endereço previsível.
- **O que falta:**
  1. Raspador dos projetos. Esforço médio.
  2. Leitor dos 60 PDFs de votação, conferindo cada lista de nomes com os totais antes de publicar. Como são poucas, cabe conferência humana. Esforço médio a alto.
  3. Decretos: separar os atos no PDF do Diário Oficial. Esforço médio.
- **Cuidado:** o robots.txt de `www.ce.gov.br` respondeu 403 e não pôde ser lido. Esse domínio deve ser evitado; usar só os PDFs em `imagens.seplag.ce.gov.br`.

### Distrito Federal (DF)
- **Feito nesta rodada:** coletor novo (`scripts/coleta/estados/abertos/`) para a API pública documentada do Processo Legislativo Eletrônico (PLe) da Câmara Legislativa. Coleta deputados (autores ativos), todas as proposições do ano, com a etapa, e as normas do ano (leis, leis complementares, decretos do governador), com a publicação no Diário Oficial do DF e o projeto de origem. Coleta real gravada em `dados/estados/df/`: 24 deputados, 3.096 proposições de 2026, 1.711 normas de 2026 (40 delas já com o detalhe da publicação).
- **O que falta:**
  1. Incluir no workflow. Esforço baixo.
  2. Partido dos deputados: o cadastro de autores do PLe não preenche o partido. Fica "Informação não disponível em fonte oficial" até haver fonte oficial estruturada (o portal da CLDF tem a lista em HTML, ainda não coletada; esforço baixo).
  3. Votações: a API pública não traz votações. Elas ficam nas atas das sessões (PDF), e a maioria é simbólica. O pedido pela LAI já está redigido em `docs/pesquisa/pedidos-lai/df.md`: pede a folha de votação na API pública. Depende de terceiros.

### Goiás (GO)
- **O que a fonte tem:** o sistema legislativo da Assembleia (ALEGO Digital) tem `robots.txt` com `Disallow: /`, ou seja, **proíbe toda coleta automática**. O governo tem uma API aberta da Casa Civil com leis, decretos e mensagens de veto com as razões, e o Diário Oficial tem busca em JSON.
- **O que falta:**
  1. Coletor de leis, decretos e vetos pela API da Casa Civil. Esforço baixo. Daria ao site os atos do governador de Goiás, mesmo sem a Assembleia.
  2. Projetos e votações da Assembleia: só com autorização ou dados abertos. Pedido pela LAI já redigido em `docs/pesquisa/pedidos-lai/go.md`. Depende de terceiros.

### Maranhão (MA)
- **O que a fonte tem:** o sistema novo da Assembleia (ALEMALEGIS) tem uma API pública em JSON, sem documentação, com deputados, projetos, andamento e normas. As votações são simbólicas e não há voto estruturado (a rota de votos existe, mas está vazia).
- **O que falta:** escrever o coletor da API (filtrar os deputados pela legislatura 20) e testar o formato, porque o sistema acabou de entrar no ar. Esforço baixo a médio. O voto de cada deputado fica "Informação não disponível em fonte oficial".

### Mato Grosso do Sul (MS)
- **O que a fonte tem:** é o único estado do Centro-Oeste que publica o voto de cada deputado ("Lista de votação" no Diário da Assembleia), mas **como imagem dentro do PDF**. O sistema de proposições tem API protegida por CAPTCHA, que não deve ser contornado.
- **O que falta:**
  1. Leitor de PDF com reconhecimento de texto (OCR) e fila de conferência humana para cada votação. Esforço alto.
  2. Projetos: dependem de acesso sem CAPTCHA. O pedido pela LAI já redigido (`docs/pesquisa/pedidos-lai/ms.md`) pede os dados em formato aberto. Depende de terceiros.
  3. Normas: Governadoria (XML) e Diário Oficial (PDF com endereço previsível). Esforço médio.

### Mato Grosso (MT)
- **O que a fonte tem:** a API oficial da Assembleia exige credencial. O robots.txt do portal proíbe as listas com parâmetros (`?`), então só dá para abrir projeto por projeto, sem descobrir os novos. Votos nominais não foram localizados. O Diário Oficial (IOMAT) tem busca em JSON.
- **O que falta:**
  1. Coletor de normas pelo IOMAT. Esforço médio.
  2. Projetos e votações: credencial da API pedida no texto pela LAI já redigido (`docs/pesquisa/pedidos-lai/mt.md`). Depende de terceiros.

### Pará (PA)
- **O que a fonte tem:** o voto de cada deputado é publicado em HTML (com nome e partido), mas só em parte das matérias (projetos de lei complementar e emendas à Constituição). O Banco de Leis tem API aberta com leis e decretos. A lista de proposições é um formulário que mostra até 100 itens por consulta. O Diário Oficial está no Google Drive, com busca quebrada.
- **O que falta:** raspador das votações nominais (lista mensal e detalhe), coletor da API do Banco de Leis e raspador das proposições por janelas de datas. Esforço médio. Vetos e razões de veto ficam para curadoria do Diário Oficial (esforço alto).

### Pernambuco (PE)
- **Feito nesta rodada:** coletor novo (`scripts/coleta/estados/abertos/`) para os dados abertos da ALEPE. Coleta os deputados (nome e partido), os projetos do ano e, aos poucos, o detalhe de cada um (andamento, resultado de cada discussão em Plenário e número da lei gerada), e as leis, leis complementares, emendas constitucionais e decretos do Executivo do sistema de legislação da ALEPE. Coleta real gravada em `dados/estados/pe/`: 49 deputados, 650 projetos de 2026 (40 com detalhe), 1.675 normas de 2026 e 10 resultados de discussão em Plenário.
- **O que a fonte tem sobre votos:** só o resultado ("APROVADA EM PRIMEIRA DISCUSSÃO"), sem a forma da votação e sem o voto de cada deputado.
- **O que falta:**
  1. Incluir no workflow. Esforço baixo. A carga diária completa o detalhe dos 610 projetos restantes em cerca de duas semanas (40 por dia), ou mais rápido com `PE_MAX_DETALHES` maior.
  2. Votos nominais (raros: emendas constitucionais, vetos): só na ata do Diário do Poder Legislativo (PDF) ou em vídeo. Curadoria caso a caso. Esforço alto. **Pedido pela LAI ainda não redigido.**
  3. A API de projetos não está na documentação oficial e pode mudar sem aviso: os testes offline ajudam a perceber a mudança.

### Paraná (PR)
- **Feito nesta rodada:** coletor próprio (`scripts/coleta/estados/pr/`, no workflow diário) da API pública documentada da ALEP (só responde em `http://`) e da página "Conheça os deputados". Coleta real gravada em `dados/estados/pr/`: 54 deputados (nome, partido e cargo na Mesa), 864 projetos de 2026 com o andamento completo (829 projetos de lei, 14 de lei complementar, 8 de resolução, 7 de decreto legislativo e 6 propostas de emenda à Constituição), 343 resultados de turno na Ordem do Dia e 494 normas de 2026 (479 leis, 6 leis complementares, 5 resoluções, 3 decretos legislativos e 1 emenda constitucional), todas com a proposição de origem; 229 projetos de 2026 ligados à lei gerada.
- **O que a fonte tem:** API JSON documentada da Assembleia com proposições, andamento e normas. O resultado de cada turno ("1º TURNO - APROVADO") vem nos trâmites, sem a forma da votação, sem placar e sem o voto de cada deputado. O "Controle de Votações" fica num caminho proibido pelo robots.txt (`/api/`) e com CAPTCHA: não é acessado.
- **O que falta:**
  1. Decretos do governador: não estão na API da ALEP; só no Diário Oficial do Estado (DIOE, JSON de edições e matérias em HTML). Esforço médio.
  2. Voto de cada deputado: pedido pela LAI já redigido (`docs/pesquisa/pedidos-lai/pr.md`) para publicar votos e presença na API pública. Até lá, "Informação não disponível em fonte oficial". Depende de terceiros.

### Rio de Janeiro (RJ)
- **O que a fonte tem:** projetos e leis num sistema antigo (Lotus Notes, HTML), sem API. As notas taquigráficas trazem só o placar, sem a lista nominal. O PDF do Diário Oficial tem o endereço escondido de propósito no visualizador; isso não deve ser contornado.
- **O que falta:**
  1. Raspador do sistema antigo para projetos, leis e placares. Esforço alto.
  2. Votos e decretos: pedido pela LAI já redigido (`docs/pesquisa/pedidos-lai/rj.md`), que pede os espelhos do painel de votação. Depende de terceiros.

### Roraima (RR)
- **Feito nesta rodada:** coletor SAPL ampliado para `sapl.al.rr.leg.br`, com coleta real pequena em `dados/estados/rr/`.
- **O que a fonte tem:** projetos, sessões e leis em dia, mas **nenhum voto nem resultado lançado no SAPL**. O resultado só aparece na ata, um PDF digitalizado com texto ruidoso ("(aprovado)", sem placar).
- **O que falta:**
  1. Incluir `rr` no workflow. Esforço baixo.
  2. Votações: leitura das atas com conferência humana. Esforço alto. O voto de cada deputado fica "Informação não disponível em fonte oficial".
  3. Decretos do governador: só no Diário Oficial (lista mensal em HTML; PDF por formulário). Esforço médio.
  4. O SAPL registra a legislatura como 2023–2026 (fim em 31/12/2026). Quando ela virar, o coletor passa a buscar a nova legislatura sozinho, se o SAPL for atualizado.

### Santa Catarina (SC)
- **O que a fonte tem:** o e-Legis (HTML, sem API) publica o "Extrato de votação" com o nome e o voto de cada deputado, mas sem o partido; a maioria das votações é simbólica. Leis e decretos do governador estão no sistema de leis da ALESC. O robots.txt do portal proíbe a API do WordPress (`/wp-json/`), que não deve ser usada.
- **O que falta:** raspador do e-Legis (sessões, ordem do dia, extratos de votação) e do sistema de leis. O partido de cada deputado na data da votação precisa vir de fonte oficial; sem ela, fica "Informação não disponível em fonte oficial". Esforço médio.

### Tocantins (TO)
- **Feito nesta rodada:** coletor SAPL ampliado para `sapl.al.to.leg.br`, com coleta real pequena em `dados/estados/to/`.
- **O que a fonte tem:** projetos e leis no SAPL (as leis mais recentes são de julho de 2026). Não há sessões cadastradas depois de 12/05/2026 e nenhum voto. O SAPL do Tocantins não tem filiações partidárias cadastradas, então o partido dos deputados fica "Informação não disponível em fonte oficial".
- **O que falta:**
  1. Incluir `to` no workflow. Esforço baixo.
  2. Votações: Diário da Assembleia (PDF) por curadoria. Esforço alto.
  3. Decretos do governador: Diário Oficial com busca por texto e tipo. Esforço médio.

## Próximos passos sugeridos (ordem de custo-benefício)
1. **Ligar no workflow** AC, AL, RR, TO (SAPL) e PE, DF (coletor de dados abertos): já estão prontos.
2. **APIs abertas que faltam:** GO (normas e vetos da Casa Civil), MA (ALEMALEGIS), PA (Banco de Leis). Cada uma, esforço baixo.
3. **Raspadores de HTML com voto nominal publicado:** SC e PA. Esforço médio.
4. **Enviar os pedidos pela LAI já redigidos** (MT, MS, GO, RJ, PR, DF) e redigir os que faltam (AC, AL e PE, para votos nominais e normas).
5. **Curadoria de PDF:** CE (60 votações), MS (OCR), RR e TO (atas).

## Comandos para o workflow (não editados nesta rodada)
- SAPL: em `.github/workflows/coleta-estados-sapl.yml`, trocar `--uf am,pi,pb,ro` por `--uf am,pi,pb,ro,ac,al,rr,to` e acrescentar `dados/estados/ac dados/estados/al dados/estados/rr dados/estados/to` ao `git add`. Os oito hosts rodam em paralelo, cada um com seu relógio de 61 s.
- PE e DF: em `.github/workflows/coleta-diaria.yml`, acrescentar `node scripts/coleta/estados/abertos/testes.mjs` e `node scripts/coleta/estados/abertos/coletar.mjs`, e `dados/estados/pe dados/estados/df` ao `git add`.

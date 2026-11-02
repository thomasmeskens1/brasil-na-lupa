# Fontes oficiais: Santa Catarina (SC)

Pesquisa feita com acessos reais (curl) em **2026-11-02**.
Arquivos baixados e script de sondagem: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-sul\` (script `sondagem.sh`).

## Resumo

| Item | Melhor via | Formato | Automatizável? |
|---|---|---|---|
| Deputados | `www.alesc.sc.gov.br/deputado/<slug>/` (40 links na página inicial) | HTML | Total (raspagem) |
| Proposições e tramitação | **e-Legis** `portalelegis.alesc.sc.gov.br/proposicoes/...` | HTML | Total, por raspagem (não há API) |
| Votações | e-Legis › Sessões Plenárias › Ordem do Dia (cada item diz "Votação simbólica" ou "Votação nominal") | HTML | Total |
| Voto nominal | **Extrato de votação** `/extrato-votacao/{id}` (fragmento htmx) | HTML (nome + Sim/Não) | **Total**, mas é raro e vem sem partido |
| Normas | **Legislação SC** (`leis.alesc.sc.gov.br`, ALESC): leis e **decretos do Executivo**, com nº do DOE e link para o PDF | HTML + PDF | Total |
| Diário Oficial do Estado | DOE-SC (`portal.doe.sea.sc.gov.br`): PDF por edição; a API de listagem exige login | PDF | Parcial |

**Viabilidade geral:** **automatizável por raspagem de HTML**, esforço **médio**. Santa Catarina publica o **voto nominal por deputado** em HTML, mas a maioria das votações recentes é simbólica.

---

## 1. Assembleia Legislativa de Santa Catarina (ALESC)

- **Portal:** https://www.alesc.sc.gov.br/ (WordPress). O `robots.txt` (Yoast) bloqueia `/?s=`, `/search/`, **`/wp-json/`** e `/?rest_route=`, então a API REST do WordPress não deve ser usada.
- **e-Legis** (processo legislativo eletrônico): https://portalelegis.alesc.sc.gov.br/ (versão 1.20.5 de 28/10/2026). Não tem `robots.txt` (HTTP 404), logo não há restrição declarada.
- **Portal da Transparência:** https://transparencia.alesc.sc.gov.br/ tem "dados abertos" só administrativos (despesas, diárias, gabinetes, pagamentos, receitas). O `robots.txt` bloqueia contracheques e endpoints AJAX.

### 1.1 Deputados
- A página inicial lista 40 perfis `https://www.alesc.sc.gov.br/deputado/<slug>/`. O e-Legis traz o seletor de autores (deputados atuais e antigos, bancadas, comissões).

### 1.2 Proposições e tramitação (e-Legis)
- Lista: `/proposicoes/processo-legislativo` (10 por página; cerca de 3.515 páginas), com filtros `tipoPropositura` (1 PL, 2 PLC, 6 PDL, 7 PEC, 8 PR, **10 Mensagem de Veto**, 15 Medida Provisória, 22 Projeto de Conversão de MP…), `ano`, `numeroPropositura`, `iniciativa`, `inicio`/`fim`, `arquivados`, `search`, `page`.
- Detalhe: `/proposicoes/{id}` redireciona para `/tramitacoes`; abas `/documentos`, `/reunioes`, `/emendas`, `/comissoes-tramitar`. Ids opacos de 5 caracteres (ex.: `Kvl3v`).
- A tramitação traz data, origem/destino, situação, resultado nas comissões ("APROVADO … por unanimidade") e o nº do Diário da Assembleia.

### 1.3 Sessões, votações e voto nominal
- `/sessoes-plenarias` (631 sessões; tipos Ordinária/Extraordinária). Por sessão: `/sessoes-plenarias/{id}/ordem-do-dia`, `/presenca` (Presente/Ausente por deputado), `/ata`, `/pronunciamentos`, `/expediente`, `/comunicado`.
- Na **Ordem do Dia**, cada item mostra o resultado (Aprovado…) e o **tipo de votação**:
  - "Votação simbólica": não há registro individual de voto.
  - "**Votação nominal**": botão "Extrato de votação", com `hx-get="/extrato-votacao/{id}"` e `hx-ext="ajax-header"`.
- O extrato só responde com o cabeçalho que o próprio site envia (`X-Requested-With: XMLHttpRequest`); sem ele, HTTP 405. Isso não é barreira anti-robô, é o mesmo pedido do navegador. O retorno é um HTML com **identificador da proposição + nome do deputado + Sim/Não**, **sem partido**.
- Frequência: nas 40 sessões mais recentes varridas (setembro–outubro/2026), os **302 itens votados foram todos simbólicos**. Votações nominais aparecem em vetos e projetos específicos (exemplo abaixo, de março/2026).

## 2. Governo de Santa Catarina

### 2.1 Legislação SC (base oficial da ALESC, inclui decretos do Executivo)
- https://leis.alesc.sc.gov.br/ (Next.js; `meta robots noindex`; sem `robots.txt`). Seções: `/legislativo` (leis, LCs, resoluções, atos da Mesa), `/executivo` (**decretos do Governador**), `/consolidacao`.
- Busca por `?search=` (HTML renderizado no servidor). Ato: `/ato-normativo/legislativo/{id}` ou `/ato-normativo/executivo/{id}`.
- A ficha traz **Procedência**, **Natureza** (nº da proposição de origem), **DOE nº e data**, **DA nº** e links para o PDF do DOE (`portal.doe.sea.sc.gov.br/repositorio/...`) e do Diário da Assembleia (`www.alesc.sc.gov.br/diarios/pdf/<n>diaicp.pdf`).
- Aviso do próprio site: "os textos publicados têm caráter informativo, não substituindo as publicações dos Diários Oficiais". Por isso o site deve **citar o PDF do DOE** como fonte primária.
- Santa Catarina tem **Medidas Provisórias** estaduais (tipo 15 no e-Legis), que geram leis de conversão.

### 2.2 Diário Oficial do Estado (DOE-SC, Secretaria de Administração)
- https://portal.doe.sea.sc.gov.br/ (SPA Angular). Sem `robots.txt` (redireciona para a página inicial).
- API em `https://portal.doe.sea.sc.gov.br/apis/`:
  - `/apis/doe-api/edicao/` e `/apis/doe-api/materia/` → **401 (exigem login)**. Não usados.
  - `/apis/edicao/buscar-jornal?dtPublicacao=AAAA-MM-DD` → `{"exists":true|false}` (público).
- Arquivos públicos: `/repositorio/AAAA/AAAAMMDD/Jornal/<nº>.pdf` (ex.: edição 22.709, 8,3 MB). O código do portal também monta matérias em HTML em `/repositorio/AAAA/AAAAMMDD/Materias/<cd>/<cd>.html` (padrão visto no código, **não testado**).
- Na prática, a lista de leis e decretos com nº e data do DOE vem da Legislação SC, e o PDF do DOE serve de comprovação.

## 3. Exemplos reais (abertos em 2026-11-02)

- **Projeto:** PL./0658/2026 (utilidade pública LABRE; autoria CCJ; entrada 22/10/2026; SEI 26.0.000036058-8): https://portalelegis.alesc.sc.gov.br/proposicoes/Kvl3v/tramitacoes
- **Votação nominal:** 8ª Sessão Extraordinária, 18/03/2026: https://portalelegis.alesc.sc.gov.br/sessoes-plenarias/NpwW5/ordem-do-dia
  - **MSV/0824/2025** (Veto Total ao PL 408/2023), "Aprovado", "Votação nominal". Extrato `https://portalelegis.alesc.sc.gov.br/extrato-votacao/zeYY8`: 25 nomes, **18 "Sim" e 7 "Não"** (ex.: Jessé Lopes Sim; Luciane Carminatti Não).
  - **PLC/0002/2026** (piso salarial estadual), "Aprovado", "Votação nominal". Extrato `/extrato-votacao/zRA0O`.
  - O sentido de "Sim" em votação de veto (manter ou derrubar) **não está escrito no extrato**. Não deduzir: buscar no Regimento ou na ata da sessão.
- **Lei:** Lei nº 19.748, de 5 de março de 2026 (ICMS, insumos agropecuários; Natureza PCL/0268/2025; promulgada pelo Presidente da ALESC após a MP nº 268/2025): https://leis.alesc.sc.gov.br/ato-normativo/legislativo/53891. DOE nº 22.709: https://portal.doe.sea.sc.gov.br/repositorio/2026/20260305/Jornal/22709.pdf
- **Decreto:** Decreto nº 1.768, de 16/10/2026: https://leis.alesc.sc.gov.br/ato-normativo/executivo/54592

## 4. Viabilidade

| Bloco | Classificação | Esforço | Observação |
|---|---|---|---|
| Proposições e tramitação | Automatizável total | Médio | HTML estável, mas sem API e com ids opacos; paginação longa |
| Sessões, presença, votos nominais | Automatizável total | Médio | Varrer Ordem do Dia → extratos; o voto vem sem partido |
| Leis e decretos | Automatizável total | Baixo/Médio | Legislação SC já liga a norma à proposição e ao DOE |
| DOE-SC | Parcial | Médio | Só PDF por edição; a listagem estruturada exige login |

**Riscos:**
- Não há API documentada: a raspagem de HTML depende do layout (e-Legis muda de versão com frequência; build de 28/10/2026).
- O extrato de votação **não traz partido**. O partido deve vir de fonte oficial na data da votação, nunca da filiação atual.
- Votação nominal é rara; a maioria das matérias terá "votação simbólica" e, portanto, sem voto individual. Exibir isso tal como a fonte diz.
- O `noindex` da Legislação SC não proíbe acesso, mas o texto ali é informativo. A fonte primária é o DOE.

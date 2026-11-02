# Fontes oficiais — Rio de Janeiro (RJ)

Pesquisa feita com acessos reais em **2026-11-02** (curl, User-Agent identificado `PlacarDoPoder-pesquisa/1.0`, sem cabeçalhos falsos). Todas as URLs abaixo foram abertas nessa data.

## Resumo

| Item | Melhor fonte | Formato | Automatizável |
|---|---|---|---|
| Deputados (70) | Portal ALERJ `/Deputados/QuemSao` | HTML | Total (scraping) |
| Proposições e tramitação | Lotus Notes da ALERJ (`scpro2327.nsf`) via páginas `www3.alerj.rj.gov.br/lotus_notes/` | HTML | Parcial (scraping de sistema legado) |
| Resultado de plenário | Notas taquigráficas (`taqalerj.nsf`) | HTML | Parcial |
| **Voto nominal (nome a nome)** | **Não encontrado em fonte acessível.** As notas taquigráficas trazem só o placar | — | **Curadoria / pedido via LAI** |
| Leis | Lotus Notes `contlei.nsf` | HTML | Total (scraping) |
| Decretos, vetos | DOERJ (Imprensa Oficial — IOERJ) | PDF em visualizador | **Baixa** (ver bloqueio) |

**Viabilidade geral: BAIXA/MÉDIA. Esforço: alto.**

---

## 1. ALERJ — Assembleia Legislativa do Rio de Janeiro

### 1.1 Portal e sistemas
- **Portal:** https://www.alerj.rj.gov.br (ASP.NET). **Não há portal de dados abertos nem API** para o processo legislativo (o endereço `dadosabertos.alerj.rj.gov.br` não respondeu). A transparência (`transparencia.alerj.rj.gov.br`) trata de gestão administrativa.
- **Processo legislativo:** bases **Lotus Notes/Domino** em `http://alerjln1.alerj.rj.gov.br/`, exibidas dentro do portal por `http://www3.alerj.rj.gov.br/lotus_notes/default.asp?id=N`:
  - `id=161` → `scpro2327.nsf` — Projetos de lei 2023–2027 (lista mais recente primeiro: número, ementa, comissões, data de publicação, autor). Também há bases das legislaturas anteriores (`id=144` = 2019–2023 etc.).
  - `id=53` → `contlei.nsf` — Leis ordinárias; `id=52` — Leis complementares; `id=54` — Resoluções.
  - `id=57` → `taqalerj.nsf` — "Discursos e Votações" (notas taquigráficas, 2012–2026).
  - Busca oficial: `http://www3.alerj.rj.gov.br/lotus_notes/consultaNotes.asp?txtquery=<termo>&hdfId=<base>` (base 0 = Atos do Executivo, 4 = Discursos e Votações, 5 = Legislação, 6 = Ordem do Dia, 12 = Processo Leg. 2023/2027).
  - Os documentos individuais (`…/scpro2327.nsf/<view>/<unid>?OpenDocument`) abrem direto e trazem ementa, autor, **texto integral, justificativa**, datas (entrada, despacho, publicação), comissões e tramitação.
  - Os recursos de leitura em lote do Domino (`?ReadViewEntries`, `OutputFormat=JSON`) e a abertura direta das *views* (`?OpenForm`) **não responderam** (conexão encerrada sem resposta). Usar somente as páginas do portal e a busca oficial, em baixa frequência.
- **Ordem do dia (pauta):** https://www2.alerj.rj.gov.br/ordemdodia/ — fragmento HTML por data em `pauta/?op=D&data=AAAA;MM;DD` (usado pela própria página). Só pauta, sem resultado.
- **robots.txt:** inexistente em `www`, `www2`, `www3` e `alerjln1` (404). Sem bloqueio declarado.
- **Codificação:** páginas em ISO-8859-1 declaradas como UTF-8 em parte do portal (acentos corrompidos) — normalizar no coletor.

### 1.2 Votação nominal
- A ALERJ vota no painel eletrônico com "1ª e 2ª chamada nominal", mas **o registro público encontrado só traz o placar**. Exemplo (PEC 76-A/2022, 24/10/2023): "Proclamo o resultado. Votaram 67 Srs. Deputados, com 67 votos favoráveis". Exemplo recente (PRS 1.682/2025, 09/12/2025): "Votaram 22 Srs. Deputados. 17 "sim" e 4 "não", uma abstenção. Não há quórum…".
- Não foi localizada lista nome a nome no portal, nas notas taquigráficas nem em página de votações. **Não verificado:** se o Diário Oficial Parte II (Poder Legislativo) publica o espelho do painel — o PDF não pôde ser obtido de forma automatizada (seção 2).
- **Consequência (diretriz 5):** sem lista oficial, o site **não atribui voto individual** a deputados do RJ; mostra o placar e o caminho "votação nominal (lista não publicada em fonte oficial)". Recomendação: pedido pela Lei de Acesso à Informação à ALERJ solicitando os espelhos do painel, nos moldes de `docs/pesquisa/pedido-sic-camara-atibaia.md`.

### 1.3 Exemplos reais
- Projeto: PL 8.467/2026 (Poder Executivo, limite de idade no CHOAE do Corpo de Bombeiros, publicado 03/11/2026) — http://alerjln1.alerj.rj.gov.br/scpro2327.nsf/18c1dd68f96be3e7832566ec0018d833/dee73a8fb27b7c6f03258e9f00736bf6?OpenDocument
- Votação (placar, sem nomes): PRS 1.682/2025, 09/12/2025 — http://alerjln1.alerj.rj.gov.br/taqalerj.nsf/8b99ca38e07826db032565300046fdf1/5715725fb2c3b98f03258d5a0060fe75?OpenDocument
- Lei: Lei 11.347, de 14/10/2026 (capoeira na rede estadual) — http://alerjln1.alerj.rj.gov.br/contlei.nsf/c8aa0900025feef6032564ec0060dfff/4e743f969e3f2d0103258e910047ef47?OpenDocument
- Deputados: https://www.alerj.rj.gov.br/Deputados/QuemSao (70 perfis, `/Deputados/PerfilDeputado/{id}?Legislatura=20`)

## 2. Governo do RJ — DOERJ (Imprensa Oficial do Estado — IOERJ)
- **Portal:** https://www.ioerj.com.br/portal/modules/conteudoonline/do_seleciona_data.php (calendário desde 2005). Edição por data: `do_seleciona_edicao.php?data=<AAAAMMDD em base64>` → cadernos Parte I (Executivo), IB (Tribunal de Contas), **II (Poder Legislativo)**, IV, V. Última data disponível no calendário em 2026-11-02: **29/10/2026** (30/10 aparecia como "sem permissão / data não encontrada").
- **Bloqueio:** o caderno abre em visualizador PDF.js (`mostra_edicao.php?session=…`) cujo endereço do PDF é **deliberadamente ofuscado** no JavaScript (montado com `String.fromCharCode`), e o visualizador desativa impressão/seleção. Isso indica intenção de impedir download automatizado. **Não foi contornado.** O `robots.txt` só proíbe três PDFs específicos.
- **Alternativa oficial para leis:** `contlei.nsf` da ALERJ (seção 1.1), em dia (Lei 11.347 de 14/10/2026). Decretos: a base "Atos do Executivo" (`decest.nsf`) da ALERJ é parcial e desatualizada (busca por "2026" não trouxe decretos de 2026). **Não verificado:** portal de legislação da Casa Civil/Governo do RJ ou da SEFAZ-RJ como fonte de decretos.
- **Vetos:** as mensagens de veto tramitam na ALERJ (bases Lotus); razões do veto devem ser lidas no documento.

## 3. Viabilidade
- **Automatizável:** deputados, lista de projetos e leis — **parcial/total** por scraping cuidadoso de sistema legado. Placar de votações — **parcial** (texto livre das notas taquigráficas). Voto nominal — **não automatizável hoje** (curadoria e LAI). Decretos — **baixo** sem uma fonte que permita download.
- **Esforço: alto.**
- **Riscos:** (1) sistema Lotus Notes antigo, lento, que derruba conexões; (2) HTML sem estrutura estável e codificação inconsistente; (3) DOERJ com download intencionalmente dificultado (não contornar — pedir acesso/autorização ou usar outra fonte); (4) ausência de voto nominal publicado nome a nome impede o principal recurso do site para o RJ; (5) URLs de documento Domino (UNIDs) são estáveis, mas as *views* não são paginadas de forma documentada.

# Resumo: Região Norte (AC, AM, AP, PA, RO, RR, TO)

Pesquisa com acessos reais em **2026-11-02**. Detalhes, URLs e exemplos em [ac.md](ac.md), [am.md](am.md), [ap.md](ap.md), [pa.md](pa.md), [ro.md](ro.md), [rr.md](rr.md) e [to.md](to.md).

| UF | Deputados | Proposições | Votos nominais | Normas | Formato | Viabilidade |
|---|---|---|---|---|---|---|
| **AC** | SAPL API (25 mandatos; o filtro `ativo` dá erro 500) | **SAPL API JSON** (1.145 em 2026) | **Parcial**: `votoparlamentar` em JSON, mas só em vetos (42 itens nominais; os últimos de mar/2026). O resto é simbólico, só com totais | SAPL sem normas recentes. **DOE-AC e LEGIS bloqueiam por robots.txt** URLs com `?` e `download`; o Legisla-e depende de JavaScript | JSON / PDF / HTML | **Parcial**. Legislativo com esforço baixo; normas e decretos por **curadoria** |
| **AM** | SAPL API (26) | **SAPL API JSON** (4.907 em 2026) | **Sim, quase tudo**: 6.920 itens nominais, 133.582 votos em JSON (até 28/10/2026) | SAPL (623 normas de 2026, com PDF e nº do DOE) + Legisla.AM (HTML) + **DOE-AM com JSON interno** e PDF | JSON / PDF | **Total** no Legislativo (esforço baixo); DOE parcial (médio). **Melhor caso do Norte** |
| **AP** | HTML (24, com partido) | eLegis em **HTML** (6.604; sem API; sistema "em implantação") | **Não**. A ata em HTML traz resultado ("unanimidade dos presentes") e a **lista de ausentes** | eLegis: leis com nº do DOE + **DOE-AP com JSON interno** (mesma plataforma do AM) e PDF; decretos só no DOE | HTML / PDF | **Parcial**, esforço médio. O voto individual fica "Informação não disponível" |
| **PA** | HTML (41, com partido nos votos) | HTML com POST DevExpress (lista limitada a 100 por consulta); ficha com pareceres e votação por turno | **Sim, só em parte das matérias** (PLC e PEC): HTML com SIM/NÃO/ABST./NÃO VOTARAM, nome e **partido**, mais PDF e DOC | **API JSON aberta do Banco de Leis** (leis + decretos estaduais); DOE (IOEPA) com PDF no Google Drive e **busca quebrada** | HTML / JSON / PDF | **Parcial/total**. Votos e leis com esforço médio; DOE por curadoria (alto) |
| **RO** | SAPL API (26 mandatos para 24 cadeiras) | **SAPL API JSON** (5.899 em 2026) | **Sim, em parte das matérias**: 2.328 itens nominais, 44.396 votos em JSON (até 19/10/2026) | SAPL (839 de 2026) + **DITEL/Casa Civil** (listas HTML por ano de leis e **decretos**, com PDF) + DIOF (PDF direto) | JSON / HTML / PDF | **Total** no Legislativo e nas normas (esforço baixo); DOE parcial |
| **RR** | SAPL API (25) | **SAPL API JSON** (774 em 2026) | **Não**: 0 votos registrados; a ata é um PDF digitalizado com OCR, com "(aprovado)" | SAPL (158 de 2026) + DOE-RR (lista HTML mensal; PDF por POST); decretos só no DOE | JSON / PDF | **Parcial**. Proposições e leis com esforço baixo; votações por **curadoria** (alto) |
| **TO** | SAPL API (27 mandatos, 24 titulares) | **SAPL API JSON** (1.093 em 2026) | **Não**: o SAPL não tem sessões depois de 12/05/2026 nem votos; o sistema Legis antigo continua no ar | SAPL (164 de 2026) + portal AL-TO (HTML/PDF) + **DOE-TO com busca por texto e tipo** e PDF | JSON / HTML / PDF | **Parcial**. Proposições e leis com esforço baixo; votações por **curadoria** (alto) |

## Achado principal: SAPL em 5 dos 7 estados
AC, AM, RO, RR e TO usam o **SAPL 3 (Interlegis)**, com a mesma API REST JSON e o mesmo esquema (`/api/parlamentares/mandato`, `/api/materia/materialegislativa`, `/api/materia/tramitacao`, `/api/sessao/sessaoplenaria`, `/api/sessao/ordemdia`, `/api/sessao/registrovotacao`, `/api/sessao/votoparlamentar`, `/api/norma/normajuridica`). **Um único coletor parametrizado pelo host cobre os cinco.** O que muda é quanto cada Casa preenche: AM preenche tudo, RO a maior parte, AC só os vetos, RR e TO não lançam votos.

**Regra do robots.txt do SAPL (igual nos 5):** `Crawl-delay: 60` para `*` (uma requisição por minuto e por host) e `Disallow: /materia/docacessorio/pdf|zip/*`. Com `page_size=100`, a carga incremental diária cabe nesse limite; a carga inicial de AM (133 mil votos, cerca de 1.340 páginas) leva cerca de 22 h por host. Os hosts podem rodar em paralelo.
*Transparência:* no primeiro reconhecimento fiz cerca de 9 requisições seguidas a cada SAPL antes de ler o crawl-delay. Todas as seguintes respeitaram 61 s.

## Ordem sugerida de implementação
1. **Coletor SAPL comum** (AM → RO → AC → RR → TO), com deputados, proposições, tramitação, sessões, resultados, votos nominais e normas.
2. **PA**: raspar as votações nominais (lista mensal → detalhe) e consumir a API do Banco de Leis.
3. **Diários oficiais com JSON** (AM e AP, mesma plataforma `apifront`) e com lista simples (RO/DIOF, RR, TO): baixar o PDF e extrair o texto. Separar leis, decretos e vetos por curadoria.
4. **AP**: raspar o eLegis (proposições, atas e leis).
5. **Curadoria**: votações de RR e TO (atas e diários), normas e decretos do AC (o robots.txt impede a coleta automática; pedir dump ou liberação via LAI).

## Cuidados comuns
- Exibir o voto com o rótulo da fonte ("Sim", "Não", "Abstenção", "Não Votou", "NÃO VOTARAM"). "Não Votou" não é voto contrário.
- "Aprovado por unanimidade dos presentes" (AP) e "(aprovado)" (RR) **não são votos nominais**. O site cita o texto e mostra "Informação não disponível em fonte oficial" para o voto de cada deputado.
- `tipo_votacao=2` (nominal) no SAPL sem `votoparlamentar` (RR, e parte do AC e de RO) não permite deduzir votos.
- Validar datas (há erros de digitação no SAPL-RO) e o cadastro de legislaturas (RR).
- Nenhuma barreira anti-robô foi contornada: o DOE-AC e o LEGIS-AC (robots.txt) não foram coletados, e o navegador não foi usado para burlar bloqueios.

# Fontes oficiais: Paraíba (PB)

Pesquisa feita com acessos reais (curl) em **2026-11-02**.
Scripts usados: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-nordeste-1\pb_sapl.sh`. O script espera 61 s entre as requisições ao SAPL para respeitar o `Crawl-delay`.

## Resumo

| Item | Melhor via | Formato | Automatizável? |
|---|---|---|---|
| Deputados (36 cadeiras) | SAPL `/api/parlamentares/parlamentar/` | JSON | Total |
| Proposições e tramitação | SAPL `/api/materia/...` | JSON | Total |
| Votação nominal | SAPL `/api/sessao/votoparlamentar/` | JSON por deputado | Total, para as votações registradas no painel (17.148 votos individuais) |
| Normas (leis, LCs, resoluções...) | SAPL `/api/norma/normajuridica/` | JSON + PDF | Total |
| Diário Oficial do Estado | `auniao.pb.gov.br/servicos/doe/AAAA/<mês>/diario-oficial-DD-MM-AAAA-portal.pdf` | PDF com texto | Parcial (segmentar o PDF) |

**Viabilidade geral:** **total** no Legislativo (SAPL 3.1, igual ao do Piauí) e **parcial** no Executivo. Esforço **baixo/médio**. O principal custo é o `Crawl-delay: 60`, que torna a carga histórica lenta.

---

## 1. Assembleia Legislativa da Paraíba (ALPB)

- **Portal:** https://www.al.pb.leg.br/ (WordPress). O `robots.txt` usa o "Ultimate Bad Bot Blocker". Para `*`, só bloqueia `/wp-admin/`.
- **Sistema legislativo:** https://sapl.al.pb.leg.br/ (SAPL 3.1).
  - `robots.txt` para `*`: **`Crawl-delay: 60`** e `Disallow: /materia/docacessorio/pdf/*`. Robôs de SEO são bloqueados.
  - **Consequência:** no máximo 1 requisição por minuto. A coleta diária incremental cabe nesse limite (poucas dezenas de requisições). A carga histórica completa leva horas: só os votos individuais exigem cerca de 172 páginas de 100 registros, ou seja, umas 3 horas. Os PDFs de documentos acessórios não podem ser baixados.
  - **API REST pública:** https://sapl.al.pb.leg.br/api/ (sem autenticação).

### 1.1 Rotas testadas

| Recurso | URL | Total em 2026-11-02 | Observação |
|---|---|---|---|
| Deputados | `/api/parlamentares/parlamentar/?ativo=True` | 130 com `ativo=True` | O filtro **não** devolve só a legislatura atual. É preciso cruzar com o mandato e a legislatura (`/api/parlamentares/mandato/`). `ativo=true` em minúsculas dá erro de validação |
| Matérias | `/api/materia/materialegislativa/?ano=2026` | 8.143 em 2026 | Inclui autógrafos e requerimentos (volume alto). Filtrar por `tipo` |
| Tramitação | `/api/materia/tramitacao/?o=-id` | 539.764 | Exemplo: "Sanção e ou Veto", 28/10/2026 |
| Sessões | `/api/sessao/sessaoplenaria/?o=-data_inicio` | 911 | 33ª Sessão Ordinária em 2026-10-28, com `upload_pauta` (PDF da ordem do dia) |
| Registro de votação | `/api/sessao/registrovotacao/?o=-id` | 56.539 | Totais de sim, não e abstenção, e resultado |
| **Voto nominal** | `/api/sessao/votoparlamentar/?votacao=<id>` | 17.148 votos individuais | `voto`: "Sim", "Não", "Abstenção", "Não Votou" |
| Normas | `/api/norma/normajuridica/?ano=2026&tipo=2` | 533 leis ordinárias em 2026 (748 normas de todos os tipos) | Tipos: 1 LC, 2 Lei Ordinária, 8 Lei Ordinária Promulgada, 4 Resolução, 6/3 Decreto Legislativo, 9 EC, 13 Autógrafo, 18 Decreto Executivo |

### 1.2 Votação nominal
- O painel eletrônico grava os votos. O mais recente encontrado é de **2026-08-17**: Veto nº 366/2025, mantido, com 9 sim, 13 não e 1 abstenção (`registrovotacao/56481`).
- Os registros de outubro de 2026 (requerimentos "aprovados por unanimidade" com `numero_votos_sim = 31`) **não** têm votos individuais em `votoparlamentar`. Nesses casos, o site deve mostrar só o resultado oficial agregado e "Informação não disponível em fonte oficial" no voto individual. Não deduzir.
- Formato: JSON.

---

## 2. Governo da Paraíba

### 2.1 Diário Oficial do Estado (DOE-PB, Empresa Paraibana de Comunicação / A União)
- **Portal:** https://auniao.pb.gov.br/doe (Plone). `robots.txt`: `*` liberado. Bloqueia apenas alguns robôs nomeados (Amazonbot, bingbot, Bytespider, AhrefsBot...).
- **Edições:** a página https://auniao.pb.gov.br/doe/edicoes-recentes lista os PDFs. A URL é previsível: `https://auniao.pb.gov.br/servicos/doe/2026/outubro/diario-oficial-29-10-2026-portal.pdf` (1,7 MB, com camada de texto).
- Conteúdo verificado na edição de 29/10/2026: Decretos nº 49.010 e 49.011, de 28/10/2026. As leis e os vetos saem na mesma publicação.
- Não há API nem busca estruturada. O caminho é baixar o PDF diário, extrair o texto e segmentar os atos.

### 2.2 Legislação estadual
- O SAPL da ALPB é a base mais completa e estruturada de leis estaduais, com PDF. Exemplo: **Lei nº 14.738, de 08/10/2026**: https://sapl.al.pb.leg.br/norma/19227. A ficha liga a norma à matéria de origem (`materia` = 152495).
- O SAPL também tem o tipo "Decreto Executivo" (18). Antes de usar como fonte dos decretos, é preciso conferir se a cobertura está completa. O DOE continua sendo a fonte primária dos decretos.

---

## 3. Exemplos reais

| Tipo | Item | URL |
|---|---|---|
| Projeto ou veto | Veto nº 366/2025 | https://sapl.al.pb.leg.br/materia/142325 |
| Votação nominal | 28ª Sessão Ordinária (17/08/2026): veto mantido, 9 sim, 13 não, 1 abstenção | https://sapl.al.pb.leg.br/api/sessao/registrovotacao/56481/ e votos em https://sapl.al.pb.leg.br/api/sessao/votoparlamentar/?votacao=56481 |
| Sessão | 33ª Sessão Ordinária (28/10/2026) | https://sapl.al.pb.leg.br/sessao/1416 |
| Lei | Lei nº 14.738/2026 | https://sapl.al.pb.leg.br/norma/19227 |
| Diário Oficial | DOE-PB de 29/10/2026 | https://auniao.pb.gov.br/servicos/doe/2026/outubro/diario-oficial-29-10-2026-portal.pdf |

---

## 4. Viabilidade

- **Legislativo: automatizável total, esforço baixo** (mesmo coletor SAPL do PI). O agendamento precisa respeitar 60 s entre requisições. A carga histórica deve rodar uma única vez, em segundo plano.
- **Executivo: parcial, esforço médio** (PDF diário; segmentar e classificar os atos).
- **Riscos:**
  1. O `Crawl-delay: 60` limita o volume. Priorizar rotas filtradas (`o=-id`, `data_hora` recente) em vez de varredura completa.
  2. O filtro `ativo=True` traz parlamentares de outras legislaturas. Montar a lista atual a partir dos mandatos.
  3. Muitas matérias são autógrafos e requerimentos. Filtrar por tipo para não poluir o site.
  4. O voto nominal não está presente em todas as deliberações.
  5. `/materia/docacessorio/pdf/*` está proibido pelo `robots.txt`. Usar só o texto integral da matéria e da norma.

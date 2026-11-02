# Fontes oficiais: Piauí (PI)

Pesquisa feita com acessos reais (curl) em **2026-11-02**. Todas as URLs abaixo responderam nessa data, salvo quando indicado.
Scripts usados: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-nordeste-1\` (`pi_votos.py`).

## Resumo

| Item | Melhor via | Formato | Automatizável? |
|---|---|---|---|
| Deputados (30 cadeiras) | SAPL `/api/parlamentares/parlamentar/` | JSON | Total |
| Proposições e tramitação | SAPL `/api/materia/materialegislativa/` e `/api/materia/tramitacao/` | JSON | Total |
| Votação nominal | SAPL `/api/sessao/votoparlamentar/` | JSON (um registro por deputado) | Total, mas **só para as votações nominais registradas no painel**: 150 desde 2022 |
| Normas da ALEPI (leis, LCs, resoluções, decretos legislativos) | SAPL `/api/norma/normajuridica/` | JSON + PDF | Total |
| Diário Oficial do Estado (leis, decretos, vetos) | `diario.pi.gov.br/doe/Api/listardiarios.json` (listagem) + PDF | JSON (lista) / PDF com texto | Parcial: a lista é automática, mas separar os atos dentro do PDF exige heurística |

**Viabilidade geral:** automatização **total** para o Legislativo (é o SAPL 3.1 do Interlegis, com API REST aberta). Para o Executivo é **parcial** (só PDF). Esforço **baixo**: o mesmo coletor SAPL serve para a Paraíba.

---

## 1. Assembleia Legislativa do Piauí (ALEPI)

- **Portal:** https://www.al.pi.leg.br/ (Plone). `robots.txt`: `User-agent: * / Disallow:` (sem restrição).
- **Sistema legislativo:** https://sapl.al.pi.leg.br/ (SAPL 3.1, Interlegis).
  - `robots.txt` bloqueia apenas robôs de SEO (semrushbot, BLEXBot, AhrefsBot, spbot...). Não há `Crawl-delay` para `*`. Mesmo assim, usar 1 req/s.
  - **API REST pública e navegável:** https://sapl.al.pi.leg.br/api/ (Django REST Framework, paginação `page`/`page_size`, ordenação `o=-id`). Não exige autenticação.

### 1.1 Rotas testadas

| Recurso | URL | Total em 2026-11-02 | Observação |
|---|---|---|---|
| Deputados | `/api/parlamentares/parlamentar/?ativo=True&page_size=100` | 33 ativos (inclui suplentes em exercício) | `ativo=true`, em minúsculas, dá HTML de erro. Use `True` |
| Matérias | `/api/materia/materialegislativa/?ano=2026` | 623 em 2026 | Campos: tipo, número, ano, `data_apresentacao`, `ementa`, `em_tramitacao`, autores |
| Tramitação | `/api/materia/tramitacao/?o=-id` | 105.374 | `materia`, `data_tramitacao`, `texto`, `status` |
| Sessões plenárias | `/api/sessao/sessaoplenaria/?o=-data_inicio` | 2.759 | A mais recente é a 97ª Sessão Ordinária (2026-10-29). Tem campos `upload_pauta` e `upload_ata` (PDF) |
| Registro de votação (resultado por item) | `/api/sessao/registrovotacao/?o=-id` | 4.558 | `numero_votos_sim/nao`, `numero_abstencoes`, `tipo_resultado_votacao`, `materia`, `data_hora` |
| **Voto nominal (por deputado)** | `/api/sessao/votoparlamentar/?votacao=<id>` | 3.394 votos individuais | `voto` (Sim/Não/Abstenção...), `parlamentar`, `data_hora`, `votacao` |
| Normas | `/api/norma/normajuridica/?ano=2026` | 285 em 2026 | `texto_integral` aponta para PDF em `/media/sapl/public/normajuridica/...` |

### 1.2 Votação nominal: o que existe de fato
- Contei os votos individuais, paginando `/api/sessao/votoparlamentar/` inteira (script `pi_votos.py`): são **150 votações distintas com voto por deputado**: 2022: 10, 2023: 39, 2024: 33, 2025: 54, 2026: 14.
- O total de registros de votação (4.558) é muito maior. A maior parte das deliberações só tem o resultado agregado: totais de "sim" e "não", e o texto "Aprovado por unanimidade". O site deve mostrar o voto por deputado **apenas** quando houver `votoparlamentar`. Nos outros casos, mostrar o resultado oficial agregado e a mensagem "Informação não disponível em fonte oficial" para o voto individual.
- Formato: JSON. O SAPL também guarda o PDF da ata da sessão (`upload_ata`).

### 1.3 Atualização
- Em tempo quase real: o painel eletrônico grava os votos com carimbo de hora. Por exemplo, os votos do PLC 5/2026 em 2026-10-28 08:53, e as matérias apresentadas em 2026-10-28 já estavam na API.

---

## 2. Governo do Piauí

### 2.1 Diário Oficial do Estado (DOE-PI)
- **Portal:** https://www.diario.pi.gov.br/doe/. O `robots.txt` dá 404 (não existe).
- **Listagem de edições (usada pelo próprio site):** `POST https://www.diario.pi.gov.br/doe/Api/listardiarios.json` com `draw=1&start=0&length=N&filter_numero=&filter_data=`. Volta JSON no formato DataTables (`recordsTotal` = 1.255), com o link do PDF de cada edição, regular ou suplementar.
  - Exemplo: edição 208/2026 (29/10/2026): https://www.diario.pi.gov.br/doe/files/diarios/anexo/8fb86fd7-93af-4bb2-89d6-dfa2bc395022/DOEPI_208_2026.pdf (PDF com camada de texto; o `pdftotext` funciona).
- **Busca textual:** `POST /doe/Api/buscaavancada.json` (`filter_texto`). No teste devolveu `null`, então não é confiável para coleta.
- Leis, decretos e vetos saem no PDF. É preciso segmentar o PDF pelos cabeçalhos "LEI Nº", "DECRETO Nº" e "VETO".

### 2.2 Legislação estadual
- O próprio SAPL da ALEPI publica as leis sancionadas, com PDF (muitas vezes o documento SEI do Executivo). Exemplo: **Lei nº 9.130, de 09/10/2026**: https://sapl.al.pi.leg.br/norma/7212 (PDF: `/media/sapl/public/normajuridica/2026/7212/sei_0026939349_lei_9130_2.pdf`).
- `legislacao.pi.gov.br` não respondeu (sem DNS ou conexão em 2026-11-02). Não há outro portal oficial do Executivo para a legislação consolidada.

---

## 3. Exemplos reais

| Tipo | Item | URL |
|---|---|---|
| Projeto | PLC nº 5/2026 (votado em 2026-10-28) | https://sapl.al.pi.leg.br/materia/21763 |
| Projeto (recém-apresentado) | PEC nº 1/2026 (posse do governador), apresentada em 2026-10-27 | https://sapl.al.pi.leg.br/materia/21961 |
| Votação nominal | 96ª Sessão Deliberativa, PLC 5/2026: 20 sim, 0 não | https://sapl.al.pi.leg.br/api/sessao/registrovotacao/4635/ e votos em https://sapl.al.pi.leg.br/api/sessao/votoparlamentar/?votacao=4635 |
| Lei | Lei nº 9.130/2026 | https://sapl.al.pi.leg.br/norma/7212 |
| Diário Oficial | DOE-PI nº 208/2026 | link acima |

---

## 4. Viabilidade

- **Legislativo: automatizável total, esforço baixo.** Um coletor SAPL genérico (proposições, tramitação, sessões, `registrovotacao` e `votoparlamentar`, normas) serve para PI e PB, e para qualquer outra casa com SAPL 3.1.
- **Executivo: parcial, esforço médio.** A listagem é automática, mas o PDF precisa ser segmentado, e a classificação do ato (lei, decreto, veto) exige revisão.
- **Riscos:**
  1. Poucas votações nominais (14 em 2026). A maioria das deliberações não tem voto individual. Não inferir votos a partir de "unanimidade".
  2. O campo `__str__` mistura metadados. Usar os campos estruturados (`materia`, `votacao`, `parlamentar`) e resolver os IDs pelas rotas próprias.
  3. A rota de parlamentares é sensível ao formato dos filtros (`True`/`False`).
  4. A busca textual do DOE não funcionou. Depender só da listagem de edições.

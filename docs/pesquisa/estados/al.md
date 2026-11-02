# Fontes oficiais: Alagoas (AL)

Pesquisa feita com acessos reais (curl) em **2026-11-02**.
Arquivos baixados para verificação: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-nordeste-2\dl\` (subpasta `al\` para a API SAPL).

## Resumo

| Item | Melhor via | Formato | Automatizável? |
|---|---|---|---|
| Deputados | SAPL: `sapl.al.al.leg.br/api/parlamentares/...` (34 mandatos na 20ª legislatura, incluindo suplentes que assumiram) | JSON | Total |
| Proposições e tramitação | SAPL 3 (Interlegis) `sapl.al.al.leg.br/api/materia/...` | JSON + PDF | **Total**, mas com **Crawl-delay de 60 s** |
| Votações | SAPL `sessao/registrovotacao` e `votoparlamentar` | JSON | **Não**: os dados param em 2018–2019 |
| Normas | SAPL `norma/normajuridica` (leis e decretos legislativos) + DOE-AL | JSON + PDF | Total para leis; decretos do governador só no DOE |
| Diário Oficial do Estado | `diario.imprensaoficial.al.gov.br/apinova/api` (API JSON da própria SPA) | JSON + PDF | Total (lista de edições e PDF); segmentar atos exige heurística |

**Viabilidade geral:** **alta para proposições e leis**, esforço **médio** (por causa do ritmo de 1 req/min). Voto nominal: **não publicado** em formato aberto atual.

---

## 1. Assembleia Legislativa de Alagoas (ALE-AL)

- **Portal:** https://www.al.al.leg.br/ (Plone). `robots.txt` (servido comprimido): `User-agent: * / Disallow:` (liberado).
- **SAPL:** https://sapl.al.al.leg.br/ (SAPL 3, Interlegis), com API REST em https://sapl.al.al.leg.br/api/.
  - **`robots.txt` do SAPL:** bloqueia uma longa lista de robôs por nome e, para os demais, **`Crawl-delay: 60`** e `Disallow: /materia/docacessorio/pdf/*` e `/materia/docacessorio/zip/*`.
  - Nota de conduta: as primeiras ~10 requisições desta pesquisa foram feitas em sequência rápida, antes de ler o robots.txt. Depois disso a coleta foi refeita com **61 s entre requisições** (script `al_sapl.sh` no scratchpad). Um coletor real **tem de respeitar 60 s** e evitar os documentos acessórios.

### 1.1 Deputados
- `GET /api/parlamentares/legislatura/` (20ª legislatura = id 35, 2023–2027) e `GET /api/parlamentares/mandato/?o=-id&page_size=100`: **34 mandatos** na legislatura 35, todos com fim em 31/01/2027 (inclui suplentes que assumiram, ex.: "DEPUTADA ELIDA MIRANDA", mandato desde 11/08/2026).
- `GET /api/parlamentares/parlamentar/` traz nome, partido (via filiação) e foto.

### 1.2 Proposições e tramitação
- `GET /api/materia/materialegislativa/?ano=2026&o=-id` → **799 matérias em 2026** (PL ordinária, PDL, resolução, requerimento, emendas, ofícios). Cada item tem `numero`, `ano`, `tipo`, `data_apresentacao`, `ementa`, `em_tramitacao`, `texto_original` (PDF), autoria (endpoint `materia/autoria`).
- `GET /api/materia/tramitacao/?ordering=-data_tramitacao` → tramitações datadas, com status e unidade.
- Atualização: matérias protocoladas em 29/10/2026 já presentes.
- Página HTML da matéria: `https://sapl.al.al.leg.br/materia/<id>`.

### 1.3 Votações e voto nominal
- O SAPL tem o modelo completo (`sessao/sessaoplenaria`, `sessao/registrovotacao`, `sessao/votoparlamentar` com `voto` Sim/Não por parlamentar), **mas a ALE-AL parou de alimentá-lo**: a sessão mais recente registrada é de **13/12/2019** (378 sessões no total); são **217 registros de votação** e **2.003 votos individuais**, todos de 2018–2019 (ex.: Indicação 124/2015, 18 votos Sim).
- O portal (`/processo-legislativo/sessao-plenaria`) ainda aponta para a página legada do SAPL. A pauta e o Diário Oficial Eletrônico do Poder Legislativo existem (`/comunicacao/diario-oficial-eletronico-do-poder-legislativo`), em PDF.
- A busca do próprio portal mostra **pedidos via LAI** de "votação nominal do PLC 74/2019" e de "histórico de votações nominais por parlamentar", sinal de que o dado **não é publicado** de forma ativa.
- Conclusão: o voto de cada deputado, quando houver votação nominal, só se obtém por **ata/diário (PDF), vídeo da TV Assembleia ou pedido de LAI** → curadoria.

### 1.4 Normas
- `GET /api/norma/normajuridica/?ano=2026&o=-id` → **346 normas em 2026** (leis ordinárias, decretos legislativos), com `texto_integral` (PDF), `data`, `data_publicacao` e `veiculo_publicacao` ("DIÁRIO OFICIAL DO ESTADO", "D.O.E - ALE").
- Página: `https://sapl.al.al.leg.br/norma/<id>`.

---

## 2. Governo de Alagoas

### 2.1 Diário Oficial do Estado (Imprensa Oficial / CEPAL)
- **Portal:** https://diario.imprensaoficial.al.gov.br/ (SPA Vue; `robots.txt` não existe — a SPA devolve o HTML). O site antigo `imprensaoficialal.com.br` redireciona para `www.imprensaoficial.al.gov.br`.
- **API usada pela própria página** (`https://diario.imprensaoficial.al.gov.br/apinova/api/`):
  - `GET editions/published?page=1` → edições recentes (`id`, `number`, `publication_date`, `suplement`); `GET editions/published/<ano>/<mês>` → edições do mês.
  - `GET editions/downloadPdf/<id>` → **PDF da edição** (ex.: id 51955, 30/10/2026, 852 kB, com camada de texto). A edição traz "DECRETO Nº 113.412, DE 29 DE OUTUBRO DE 2026" etc.
  - `POST editions/searchES?page=1&bucket_size=10` com corpo `keywords=...&year=...` (form-urlencoded) → busca textual por página (Elasticsearch), com trechos destacados.
  - `GET legislations/published/<ano>/<mês>?page=&perPage=` devolve os tipos (Lei, Ato, Lei Complementar, Decreto, Projeto de Lei) mas **veio vazio** para 2026 — a seção "legislações" não está sendo alimentada.
  - A API expõe páginas de erro do Laravel com stack trace quando o parâmetro é inválido (risco de instabilidade; não insistir).
- Decretos do governador: só no DOE (PDF) → segmentar por cabeçalho "DECRETO Nº".

### 2.2 Gabinete Civil / legislação
- https://gabinetecivil.al.gov.br/legislacao apenas aponta para o sistema da SEFAZ: `https://gcs.sefaz.al.gov.br/#/administrativo/documentos/consultar-gabinete` (não testado a fundo; SPA). Para leis, o SAPL da ALE-AL é mais simples.

---

## 3. Exemplos reais (abertos em 2026-11-02)

- **Projeto:** PL Ordinária nº 2176/2026 (glicemia capilar em triagens): https://sapl.al.al.leg.br/materia/16040 (texto: `media/sapl/public/materialegislativa/2026/16040/protocolo_4758.pdf`).
- **Votação:** não há votação recente registrada. Último registro estruturado: votação id 218 (Indicação 124/2015, 63ª Ordinária da 1ª Sessão Legislativa da 18ª Legislatura) — `https://sapl.al.al.leg.br/api/sessao/registrovotacao/218/` (endereço montado a partir do padrão REST do SAPL, não aberto individualmente); os votos aparecem em `/api/sessao/votoparlamentar/` com o campo `votacao: 218` (ex.: Sérgio Toledo, "Sim").
- **Lei:** Lei nº 10.066, de 13/10/2026 (reestrutura a ARSAL): https://sapl.al.al.leg.br/norma/4102
- **Decreto:** Decreto nº 113.412, de 29/10/2026, no DOE de 30/10/2026: https://diario.imprensaoficial.al.gov.br/apinova/api/editions/downloadPdf/51955

---

## 4. Viabilidade

- **Proposições, tramitação, leis:** automatizável **total** via SAPL; esforço **médio** — o código é simples (mesma API em centenas de casas legislativas), mas o **Crawl-delay de 60 s** obriga coleta incremental lenta (ex.: só o que mudou desde a última data).
- **Decretos e vetos:** **parcial** (PDF do DOE, segmentação por cabeçalho).
- **Voto nominal:** **curadoria / LAI**; esforço **alto**.
- **Riscos:** SAPL sem sessões/votações desde 2019 (o portal não diz se voltará a ser usado); seção "legislações" do DOE vazia; API do DOE sem documentação e com erros expostos.

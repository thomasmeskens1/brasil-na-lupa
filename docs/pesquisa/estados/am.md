# Amazonas (AM): fontes oficiais

Pesquisa feita com acessos reais em **2026-11-02** (curl e Python, com o agente `PlacarDoPoder-pesquisa/1.0`).
Scripts e respostas: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-norte\` (`out/sapl.al.am.leg.br.*`).

## 1. Assembleia Legislativa (ALEAM)

| Item | Onde | Formato | Observação |
|---|---|---|---|
| Portal | https://www.aleam.gov.br/ (WordPress) | HTML | O robots.txt só bloqueia `/wp-admin/` e `/cgi-bin/` |
| Sistema legislativo | **SAPL 3**: https://sapl.al.am.leg.br/ (API em `/api/`) | **JSON** + HTML + PDF | Sem autenticação |
| Deputados | `/api/parlamentares/mandato/?legislatura=20` | JSON | 26 mandatos (todos titulares) na 20ª legislatura (2023–2027). O resumo da sessão traz nome e partido (ex.: "Abdala Fraxe / AVANTE") |
| Proposições | `/api/materia/materialegislativa/` | JSON | 79.327 no total; **4.907 de 2026**. Mais recente: Requerimento 4081/2026, de 28/10/2026 |
| Tramitação | `/api/materia/tramitacao/` | JSON | 175.690 registros; o último é de 29/10/2026 |
| Sessões | `/api/sessao/sessaoplenaria/` | JSON | 2.623 sessões; a 94ª Ordinária, de 28/10/2026, tem `url_video` (YouTube) e pauta em PDF |
| Ordem do dia | `/api/sessao/ordemdia/` | JSON | 6.983 itens, dos quais **6.920 com `tipo_votacao=2` (nominal)**: praticamente tudo é votado no painel |
| Resultado | `/api/sessao/registrovotacao/` | JSON | 6.650 registros com sim/não/abstenção e observação |
| **Voto nominal** | `/api/sessao/votoparlamentar/?votacao={id}` | **JSON**, um registro por deputado | **133.582 votos**; o mais recente é de 28/10/2026 às 16:12 |
| Normas | `/api/norma/normajuridica/` | JSON + PDF | 14.966 normas; **623 de 2026**; a mais recente é a Lei 8.563, de 20/10/2026, com o campo `veiculo_publicacao` ("D.O.E. 35.809") |

**robots.txt** (`sapl.al.am.leg.br`): para `*`, **`Crawl-delay: 60`**; bloqueia apenas `/materia/docacessorio/pdf|zip/*`.

## 2. Governo do Estado

| Item | Onde | Formato | Observação |
|---|---|---|---|
| DOE-AM (Imprensa Oficial) | https://diario.imprensaoficial.am.gov.br/ | **JSON** (API interna do portal) + PDF | `GET /apifront/portal/edicoes/ultimas_edicoes.json` lista as edições (id, data, número). `/apifront/portal/edicoes/busca_edicao/{id}` traz os metadados (páginas, assinatura, data de publicação). `/apifront/portal/edicoes/edicoes_from_data/AAAA-MM-DD.json` busca por data. O PDF completo fica em `/portal/edicoes/download/{id}`. Há busca textual em `/busca/?q=`. robots.txt: 404, sem restrição declarada |
| Última edição vista | id 18259, **nº 35.815, de 28/10/2026** (54 páginas, assinada, publicada em 30/10/2026 às 17:13) | PDF | https://diario.imprensaoficial.am.gov.br/portal/edicoes/download/18259 (HTTP 206, `application/pdf`) |
| Legislação consolidada | **Legisla.AM**: https://legisla.imprensaoficial.am.gov.br/diario_am | HTML | Seções: leis ordinárias (`/diario_am/12/{ano}/{mês}`), complementares (`/10`), delegadas (`/11`), promulgadas (`/41534`), decretos legislativos (`/41535`) e **decretos numerados (`/41536`)**. "Última versão da base: 26/10/2026". A lista do mês é montada por JavaScript e não apareceu via curl |

Os **vetos** chegam à ALEAM como matéria (`Ofício` ou `MENSAGEM DO GOVERNADOR`), e o tipo existe no SAPL.

## 3. Exemplos reais

- **Projeto:** PL Ordinária 615/2026 (28/10/2026), "Estabelece requisitos de segurança para a instalação… de traves de gol…", https://sapl.al.am.leg.br/materia/185069.
- **Votação nominal:** PL Ordinária 721/2021, 95ª Ordinária (28/10/2026), "Aprovado", **22 sim / 0 não / 0 abstenção**. Votos por deputado em https://sapl.al.am.leg.br/api/sessao/votoparlamentar/?votacao=6872 (22 registros "Sim", ex.: Abdala Fraxe). Resumo da sessão: https://sapl.al.am.leg.br/sessao/2636/resumo.
- **Lei:** Lei Ordinária 8.563, de 20/10/2026 (D.O.E. 35.809), https://sapl.al.am.leg.br/norma/15199, PDF em http://sapl.al.am.leg.br/media/sapl/public/normajuridica/2026/15199/8563.pdf.

## 4. Viabilidade

- **Legislativo: automatizável quase por inteiro** (esforço **baixo**). Este é o melhor caso da região Norte: o voto nominal vem em JSON em quase toda a ordem do dia, ligado a matéria, sessão e deputado.
- **DOE: automatizável em parte** (esforço **médio**). A lista de edições sai em JSON e o PDF é baixável, mas separar leis, decretos e vetos dentro do PDF exige extração de texto e curadoria (como no DOE de Atibaia).
- **Riscos:** o crawl-delay de 60 s; a API do DOE não é documentada (pode mudar sem aviso); a observação "REDAÇÃO FINAL PENDENTE" mostra que um "Aprovado" pode não ser a votação final; um veto derrubado ou mantido exige seguir a matéria `Ofício`/`MSGOV`.

# Rondônia (RO): fontes oficiais

Pesquisa feita com acessos reais em **2026-11-02** (curl e Python, com o agente `PlacarDoPoder-pesquisa/1.0`).
Scripts e respostas: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-norte\` (`out/sapl.al.ro.leg.br.*`, `out/ro_*.html`).

## 1. Assembleia Legislativa (ALE-RO)

| Item | Onde | Formato | Observação |
|---|---|---|---|
| Portal | https://www.al.ro.leg.br/ | HTML | robots.txt: 404. Links para atas, ordem do dia, pautas, "Frequência Parlamentar", "Proposições Recebidas" e o Diário Oficial da ALE-RO (`transparencia.al.ro.leg.br/Diario/`) |
| Sistema legislativo | **SAPL 3**: https://sapl.al.ro.leg.br/ (API em `/api/`) | **JSON** + HTML + PDF | Sem autenticação |
| Deputados | `/api/parlamentares/mandato/?legislatura=11` | JSON | 26 mandatos na 11ª legislatura (2023–2027), dos quais 25 titulares (a Casa tem 24 cadeiras; os registros extras são de suplentes ou substituições) |
| Proposições | `/api/materia/materialegislativa/` | JSON | 57.233 no total; **5.899 de 2026**. Mais recente: PLO 1561/2026, de 27/10/2026 |
| Tramitação | `/api/materia/tramitacao/` | JSON | 112.043 registros; o último é de 28/10/2026 |
| Sessões | `/api/sessao/sessaoplenaria/` | JSON | 1.584 sessões; resumo em `/sessao/{id}/resumo`, com a lista de presença (nome e partido) |
| Ordem do dia | `/api/sessao/ordemdia/` | JSON | 16.471 itens; **2.328 com `tipo_votacao=2`** (nominal: PEC, PLC etc.) |
| Resultado | `/api/sessao/registrovotacao/` | JSON | 15.930 registros (sim/não/abstenção) |
| **Voto nominal** | `/api/sessao/votoparlamentar/?votacao={id}` | **JSON** | **44.396 votos**; o mais recente é de 19/10/2026. Valores observados: "Sim" e "Não Votou" |
| Normas | `/api/norma/normajuridica/` | JSON + PDF | 12.407 normas; **839 de 2026**; a mais recente é a Lei 6.525–6.527, de 23/09/2026 (D.O.E nº 184) |

**robots.txt** (`sapl.al.ro.leg.br`): **`Crawl-delay: 60`** para `*`; bloqueia só `/materia/docacessorio/pdf|zip/*`.

## 2. Governo do Estado

| Item | Onde | Formato | Observação |
|---|---|---|---|
| DOE-RO (DIOF) | https://diof.ro.gov.br/ (WordPress) | PDF | Lista na home com links diretos: `https://diof.ro.gov.br/data/uploads/AAAA/MM/DOE-DD-MM-AAAA.pdf`, mais os suplementares (`…-SUPLEMENTAR.pdf`). **O padrão do nome não é uniforme** (ex.: `DOE-27-10-26.pdf`). A REST API do WordPress está fechada ("Only authenticated users", 401). robots.txt só bloqueia `/wp-admin/`. Última edição vista: **DOE de 29/10/2026 e suplemento** |
| Legislação (Casa Civil, DITEL/COTEL) | https://ditel.casacivil.ro.gov.br/cotel/Livros/ | HTML (ASP.NET) + PDF | Listas por ano sem formulário: `listleiord.aspx?ano=2026` (leis ordinárias), `listdecnum.aspx?ano=2026` (**decretos numerados**), mais `leicomp.aspx` e `declei.aspx`. Ficha em `detalhes.aspx?coddoc={id}`; PDF em `Livros/Files/D{nº}.pdf` e `L{nº}.pdf`. robots.txt: 404. *O Python/urllib levou "connection reset" do servidor; o curl funcionou* |

## 3. Exemplos reais

- **Projeto:** PLO 1561/2026 (27/10/2026), crédito adicional suplementar por excesso de arrecadação, https://sapl.al.ro.leg.br/materia/58662.
- **Votação nominal:** PEC 27/2026, 19ª Sessão Extraordinária, "Aprovada em 1ª discussão e votação", 17 registros de voto (ex.: "ALAN QUEIROZ: Sim"; "MARCELO CRUZ: Não Votou"). https://sapl.al.ro.leg.br/api/sessao/votoparlamentar/?votacao=16782.
- **Lei:** Lei 6.525, de 23/09/2026 (D.O.E nº 184), https://sapl.al.ro.leg.br/norma/14241, PDF em http://sapl.al.ro.leg.br/media/sapl/public/normajuridica/2026/14241/l6525.pdf. Na Casa Civil: `listleiord.aspx?ano=2026` (código 45399).
- **Decreto:** Decreto 32.167, de 27/10/2026 (crédito suplementar), https://ditel.casacivil.ro.gov.br/cotel/Livros/detalhes.aspx?coddoc=45581.

## 4. Viabilidade

- **Legislativo: automatizável quase por inteiro** (esforço **baixo**, com o coletor SAPL comum da região). O voto nominal é registrado nas matérias com votação nominal (PEC, PLC); as demais têm só os totais.
- **Normas e decretos: automatizáveis** (esforço **baixo/médio**). A DITEL tem listas por ano em HTML simples, com PDF.
- **DOE: automatizável em parte** (esforço **médio**). Os PDFs são diretos, mas o nome muda de padrão; separar os atos exige curadoria.
- **Riscos:** o crawl-delay de 60 s; erros de digitação na base (uma matéria de 2008 aparece com `data_apresentacao` "2208-02-06", o que exige validar datas); "Não Votou" não é voto contrário; a DITEL derruba conexões de alguns clientes (usar curl ou ajustar o TLS, sem disfarçar o agente).

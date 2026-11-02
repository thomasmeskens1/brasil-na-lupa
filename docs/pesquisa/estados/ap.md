# Amapá (AP): fontes oficiais

Pesquisa feita com acessos reais em **2026-11-02** (curl e Python, com o agente `PlacarDoPoder-pesquisa/1.0`).
Scripts e respostas: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-norte\` (`out/elegis.html`, `out/ap_*.html`, `out/ata.bin`).

## 1. Assembleia Legislativa (ALAP)

| Item | Onde | Formato | Observação |
|---|---|---|---|
| Portal | https://www.al.ap.leg.br/ | HTML (PHP) | O robots.txt responde **403** (pela RFC 9309, não há restrição declarada) |
| Sistema legislativo | **eLegis**: https://elegis.al.ap.leg.br/portal/ | **HTML** + PDF | robots.txt: `User-agent: * / Disallow:` (tudo liberado). **Não há API** (`/api/proposicoes` dá 404). Aviso no portal: "O Processo Legislativo está em fase de implantação do novo sistema eLegis… as informações… podendo não ser apresentadas em tempo real" |
| Sistema antigo | SILEGIS (`silegis.al.ap.leg.br/proposicaopdf/...`) | PDF | Os PDFs das proposições antigas continuam linkados nas pautas |
| Deputados | https://www.al.ap.leg.br/pagina.php?pg=exibir_legislatura | HTML | **24 deputados**, com nome completo e partido (`pg=exibir_parlamentar&iddeputado=N`) |
| Proposições | https://elegis.al.ap.leg.br/portal/proposicoes?tipo_proposicao=1 (PLO; também 2=PLC, 4=PEC, 10=PDL, 9=PR, 3=Req., 5=Moção, 8=Indicação; existe o tipo Veto) | HTML com filtros (tipo, número, ano, origem, deputado) | **6.604 proposições** na listagem. A ficha `/portal/proposicao/{id}` tem ementa, origem, data de protocolo, "Texto Original" em PDF (`/storage/proposicoes/*.pdf`) e "Movimentação" (tramitação) |
| Pautas | `/portal/sessoes`, `/portal/sessao/{id}`, `/portal/sessao/{id}/pauta-pdf` | HTML + PDF | Pauta estruturada, com itens, proposição, autor e ementa |
| Atas | `/portal/atas`, `/portal/sessao/{id}/ata` | **HTML** | Texto corrido. Cada matéria tem resultado ("aprovada por unanimidade dos Deputados presentes") e **a lista nominal dos ausentes**. Também há "Lista de Presença" |
| **Voto nominal** | — | — | **Não encontrado** em formato estruturado. As atas só trazem o resultado e os ausentes; o voto individual não é registrado. Vídeo das sessões: canal TV Assembleia no YouTube |
| Leis | https://elegis.al.ap.leg.br/portal/legislacao?tipo_proposicao_id=1 (também 2, 9, 10) | HTML | Tipo, número, data, ementa, **número do DOE**, data de publicação, link para a proposição de origem e o texto integral (`/portal/proposicao/{id}/texto-integral`) |

## 2. Governo do Estado

| Item | Onde | Formato | Observação |
|---|---|---|---|
| DOE-AP (DIOFE) | https://diofe.portal.ap.gov.br/ | **JSON** (API interna, a mesma plataforma da Imprensa Oficial do AM) + PDF | `GET /apifront/portal/edicoes/ultimas_edicoes.json`; PDF em `/portal/edicoes/download/{id}`. Última edição vista: **id 10153, nº 8.773, de 29/10/2026** (PDF baixado com HTTP 206). robots.txt: 404, sem restrição. A busca `/busca?q=` deu 404 (a rota exata não foi confirmada) |
| Legislação | A mesma lista "Legislação" do eLegis (leis, com o nº do DOE); no portal antigo, `al.ap.leg.br/pagina.php?pg=buscar_legislacao` | HTML | **Decretos do governador**: só no DOE (PDF). Não encontrei portal de legislação da Casa Civil |

## 3. Exemplos reais

- **Projeto:** PLO 0043/26-GEA (Poder Executivo, protocolado em 29/10/2026), altera a Lei 789/2003 (FREBOM). https://elegis.al.ap.leg.br/portal/proposicao/111290. Movimentação: "Incluído para leitura: 48ª Sessão Ordinária".
- **Votação:** 47ª Sessão Ordinária (pauta de 20/10/2026), ata em https://elegis.al.ap.leg.br/portal/sessao/1714/ata. Vários PLs "aprovad[os] por unanimidade dos Deputados presentes", com "ausentes os Deputados: Coronel Flexa, Junior Favacho, Rodolfo Vale e as Deputadas: Edna Auzier, Telma Nery e a Zeneide Costa".
- **Veto:** PLO 0169/26-AL (Dep. Roberto Góes), com a situação "Vetado Totalmente" na listagem de proposições.
- **Lei:** Lei Ordinária 3.530, de 21/09/2026 (DOE 8745), originada do PLO 0005/26-PGJ. Ficha em https://elegis.al.ap.leg.br/portal/legislacao?tipo_proposicao_id=1; texto em https://elegis.al.ap.leg.br/portal/proposicao/110964/texto-integral.

## 4. Viabilidade

- **Legislativo: automatizável em parte** (esforço **médio**). Proposições, tramitação, pautas, atas e leis exigem um raspador de HTML estável (servidor Laravel com URLs limpas). O voto nominal **não existe** em fonte oficial: o site mostra o resultado e a lista de ausentes **tal como está na ata**, sem deduzir o voto de cada presente.
- **DOE: automatizável em parte** (esforço **médio**). A lista sai em JSON e o PDF é baixável; separar os atos (decretos, vetos, sanções) exige curadoria.
- **Riscos:** o eLegis ainda está "em implantação" (os dados podem mudar ou ficar incompletos); as atas vêm em texto livre, então mudanças de redação quebram o parser; "unanimidade dos presentes" não é um voto nominal registrado e deve aparecer literalmente.

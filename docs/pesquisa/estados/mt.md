# Mato Grosso (MT): fontes oficiais

Pesquisa feita com acessos reais em **2026-11-02** (curl com User-Agent identificado e, quando foi preciso, navegador). Regras seguidas: só fontes oficiais, `robots.txt` respeitado e nenhuma proteção anti-robô contornada.

## Resumo

| Item | Melhor via | Formato | Automatizável |
|---|---|---|---|
| Deputados (24) | Portal ALMT `/parlamento/deputados` (HTML). A API exige credencial | HTML | Sim (HTML) |
| Proposições e tramitação | Portal ALMT: páginas de detalhe `/proposicao/{id}/tramitacoes` (fragmento HTML) | HTML + PDF | Parcial: as listagens com `?` são proibidas pelo robots |
| Votações | Ordem do dia (PDF) e tramitação ("Mantido", "Aprovado"...). **Não foi encontrado voto nominal publicado** | PDF/HTML | Só o resultado agregado |
| Normas (leis e decretos) | IOMAT, com busca em JSON (Elasticsearch) e edições por data. Ficha da norma na ALMT por URN LexML | JSON + PDF/HTML | Sim |

---

## 1. Assembleia Legislativa (ALMT)

- **Portal:** https://www.al.mt.gov.br/. **robots.txt:** bloqueia as listagens com parâmetros: `/proposicao?`, `/norma-juridica?`, `/parlamento/ordem-do-dia?`, `/parlamento/documentos/parlamentares?`, `/transparencia/pesquisa/`. Também **bloqueia totalmente** GPTBot, CCBot, ChatGPT-User e Google-Extended. As páginas sem `?` (detalhes, fragmentos e primeira página das listas) são permitidas.
- **API oficial `https://api.al.mt.gov.br/`** (página "ALMT API"). Tem endpoints `ssl/parlamentar`, `ssl/proposicao`, `ssl/proposicao/tramitacao`, `ssl/sessao-plenaria/{id}/proposicao-votada`, `ssl/ordem-dia`, `ssl/norma-juridica`... Exige **OAuth2 com credenciais "fornecidas pela instituição"**: o próprio portal a descreve como "ofertados aos fornecedores". Teste real: `GET /api/v1/ssl/proposicao` retorna `401 {"error":"access_denied","error_description":"OAuth2 authentication required"}`. Limite documentado: 10 requisições/s. O retorno de `proposicao-votada` (segundo a documentação) traz `autor, tipo, numero, ano, ementa, tipoVotacao`. Ou seja, informa o **tipo de votação**, mas **não o voto de cada deputado**. **Caminho:** pedir credencial pela Ouvidoria/SIC da ALMT.
- **Deputados:** https://www.al.mt.gov.br/parlamento/deputados (24 perfis, `/parlamento/deputados/{id}/perfil`).
- **Proposições:** a lista `/proposicao` (só a 1ª página é permitida) mostra a página em blocos. Cada item carrega por "turbo-frame":
  - Tramitação: `https://www.al.mt.gov.br/proposicao/{cpdoc}/tramitacoes` (HTML curto, com data e evento: "Lido", "Parecer", "Relator", "Mantido: 36ª Sessão Ordinária"...).
  - Emendas: `/proposicao/{cpdoc}/emendas-e-substitutivos`.
  - Texto: `/proposicao/cpdoc/{cpdoc}/visualizar` (HTML com link para PDF em `/storage/webdisco/cp/...pdf`).
  - Tipos: Indicação, Moções, PDL, PEC, PL, PLC, Projeto de Resolução, Requerimento, Veto.
- **Votações em plenário:** a ALMT publica a **Ordem do Dia em PDF** (`https://storage.al.mt.gov.br/api/v1/download/default/{id}`, PDF com texto; storage sem restrição no robots). Em "Documentos parlamentares" existem os tipos "Ata - Sessão Plenária", "Proposições Votadas - Sessão Plenária" e "Súmulas". O filtro por tipo usa `?`, que é **proibido pelo robots**, então essa listagem não foi aberta. **Não foi localizado voto nominal estruturado.** A tramitação traz apenas o resultado ("Mantido", "Aprovado"); nas comissões, apenas "Voto: Acata o Parecer". **Voto individual: informação não disponível em fonte oficial estruturada.** Para MT é preciso conferir nas atas (PDF) e nos vídeos da TV Assembleia, por curadoria.
- **Diário Oficial Eletrônico da ALMT:** https://diariooficial.al.mt.gov.br/ (Dexatec). Busca `/publicacoes/?q=` com página por publicação (`/publicacoes/{id}/`, texto em HTML) e PDF da edição assinada (edição nº 2141 de 30/10/2026). Não há robots.txt (404).
- **Atualização:** contínua. Agenda de 03/11/2026 publicada; Ordem do Dia da 54ª Sessão Ordinária (28/10/2026).

## 2. Governo de MT

- **Diário Oficial (IOMAT):** https://www.iomat.mt.gov.br/ (robots.txt inexistente, 404). APIs do próprio portal, sem documentação, testadas:
  - Edições por data: `GET /apifront/portal/edicoes/edicoes_from_data/AAAA-MM-DD.json` → `{itens:[{id, numero, suplemento, paginas}]}`. Exemplo: 2026-10-29 → edição 29.347 (id 19401, 236 páginas) e suplemento (id 19404).
  - Busca de texto integral por página (Elasticsearch): `GET /busca/busca/buscar/query/{pagina}/d:AAAA-MM-DD/AAAA-MM-DD/?1=1&q="..."` → JSON com `conteudo` (texto da página), `data`, `diario_id`, `pagina`, `pdf_id`.
  - PDF da edição: `/portal/edicoes/download/{id}`. Conteúdo HTML de publicação: `/apifront/portal/edicoes/publicacoes_ver_conteudo/{id}`.
  - Leis, decretos e vetos saem no corpo do DOE. A **razão do veto** aparece no texto (ex.: "Inconstitucionalidade formal do inciso X do art. 4º...", página 6 do DOE de 22/09/2026).
- **Legislação consolidada:** `legislacao.mt.gov.br` **redireciona para `leisestaduais.com.br`, site privado** que responde com desafio Cloudflare (403). **Não é fonte oficial e não deve ser usado.** A alternativa oficial é a **ficha de norma da ALMT** com URN LexML: `https://www.al.mt.gov.br/norma-juridica/urn:lex:br;mato.grosso:estadual:lei.ordinaria:2026-09-22;13574` (HTML, com links para a proposição e o "Diário Oficial Eletrônico" e geração de PDF em `/gerar-pdf-redacao`). A lista `/norma-juridica` (sem `?`) mostra as mais recentes.

## 3. Exemplos reais (abertos em 2026-11-02)

- **Projeto:** PEC 2/2026 (Dep. Janaina Riva), arquivada em 07/04/2026: https://www.al.mt.gov.br/proposicao/cpdoc/174768/visualizar. Tramitação: https://www.al.mt.gov.br/proposicao/174768/tramitacoes
- **Votação (resultado agregado):** Veto ao PLC 1/2026 (licença para mandato classista), "Mantido: 36ª Sessão Ordinária (17/06/2026)": https://www.al.mt.gov.br/proposicao/172857/tramitacoes. Ordem do Dia da sessão ordinária de 28/10/2026 (PDF): https://storage.al.mt.gov.br/api/v1/download/default/1106578
- **Lei:** Lei 13.574, de 22/09/2026 (Semana de Valorização do Conselheiro Tutelar; autor: Dep. Paulo Araújo). Ficha: https://www.al.mt.gov.br/norma-juridica/urn:lex:br;mato.grosso:estadual:lei.ordinaria:2026-09-22;13574. No IOMAT: DOE nº 29.321, suplemento, página 6 (diario_id 19345).

## 4. Viabilidade

- **Classificação: parcial.** Normas e DOE: **automatizáveis** (JSON do IOMAT + URN da ALMT). Proposições e tramitação: automatizáveis por páginas de detalhe, mas **sem lista permitida pelo robots** para descobrir os IDs novos. Votos: **curadoria** (atas/vídeos), e só se houver votação nominal.
- **Esforço:** médio.
- **Riscos:** (1) a API oficial exige credencial, que precisa de pedido formal; (2) o robots bloqueia as listagens com `?` e bloqueia explicitamente robôs de IA, então o coletor precisa de UA próprio e só deve acessar URLs permitidas; (3) as APIs do IOMAT não têm contrato público e podem mudar; (4) a busca do IOMAT indexa por página, então separar os atos exige heurística; (5) o portal "legislacao.mt.gov.br" leva a um site privado, que deve ser evitado.
- **Recomendação:** pedir à ALMT acesso à API (`proposicao-votada` com `tipoVotacao`) e perguntar se existe registro do painel eletrônico com voto individual.

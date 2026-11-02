# Goiás (GO): fontes oficiais

Pesquisa feita com acessos reais em **2026-11-02**. Regras seguidas: só fontes oficiais, `robots.txt` respeitado e nenhuma proteção anti-robô contornada.

## Resumo

| Item | Melhor via | Formato | Automatizável |
|---|---|---|---|
| Deputados (41 cadeiras) | Portal ALEGO `/deputados/em-exercicio` | HTML | Sim |
| Proposições, tramitação, sessões | Sistema "ALEGO Digital" (SPL), **`robots.txt: Disallow: /`** | HTML/PDF | **Não** (robots), só manual ou por acordo |
| Votos nominais | Não localizados de forma estruturada. As sessões publicam "Votação Preliminar" (resultado agregado) e ata em PDF | HTML/PDF | Curadoria |
| Normas e vetos | **API da Casa Civil (`legisla.casacivil.go.gov.br/api`)**, JSON aberto, com link para o DOE e mensagens de veto | JSON | **Sim** |
| Diário Oficial | DOE-GO (`diariooficial.abc.go.gov.br`), mesmo sistema do IOMAT-MT: busca JSON e edições por data | JSON + PDF | Sim |

---

## 1. Assembleia Legislativa (ALEGO)

- **Portal:** https://portal.al.go.leg.br/. O robots.txt só bloqueia o quadro de remuneração. Deputados: https://portal.al.go.leg.br/deputados/em-exercicio (perfis `/deputados/perfil/{id}`). Também há comissões (`/comissoes/{id}`), agenda (`/agenda?data=AAAA-MM-DD`) e discursos.
- **Consulta legislativa (SPL):** https://alegodigital.al.go.leg.br/spl/. **O `robots.txt` desse host é `User-agent: * / Disallow: /`**, ou seja, **coleta automática proibida**. As páginas foram abertas uma vez por navegador, só para descrever o formato:
  - Sessões: `spl/sessoes.aspx` ("Última atualização: 29/10/2026"). Cada sessão tem documentos: Pauta Prévia/Ordem do Dia, Requerimentos, Expediente, **Votação Preliminar**, **Presença em Plenário**, Ata da Sessão (PDF, `Arquivo/Documents/SES/{id}/...pdf`) e Vídeo. Os tipos incluem "Pauta de Veto".
  - "Votação Preliminar" (`spl/sessao-leitura.aspx?id={sessao}&tip=6`) lista cada proposição com número, processo, autor, ementa, fase e **ação** ("Aprovado Preliminarmente"). É **resultado agregado, sem voto individual**.
  - Consulta de proposição: `spl/consulta-producao.aspx?processo={n}` (link usado pela própria Casa Civil).
  - A ata do PDF aberto não tinha camada de texto (a extração não retornou nada). Não foi possível confirmar se as atas registram votos nominais.
- **Votação nominal:** reportagens (apenas como pista) indicam uso de votação nominal em plenário híbrido. **Não foi localizado registro oficial estruturado do voto de cada deputado.** Voto individual: "informação não disponível em fonte oficial" até confirmação nas atas/vídeos.
- **Transparência:** https://transparencia.al.go.leg.br/ (SPA, robots só restringe a remuneração; sem API pública identificada).

## 2. Governo de GO

- **Legislação (Casa Civil):** https://legisla.casacivil.go.gov.br/. **API JSON aberta**, usada pelo próprio site (sem documentação pública):
  - `GET /api/v1/pesquisa/legislacoes?tipo_legislacao={id}&qtd_por_pagina=N&pagina=P` → `{total_resultados, resultados:[{id, ano, numero, ementa, tipo_legislacao, autor, data_legislacao, numero_processo_projeto_lei, diarios:[{data_diario, numero, suplemento, link_download}], categorias_legislacoes...}]}`. 43.400 atos no total.
  - Tipos (`/api/v2/pesquisa/legislacoes/tipos`): Lei Ordinária (id 2, 25.303), Lei Complementar (1, 216), Decreto Numerado (3, 13.529), Decreto Orçamentário (5), Emenda Constitucional (13, 88)...
  - **Mensagens de veto:** `GET /api/v1/pesquisa/mensagens_veto?qtd_por_pagina=N&pagina=P` (1.284). O texto traz o autógrafo, o processo na ALEGO e **as razões do veto**.
  - Dados abertos em lote: `/api/v2/pesquisa/legislacoes/dados_abertos?ano=&tipo_legislacao=` (JSON; limite de 1.000 registros por consulta).
  - O campo `autor` distingue "Governador do Estado de Goiás" de "Deputado X", o que mostra a origem da lei.
  - Página pública: `https://legisla.casacivil.go.gov.br/pesquisa_legislacao/{id}/{slug}`.
  - O `robots.txt` responde com o HTML da SPA (não há arquivo de robots), então não há restrição declarada.
- **Diário Oficial (DOE-GO):** https://diariooficial.abc.go.gov.br/ (mesmo fornecedor do IOMAT-MT; sem robots.txt):
  - `GET /apifront/portal/edicoes/edicoes_from_data/AAAA-MM-DD.json` (ex.: 23/10/2026 → edição 24.892, suplemento id 7419).
  - `GET /busca/busca/buscar/query/{pag}/?1=1&q="..."` → JSON (índice "multidiarios") com o texto por página.
  - PDF: `/portal/edicoes/download/{id}`.

## 3. Exemplos reais (abertos em 2026-11-02)

- **Projeto:** PL 931/2026 (Dep. Talles Barreto), Processo 22227/2026, aprovado preliminarmente na 84ª Sessão Ordinária (28/10/2026): https://alegodigital.al.go.leg.br/spl/sessao-leitura.aspx?id=956&tip=6 (aberto por navegador; não coletar automaticamente).
- **Votação (agregada):** a mesma página: "Votação Preliminar", 4 registros, ação "Aprovado Preliminarmente".
- **Lei:** Lei 24.570, de 23/10/2026 (autoria do Dep. Talles Barreto, sancionada por Daniel Vilela): https://legisla.casacivil.go.gov.br/pesquisa_legislacao/118537/lei-24570. DOE (suplemento de 23/10/2026): https://diariooficial.abc.go.gov.br/portal/edicoes/download/7419
- **Veto:** Mensagem de veto nº 162/2026 (Autógrafo de Lei nº 405, Processo ALEGO 24700/2024): via `GET https://legisla.casacivil.go.gov.br/api/v1/pesquisa/mensagens_veto?qtd_por_pagina=2&pagina=1`

## 4. Viabilidade

- **Classificação: parcial.** Governo (normas, vetos com razões, DOE): **automatizável** (custo baixo). ALEGO (proposições, sessões, votos): **bloqueada pelo robots**, então fica em curadoria manual ou depende de autorização formal.
- **Esforço:** baixo para normas e vetos; alto para votações.
- **Riscos:** (1) `Disallow: /` no SPL da ALEGO: é preciso pedir autorização ou dados abertos à ALEGO antes de qualquer coleta; (2) as APIs da Casa Civil e do DOE não têm contrato público e podem mudar; (3) as atas em PDF parecem ser imagem, o que exige OCR; (4) não há evidência oficial de voto individual estruturado.
- **Recomendação:** começar por normas e vetos (API Casa Civil) e pedir à ALEGO (Fale Conosco/SIC) acesso de dados às sessões e votações nominais.

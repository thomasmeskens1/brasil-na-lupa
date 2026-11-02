# Fontes oficiais: Rio Grande do Norte (RN)

Pesquisa feita com acessos reais (curl) em **2026-11-02**.
Scripts usados: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-nordeste-1\rn_votos.py`.

## Resumo

| Item | Melhor via | Formato | Automatizável? |
|---|---|---|---|
| Deputados (24 cadeiras) | API eLegis `.../parlamentar` | JSON | Total (**atenção: a API expõe CPF; descartar**) |
| Proposições e tramitação | API eLegis `processo/{id}` e `processo/{id}/tramitacao` | JSON | Total |
| Votação nominal (plenário **e** comissões) | API eLegis `processo/ultimas-votacoes` + `processo/{id}/detalhamento-votacao/{reuniao}` | JSON por deputado, com presença | Total |
| Leis ordinárias e complementares | `al.rn.leg.br/legislacao/leis-ordinarias` (lista HTML) + PDF | HTML / PDF | Total (raspagem simples) |
| Diário Oficial do Estado | `webdisk.diariooficial.rn.gov.br/Jornal/1AAAA-MM-DD.pdf` | PDF com texto | Parcial (segmentar) |

**Viabilidade geral:** o RN tem a **melhor fonte de voto nominal** deste grupo: votos por deputado em JSON, também nas comissões. Automatização **total** no Legislativo e **parcial** no Executivo. Esforço **médio**: a API não tem documentação e foi mapeada a partir do código do próprio site.

---

## 1. Assembleia Legislativa do RN (ALRN)

- **Portal:** https://www.al.rn.leg.br/. `robots.txt`: `User-agent: * / Disallow:` (liberado).
- **Transparência Legislativa (SPA React):** https://transparencialegislativa.al.rn.leg.br/. Rotas do site: `/projeto/:id`, `/parlamentar/:id`, `/evento-legislativo/:id`, `/ultimas-votacoes`, `/pesquisa`, `/pesquisa-avancada`, `/agenda`.
- **API que alimenta o site:** `https://api-transparencialegislativa.al.rn.leg.br/elegis-api-transp-legislativa/`. É pública, sem autenticação e sem documentação. Os endereços foram tirados do `bundle.js` do próprio site. Não há `robots.txt` no host da API (a rota devolve uma página HTML genérica).

### 1.1 Rotas testadas

| Recurso | Rota (relativa à base) | Observação |
|---|---|---|
| Parlamentares | `parlamentar` | Nome parlamentar, filiações com vigência e partido. **Também traz CPF e data de nascimento: o coletor deve descartar esses campos (LGPD, e não fazem parte do escopo)** |
| Últimas votações | `processo/ultimas-votacoes?pagina=N&tamanhoPagina=M` | `total` = 2.454 votações. Cada item: processo (tipo, número/ano, ementa, iniciativa ou autor), `resultadoVotacao` com `reuniao.id` e data |
| Detalhe da votação | `processo/{processoId}/detalhamento-votacao/{reuniaoId}` | Tipo da reunião (Sessão Plenária Ordinária/Extraordinária ou Reunião de Comissão), `votacao.dados[]` (parlamentar, partido, `voto` codificado), `votacao.resumo` (sim/não/abstenção), `obstrucao` e `presenca` |
| Processo | `processo/{id}` | Ficha da proposição |
| Tramitação | `processo/{id}/tramitacao` | Lista de andamentos: setor, data, situação ("Autógrafo encaminhado para sanção" etc.) e `linkDOE` quando houver |
| Temas | `entidade-base/materia-legislativa` | 26 temas |

O `voto` vem como código numérico (no exemplo, `1` = sim, conforme o `resumo`). Antes de publicar, é preciso confirmar o mapeamento de todos os códigos comparando com o `resumo` de várias votações.

### 1.2 Votação nominal: amostra real
Sete reuniões consecutivas, consultadas pelo detalhamento:

| Reunião | Tipo | Data | Processo | Votos individuais | Resumo |
|---|---|---|---|---|---|
| 3019 | Sessão Plenária Ordinária | 2026-09-01 | VET 12/2026 (processo 63344) | 16 | 0 sim / 16 não |
| 3016 | Sessão Plenária Ordinária | 2026-08-25 | PLC 11/2023 | 14 | 14 sim |
| 3011 | Sessão Plenária Extraordinária | 2026-08-25 | processo 63252 | 16 | 16 sim |
| 3029 | Comissão (CCJR) | 2026-10-20 | PL 394/2026 | 5 | 5 sim |

Conclusão: há voto nominal estruturado para as votações de plenário e de comissão registradas no sistema. Atualização quase em tempo real: votações de 2026-10-20 já estavam na API.

### 1.3 Leis
- Listas por tipo, em HTML: https://www.al.rn.leg.br/legislacao/leis-ordinarias (também `leis-complementares`, `decretos-legislativos`, `resolucoes`). Cada item tem um PDF em `https://www.al.rn.leg.br/storage/legislacao/AAAA/<hash>.pdf`.
- Exemplo: **Lei Ordinária nº 12.931, de 19/10/2026** ("Cidade Segura"): https://www.al.rn.leg.br/storage/legislacao/2026/wej7nn0zbuv62xoqcu11bv7qzpqno9.pdf
- **Não usar** como fonte o `iframe.leisestaduais.com.br/rn` linkado no portal. É um serviço privado (Leis Estaduais), não fonte oficial.

### 1.4 Diário da Assembleia
- https://www.al.rn.leg.br/diariooficial redireciona para https://dle.al.rn.leg.br/ (Diário Legislativo Eletrônico). Não tem `robots.txt` (404). Não foi detalhado nesta pesquisa.

---

## 2. Governo do RN

### 2.1 Diário Oficial do Estado (DOE-RN, Departamento Estadual de Imprensa)
- **Portal:** http://www.diariooficial.rn.gov.br/dei/dorn3 (ASP.NET WebForms; o `https://www.diariooficial.rn.gov.br/` só faz o redirecionamento). Não foi possível ler um `robots.txt` (a página de erro é do IIS). Para a coleta, usei apenas os PDFs linkados no próprio portal.
- **PDF diário com URL previsível:** `https://webdisk.diariooficial.rn.gov.br/Jornal/1AAAA-MM-DD.pdf`. Edições extras terminam em `E`, por exemplo `12026-10-13E.pdf`. A edição de 29/10/2026 tem 3,3 MB, com texto.
  - Conteúdo verificado: Decretos nº 35.998, 35.999 e 36.000, de 28/10/2026.
- O portal também linka uma plataforma de edições em `deirn.sdoe.com.br` (fornecedor terceirizado do DEI). Preferir o PDF em `webdisk.diariooficial.rn.gov.br` (domínio oficial).

### 2.2 Gabinete Civil
- http://www.gabinetecivil.rn.gov.br/ (ASP clássico): seção "Legislação" e "Projetos de Lei Pendentes de Sanção" (`Conteudo.asp?TRAN=ITEM&TARG=51141`). Mensagens do governador à Assembleia em `Conteudo.asp?TRAN=PASTAC&TARG=2063`. É HTML legado, útil para a curadoria de vetos e das mensagens de justificativa.

---

## 3. Exemplos reais

| Tipo | Item | URL |
|---|---|---|
| Projeto | Veto nº 12/2026 | https://transparencialegislativa.al.rn.leg.br/projeto/63344 |
| Votação nominal | Sessão Plenária Ordinária de 01/09/2026, VET 12/2026: 0 sim, 16 não | https://api-transparencialegislativa.al.rn.leg.br/elegis-api-transp-legislativa/processo/63344/detalhamento-votacao/3019 |
| Votação em comissão | CCJR, 20/10/2026, PL 394/2026 | `.../processo/63791/detalhamento-votacao/3029` |
| Lei | Lei Ordinária nº 12.931/2026 | link acima |
| Diário Oficial | DOE-RN de 29/10/2026 | https://webdisk.diariooficial.rn.gov.br/Jornal/12026-10-29.pdf |

---

## 4. Viabilidade

- **Legislativo: automatizável total, esforço médio.** A API é rica (votos, presença, obstrução, comissões), mas não tem documentação nem garantia de estabilidade.
- **Executivo: parcial, esforço médio** (PDF diário; segmentar decretos, leis e vetos).
- **Riscos:**
  1. A API não é documentada e pode mudar sem aviso. Fixar testes de contrato e guardar o JSON bruto como evidência.
  2. **Dados pessoais** (CPF, data de nascimento) vêm na rota de parlamentares. Descartar na ingestão e nunca publicar.
  3. O código do `voto` precisa de mapeamento validado. Não deduzir: conferir com o `resumo` oficial.
  4. A ordenação de `ultimas-votacoes` não é estritamente cronológica. Paginar tudo e deduplicar por `reuniao.id` + processo.
  5. O link para leis privadas (leisestaduais.com.br) não é fonte oficial.

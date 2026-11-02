# Fontes oficiais: Ceará (CE)

Pesquisa feita com acessos reais (curl) em **2026-11-02**.
Arquivos baixados para verificação: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-nordeste-1\dl_ce\`.

## Resumo

| Item | Melhor via | Formato | Automatizável? |
|---|---|---|---|
| Deputados (46 cadeiras) | https://www.al.ce.gov.br/deputados | HTML | Total (raspagem simples) |
| Proposições e tramitação | `www2.al.ce.gov.br/legislativo/proposicoes/numero.php` (sistema legado) | HTML | Total, com raspagem de HTML legado (ISO-8859-1) |
| Votação nominal | Portal da Transparência: índice CSV + **um PDF por votação** | CSV + PDF | Parcial: o índice é automático; o PDF exige extração e conferência |
| Normas | DOE-CE (PDF) + BELT (temático) | PDF / HTML | Parcial |
| Diário Oficial do Estado | `imagens.seplag.ce.gov.br/PDF/AAAAMMDD/doAAAAMMDDpNN.pdf` + busca OCR | PDF com texto / JSON | Parcial (segmentar) |

**Viabilidade geral:** **parcial**, esforço **médio/alto**. A própria ALECE declara que a votação nominal é "pouco frequente": **60 votações nominais publicadas** entre 2023 e 2026, todas em PDF.

---

## 1. Assembleia Legislativa do Ceará (ALECE)

- **Portal:** https://www.al.ce.gov.br/. `robots.txt`: só bloqueia `/banco-de-imagens/download/`.
- **Deputados:** https://www.al.ce.gov.br/deputados (fichas em `/deputados/<slug>`). Não há API.

### 1.1 Proposições e tramitação (sistema legado `www2`)
- Índice: https://www.al.ce.gov.br/paginas/proposicoes?menu=96
- Lista por tipo e situação na 31ª legislatura: `https://www2.al.ce.gov.br/legislativo/proposicoes/numero.php?nome=31_legislatura&tabela=<tipo>&opcao=<D|T>`
  - `tabela`: `projeto_lei`, `projeto_compl`, `projeto_decre`, `projeto_emen`, `projeto_indi`, `projeto_mens` (mensagens do governador), `projeto_reso`; `opcao`: `D` (deliberados), `T` (em tramitação).
  - Exemplo: projetos de lei deliberados de 2023 a 2026, **1.384 registros** em 70 páginas de 20. Cada registro traz número, autor, datas de entrada e expediente, ementa, distribuição às comissões, **histórico de tramitação** e o número da lei resultante ("Lei: 19.518").
- Formato: HTML antigo, codificação mista (UTF-8 com trechos em ISO-8859-1). Raspagem viável, mas frágil.
- `www2.al.ce.gov.br/robots.txt` dá 404. Usar ritmo baixo, 1 req/s.

### 1.2 Votação nominal
- **Página oficial:** https://transparencia.al.ce.gov.br/consultas-gerais/votacao-nominal. O texto do Departamento de Plenário diz: "As votações nominais na Alece são procedimentos pouco frequentes [...] A prática predominante no Plenário é a votação simbólica".
- **Índice em CSV:** https://transparencia.al.ce.gov.br/consultas-gerais/votacao-nominal/votacaoNominalcsv. Colunas `LEGISLATURA;SESSÃO;MATERIA;URL`, separadas por `;`, em UTF-8. São **60 votações**, a maioria mensagens do Poder Executivo (operações de crédito, reajustes). Não há coluna de data: a data só aparece no PDF.
- **Cada votação é um PDF** ("Relatório de Votação"), por exemplo https://transparencia.al.ce.gov.br/uploads/votacao_nominal_materia/DBvX13sVLgARUh7Vb7k5ETBJKX7Sq4qmkPLq0LSO.pdf. O PDF traz o presidente da sessão, a data e a hora, "Processo de votação: NOMINAL", o resultado e, para cada deputado, nome, partido e voto, com o sufixo (P) para presencial e (V) para virtual.
  - **Dificuldade real:** no `pdftotext -layout` as colunas SIM/NÃO/ABSTENÇÃO se desalinham das linhas de nomes. É preciso extrair por coordenadas, com `pdfplumber` ou equivalente, como já fazemos em `scripts/coleta/alesp/extrair_votacao_pdf.py`, e conferir os totais de cada votação.
- A API do Portal da Transparência (OpenAPI em `https://transparencia.al.ce.gov.br/docs?api-docs.json`) só cobre contratos, empenhos, licitações, pagamentos e credenciamentos. **Não tem dados legislativos.**

### 1.3 Diário da Assembleia e outros
- Diário Oficial da ALECE: https://doalece.al.ce.gov.br/publico/consulta (não detalhado).
- Atas: https://www.al.ce.gov.br/atas/legislaturas. Ordem do dia (avulso): https://www.al.ce.gov.br/legislativo/ordem-do-dia/avulso-de-projeto
- BELT (Banco Eletrônico de Leis Temáticas): https://belt.al.ce.gov.br/ (Joomla). Organiza a legislação por tema. Serve para consulta, não para coleta incremental.

---

## 2. Governo do Ceará

### 2.1 Diário Oficial do Estado (DOE-CE, Casa Civil)
- **Portal:** https://www.ce.gov.br/diario-oficial/ (WordPress, plugin "ocrdoe"). O `robots.txt` de `www.ce.gov.br` devolveu **403** ao nosso agente, então não foi possível lê-lo. Usei apenas as chamadas que a própria página faz, em volume mínimo.
- **Busca OCR (usada pelo próprio site):** `GET https://www.ce.gov.br/wp-admin/admin-ajax.php?action=ocrdoe_proxy&nonce=<nonce da página>&path=/ocr_documents/query&query=...&exact_phrase=true&order_by=date&order_dir=desc&start_date=AAAA-MM-DD&end_date=AAAA-MM-DD&per_page=N`. Devolve JSON com a página do diário, a data, o caderno e trechos do texto.
  - O `nonce` vem embutido no HTML da página e muda. O backend (`ocrdoeapi.casacivil.ce.gov.br`) exige login quando é chamado diretamente (401). **Não usar como base da coleta**: depende de um nonce de sessão e o OCR é imperfeito. Serve como localizador.
- **PDF oficial, com URL previsível e camada de texto:** `http://imagens.seplag.ce.gov.br/PDF/AAAAMMDD/doAAAAMMDDpNN.pdf` (NN = caderno). Exemplo: http://imagens.seplag.ce.gov.br/PDF/20261028/do20261028p01.pdf (1 MB). A página 1 traz a **Lei nº 19.915, de 28/10/2026**: programa de parcelamento de débitos de **ICMS**, IPVA e ITCD, relevante para o piloto ICMS. `imagens.seplag.ce.gov.br/robots.txt` dá 404 (não existe).
- Leis, decretos e vetos saem no caderno do Poder Executivo, com cabeçalhos "LEI Nº", "DECRETO Nº" e mensagens de veto.

### 2.2 Casa Civil e legislação
- https://www.casacivil.ce.gov.br/ redireciona para `www.ce.gov.br/casacivil/`. Não foi encontrada base estruturada de legislação do Executivo. As fontes primárias são o DOE e, para as leis, a ficha da proposição na ALECE (campo "Lei").
- `www2.al.ce.gov.br/legislativo/legislacao5/leis2026/` dá 403 (sem listagem de diretório).

---

## 3. Exemplos reais

| Tipo | Item | URL |
|---|---|---|
| Projetos | Lista de PLs deliberados (31ª legislatura) | https://www2.al.ce.gov.br/legislativo/proposicoes/numero.php?nome=31_legislatura&tabela=projeto_lei&opcao=D |
| Votação nominal | PL 13/2026 (auxílio-alimentação da Segurança Pública), 10ª Sessão Ordinária, 26/02/2026, aprovado | https://transparencia.al.ce.gov.br/uploads/votacao_nominal_materia/DBvX13sVLgARUh7Vb7k5ETBJKX7Sq4qmkPLq0LSO.pdf |
| Índice de votações | CSV com as 60 votações | https://transparencia.al.ce.gov.br/consultas-gerais/votacao-nominal/votacaoNominalcsv |
| Lei | Lei nº 19.915/2026 (parcelamento de ICMS) | http://imagens.seplag.ce.gov.br/PDF/20261028/do20261028p01.pdf |

---

## 4. Viabilidade

- **Proposições: automatizável total por raspagem, esforço médio** (HTML legado, paginação, codificação mista).
- **Votação nominal: parcial, esforço médio/alto.** O índice CSV é automático, mas cada PDF exige extração por coordenadas e conferência dos totais. O volume é baixo (60), o que permite curadoria humana de cada uma.
- **Normas e DOE: parcial, esforço médio.** O PDF diário tem URL previsível e texto; falta segmentar os atos.
- **Riscos:**
  1. A maior parte das deliberações é simbólica, sem voto individual. Mostrar "Informação não disponível em fonte oficial".
  2. O layout do PDF de votação desalinha as colunas. Nunca atribuir voto sem conferir com os totais.
  3. O `robots.txt` de `www.ce.gov.br` estava inacessível (403). Evitar varredura nesse domínio e usar o PDF em `imagens.seplag.ce.gov.br`.
  4. O sistema legado `www2` pode ser substituído sem aviso.

# Fontes oficiais: Rio Grande do Sul (RS)

Pesquisa feita com acessos reais (curl) em **2026-11-02**.
Arquivos baixados e script de sondagem: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-sul\` (script `sondagem.sh`).

## Resumo

| Item | Melhor via | Formato | Automatizável? |
|---|---|---|---|
| Deputados | Nos votos (nome + partido + id estável); a página `/deputados` carrega a lista por JavaScript | JSON embutido | Total, via votações; a lista própria não foi verificada |
| Proposições e tramitação | `ww4.al.rs.gov.br/proposicao/{SIGLA}/{nº}/{ano}`, **JSON embutido** (`drupal-settings-json`) + busca `/legislativo/pesquisa` | HTML + JSON | **Total** |
| Votações e voto nominal | Mesmo JSON: `#votacoes.lista[].votos[]` com **deputado, partido e voto**, em plenário **e em comissões** | JSON | **Total** |
| Normas | Sistema **LEGIS** (ALRS), que liga norma ↔ proposição ↔ DOE, + DOE-RS | HTML + PDF / JSON | Total |
| Diário Oficial do Estado | DOE-RS (PROCERGS): backend `doe-backend.pro.rs.gov.br/public/...` | **JSON** (matérias em HTML) | **Total** |

**Viabilidade geral:** **alta**, esforço **baixo/médio**. É o melhor caso do Sul: a ALRS publica **voto por deputado com partido**, inclusive nas comissões, e o DOE tem API pública em JSON.

---

## 1. Assembleia Legislativa do Rio Grande do Sul (ALRS)

- **Portal:** https://ww4.al.rs.gov.br/ (Drupal). O `robots.txt` é o padrão Drupal (bloqueia `/admin/`, `/search/`, `/user/...`, `/core/`); `/proposicao` e `/legislativo` estão liberados. `www.al.rs.gov.br/robots.txt` e `ww3.al.rs.gov.br/robots.txt` não existem (404).
- **Dados abertos:** `ww4.al.rs.gov.br/dados-abertos` responde 500. A página `transparencia.al.rs.gov.br/dados-abertos` existe, mas veio **vazia** (sem conjuntos legislativos). Não há API documentada.

### 1.1 Proposições e tramitação
- Busca: `GET /legislativo/pesquisa?siglaTipoProposicao=PL&anoProposicao=2026` (outros filtros: `nroProposicao`, `nomeProponente`, `situacaoProposicao`, `dataIni`, `dataFim`, `assunto1..3`, `pagina`). Retorna 10 por página, em **~10 s por página** (servidor lento; manter ritmo baixo).
- Tipos: PL, PLC, PEC, PDL, PR, **VT (veto total)**, **VP (veto parcial)**, requerimentos, entre outros.
- Página: `/proposicao/{SIGLA}/{nº}/{ano}`. Mostra situação, proponente, ementa, linha do tempo, comissões (relator, parecer), **votações** e links para **Texto** e **Justificativa** (a justificativa oficial do autor, útil para o "por quê").
- **JSON embutido** em `<script data-drupal-selector="drupal-settings-json">`:
  - `#proposicao.dados`: `proposicao`, `proponente`, `ementa`, `descricaoSituacao`, `numeroProcesso`, `dataProtocolo`, `situacoesPorPeriodo[]`, `linkTexto`, `linkJustificativa`, `anexos[]`.
  - `#comissoes.lista[]`: comissão, relator, parecer, data.
  - `#votacoes.lista[]`: `tipoVotacao` (`PlenarySession` / `CommissionMeeting`), `sessaoPlenaria` ou `reuniaoComissao` (número, data), `resultadoFinal`, `resultados[]` e **`votos[]`** com `idParlamentar`, `nomeParlamentar`, `nomeOpcaoVoto` (Sim/Não/Favorável/Contrário), `siglaPartidoParlamentar` e `nomePartidoParlamentar`.
- O partido aparece **por votação** (ex.: Neri, o Carteiro: PSDB na CSMA em 27/08/2025 e PSD em 25/08/2026), o que indica partido na data do voto. Usar o valor de cada registro, sem recalcular.
- Os links de Texto e Justificativa são URLs **assinadas e temporárias** (`api-nopaper.al.rs.gov.br/...pdf?exp=...&sig=...`, validade de ~15–20 min). O site deve citar a página `/proposicao/...` e baixar o PDF na hora da coleta.

### 1.2 Deputados
- `/deputados` monta a lista por JavaScript a partir de `${origem}:5000/listarDestaqueDeputados` (porta não padrão; **não testado**). Alternativa oficial: nome, partido e id vêm em cada voto.

## 2. Governo do Rio Grande do Sul

### 2.1 Diário Oficial do Estado (DOE-RS, PROCERGS)
- Site: https://www.diariooficial.rs.gov.br/ (SPA). A configuração pública `environments/environment.json` aponta o backend `https://doe-backend.pro.rs.gov.br/`. Sem `robots.txt` em nenhum dos dois hosts.
- Endpoints públicos (JSON):
  - `public/diarios/lista`: edições (`id`, `dataString`, `tipoDiario`, `numeroEdicao`, `qtdPaginas`, suplementos).
  - `public/sumario/AAAA-MM-DD`: órgãos do dia com tipos de matéria (ex.: "Atos do Governador" › Decretos, Atos de Pessoal…).
  - `public/materias/?page=&tipoDiario=DOE&entidade=Atos do Governador&tipoMateria=Leis|Decretos&dataIni=AAAA-MM-DD&dataFim=AAAA-MM-DD` (as duas datas são obrigatórias). Teste: 45 decretos em outubro/2026; 37 leis entre julho e outubro/2026.
  - `public/materias/{id}`: `conteudo` (HTML integral), `nomeEntidade`, `nomeTipoMateria`, `responsavelOrgao`, `cargoResponsavelOrgao`, `dataPublicacao`, `pagina`.
  - Link público da matéria: `https://www.diariooficial.rs.gov.br/materia?id={id}`.
- Limitação: a busca por palavra (`queryString`) só devolveu publicações privadas (atas, balanços). Para atos do governo, filtrar por `entidade` e `tipoMateria`.

### 2.2 Legislação estadual: Sistema LEGIS (ALRS)
- https://ww3.al.rs.gov.br/legis/M010/M0100008.ASP (ASP clássico, ISO-8859-1). É um `POST` com `cboTipoNorma` (20 Lei, 2 LC, 3 Decreto, 23 EC…), `TxtNumero_Norma` e `TxtAno`, mais `txtOperacaoFormulario=Pesquisar`; o resultado sai em `M0100017.asp` (depende do cookie de sessão).
- Ficha: `M0100018.asp?Hid_IdNorma={id}` → **Proposição de origem**, ementa, **fonte (DOE nº, data, página)**, assunto/indexação.
- Texto: PDF em `https://ww3.al.rs.gov.br/filerepository/repLegis/arquivos/LEI <nº>.pdf`.

## 3. Exemplos reais (abertos em 2026-11-02)

- **Projeto:** PL 188/2024 (Dep. Edivilson Brum; ICMS pertencente aos municípios), situação "Sancionado(a)" em 11/09/2026: https://ww4.al.rs.gov.br/proposicao/PL/188/2024
- **Votação (comissões e plenário):** no mesmo PL, CCJ em 01/04/2025 (9 favoráveis), CSMA em 27/08/2025 (8), CAM em 04/11/2025 (8) e **Sessão Ordinária 65, de 11/08/2026: 50 Sim, 0 Não**, cada voto com partido.
  - Outro exemplo: **VT 599/2023** (veto total ao PL 599/2023), Sessão Ordinária 71 de 25/08/2026, "Rejeitado", **38 Não**: https://ww4.al.rs.gov.br/proposicao/VT/599/2023
- **Lei:** Lei nº 16.563, de 11 de setembro de 2026 (DOE nº 177 de 14/09/2026, p. 6):
  - Ficha LEGIS (Proposição: PL 188/2024): https://ww3.al.rs.gov.br/legis/M010/M0100018.asp?Hid_IdNorma=77402&Texto=&Origem=1
  - DOE: https://www.diariooficial.rs.gov.br/materia?id=1478945
- **Decreto:** Decreto nº 59.036, de 28/10/2026: https://www.diariooficial.rs.gov.br/materia?id=1499007

## 4. Viabilidade

| Bloco | Classificação | Esforço | Observação |
|---|---|---|---|
| Proposições + votos nominais (plenário e comissões) | Automatizável total | **Baixo/Médio** | JSON embutido com ids estáveis; a busca é lenta |
| Leis (ligação com o projeto) | Automatizável total | Médio | LEGIS é ASP com sessão; ou casar via DOE |
| Decretos, leis e vetos no DOE | Automatizável total | Baixo | API JSON pública do próprio DOE |
| Lista de deputados | Parcial | Baixo | Obter pelos votos ou pela página oficial; não deduzir |

**Riscos:**
- O JSON embutido e o backend do DOE são **internos e sem documentação**: podem mudar sem aviso. Validar o esquema a cada coleta.
- Documentos (texto e justificativa) só saem por URL assinada que expira: guardar a página da proposição como fonte e a data da coleta.
- A busca da ALRS leva ~10 s por página: coleta incremental (por data) e ritmo de 1 pedido a cada poucos segundos.
- "Favorável/Contrário" (comissão) e "Sim/Não" (plenário) devem ser exibidos como na fonte, sem converter para "a favor/contra".

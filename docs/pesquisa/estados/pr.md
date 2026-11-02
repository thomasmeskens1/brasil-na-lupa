# Fontes oficiais: Paraná (PR)

Pesquisa feita com acessos reais (curl) em **2026-11-02**.
Arquivos baixados e script de sondagem: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-sul\` (script `sondagem.sh`).

## Resumo

| Item | Melhor via | Formato | Automatizável? |
|---|---|---|---|
| Deputados | `www.assembleia.pr.leg.br/deputados/conheca` (54 perfis) | HTML | Total (raspagem simples); a API não tem endpoint de deputados |
| Proposições e tramitação | **API pública documentada** `webservices.assembleia.pr.leg.br/api/public/proposicao/...` | JSON | **Total** |
| Votações (resultado) | Trâmites da proposição na API ("1º TURNO - APROVADO" etc.) | JSON | Total, mas só o resultado, sem voto por deputado |
| Voto nominal | "Controle de Votações" do Portal da Transparência | Documento por item, servido por `/api/votacoes*` | **Não**: `robots.txt` proíbe `/api/` e a busca exige reCAPTCHA |
| Normas (leis) | API `norma-legal` (ALEP) + Sistema Estadual de Legislação (Casa Civil) | JSON / HTML | Total |
| Diário Oficial do Estado | DIOE (`www.dioe.pr.gov.br`, plataforma IONEWS): JSON de edições + sumário e matérias em HTML | JSON / HTML | Total |

**Viabilidade geral:** **parcial**. Proposições, tramitação, leis e decretos são **automatizáveis com esforço baixo**. O **voto nominal fica fora** da coleta automática enquanto a ALEP não o publicar em canal liberado a robôs.

---

## 1. Assembleia Legislativa do Paraná (ALEP)

- **Portal:** https://www.assembleia.pr.leg.br/ (54 deputados listados em `/deputados/conheca`, um link `/deputados/perfil/<slug>` por deputado).
- **robots.txt** (revisto em 21/10/2026) do portal e do Portal da Transparência: para `*`, `Disallow: /api/`, `/search`, `/busca`, `/*export`, `/*download`, `/*_csv`, entre outros. Para robôs de IA/SEO, `Crawl-delay: 10` e o servidor responde **429** acima disso.
- **Portal da Transparência:** https://transparencia.assembleia.pr.leg.br/ (pautas, atas, presença, controle de votações, diários).

### 1.1 API de Dados Abertos (documentada)
- Documentação oficial: https://transparencia.assembleia.pr.leg.br/servicos/dados-abertos. URL base declarada: `http://webservices.assembleia.pr.leg.br/api/public`.
- **Só responde em `http://`**: a tentativa em `https://` falhou na conexão. O `robots.txt` do host só bloqueia `/api/account`, `/api/users`, `/management/` etc. (padrão JHipster); `/api/public` está liberado.
- Endpoints:
  - `GET /proposicao/campos`: tipos (PRO = Projeto de Lei, PLC, PDL, RES, IND, PEC, REQ, EPL, VET…), assuntos, autores, status.
  - `POST /proposicao/filtrar` (JSON: `ano`, `codigoTipoProposicao`, `dataInicial`, `dataFinal`, `autor`, `numeroMaximoRegistro`…). Teste: `{"ano":2026,"codigoTipoProposicao":1}` → `totalRegistrosSemLimitador: 829` projetos de lei em 2026, resposta em ~0,6 s.
  - `GET /proposicao/{codigo}`: detalhe com `tramites[]` → `acoes[]` (descrição, data, `codigoAnexo` do documento), `regimeUrgencia`, `normasLegais[]` (norma gerada).
  - `GET /norma-legal/campos`, `POST /norma-legal/filtrar`, `GET /norma-legal/{codigo}`: leis com `movimentacoes[]` (SANCIONADO(A) / PROMULGADO(A), nº e data do Diário Oficial, `nomeArquivo` do PDF) e `proposicoes[]` de origem. Teste: 479 leis de 2026.
- Atualização: lançamentos de 14/09/2026 para uma lei de 09/09/2026, ou seja, poucos dias de defasagem.
- Lacuna: a forma de baixar o anexo pelo `codigoAnexo` não está na documentação (o portal `consultas.assembleia.pr.leg.br` usa `api/public/documento-interno/consulta-publica/...`, que não foi testado).

### 1.2 Votações e voto nominal
- **Resultado** de plenário aparece nos trâmites da API (ex.: `DAP - ORDEM DO DIA` → "1º TURNO - APROVADO", "2º TURNO - APROVADO COM EMENDA"). **Não há voto por deputado** na API.
- **Controle de Votações:** https://transparencia.assembleia.pr.leg.br/plenario/controle-de-votacao ("Atualizado em 30/10/2026 22:49"; anos 2011–2026; por sessão ou por projeto). A página explica que o presidente só vota em empate ou em votação secreta.
  - O script da página (`assets/js/votacoes.min.js`) chama `/api/votacoes`, `/api/votacoes/sessoes`, `/api/votacoes/dados-abertos` etc. **com token reCAPTCHA**. Cada item volta com `arquivo` (documento da votação), e há um botão de "dados abertos" por sessão.
  - **Não coletado**: `/api/` está em `Disallow` no `robots.txt` e o reCAPTCHA é uma barreira anti-robô. Por isso o **formato real do arquivo de votação não foi verificado**.
  - "Presença em Plenário" segue o mesmo padrão (`/api/presenca*`).
- Caminho para obter o voto nominal: **pedido formal à ALEP** (e-SIC ou ofício) para incluir votações e presença em `webservices.../api/public`, ou consulta manual (curadoria) caso a caso.

### 1.3 Outras fontes da ALEP
- Diários da Assembleia (`/plenario/diarios-da-assembleia`): página de 14 MB com cerca de 500 PDFs em `storage2.assembleia.pr.leg.br/file/public-media/...`. Os links vistos eram históricos (1935–1988); os diários recentes não foram localizados nesta pesquisa.
- Atas das sessões, pautas da Ordem do Dia e da CCJ: páginas do Portal da Transparência (HTML).

## 2. Governo do Paraná

### 2.1 Diário Oficial do Estado (DIOE, Departamento de Imprensa Oficial)
- Portal: https://www.dioe.pr.gov.br/ ("Powered by IONEWS"). Não há `robots.txt` (o endereço devolve a página inicial).
- `GET /apifront/portal/edicoes/ultimas_edicoes.json` → JSON com `id`, `data`, `numero`, `tipo_edicao_nome` (ex.: id 17422 = "Diário Oficial Executivo" nº 12260 de 30/10/2026).
- `GET /portal/visualizacoes/view_html_diario/{id}` → **sumário em HTML por seção**: Poder Executivo › Atos do Chefe do Poder Executivo › Decretos Regulamentares / Decretos Autônomos / Decretos Pessoal; Casa Civil; secretarias… Cada matéria tem `identificador` e `data-protocolo`.
- `GET /apifront/portal/edicoes/publicacoes_ver_conteudo/{materia}/{edicao}` → **texto integral da matéria em HTML** (ex.: Decreto nº 15.592, de 30/10/2026, com assinatura).
- PDF certificado: `/portal/edicoes/download/{id}`.
- Leis sancionadas e vetos são publicados pelo Executivo no mesmo diário. A ALEP informa o nº do DIOE em cada movimentação da norma.

### 2.2 Casa Civil: Sistema Estadual de Legislação
- https://www.legislacao.pr.gov.br/legislacao/ (sem `robots.txt`; HTTP 404).
- Busca rápida: `POST pesquisarAto.do?action=listar&opt=r&site=1` com `tipoAto` (1 Lei, 3 LC, 11 Decreto, 9 EC…), `nroAto` e `anoAto` (exige o cookie de sessão da página do formulário).
- Texto: `pesquisarAto.do?action=exibir&codAto={id}&codItemAto=0` (HTML, versões "Original" e "Compilado").

## 3. Exemplos reais (abertos em 2026-11-02)

- **Projeto:** PL 747/2024 (código 121086), Dep. Alexandre Amaro: http://webservices.assembleia.pr.leg.br/api/public/proposicao/121086. Trâmites: CCJ (parecer favorável com emendas), Comissão de Ecologia, **Ordem do Dia 14/04/2026 "1º TURNO - APROVADO"**, **04/08/2026 "2º TURNO - APROVADO COM EMENDA"**, autógrafo e envio à sanção, "LEI PROMULGADA" (10/09/2026).
- **Votação:** só o resultado está disponível (trâmites acima). O voto por deputado não foi obtido (ver 1.2).
- **Lei:** Lei nº 23.448, de 9 de setembro de 2026 (DIOE nº 12224): https://www.legislacao.pr.gov.br/legislacao/pesquisarAto.do?action=exibir&codAto=405228&codItemAto=0. O texto diz: "A Assembleia Legislativa do Estado do Paraná aprovou e eu promulgo, nos termos do § 3º do art. 71 da Constituição Estadual, os seguintes dispositivos do Projeto de Lei nº 747/2024". Na API da ALEP: `norma-legal/66492`, movimentação "PROMULGADO(A)".
- **Decreto:** Decreto nº 15.592, de 30/10/2026: https://www.dioe.pr.gov.br/apifront/portal/edicoes/publicacoes_ver_conteudo/2143920/17422.

## 4. Viabilidade

| Bloco | Classificação | Esforço | Observação |
|---|---|---|---|
| Proposições, tramitação, leis | Automatizável total | **Baixo** | API JSON documentada e rápida; ligação projeto ↔ lei já vem pronta |
| Decretos e vetos (DIOE) | Automatizável total | Médio | Sumário HTML por seção + matéria em HTML; mapear seções |
| Deputados | Automatizável total | Baixo | HTML do portal; o partido deve vir da página oficial, nunca deduzido |
| Voto nominal | **Curadoria / pedido formal** | Alto | Bloqueado a robôs (robots + reCAPTCHA) |

**Riscos:**
- A API só existe em **http sem TLS** (citar a URL, mas validar o conteúdo).
- O voto nominal fica inacessível a coleta automática; o site deve exibir "Informação não disponível em fonte oficial" até haver canal liberado.
- A documentação da API traz exemplos com erros (descrições de campos trocadas), então vale validar cada campo.
- Quando a lei é promulgada pela ALEP (art. 71 § 3º), o texto oficial explica a origem. Não inferir "veto derrubado" sem documento que diga isso.

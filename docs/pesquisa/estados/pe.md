# Fontes oficiais: Pernambuco (PE)

Pesquisa feita com acessos reais (curl) em **2026-11-02**.
Arquivos baixados para verificação: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-nordeste-2\dl\`.

## Resumo

| Item | Melhor via | Formato | Automatizável? |
|---|---|---|---|
| Deputados (49 na API) | `dadosabertos.alepe.pe.gov.br/api/v1/parlamentares/` | JSON / CSV | Total |
| Proposições e tramitação | `dadosabertos.alepe.pe.gov.br/api/v1/proposicoes/{projetos,indicacoes,requerimentos}/` (API pública, não listada na documentação) | XML | **Total**: texto, justificativa, pareceres, histórico, discussões e número da lei |
| Votações | Resultado por discussão no XML ("APROVADA EM PRIMEIRA DISCUSSÃO") | XML | Total para o **resultado**; **o voto nominal não é publicado em dado estruturado** |
| Normas (leis e decretos) | `legis.alepe.pe.gov.br` (base de legislação estadual mantida pela ALEPE) | HTML | Total (raspagem simples) |
| Diário Oficial do Estado | CEPE: `diariooficial.cepe.com.br` (SPA Angular com API JSON interna) | JSON / PDF | Parcial (API sem documentação) |

**Viabilidade geral:** **alta para proposições, tramitação e normas**, esforço **baixo/médio**. Voto nominal: **curadoria** (raro; só em atas e notícias).

---

## 1. Assembleia Legislativa de Pernambuco (ALEPE)

- **Portal:** https://www.alepe.pe.gov.br/ (WordPress). `robots.txt`: `User-agent: * / Disallow:` (tudo liberado).
- **Portal de Dados Abertos:** https://dadosabertos.alepe.pe.gov.br/ (robots.txt: 404, inexistente). A documentação lista **só dados administrativos**: `cargos`, `contratos`, `licitacoes`, `lotacoes`, `parlamentares`, `remuneracao`, `servidores` (JSON ou CSV, `?formato=json|csv`).

### 1.1 Deputados
- `GET https://dadosabertos.alepe.pe.gov.br/api/v1/parlamentares/?formato=json` (atenção à barra final; sem ela há um redirecionamento 301). Devolveu **49 registros** `{nomeParlamentar, partido}`. Filtro `partido=`. Não traz ID, foto nem mandato.

### 1.2 Proposições e tramitação (API pública, não documentada)
O site de proposições https://proposicoes.alepe.pe.gov.br/ (SPA React; robots.txt libera tudo) consome endpoints do mesmo servidor de dados abertos, **que não aparecem na documentação** mas são públicos:

- **Lista:** `GET https://dadosabertos.alepe.pe.gov.br/api/v1/proposicoes/projetos/` (sem filtro: ano corrente, **650 projetos de 2026**). Também `/indicacoes/` e `/requerimentos/` (862 itens). Filtros que funcionaram: `ano=2025` (1.239), `legislatura=20` (4.452), `numero=3692&ano=2026` (1).
  - Atributos de cada `<projeto>`: `docid`, `numero`, `ano`, `legislatura`, `tipo` (PLO, PLC, PEC, PR, LOA, LDO, PPA etc.), `ementa`, `dataPublicacao`, `<autores>` (nome e tipo DEPUTADO/EXTERNO/COMISSAO).
- **Detalhe:** `GET .../proposicoes/projetos/?docid=<docid>&tipoprop=p` (o código usa `p`=projeto, `i`=indicação, `r`=requerimento, `pc`=parecer). Traz, em XML:
  - `materia`/`materiaHtml` (texto integral), `justificativa` (para projetos do governador, a **mensagem com a exposição de motivos**), `pareceres` (relator, relatório, conclusão por comissão), `distribuicao` (comissões e datas), `regimeTramitacao` (ex.: Urgência), `lotacaoAtual`;
  - `historico` (eventos datados: ASSINADO, PUBLICADO, EMITIR PARECER, AUTÓGRAFO ENVIADO PARA O EXECUTIVO, AUTÓGRAFO SANCIONADO etc.);
  - `historicoResultado` com cada **discussão em plenário e seu resultado** (ex.: "APROVADA EM PRIMEIRA DISCUSSÃO", 26/05/2026);
  - `autografo` com `lei` (número da lei gerada), `resultado` (ex.: `SANCAO`) e texto final.
- **Risco:** a API não é documentada nem versionada publicamente para proposições; pode mudar sem aviso. Atualização observada: diária (projetos de 28/10/2026 já presentes).

### 1.3 Votação nominal
- O XML só traz o **resultado** de cada discussão. **Não há voto por deputado** em API.
- Notícias oficiais da ALEPE mostram que a votação nominal ocorre em casos regimentais (PEC com quórum de 3/5, vetos, escolha de conselheiros do TCE, ou a pedido de deputado), às vezes com o placar ("com 42 votos favoráveis", notícia da PEC de 11/04/2023), sem a lista de nomes. Em 2023 a ALEPE tornou **secreta** a votação para conselheiros do TCE-PE (notícia de 25/04/2023).
- Onde procurar o voto de cada um: atas no **Diário Oficial do Poder Legislativo** (PDF, ex.: https://www.alepe.pe.gov.br/Flip/pubs/diario-oficial-2026-10-30/Flip.pdf, 2,9 MB, com camada de texto; a edição testada não tinha votação nominal) e vídeos da TV Alepe. **Curadoria manual.**
- Busca útil (WP REST, oficial): `https://www.alepe.pe.gov.br/wp-json/wp/v2/posts?search=%22vota%C3%A7%C3%A3o%20nominal%22` — as notícias servem de **pista** para achar a ata, não como fonte do voto.

### 1.4 Normas (legislação estadual)
- **https://legis.alepe.pe.gov.br/** (ASP.NET; `robots.txt` dá 404). Listas por tipo: `lista.aspx?tiponorma=1` (leis ordinárias), `=2` (complementares), `=6` (**Decreto do Executivo**), `=13` etc. Texto: `texto.aspx?id=<id>` ou `texto.aspx?tiponorma=1&numero=19246&complemento=0&ano=2026&tipo=&url=`. Traz o texto original e o compilado.
- Decretos de ICMS aparecem aqui (ex.: alterações do Decreto 44.650/2017, PROIND; incentivos do PRODEPE).

---

## 2. Governo de Pernambuco

### 2.1 Diário Oficial do Estado (CEPE)
- **Portal:** https://diariooficial.cepe.com.br/diariooficialweb/ (SPA AngularJS). `robots.txt`: 404.
- API JSON interna em `https://diariooficial.cepe.com.br/diariooficial/public/...`, sem documentação. Testado: `public/diarios` (lista de diários: DOE-PE, TCE-PE, Defensoria etc.), `public/consultarUfs`. Há rotas `public/busca-avancada/consultarMateriaBuscaAvancada`, `consultarPublicacaoElastic`, `buscarMateria`, `visualizar-publicacao/consultarMateria` (matéria a matéria). Não testei a busca a fundo; a aplicação usa reCAPTCHA no cadastro e na recuperação de senha (não na consulta pública, pelo que o código indica). **Não contornar captcha.**
- Recomendação: para leis e decretos, usar `legis.alepe.pe.gov.br` (já segmentado por ato). Usar o DOE só para vetos e mensagens, se necessário.

### 2.2 Casa Civil / legislação
- A base consolidada é a da ALEPE (item 1.4). A ALEPE também mantém https://transparencia.alepe.pe.gov.br/legislacao.

---

## 3. Exemplos reais (abertos em 2026-11-02)

- **Projeto:** PLO 3692/2026 (Poder Executivo, operação de crédito): https://proposicoes.alepe.pe.gov.br/proposicoes/detalhes?docid=16052&tipoprop=p — dado: https://dadosabertos.alepe.pe.gov.br/api/v1/proposicoes/projetos/?docid=16052&tipoprop=p
- **Votação (resultado):** no mesmo XML, `historicoResultado`: aprovada em 1ª discussão (26/05/2026) e em 2ª discussão (27/05/2026), regime de urgência. Sem voto nominal.
- **Lei:** Lei nº 19.246, de 4/6/2026 (resultado do PLO acima): https://legis.alepe.pe.gov.br/texto.aspx?tiponorma=1&numero=19246&complemento=0&ano=2026&tipo=&url=
- **Decreto:** Decreto do Executivo nº 61.647: https://legis.alepe.pe.gov.br/texto.aspx?id=90429

---

## 4. Viabilidade

- **Proposições, tramitação, resultado e lei gerada:** automatizável **total**, esforço **baixo** (um coletor de XML com paginação por ano/legislatura). Melhor fonte entre os 4 estados desta pesquisa: liga projeto → discussões → autógrafo → número da lei, e traz a justificativa oficial.
- **Normas:** total, esforço **baixo/médio** (raspagem HTML do legis.alepe).
- **Voto nominal:** **curadoria**, esforço **alto** por caso (ata em PDF ou vídeo).
- **Riscos:** API de proposições não documentada (mudança silenciosa); XML em UTF-8 com entidades HTML no CDATA; o histórico não identifica a sessão (só a data); notícias não podem ser usadas como fonte do voto.

# Fontes oficiais: Bahia (BA)

Pesquisa feita com acessos reais (curl) em **2026-11-02**.
Arquivos baixados para verificação: `C:\Users\thoma\AppData\Local\Temp\claude\c--dev-voto-em-quem\ebdd0fd2-cfa8-41be-bae4-7056eb081ad3\scratchpad\estados-nordeste-2\dl\`.

## Resumo

| Item | Melhor via | Formato | Automatizável? |
|---|---|---|---|
| Deputados | API Ágape documentada: `albalegis.nopapercloud.com.br/api/publico/parlamentar/` (72 cadastrados; detalhes com frequência) | JSON | Total |
| Proposições e tramitação | API Ágape: `/api/publico/proposicao/` (74.826 itens) | JSON + PDF | **Total** |
| Sessões, presença, notas taquigráficas | API `/api/publico/spl/sessoes/` (lista) + PDF e MP3 por sessão | JSON / PDF / MP3 | Parcial (o detalhe por `id` deu erro 500) |
| Votações | Resultado no texto da tramitação ("Aprovado em 1ª e 2ª discussão em 16/06/2026"); botão "Ver Votação" no SPL | JSON / HTML | Parcial; **voto nominal estruturado não localizado** |
| Normas | **Legisla Bahia** (Casa Civil): `legislabahia.ba.gov.br/documentos/...` | HTML | Total (raspagem simples) |
| Diário Oficial do Estado | DOE-BA (EGBA, plataforma Ionews): busca JSON com texto integral | JSON; PDF exige login | Parcial |

**Viabilidade geral:** **alta para proposições, tramitação e normas**, esforço **baixo/médio**. Voto nominal: **curadoria** (notas taquigráficas em PDF).

---

## 1. Assembleia Legislativa da Bahia (ALBA)

- **Portal:** https://www.al.ba.gov.br/ (Spring/Java). `robots.txt` **não existe** (404 em JSON) → sem restrições declaradas; usar ritmo baixo.
- **Migração de sistema:** o portal informa que, "em virtude da mudança de sistema [...] realizada em 01/08/2025", os dados passaram para o **SPL da Ágape** em https://albalegis.nopapercloud.com.br/ (robots.txt: `User-agent: * / Allow: /`). Proposições "criadas até 19/01/2021" e "após 19/01/2021" ainda têm páginas separadas no portal antigo (`/atividade-legislativa-nova/proposicoes`, 20 por página, filtro `tipo=PL.` etc.).
- Página de proposição do portal antigo para projeto do sistema novo deu **erro 500** (`/atividade-legislativa-nova/proposicao/PL.-26231-2026`). Usar o SPL/API.

### 1.1 Dados abertos (API Ágape documentada)
- Documentação: https://albalegis.nopapercloud.com.br/dados-abertos.aspx (o conteúdo vem de `spl/js/dados-abertos.js`).
- Endpoints: `/api/publico/parlamentar/`, `/api/publico/proposicao/`, `/api/publico/comissoes/`, `/api/publico/spl/comissoes/reunioes`, `/api/publico/spl/sessoes` (+ `/tipos`, `/fases`, `/arquivo-tipos`), `/api/publico/spl/liderancas`, `/api/publico/spl/mesa`, `/api/publico/spl/partidos`. Paginação `pag` e `qtd`.

### 1.2 Deputados
- `GET /api/publico/parlamentar/?pag=1&qtd=1` → `total: 72` (titulares, suplentes e licenciados). `?parlamentarID=<id>` (ou `detalhes=true`) devolve **comissões, frequência em plenário, proposições e normas** do parlamentar.
- O filtro "Deputados atuais" do portal lista 71 nomes. (O número de cadeiras não foi conferido em página da ALBA nesta pesquisa.)

### 1.3 Proposições e tramitação
- `GET /api/publico/proposicao/?pag=1&qtd=N` → `total: 74.826`. Filtros testados: `sigla=PL&ano=2026` (268 PLs em 2026), `assunto=<trecho>`.
- Cada item: `sigla`, `tipo`, `numero`, `ano`, `assunto` (ementa), `data`, `situacao`, `arquivo` (PDF do texto), `AutorRequerenteDados`, `CoAutores`, `ProcessoAnexos`, `TramitacaoAnexo` (despachos e pareceres em PDF) e **`Tramitacoes`** (fase, setor, ação, complemento, datas de recebimento/saída/assinatura).
- O **complemento da tramitação** registra pareceres e resultados, ex.: "Parecer da Deputada Neusa Cadore FAVORÁVEL", "Parecer APROVADO por UNANIMIDADE" (CCJ), "Aprovado em 1ª e 2ª discussão em 16/06/2026", "Expedido autógrafo ao Governador por meio do Of. nº 1143/2026".
- **Defeito de dados:** o PL 26.231/2026, já transformado na Lei 15.203/2026, aparece com `situacao: "TRAMITANDO"`; entre 50 PLs de 2026 todos estavam "TRAMITANDO". **Não usar o campo `situacao`** para dizer se virou lei; usar a tramitação e o Legisla Bahia.
- Página: `https://albalegis.nopapercloud.com.br/spl/processo.aspx?id=<id>`.

### 1.4 Sessões, presença e votação nominal
- `GET /api/publico/spl/sessoes/?pag=1&qtd=2` (com barra final) → `total: 5.187` sessões (`id`, tipo, número, data, horário, legislatura). Segundo a documentação, `?id=<id>` traria pauta por fase, oradores, presenças e arquivos — **mas devolveu HTTP 500** para os ids 107564, 107572 e 107573 em 2026-11-02.
- `spl/sessoes.aspx`: por sessão, "Presença em Plenário", **áudio MP3 da sessão completa** e **PDF das notas taquigráficas** ("SESSÕES DO PLENÁRIO", ex.: 44ª Sessão Especial, 31/08/2026, 282 kB, com camada de texto).
- Votação nominal: notícia oficial de 11/12/2025 relata votação nominal **no painel eletrônico** a pedido de deputado, com placar "32 votos favoráveis e 7 contrários" — não traz os nomes. A lista de nomes, quando existir, deve estar nas notas taquigráficas (PDF) ou no painel "Resultado da Votação" do SPL.
  - O SPL mostra um botão **"Ver Votação"** no processo do PL 26.231/2026, acionado por *postback* ASP.NET. Um postback simples (formulário normal) **não** retornou a votação (provavelmente exige a chamada assíncrona do UpdatePanel). **Verificar no navegador** antes de planejar coletor; não houve tentativa de contornar nada.

---

## 2. Governo da Bahia

### 2.1 Legislação estadual — Legisla Bahia (Casa Civil)
- **Portal:** https://www.legislabahia.ba.gov.br/ (Drupal). `robots.txt`: bloqueia robôs comerciais específicos (Semrush, Ahrefs, Petal, Yandex...) e, para os demais, só `/admin/`, `/search/`, `/user/...` etc. **`/documentos` é permitido.** `/jsonapi` não existe (404).
- Listas por categoria: `/documentos?categoria[0]=<n>` — 7 = Leis Ordinárias, 5 = Leis Complementares, 4 = Emendas Constitucionais, 2 = Decretos Numerados, 3 = Decretos Simples, 1 = Decretos Financeiros, 23/24 = Portarias/Instruções Sefaz, 26 = Portarias do Gabinete do Governador, 14 = Despachos do Governador.
- Cada ato tem página com o texto integral em HTML: `/documentos/lei-no-15203-de-14-de-agosto-de-2026`, `/documentos/decreto-no-24901-de-26-de-outubro-de-2026`.

### 2.2 Diário Oficial do Estado (EGBA)
- **Portal:** https://dool.egba.ba.gov.br/ (plataforma **Ionews**, a mesma do DOE de Sergipe). `robots.txt` não existe (404).
- `GET https://dool.egba.ba.gov.br/apifront/portal/edicoes/edicoes_from_data/2026-10-30.json` → edição nº 24.510, 98 páginas, id 22776.
- `GET https://dool.egba.ba.gov.br/busca/busca/buscar/query/0/?1=1&q=%22Lei%20n%C2%BA%2015.203%22` → JSON (Elasticsearch) com o **texto integral da página** (encontrou a Lei 15.203 no DOE nº 24.457, de 15/08/2026, seção "LEIS").
- **Download do PDF (`/portal/edicoes/download/<id>`) e visualizador (`/ver/...` → `/portal/visualizacoes/pdf/...`) redirecionam para `/login`.** Não contornar; o texto público vem da busca JSON.

---

## 3. Exemplos reais (abertos em 2026-11-02)

- **Projeto:** PL 26.231/2026 (Selo Distribuição Legal): https://albalegis.nopapercloud.com.br/spl/processo.aspx?id=17558 — dado: https://albalegis.nopapercloud.com.br/api/publico/proposicao/?assunto=Selo%20Distribui%C3%A7%C3%A3o%20Legal&pag=1&qtd=5
- **Votação (resultado):** mesma tramitação: "Parecer verbal favorável pelas Comissões Conjuntas [...] Aprovado em 1ª e 2ª discussão em 16/06/2026". Voto nominal: não localizado.
- **Notas taquigráficas:** https://albalegis.nopapercloud.com.br/Arquivo/Documents/SES/107564/sessao_107564_20260928171927645_682e2aae.pdf?identificador=30003A005300
- **Lei:** Lei nº 15.203, de 14/08/2026: https://www.legislabahia.ba.gov.br/documentos/lei-no-15203-de-14-de-agosto-de-2026
- **Decreto:** Decreto nº 24.901, de 26/10/2026: https://www.legislabahia.ba.gov.br/documentos/decreto-no-24901-de-26-de-outubro-de-2026

---

## 4. Viabilidade

- **Proposições e tramitação:** **total**, esforço **baixo** (API JSON documentada; mesmo coletor da Alese/SE).
- **Normas:** **total**, esforço **baixo/médio** (raspagem HTML do Legisla Bahia; ligar lei → PL pela ementa e pela tramitação "Expedido autógrafo").
- **Resultado das votações:** parcial (texto livre da tramitação), esforço médio.
- **Voto nominal:** **curadoria** (notas taquigráficas em PDF, ou o painel do SPL se confirmado no navegador), esforço alto.
- **Riscos:** campo `situacao` desatualizado; detalhe de sessão com erro 500; dados antes de 01/08/2025 no portal antigo (dois sistemas); PDF do DOE atrás de login.

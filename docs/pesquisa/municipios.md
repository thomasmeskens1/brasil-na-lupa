# Municípios: quais fontes oficiais estruturadas existem

Levantamento de 03/11/2026 para a seção **Municípios** do Brasil na Lupa (a antiga aba Atibaia passa a ser
`/municipios/sp/atibaia`). Só fontes oficiais; nada foi deduzido. Onde a verificação não foi feita, o texto diz.

## Regra de inclusão

> **Um município entra na seção quando há pelo menos uma fonte oficial estruturada já coletada** —
> Câmara Municipal no SAPL (proposições, votações, votos, normas), leis e decretos de diário oficial
> lidos pela curadoria (hoje só Atibaia) ou finanças declaradas ao Tesouro Nacional no Siconfi.
> Os demais 5.570 municípios aparecem na busca como “Em breve”, sem página própria.

Consequências: (1) a Câmara só aparece com dados quando o próprio SAPL da Câmara foi coletado (não basta
estar na lista do Interlegis); (2) o voto de cada vereador só aparece em votação **nominal** com o registro
`votoparlamentar` da fonte (diretriz 5); (3) “sem dados” no Siconfi é registrado com a data da consulta e
reconsultado, nunca preenchido.

## 1. Câmaras Municipais com SAPL 3 (Interlegis/Senado)

### Lista oficial das Casas atendidas

O Interlegis (Secretaria Especial do Senado Federal) publica uma **API de dados abertos** do seu sistema
de gestão (SIGI), documentada em OpenAPI:

- Documentação: <https://sigi.interlegis.leg.br/api/schema/> (Swagger em `/api/doc/swagger-ui/`)
- Serviços por tipo: <https://sigi.interlegis.leg.br/api/servicos/?tipo_servico=SAPL> — paginado
  (`page`, `page_size`), filtros `uf`, `hospedagem_interlegis`, `data_ativacao`, `search`.
- Resumo por produto: <https://sigi.interlegis.leg.br/api/servicos/resumoprodutos/> — em 03/11/2026:
  **SAPL 1.163**, Portal Modelo 1.032, Domínio .leg.br 3.124.
- A mesma lista aparece em HTML em <https://www12.senado.leg.br/interlegis/orgaosatendidos?servico=SAPL&uf=SP>
  (20 páginas só para SP). Não é usada pelo coletor (a API é a forma estruturada).
- `robots.txt` de `sigi.interlegis.leg.br`: inexistente (404, página HTML) — sem restrição declarada.
  `www12.senado.leg.br/robots.txt`: `User-agent: * / Disallow:` (sem restrição).

Cada item traz a Casa (nome, CNPJ, tipo de órgão, município, UF, e-mail, telefone, endereço), a URL do SAPL,
se a hospedagem é do Interlegis e a data de ativação. O registro do projeto guarda **só** nome da Casa,
município, UF, host, hospedagem e data de ativação (e-mail, telefone e endereço não são necessários ao site).

Das 1.163 instâncias, **1.155 são de Câmaras Municipais** (tipo de órgão `CM`) e todas foram ligadas a um
município do Siconfi pelo nome e UF (sem acento e sem hífen); nenhuma ficou sem correspondência.
Por UF: AC 14, AL 7, AM 26, AP 10, BA 53, CE 34, ES 24, GO 30, MA 14, MG 208, MS 12, MT 51, PA 18, PB 49,
PE 54, PI 45, PR 164, RJ 39, RN 52, RO 42, RR 5, RS 59, SC 27, SE 3, SP 81, TO 34.

Padrão de endereço: `https://sapl.<cidade>.<uf>.leg.br/` (ex.: `sapl.joaopessoa.pb.leg.br`). **Atibaia não
consta da lista** (a Câmara de Atibaia não usa SAPL do Interlegis; ver `pedido-sic-camara-atibaia.md`).

### Verificação por amostra (sem varrer o país)

`scripts/coleta/municipios/registro.mjs` verifica, a cada execução, no máximo `--max` hosts (padrão 40),
em paralelo entre hosts distintos (até 12) e sempre: **robots.txt primeiro**; depois, respeitando o
Crawl-delay contado desde a 1ª requisição, uma consulta de 1 registro a cada rota
(`/api/sessao/votoparlamentar/`, `/api/materia/materialegislativa/`, `/api/norma/normajuridica/`), para
saber se a API responde e quantos registros a Câmara publica. Hosts verificados há menos de 30 dias não
voltam à amostra.

Amostra de 03/11/2026: as **8 capitais com SAPL** na lista (Rio Branco, Manaus, Fortaleza, João Pessoa,
Natal, Porto Velho, Boa Vista, Palmas) e as **40 primeiras Câmaras de SP** em ordem alfabética.
Resultado: os 48 `robots.txt` responderam 200 com `Crawl-delay: 60` (o coletor usa 61 s) e sem bloqueio a
`/api/`; a API respondeu JSON em todos; **33 publicam votos por vereador** (`votoparlamentar` > 0).
Em 6 Câmaras a API responde mas não tem nenhuma matéria cadastrada (Manaus, Águas da Prata, Agudos,
Angatuba, Barretos, Campo Limpo Paulista) — a instância existe, o sistema não é usado.

| Município | Host | robots | Crawl-delay | API | votos por vereador | matérias | normas |
|---|---|---|---|---|---|---|---|
| Rio Branco/AC | sapl.riobranco.ac.leg.br | 200 | 60 | sim | 41.083 | 46.807 | 3.322 |
| Manaus/AM | sapl.manaus.am.leg.br | 200 | 60 | sim | 0 | 0 | 0 |
| Fortaleza/CE | sapl.fortaleza.ce.leg.br | 200 | 60 | sim | 0 | 127.118 | 14.339 |
| João Pessoa/PB | sapl.joaopessoa.pb.leg.br | 200 | 60 | sim | 13.817 | 204.267 | 22.130 |
| Natal/RN | sapl.natal.rn.leg.br | 200 | 60 | sim | 617 | 58.189 | 9.373 |
| Porto Velho/RO | sapl.portovelho.ro.leg.br | 200 | 60 | sim | 80.009 | 47.049 | 29.566 |
| Boa Vista/RR | sapl.boavista.rr.leg.br | 200 | 60 | sim | 0 | 106.222 | 5.902 |
| Palmas/TO | sapl.palmas.to.leg.br | 200 | 60 | sim | 0 | 18.052 | 12 |
| Adamantina/SP | sapl.adamantina.sp.leg.br | 200 | 60 | sim | 17 | 17.865 | 5.189 |
| Águas da Prata/SP | sapl.aguasdaprata.sp.leg.br | 200 | 60 | sim | 0 | 0 | 0 |
| Agudos/SP | sapl.agudos.sp.leg.br | 200 | 60 | sim | 0 | 0 | 0 |
| Álvares Machado/SP | sapl.alvaresmachado.sp.leg.br | 200 | 60 | sim | 61 | 11.579 | 2.593 |
| Américo Brasiliense/SP | sapl.americobrasiliense.sp.leg.br | 200 | 60 | sim | 3.350 | 3.456 | 531 |
| Angatuba/SP | sapl.angatuba.sp.leg.br | 200 | 60 | sim | 0 | 0 | 0 |
| Areias/SP | sapl.areias.sp.leg.br | 200 | 60 | sim | 1.481 | 2.487 | 1.203 |
| Artur Nogueira/SP | sapl.arturnogueira.sp.leg.br | 200 | 60 | sim | 0 | 3.877 | 5.027 |
| Bariri/SP | sapl.bariri.sp.leg.br | 200 | 60 | sim | 275 | 4.733 | 1.683 |
| Barretos/SP | sapl.barretos.sp.leg.br | 200 | 60 | sim | 0 | 0 | 0 |
| Barrinha/SP | sapl.barrinha.sp.leg.br | 200 | 60 | sim | 4.513 | 4.608 | 3.356 |
| Barueri/SP | sapl.barueri.sp.leg.br | 200 | 60 | sim | 6.452 | 72.131 | 5.012 |
| Bertioga/SP | sapl.bertioga.sp.leg.br | 200 | 60 | sim | 1.838 | 20.631 | 7.643 |
| Birigui/SP | sapl.birigui.sp.leg.br | 200 | 60 | sim | 64.390 | 41.971 | 8.473 |
| Bofete/SP | sapl.bofete.sp.leg.br | 200 | 60 | sim | 3.604 | 3.488 | 2.471 |
| Buritama/SP | sapl.buritama.sp.leg.br | 200 | 60 | sim | 10.017 | 4.490 | 7.704 |
| Caconde/SP | sapl.caconde.sp.leg.br | 200 | 60 | sim | 0 | 1.877 | 1.728 |
| Campina do Monte Alegre/SP | sapl.campinadomontealegre.sp.leg.br | 200 | 60 | sim | 4.903 | 687 | 1 |
| Campo Limpo Paulista/SP | sapl.campolimpopaulista.sp.leg.br | 200 | 60 | sim | 0 | 0 | 0 |
| Cubatão/SP | sapl.cubatao.sp.leg.br | 200 | 60 | sim | 0 | 33.736 | 0 |
| Cunha/SP | sapl.cunha.sp.leg.br | 200 | 60 | sim | 4.428 | 4.224 | 2.600 |
| Dracena/SP | sapl.dracena.sp.leg.br | 200 | 60 | sim | 585 | 27.811 | 7.855 |
| Embu-Guaçu/SP | sapl.embuguacu.sp.leg.br | 200 | 60 | sim | 6.151 | 11.502 | 2.468 |
| Espírito Santo do Turvo/SP | sapl.espiritosantodoturvo.sp.leg.br | 200 | 60 | sim | 753 | 1.655 | 1.336 |
| Fernão/SP | sapl.fernao.sp.leg.br | 200 | 60 | sim | 10.649 | 3.030 | 3.226 |
| Gália/SP | sapl.galia.sp.leg.br | 200 | 60 | sim | 7.892 | 2.979 | 6 |
| Garça/SP | sapl.garca.sp.leg.br | 200 | 60 | sim | 16.473 | 57.305 | 8.453 |
| Guariba/SP | sapl.guariba.sp.leg.br | 200 | 60 | sim | 61 | 11.508 | 4.992 |
| Guatapará/SP | sapl.guatapara.sp.leg.br | 200 | 60 | sim | 0 | 557 | 426 |
| Ibiúna/SP | sapl.ibiuna.sp.leg.br | 200 | 60 | sim | 19.388 | 20.642 | 3.424 |
| Igarapava/SP | sapl.igarapava.sp.leg.br | 200 | 60 | sim | 665 | 6.421 | 1.948 |
| Iguape/SP | sapl.iguape.sp.leg.br | 200 | 60 | sim | 33 | 5.387 | 2.486 |
| Ilha Comprida/SP | sapl.ilhacomprida.sp.leg.br | 200 | 60 | sim | 13.314 | 9.404 | 4.062 |
| Indiaporã/SP | sapl.indiapora.sp.leg.br | 200 | 60 | sim | 11.002 | 3.125 | 3.594 |
| Ipiguá/SP | sapl.ipigua.sp.leg.br | 200 | 60 | sim | 0 | 596 | 1.002 |
| Itaporanga/SP | sapl.itaporanga.sp.leg.br | 200 | 60 | sim | 205 | 1.861 | 1.980 |
| Itapuí/SP | sapl.itapui.sp.leg.br | 200 | 60 | sim | 70 | 9.603 | 3.472 |
| Ituverava/SP | sapl.ituverava.sp.leg.br | 200 | 60 | sim | 9.942 | 3.097 | 113 |
| Jambeiro/SP | sapl.jambeiro.sp.leg.br | 200 | 60 | sim | 0 | 755 | 1.571 |
| Jardinópolis/SP | sapl.jardinopolis.sp.leg.br | 200 | 60 | sim | 40.333 | 4.540 | 405 |

Os totais são de **todo o histórico** cadastrado no SAPL (não só da legislatura atual). “0 votos por vereador”
não quer dizer que não houve votação nominal: quer dizer que a Câmara não lança o voto individual no SAPL.

### Custo de coleta e escala

Com `Crawl-delay: 60`, cada Câmara admite ~1 requisição por minuto (≈ 24 por execução de 25 min). O
coletor municipal reaproveita, **sem alterar**, o planejador estadual (`scripts/coleta/estados/sapl/**`):
lê do mais novo para o mais antigo, guarda cursor e cobertura, e retroage até o início da legislatura
(01/01/2025). Hosts diferentes rodam em paralelo, cada um com seu relógio — por isso é possível acompanhar
dezenas de Câmaras por execução, mas não as 1.155 de uma vez. Rodízio: câmaras nunca coletadas primeiro
(capitais e com votos publicados à frente), depois a que está há mais tempo sem coleta.

## 2. Finanças de todos os municípios — Siconfi (Tesouro Nacional)

- API: <https://apidatalake.tesouro.gov.br/ords/siconfi/tt/> — documentação em
  <https://apidatalake.tesouro.gov.br/docs/siconfi/> (`/docs/siconfi.yaml`).
- **Limite oficial: 1 requisição por segundo** (texto da documentação). O coletor usa 1,5 s.
- `robots.txt`: inexistente (404) — sem restrição declarada.
- `/entes`: os entes da Federação; 5.598 itens, dos quais **5.570 municípios** (código IBGE, nome, UF,
  capital, população do exercício, CNPJ). É a base do registro de municípios.
- `/rreo?an_exercicio=&nr_periodo=&co_tipo_demonstrativo=RREO&no_anexo=RREO-Anexo%2001&id_ente=`:
  Relatório Resumido da Execução Orçamentária. **Exige `id_ente`**: a consulta só com `co_esfera=M`
  devolve 0 itens (testado), por isso a coleta é município a município (2 requisições: Anexo 01 e 02).
  - Anexo 01 (Balanço Orçamentário): receitas (previsão atualizada, realizada até o bimestre) e despesas
    por categoria econômica (dotação atualizada, empenhada, liquidada, paga até o bimestre). Guardadas só
    as linhas principais pelo `cod_conta` da fonte (ex.: `TotalReceitas`, `PessoalEEncargosSociais`).
  - Anexo 02 (Despesa por Função/Subfunção): o `cod_conta` não separa função de subfunção; as funções são
    identificadas pelo nome exato da lista oficial (Portaria MOG nº 42/1999). Subfunções não são guardadas.
- `/extrato_entregas?id_ente=&an_referencia=`: o que cada ente entregou (útil para saber se a ausência é
  falta de entrega). Não coletado nesta etapa.
- `/dca` (Declaração de Contas Anuais, base do antigo FINBRA): anual, mais detalhada. Não coletada nesta
  etapa; candidata a uma segunda fase.

Relatórios-alvo (`scripts/coleta/municipios/siconfi.mjs`): 6º bimestre do último exercício encerrado
(ano inteiro; hoje 2025) e o bimestre mais recente do exercício atual cujo prazo de publicação (30 dias
após o fim do bimestre, LRF art. 52) já passou (hoje o 4º de 2026). A cada execução, os municípios ainda não
consultados — capitais primeiro, depois por população — até o orçamento de tempo acabar (~330 municípios
por 20 min). As 5.570 consultas de cada relatório levam ~17 execuções.

Atibaia, 2025, 6º bimestre (conferido na API em 03/11/2026): receitas realizadas R$ 1.301.300.980,12;
pessoal e encargos liquidados R$ 474.879.376,14.

## 3. Tribunais de Contas (TCE-SP) — já usado em Atibaia

O Portal da Transparência Municipal do TCE-SP (`transparencia.tce.sp.gov.br`, API `/api/json/...`) traz
receitas e despesas mês a mês de cada município paulista (exceto a capital, fiscalizada pelo TCM-SP). O
coletor de Atibaia (`scripts/coleta/atibaia/financas.mjs`) já o usa; estendê-lo aos 644 municípios de SP é
possível (mesma API), mas não foi feito nesta etapa. Outros TCEs não foram verificados.

## 4. Portais de dados abertos municipais e diários oficiais

Não verificados nesta etapa. Pistas a conferir, por fonte oficial, antes de qualquer coleta: portais de
dados abertos das capitais, diários oficiais municipais em formato estruturado e o Querido Diário (Open
Knowledge Brasil, **não oficial**: só serviria de pista para chegar ao diário oficial). Leis e decretos do
prefeito ficam como “Em breve” em todos os municípios, exceto Atibaia (Imprensa Oficial lida pela curadoria).

## Arquivos

- `dados/municipios/entes.json` — municípios do Siconfi (linhas compactas).
- `dados/municipios/registro.json` — Câmaras com SAPL e verificação (robots, API, totais).
- `dados/municipios/<uf>/<cidade>/` — coleta SAPL, mesmo contrato de `dados/estados/<uf>/`.
- `dados/municipios/financas/<ano>-b<bimestre>/<uf>.json` e `financas/meta.json` — RREO do Siconfi.
- Coletores: `scripts/coleta/municipios/{registro,sapl,siconfi}.mjs`; testes offline em `testes.mjs`.

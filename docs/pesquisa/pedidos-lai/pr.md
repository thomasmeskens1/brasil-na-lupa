# Pedido de acesso à informação — Assembleia Legislativa do Estado do Paraná (ALEP)

**Canal:** e-SIC da ALEP, no sistema de Ouvidoria (SISGOP): https://alep.sisgop.pr.gov.br/cidadao/acesso-informacao/1 → botão "Continuar" (abre o formulário em https://alep.sisgop.pr.gov.br/cidadao/1/acesso-informacao?embed=true; o navegador precisa aceitar cookies).
**Exige cadastro:** não confirmado. A página diz que, para pedidos pela LAI, "é necessário identificar-se" e oferece a "opção sigilosa" (dados cadastrais resguardados); o acompanhamento do protocolo usa login (https://alep.sisgop.pr.gov.br/cidadao/login). Os campos do formulário não foram vistos (ele não abriu sem cookies na consulta automatizada).
**Outros canais:** ouvidoria@assembleia.pr.leg.br; (41) 3350-4141 e 0800 6456 760; presencialmente na Ouvidoria-Geral, 3º andar do Edifício Palácio XIX de Dezembro, Curitiba, das 9h às 18h.
**Base legal:** Lei Federal n.º 12.527/2011 (LAI) e Ato da Comissão Executiva n.º 560, de 7 de maio de 2024, que regulamenta o acesso à informação na ALEP (publicado no Diário da Assembleia n.º 2.919, de 13/05/2024).
**Prazo (Ato 560/2024, art. 7º, §§ 2º e 3º):** até 20 dias, contados do primeiro dia útil após o recebimento, **suspensos durante o recesso da Assembleia**, prorrogáveis por mais 10 dias com justificativa. (A página do e-SIC fala em "20 dias úteis".)
**Recurso (Ato 560/2024, art. 9º):** 10 dias a contar da ciência do indeferimento, interposto pela Ouvidoria-Geral e dirigido ao **Diretor-Geral** (decisões das unidades a ele subordinadas) ou à **Comissão Executiva** (decisões da Procuradoria-Geral, Controladoria Interna ou Diretoria-Geral); decisão em até 5 dias.

Conferido no Portal da Transparência e no e-SIC da ALEP em 03/11/2026.

> O CPF e demais dados pessoais não ficam neste arquivo (o repositório é público): eles são informados só no formulário. A LAI (art. 10, § 3º) proíbe exigir os motivos do pedido; o texto abaixo os traz apenas como contexto e pode ser enviado sem eles.

---

À Assembleia Legislativa do Estado do Paraná
Ouvidoria-Geral / Serviço de Informação ao Cidadão (e-SIC)

**Assunto:** Pedido de acesso à informação — votações nominais de Plenário de 2025 e 2026 por deputado em formato aberto, proposições com tramitação e inclusão das votações na API pública de dados abertos

Eu, **Thomas Alcantara Meskens**, e-mail thomas.meskense@gmail.com, com base no art. 5º, inciso XXXIII, da Constituição Federal, nos arts. 8º, 10 e 11 da Lei n.º 12.527/2011 e no Ato da Comissão Executiva n.º 560/2024, peço respeitosamente as seguintes informações:

**1. Votações nominais de Plenário, com o voto de cada deputado**
Os dados do "Controle de Votações" de todas as votações de Plenário de 1º de janeiro de 2025 até a data da resposta, em formato aberto e legível por máquina (CSV ou JSON; XLSX também serve), com, para cada votação:
- data, sessão (número e tipo) e proposição votada (tipo, número e ano);
- objeto da votação (ex.: 1º ou 2º turno, emenda, veto, redação final);
- voto de cada deputado (Sim, Não, Abstenção, ausente ou outro registro previsto no Regimento Interno), com nome e partido na data da votação;
- totais e resultado proclamado.

Se alguma votação não tiver registro nominal (por exemplo, votação simbólica), peço que isso seja informado, junto com o resultado proclamado. Peço também os dados de presença em Plenário do mesmo período, no mesmo formato.

**2. Proposições de 2025 e 2026, com tramitação**
A API de dados abertos da Assembleia já permite consultar as proposições e seus trâmites. Peço, para o mesmo período (1º de janeiro de 2025 até a data da resposta):
- a exportação completa das proposições de todos os tipos, com tipo, número, ano, data de apresentação, autoria, ementa, situação atual, histórico completo de tramitação e resultado de cada deliberação em Plenário, em CSV ou JSON — ou a confirmação de que a API pública (`proposicao/filtrar` e `proposicao/{codigo}`) contém todas essas proposições e trâmites;
- a forma documentada de baixar, pela API, os documentos anexos aos trâmites (campo `codigoAnexo`), como textos e pareceres.

**3. Publicação permanente (transparência ativa)**
Peço também que a Assembleia passe a publicar, de forma permanente e atualizada, as votações nominais (com o voto de cada deputado) e a presença em Plenário na API pública de dados abertos (`webservices.assembleia.pr.leg.br/api/public`), sem verificação de reCAPTCHA, conforme o art. 8º, caput e § 3º, incisos II, III e VI, da LAI. O § 3º, inciso III, prevê o "acesso automatizado por sistemas externos em formatos abertos, estruturados e legíveis por máquina". Se possível, peço também que a API passe a responder em `https://`. Se já houver previsão ou cronograma para isso, peço que seja informado.

**O que já está publicado e o que não localizamos**
Agradeço o que a Assembleia já publica: a API de dados abertos documentada no Portal da Transparência (proposições, trâmites e normas legais, em JSON), que traz o resultado das deliberações (por exemplo, "1º TURNO - APROVADO"), e a página "Controle de Votações" do Portal da Transparência, com votações por sessão ou por projeto de 2011 a 2026. Na consulta feita em 02/11/2026:
- a API pública não traz o voto de cada deputado;
- a página "Controle de Votações" busca os dados com verificação de reCAPTCHA, e o `robots.txt` do Portal da Transparência não permite acesso automatizado ao caminho `/api/` usado por ela; por isso não consultamos esses dados de forma automatizada e não conferimos o formato dos arquivos de votação;
- a API pública respondeu apenas em `http://` (a conexão em `https://` não foi estabelecida).

Lembro, com todo o respeito, que:
- o pedido não precisa ser motivado (art. 10, § 3º, da LAI);
- a informação disponível deve ser fornecida de imediato ou em até 20 dias, prorrogáveis por mais 10 com justificativa expressa (art. 11 da LAI; art. 7º do Ato da Comissão Executiva n.º 560/2024);
- se a informação estiver disponível em formato eletrônico, peço que seja entregue nesse formato (art. 11, § 5º, da LAI); se já estiver publicada, basta indicar o local exato (art. 11, § 6º);
- em caso de negativa total ou parcial, peço a indicação do fundamento legal, do prazo e da autoridade competente para o recurso (art. 11, § 4º, da LAI).

Peço que a resposta seja enviada ao e-mail informado acima, em arquivos digitais.

Contexto, apenas informativo: as informações serão usadas num site sem fins lucrativos e apartidário de acompanhamento das decisões do poder público. O site mostra o que foi votado e decidido, sempre com link para a fonte oficial.

Agradeço desde já pela atenção.

Atenciosamente,

**Thomas Alcantara Meskens**
thomas.meskense@gmail.com
Atibaia-SP, ____ de __________ de 2026.

---

### Versão curta (se o campo do formulário limitar o tamanho do texto)
Com base na Lei 12.527/2011 e no Ato da Comissão Executiva 560/2024, peço, em formato aberto (CSV ou JSON): (1) os dados do "Controle de Votações" de todas as votações de Plenário de 01/01/2025 até a resposta, com data, sessão, proposição, objeto, voto de cada deputado (nome e partido), totais e resultado, e a presença em Plenário no mesmo período; (2) a exportação das proposições do período com tramitação, ou a confirmação de que a API pública as contém, e a forma de baixar os anexos (codigoAnexo); (3) a publicação permanente das votações nominais e da presença na API pública de dados abertos, sem reCAPTCHA (art. 8º, § 3º, da LAI). Resposta por e-mail, em arquivos digitais. Thomas Alcantara Meskens, thomas.meskense@gmail.com.

### Envio
- **Protocolo:** (preencher após o envio)
- **Enviado em:** (preencher)
- **Prazo de resposta:** 20 dias (suspensos no recesso), prorrogáveis por mais 10
- **Situação:** não enviado

### Notas para quem envia (não fazem parte do pedido)
- Dados pessoais exigidos pelo formulário (CPF, telefone, endereço etc.): (preencher no formulário). Nada disso entra neste arquivo.
- Atenção ao recesso parlamentar: o prazo fica suspenso nesse período (art. 7º, § 2º, do Ato 560/2024). Enviar antes do recesso de fim de ano pode adiar a resposta.
- Guarde o número de protocolo. Sem resposta no prazo, ou com resposta insatisfatória, cabe recurso em 10 dias pela Ouvidoria-Geral (art. 9º do Ato 560/2024).
- Quando os arquivos chegarem, salve-os sem alterações e registre a data de recebimento: eles passam a ser a fonte oficial citada no site (diretrizes 2 e 3).

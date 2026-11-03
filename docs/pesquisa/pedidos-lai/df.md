# Pedido de acesso à informação — Câmara Legislativa do Distrito Federal (CLDF)

**Canal:** Serviço de Informações ao Cidadão (SIC), a cargo da Ouvidoria da CLDF, página "Faça seu pedido": https://www.cl.df.gov.br/faca-seu-pedido (o formulário fica em https://www.cl.df.gov.br/web/forms/shared/-/form/23521589).
**Exige cadastro:** não (formulário compartilhado, sem login). Campos: nome, tipo de pessoa (física ou jurídica), CPF ou CNPJ, e-mail, telefone, celular, descrição do pedido e uma verificação (CAPTCHA) que o próprio usuário resolve. Quais campos são obrigatórios: não confirmado (o formulário tem 4 campos obrigatórios).
**Outros canais:** ouvidoria@cl.df.gov.br; (61) 3348-8000; atendimento das 9h às 19h.
**Base legal:** Lei Federal n.º 12.527/2011 (LAI), Lei Distrital n.º 4.990/2012, que regula o acesso a informações no Distrito Federal, e Ato da Mesa Diretora n.º 57/2016, que dispõe sobre a aplicação da LAI na CLDF (normas listadas na página "Lei de Acesso à Informação" da CLDF).
**Prazo (informado pela CLDF):** até 20 dias, prorrogáveis por 10 com justificativa.
**Recurso (informado pela CLDF):** 10 dias a contar da ciência da decisão, dirigido, por intermédio da Ouvidoria, à **autoridade hierarquicamente superior** à que decidiu, que tem 5 dias para se manifestar; negado o recurso, cabe novo recurso à **Mesa Diretora**, que também tem 5 dias.

Conferido no portal da CLDF em 02–03/11/2026.

> O CPF e o telefone não ficam neste arquivo (o repositório é público): eles são informados só no formulário. A LAI (art. 10, § 3º) proíbe exigir os motivos do pedido; o texto abaixo os traz apenas como contexto e pode ser enviado sem eles.

---

À Câmara Legislativa do Distrito Federal
Ouvidoria / Serviço de Informações ao Cidadão (SIC)

**Assunto:** Pedido de acesso à informação — votações nominais de Plenário de 2025 e 2026 por deputado distrital em formato aberto, proposições com tramitação e inclusão das votações na API pública do PLe

Eu, **Thomas Alcantara Meskens**, e-mail thomas.meskense@gmail.com, com base no art. 5º, inciso XXXIII, da Constituição Federal, nos arts. 8º, 10 e 11 da Lei n.º 12.527/2011, na Lei Distrital n.º 4.990/2012 e no Ato da Mesa Diretora n.º 57/2016, peço respeitosamente as seguintes informações:

**1. Votações nominais de Plenário, com o voto de cada deputado distrital**
Registro de todas as votações nominais (inclusive verificações de votação e votações pelo painel eletrônico) feitas em Plenário de 1º de janeiro de 2025 até a data da resposta, em formato aberto e legível por máquina (CSV ou JSON; XLSX também serve), com, para cada votação:
- data, sessão (número e tipo) e proposição votada (tipo, número e ano);
- objeto da votação (ex.: 1º ou 2º turno, emenda, veto, redação final);
- voto de cada deputado distrital (Sim, Não, Abstenção, ausente ou outro registro previsto no Regimento Interno), com nome e partido na data da votação;
- totais e resultado proclamado.

Peço também a relação das demais votações do período (votações simbólicas), com a proposição, a data e o resultado proclamado, para que fique claro quais votações tiveram registro nominal e quais não tiveram.

**2. Proposições de 2025 e 2026, com tramitação**
A API pública do Processo Legislativo Eletrônico (PLe) já permite consultar as proposições e o histórico de cada uma. Peço, para o mesmo período (1º de janeiro de 2025 até a data da resposta):
- os arquivos anuais de proposições de 2021 a 2026 no conjunto "Proposições" do Portal de Dados Abertos da CLDF (hoje os arquivos anuais em JSON e CSV vão até 2020), ou uma exportação completa equivalente, com tipo, número, ano, data de leitura, autoria, ementa, situação ou etapa atual, histórico completo de tramitação e resultado de cada deliberação em Plenário;
- a confirmação das rotas válidas da API pública: na consulta feita, a rota `/proposicao/{id}/detalhe` trouxe o histórico, enquanto as rotas `/proposicao/{id}`, `/tramitacoes` e `/documentos`, previstas na documentação, voltaram vazias ou com erro 404.

**3. Publicação permanente (transparência ativa)**
Peço também que a Câmara Legislativa passe a publicar, de forma permanente e atualizada, o resultado de cada votação e a folha de votação nominal (voto de cada deputado distrital) na API pública do PLe (`ple.cl.df.gov.br/pleservico/api/public`) e no Portal de Dados Abertos, conforme o art. 8º, caput e § 3º, incisos II, III e VI, da LAI. O § 3º, inciso III, prevê o "acesso automatizado por sistemas externos em formatos abertos, estruturados e legíveis por máquina". Se já houver previsão ou cronograma para isso, peço que seja informado.

**O que já está publicado e o que não localizamos**
Agradeço o que a Câmara Legislativa já publica: a API pública do PLe, documentada e sem necessidade de autenticação, com proposições, histórico de tramitação e normas ligadas à proposição de origem e ao Diário Oficial do DF; o Portal de Dados Abertos (https://dados.cl.df.gov.br/); e, na página "Sessões Plenárias", as atas circunstanciadas e sucintas, o áudio e a lista de presença. Na consulta feita em 02/11/2026:
- a API pública não traz o resultado das votações nem o voto de cada deputado; as telas de votação do PLe (resultado e "folha de votação") ficam fora do caminho público e exigem login;
- o voto nominal, quando há, aparece em texto corrido nas atas circunstanciadas (PDF), e não em formato estruturado;
- os arquivos anuais do conjunto "Proposições" do Portal de Dados Abertos vão até 2020.

Lembro, com todo o respeito, que:
- o pedido não precisa ser motivado (art. 10, § 3º, da LAI);
- a informação disponível deve ser fornecida de imediato ou em até 20 dias, prorrogáveis por mais 10 com justificativa expressa (art. 11, caput e §§ 1º e 2º);
- se a informação estiver disponível em formato eletrônico, peço que seja entregue nesse formato (art. 11, § 5º); se já estiver publicada, basta indicar o local exato (art. 11, § 6º);
- em caso de negativa total ou parcial, peço a indicação do fundamento legal, do prazo e da autoridade competente para o recurso (art. 11, § 1º, inciso II, e § 4º).

Peço que a resposta seja enviada ao e-mail informado acima, em arquivos digitais.

Contexto, apenas informativo: as informações serão usadas num site sem fins lucrativos e apartidário de acompanhamento das decisões do poder público. O site mostra o que foi votado e decidido, sempre com link para a fonte oficial.

Agradeço desde já pela atenção.

Atenciosamente,

**Thomas Alcantara Meskens**
thomas.meskense@gmail.com
Atibaia-SP, ____ de __________ de 2026.

---

### Versão curta (se o campo do formulário limitar o tamanho do texto)
Com base na Lei 12.527/2011, na Lei Distrital 4.990/2012 e no Ato da Mesa 57/2016, peço, em formato aberto (CSV ou JSON): (1) todas as votações nominais de Plenário de 01/01/2025 até a resposta, com data, sessão, proposição, objeto, voto de cada deputado distrital (nome e partido), totais e resultado, e a relação das votações simbólicas com o resultado; (2) os arquivos anuais de proposições de 2021 a 2026 no Portal de Dados Abertos (hoje vão até 2020), com tramitação e resultado das deliberações, e as rotas válidas da API pública do PLe; (3) a publicação permanente do resultado e da folha de votação nominal na API pública do PLe (art. 8º, § 3º, da LAI). Resposta por e-mail, em arquivos digitais. Thomas Alcantara Meskens, thomas.meskense@gmail.com.

### Envio
- **Protocolo:** (preencher após o envio)
- **Enviado em:** (preencher)
- **Prazo de resposta:** 20 dias, prorrogáveis por mais 10
- **Situação:** não enviado

### Notas para quem envia (não fazem parte do pedido)
- No formulário: CPF, telefone e celular: (preencher no formulário). Nada disso entra neste arquivo.
- Guarde o número de protocolo e a data do envio. Sem resposta no prazo, ou com resposta insatisfatória, cabe recurso em 10 dias pela Ouvidoria e, depois, à Mesa Diretora.
- Quando os arquivos chegarem, salve-os sem alterações e registre a data de recebimento: eles passam a ser a fonte oficial citada no site (diretrizes 2 e 3).

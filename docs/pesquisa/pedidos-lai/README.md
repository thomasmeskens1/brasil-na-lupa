# Pedidos de acesso à informação — Assembleias de MT, MS, GO, RJ, PR e Câmara Legislativa do DF

Seis pedidos pela Lei de Acesso à Informação (LAI, Lei Federal n.º 12.527/2011), no mesmo tom e estrutura do pedido já enviado à Câmara de Atibaia (`docs/pesquisa/pedido-sic-camara-atibaia.md`). Todos pedem:

1. as votações nominais de Plenário de 2025 e 2026, com o voto de cada deputado, em formato aberto (CSV ou JSON);
2. as proposições do mesmo período, com tramitação;
3. a publicação permanente desses dados em formato aberto (art. 8º da LAI).

Cada pedido cita o que a pesquisa de 02/11/2026 encontrou publicado (`docs/pesquisa/estados/`) e o que não foi localizado, sem acusar ninguém. Canais conferidos nos sites oficiais em 02–03/11/2026, com poucas requisições, User-Agent identificado, `robots.txt` respeitado e sem contornar CAPTCHA ou login. **Nada foi enviado.**

Solicitante: Thomas Alcantara Meskens, thomas.meskense@gmail.com. CPF, RG, endereço e telefone não aparecem em nenhum arquivo: onde o formulário pedir, eles são preenchidos na hora do envio.

## Canais

| Casa | Canal | Link | Exige cadastro | Prazo | Recurso | Norma local |
|---|---|---|---|---|---|---|
| [ALMT (MT)](mt.md) | e-SIC na Conta ALMT (Ouvidoria-Geral) | https://www.al.mt.gov.br/transparencia/pedido-informacao/ | **Sim** (Conta ALMT, login com CPF/CNPJ e senha) | 20 dias + 10 | 10 dias; resposta em 10 dias. Instância: não confirmado (o projeto de origem previa o Secretário-Geral) | Resolução ALMT n.º 2.776/2012 |
| [ALEMS (MS)](ms.md) | Ouvidoria/SIC, formulário "Escrever uma Manifestação" | https://transparencia2.al.ms.gov.br/transparencia-manifesto | Não (mas o formulário exige CPF, RG, telefones e endereço) | 20 dias + 10 | 10 dias ao Presidente da ALEMS, que responde em 15 dias | Lei Estadual n.º 4.416/2013 |
| [ALEGO (GO)](go.md) | SIC, formulário da página "Fale Conosco" do Portal da Transparência | https://transparencia.al.go.leg.br/fale-conosco | Não (formulário com CPF e reCAPTCHA) | 20 dias + 10 | 10 dias ao Presidente da Assembleia, apreciado em 10 dias | Lei Estadual n.º 18.025/2013 e Ato da Mesa de 08/07/2013 |
| [ALERJ (RJ)](rj.md) | Formulário online de pedido (LAI) | http://www2.alerj.rj.gov.br/leideacesso/formulario-2016.asp | Não (formulário com CPF, endereço e código de imagem; página sem `https`) | "Prazo legal": 20 dias + 10 (LAI) | Não confirmado (LAI art. 15: 10 dias à autoridade superior) | Não confirmado |
| [ALEP (PR)](pr.md) | e-SIC no SISGOP (Ouvidoria-Geral) | https://alep.sisgop.pr.gov.br/cidadao/acesso-informacao/1 | Não confirmado (exige identificação; tem opção sigilosa; acompanhamento com login) | 20 dias + 10, **suspensos no recesso** | 10 dias, pela Ouvidoria, ao Diretor-Geral ou à Comissão Executiva; decisão em 5 dias | Ato da Comissão Executiva n.º 560/2024 |
| [CLDF (DF)](df.md) | SIC da Ouvidoria, página "Faça seu pedido" | https://www.cl.df.gov.br/faca-seu-pedido | Não (formulário com CPF e CAPTCHA) | 20 dias + 10 | 10 dias, pela Ouvidoria, à autoridade superior (5 dias); depois à Mesa Diretora (5 dias) | Lei Distrital n.º 4.990/2012 e Ato da Mesa n.º 57/2016 |

Canais alternativos (e-mail e telefone) estão no topo de cada arquivo.

## O que cada pedido destaca

| Casa | Publicado hoje (pesquisa de 02/11/2026) | Não localizado / pedido extra |
|---|---|---|
| MT | Tramitação por proposição; Ordem do Dia em PDF; documentação da ALMT API | Voto individual estruturado; API exige credencial → pede credencial de leitura |
| MS | "Lista de votação" nominal no Diário da ALEMS (voto por deputado) | Listas publicadas como imagem no PDF; SGPL com CAPTCHA → pede dados em CSV/JSON e acesso de leitura sem CAPTCHA |
| GO | ALEGO Digital (sessões, "Votação Preliminar", atas); Portal de Dados Abertos com dados de gestão | Voto individual; ALEGO Digital proíbe leitura automatizada no `robots.txt` → pede dados abertos legislativos |
| RJ | Projetos com tramitação (Lotus Notes); notas taquigráficas com placar | Lista nome a nome dos votos → pede espelhos do painel eletrônico |
| PR | API pública de proposições, trâmites e normas; "Controle de Votações" no portal | Votos só com reCAPTCHA e em caminho bloqueado pelo `robots.txt` → pede votos e presença na API pública |
| DF | API pública do PLe; Portal de Dados Abertos; atas | Votos só em texto nas atas; arquivos anuais param em 2020 → pede folha de votação na API pública |

## Passo a passo para enviar

1. Abra o arquivo da casa (links da tabela) e copie o texto entre as duas linhas horizontais (`---`), do "À Assembleia..." até a assinatura. Preencha a data no fim.
2. Abra o link do canal. Em **MT**, crie antes a Conta ALMT (Cadastrar Pessoa Física) e entre com ela. Em **PR**, clique em "Continuar" (o navegador precisa aceitar cookies). Em **GO**, marque "Pessoa física".
3. Preencha os dados pessoais pedidos pelo formulário (CPF, RG, endereço, telefone etc.) direto no site. Eles não devem ser copiados para o repositório.
4. Cole o texto no campo do pedido. Se o campo limitar o tamanho, use a "Versão curta" que está em cada arquivo e, se houver campo de anexo, anexe o texto completo.
5. Resolva a verificação do formulário (conta, código de imagem ou "Não sou um robô") e envie.
6. Anote o número de protocolo e a data na seção "Envio" do arquivo da casa e calcule o prazo (20 dias; no PR, descontar o recesso).
7. Sem resposta no prazo ou com resposta incompleta, apresente recurso em até 10 dias, pela instância indicada na tabela.
8. Quando a resposta chegar, salve os arquivos sem alterações e registre a data de recebimento: eles passam a ser fonte oficial citada no site (diretrizes 2 e 3).

## Pontos não confirmados
- **ALMT:** instância do recurso no texto final da Resolução 2.776/2012 (só o projeto de origem foi lido).
- **ALERJ:** regulamentação própria da LAI, prazo e instância de recurso da Casa; campos obrigatórios do formulário além da data de nascimento.
- **ALEP:** se o formulário do e-SIC exige cadastro e quais campos pede (ele não abriu sem cookies).
- **ALEGO e CLDF:** quais campos o sistema trata como obrigatórios.

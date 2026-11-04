# Fotos oficiais de políticos: permissões de uso

Pesquisa feita em 04/11/2026, só em páginas oficiais das próprias casas legislativas. Regra do site:
a foto só aparece quando a fonte **declara** que as imagens podem ser usadas, e sempre com o crédito
pedido por ela. Sem essa declaração, o político aparece com as iniciais do nome, no mesmo formato e
tamanho (nada que pareça punição). Coletor: `scripts/coleta/fotos/coletar.mjs`; manifesto com
arquivo, endereço de origem, crédito, licença e data em `dados/fotos/manifest.json`.

## Ativadas

### Câmara dos Deputados — ativada

- Página: <https://www2.camara.leg.br/comunicacao/assessoria-de-imprensa/guia-para-jornalistas/noticias-e-fotografias>
- Trecho: “Todas as imagens disponíveis são protegidas pelas leis brasileiras de direitos autorais e
  podem ser livremente utilizadas, sem custo e sem necessidade de autorização, desde que sejam dados
  os créditos, no formato Nome do Fotógrafo/Câmara dos Deputados. Em caso de fotografia sem
  identificação da autoria, o formato deve ser Arquivo/Câmara dos Deputados.”
- Crédito usado: **“Foto: Arquivo/Câmara dos Deputados”** (a foto oficial de cada deputado, em
  `www.camara.leg.br/internet/deputado/bandep/<id>.jpg`, não identifica o fotógrafo).
- robots.txt de `www.camara.leg.br`: não bloqueia `/internet/deputado/bandep/` (bloqueia, entre
  outros, `/deputados/*/*` e `/internet/deputado/Dep_Lista*`).
- A fonte envia ETag e Last-Modified: o coletor só baixa de novo quando a foto muda (resposta 304).
- Proporção 3:4 (a mesma da moldura do site): sem corte.

### Senado Federal — ativada

- Página: <https://www12.senado.leg.br/noticias/politica-de-uso>
- Trecho: “A reprodução de matérias e fotografias é livre, desde que não haja descaracterização de
  conteúdo e mediante a citação da Agência Senado e do autor.”
- Confirmação para as fotos oficiais: <https://www12.senado.leg.br/assessoria-de-imprensa/lista-dos-servicos-da-secom>
  — “As fotos oficiais dos senadores e das senadoras estão disponíveis no banco de imagens da Agência
  Senado no Flickr. […] De acordo com a Política de Uso, a reprodução de fotografias é livre, desde que
  não haja descaracterização de conteúdo e mediante a citação da fonte/autor.”
- Mesma regra em <https://www12.senado.leg.br/assessoria-de-imprensa/politica-de-uso>: “Todo o material
  produzido pelos veículos do Senado Federal pode ser baixado ou reproduzido livremente, desde que
  citada a respectiva fonte e não haja descaracterização do conteúdo.”
- Crédito usado: **“Foto: Agência Senado”** (a foto oficial, em
  `www.senado.leg.br/senadores/img/fotos-oficiais/senador<id>.jpg`, redireciona para
  `legis.senado.leg.br/senadores/fotos-oficiais/<id>` e não identifica o fotógrafo).
- “Sem descaracterização”: a imagem só é reduzida (256 px de largura). O original tem proporção 4:5;
  na moldura 3:4 do site sobra um corte lateral de cerca de 6% da largura, sem alterar o retrato.
- robots.txt: `www.senado.leg.br` não tem robots.txt (404); `legis.senado.leg.br/robots.txt`
  responde 403 (pela RFC 9309, erro 4xx no robots.txt equivale a nenhuma restrição);
  `www12.senado.leg.br` libera tudo (`Disallow:` vazio).
- A fonte não envia ETag nem Last-Modified: o coletor confere o hash do original no máximo uma vez
  por semana e só regrava se mudou.

### Assembleia Legislativa de São Paulo (ALESP) — ativada

- Página: <https://www.al.sp.gov.br/alesp/license/>
- Trecho: “O conteúdo do Portal da Alesp - www.al.sp.gov.br - está licenciado com uma Licença
  Creative Commons - Atribuição 4.0 Internacional.”
- Banco de imagens (ex.: <https://www.al.sp.gov.br/noticia/album/?id=513586>): “Todas as imagens são
  protegidas pelas leis de direitos autorais e podem ser livremente utilizadas, sem custo e sem
  necessidade de autorização, de acordo com a licença Creative Commons BY, que apenas exige que seja
  dado o crédito no formato 'Nome do Fotógrafo/Alesp'.”
- Crédito usado: **“Foto: Alesp · licença CC BY 4.0”**, com link para a página de licença da ALESP;
  o manifesto registra que a imagem foi redimensionada e, na exibição, enquadrada na moldura 3:4
  (exigência da CC BY de indicar alterações). 21 das 52 fotos têm enquadramento largo (retrato de
  meio corpo mais largo que alto); nelas a moldura corta as laterais, mantendo o rosto.
  A foto oficial do deputado (`/repositorio/deputadoPortal/fotos/…`) não identifica o fotógrafo.
- robots.txt de `www.al.sp.gov.br`: bloqueia só `/web`, `/StaticFile`, `/repositorio/contratos`,
  `/repositorio/legislacao/seo/` e `/legis/seo/`; `/repositorio/deputadoPortal/fotos/` é liberado.
- Só 52 dos 94 deputados em exercício têm foto publicada no repositório oficial (campo `foto` de
  `dados/alesp/parlamentares.json`); os demais aparecem com as iniciais.

## Não ativadas (iniciais)

| Casa | Situação encontrada | Motivo |
|---|---|---|
| Minas Gerais (ALMG) | <https://www.almg.gov.br/portal-da-almg/termos-de-uso-e-politica-de-privacidade/>: “Os conteúdos originais produzidos pela própria ALMG […] tais como textos, vídeos, imagens […] estão disponíveis para leitura, uso, reprodução ou distribuição, desde que citados a fonte e o autor […]. Entretanto, a instituição se reserva o direito de restringir a licença de uso de conteúdos específicos.” O banco de imagens restringe: “É permitido o uso das imagens, desde que não seja para fins comerciais ou publicitários […] nome do fotógrafo/ALMG.” | A lista coletada (`dados/estados/mg`) não traz endereço de foto, e o robots.txt bloqueia `/.content/`. Pode ser ativada depois, se o coletor de MG passar a registrar a foto oficial fora de caminho bloqueado. |
| Paraíba, Acre, Alagoas, Amazonas, Piauí, Rondônia, Roraima e Tocantins (fotos no SAPL) | Rodapé padrão do sistema SAPL (Interlegis): “Conteúdo e dados sob licença Creative Commons 4.0 Atribuir Fonte - Compartilhar Igual” (o texto diz BY-SA; o link aponta para CC BY 4.0). Os portais institucionais de PB, RO e RR dizem “Todos os direitos reservados”. | Rodapé genérico do software, não um ato da Assembleia, sem citar fotografias e em conflito com o “todos os direitos reservados” de parte dos portais. Além disso, o robots.txt desses hosts pede intervalo de 60 s entre acessos. Fica para decisão do responsável pelo projeto. |
| Rio Grande do Sul | Termo de uso (<https://ww4.al.rs.gov.br/sites/default/files/termo-de-uso-portal-institucional.pdf>): “A utilização do nosso Site não lhe dá a propriedade ou qualquer direito de propriedade intelectual sobre nosso conteúdo”; rodapé “Todos os direitos reservados”. | Não declara permissão. |
| Pernambuco | <https://www.alepe.pe.gov.br/termos-de-uso-e-politica-de-privacidade> não concede licença. | Não declara permissão. |
| Bahia | Rodapé: “Todos os direitos reservados.” | Não declara permissão. |
| Distrito Federal (CLDF) | Nenhuma política de uso de imagens encontrada no domínio oficial. | Não declara permissão. |
| Espírito Santo | <https://www.al.es.gov.br/Home/AvisoPeriodoEleitoralImagens>: banco de imagens “mediante solicitação formal”. | Não declara permissão. |
| Sergipe | Rodapé “Copyright © Assembleia”. | Não declara permissão. |
| Rio Grande do Norte | Álbuns com “Crédito: <fotógrafo>”, sem licença. | Não declara permissão. |

Vereadores, prefeitos, governadores e a Presidência estão fora do escopo por enquanto (iniciais).

A página de deputado estadual antes mostrava, direto do site de cada Assembleia, a foto de quem
tinha o campo `foto`; isso foi substituído pela regra acima (só ALESP, com cópia reduzida e crédito).

## Tamanho

646 fotos em WebP de 256 px de largura (513 da Câmara, 81 do Senado e 52 da ALESP), cerca de 6,3 MB
em `dados/fotos/`. No site, ficam em `web/public/fotos/` (arquivos estáticos, fora do pacote das
funções sob demanda: `next.config.ts` exclui `public/` que nenhuma rota usa).

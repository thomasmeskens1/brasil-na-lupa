# Cadastro de usuários — como configurar

O cadastro (login por **código de 6 dígitos enviado por e-mail**, com o link como alternativa no mesmo
e-mail, e, opcionalmente, "Entrar com Google"), os **favoritos** (estrela "Favoritar") e as **reações**
(curtir / não curtir) **só ligam quando as quatro variáveis obrigatórias existem** no ambiente da Vercel:

| Variável | Obrigatória | O que é |
|---|---|---|
| `DATABASE_URL` | sim | Endereço do banco Neon Postgres (a integração da Vercel cria) |
| `AUTH_SECRET` | sim | Segredo do Auth.js (assina e protege cookies e tokens) |
| `AUTH_RESEND_KEY` | sim | Chave de API do Resend (envio do e-mail com o código) |
| `EMAIL_FROM` | sim | Remetente, ex.: `Brasil na Lupa <no-reply@brasilnalupa.com.br>` |
| `AUTH_GOOGLE_ID` | não | ID do cliente OAuth do Google |
| `AUTH_GOOGLE_SECRET` | não | Segredo do cliente OAuth do Google |

Sem qualquer uma das quatro, o site funciona exatamente como antes: as páginas `/entrar` e
`/minha-conta` e as rotas `/api/conta/*` respondem "Página não encontrada", o botão "Minha conta",
os botões "Favoritar" e de reação, o convite para entrar e o bloco "Seus favoritos" não aparecem, e a
Política de Privacidade mostra a versão 3 (sem cadastro). O aviso de cookies do rodapé aparece nos dois
casos.

> A Vercel só aplica variáveis novas num **novo deploy**. Depois de criar ou mudar qualquer
> variável, faça *Redeploy* do último deploy de produção.

Nunca coloque valores reais no repositório. O arquivo `web/.env.example` traz só os nomes.

---

## 1. Banco de dados (Neon, pela aba Storage da Vercel)

1. No painel da Vercel, abra o projeto do site → aba **Storage** → **Create Database**.
2. Escolha **Neon** (Serverless Postgres) → **Continue**. Aceite os termos da integração.
3. Região: escolha **São Paulo (aws-sa-east-1)** se estiver na lista. A Política de Privacidade
   (item 9.5) diz que o banco fica em São Paulo — se escolher outra região, avise para o texto ser
   corrigido antes de ligar o cadastro.
4. Plano: o gratuito basta para começar. Dê um nome (ex.: `brasil-na-lupa-cadastro`) → **Create**.
5. Em **Connect Project**, ligue ao projeto do site e marque o ambiente **Production**.
   (Para Preview, prefira não ligar, ou use um *branch* separado do Neon, para que testes não
   gravem no banco de produção.)
6. Confira em **Settings → Environment Variables** que apareceu `DATABASE_URL` (a integração cria
   também outras, como `DATABASE_URL_UNPOOLED` e `PG*`; o site só usa `DATABASE_URL`).
7. Retenção do histórico: no console do Neon (botão **Open in Neon**) → **Settings** →
   **Storage/History retention** (o nome pode variar), deixe o histórico de restauração em
   **7 dias ou menos** — é o prazo que a política informa para dados excluídos ainda existirem em
   cópias.

## 2. E-mail (Resend) e verificação do domínio

Pré-requisito: o domínio `brasilnalupa.com.br` registrado (Registro.br) e com acesso ao DNS.

1. Crie a conta em <https://resend.com> (use o e-mail do responsável).
2. **Domains → Add Domain** → digite `brasilnalupa.com.br`. Se o Resend oferecer escolha de
   região, prefira **São Paulo (sa-east-1)**.
3. O Resend mostra os registros DNS a criar. Normalmente são:
   - **MX** em `send` → `feedback-smtp.<região>.amazonses.com` (prioridade 10);
   - **TXT** em `send` → `v=spf1 include:amazonses.com ~all`;
   - **TXT** em `resend._domainkey` → a chave DKIM longa mostrada na tela.
   Copie **exatamente** os valores da tela do Resend (eles podem diferir dos exemplos acima).
4. No DNS do domínio (Registro.br → *Editar zona*, ou na Vercel se o DNS estiver lá), crie esses
   registros. Recomendado também: **TXT** em `_dmarc` → `v=DMARC1; p=none;`.
5. Volte ao Resend e clique **Verify DNS Records**. Pode levar de minutos a algumas horas.
6. **API Keys → Create API Key**: nome `brasil-na-lupa-producao`, permissão **Sending access**, domínio
   `brasilnalupa.com.br`. Copie a chave (ela só aparece uma vez).
7. Na Vercel (Settings → Environment Variables, ambiente Production), crie:
   - `AUTH_RESEND_KEY` = a chave copiada (marque como *Sensitive*);
   - `EMAIL_FROM` = `Brasil na Lupa <no-reply@brasilnalupa.com.br>`.

Antes de o domínio estar verificado, dá para testar com `EMAIL_FROM=onboarding@resend.dev`: nesse
modo o Resend só entrega para o e-mail da própria conta Resend.

## 3. "Entrar com Google" (opcional)

1. Acesse <https://console.cloud.google.com> → crie um projeto (ex.: `brasil-na-lupa`).
2. **APIs e serviços → Tela de consentimento OAuth** (ou **Google Auth Platform → Branding**):
   - Nome do app: `Brasil na Lupa`; e-mail de suporte: o do responsável;
   - Domínio autorizado: `brasilnalupa.com.br`;
   - Página inicial: `https://brasilnalupa.com.br`;
   - Política de privacidade: `https://brasilnalupa.com.br/privacidade`;
   - Público: **Externo**. Escopos: só `openid`, `email` e `profile` (não exigem verificação
     especial do Google).
   - Publique o app (**Em produção**); em modo "Teste" só os e-mails cadastrados como testadores
     conseguem entrar.
3. **Credenciais → Criar credenciais → ID do cliente OAuth** → tipo **Aplicativo da Web**:
   - **Origens JavaScript autorizadas**:
     `https://brasilnalupa.com.br` e `http://localhost:3000`
     (acrescente `https://www.brasilnalupa.com.br` se o site também responder em `www`);
   - **URIs de redirecionamento autorizados**:
     `https://brasilnalupa.com.br/api/auth/callback/google` e
     `http://localhost:3000/api/auth/callback/google`
     (e `https://www.brasilnalupa.com.br/api/auth/callback/google`, se usar `www`).
4. Copie o **ID do cliente** e a **Chave secreta** e crie na Vercel (Production):
   `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` (marque como *Sensitive*).

O Google não aceita curingas: o login com Google não funciona nos endereços de *Preview* da Vercel
(`*.vercel.app`). Neles, use o link por e-mail.

## 4. Gerar o `AUTH_SECRET`

Em qualquer terminal com Node.js:

```bash
npx auth secret --raw
# ou
node -e "console.log(require('crypto').randomBytes(33).toString('base64'))"
```

Crie `AUTH_SECRET` na Vercel (Production, *Sensitive*) com o valor gerado. Use um segredo
diferente para cada ambiente. Trocar o segredo encerra todas as sessões abertas e invalida os
links de acesso ainda não usados.

## 5. Criar as tabelas (migração)

As migrações ficam em `web/db/migracoes/` (arquivos `NNN_nome.sql`, aplicados em ordem; as já
aplicadas ficam registradas na tabela `migracoes_aplicadas` e não rodam de novo).

```bash
cd web
npx vercel link            # uma vez: liga a pasta ao projeto da Vercel
npx vercel env pull .env.local --environment=production   # baixa DATABASE_URL e as demais
npm run db:migrar
```

A saída esperada é `aplicada: 001_cadastro.sql`, `aplicada: 002_favoritos_reacoes.sql` e
`aplicada: 003_estado_eleitoral.sql` (num banco que já tinha as anteriores, só a nova). Rodar de novo mostra "Banco já está atualizado".
O arquivo `.env.local` fica fora do Git (está no `.gitignore`); apague-o se não precisar mais.

Rode `npm run db:migrar` de novo sempre que surgir uma migração nova, **antes** do deploy que a usa.

## 6. Ligar e testar

1. Com as variáveis criadas e a migração aplicada, faça **Redeploy** de produção.
2. Confira que o botão **Minha conta** aparece no cabeçalho e que `/privacidade` mostra a
   **versão 4**, com o item 9 "Cadastro (opcional), favoritos e reações" e o item 4 "Cookies".
3. Em `/entrar`, peça o código com o seu e-mail. Deve abrir a tela **Digite o código**. Confira a
   chegada do e-mail (e a caixa de spam): ele traz o código de 6 dígitos e um link.
4. Digite o código: deve abrir **Minha conta** com a tela de consentimento (caixas desmarcadas, incluindo
   "Declaro que tenho 18 anos ou mais").
   - Digite um código errado 5 vezes: na 5ª, o código é cancelado (peça outro).
   - "Não concordo" deve apagar a conta e mostrar "Conta excluída".
   - "Concordo" (com as duas caixas) deve mostrar favoritos e preferências.
5. Abra uma votação (ex.: `/congresso/votacoes/camara/...`): aparecem **Favoritar** e os botões
   **Curtir** / **Não curtir** com os contadores e o rótulo "Opinião de usuários do Brasil na Lupa —
   não é pesquisa nem dado oficial". Na primeira reação aparece o consentimento das reações.
6. Numa janela anônima (sem login), a mesma página mostra os botões **sem números**; clicar abre o
   convite para entrar (Esc fecha e devolve o foco ao botão).
7. Favorite um estado (`/estados/sp`), um político e uma votação; volte à página inicial: o bloco
   **Seus favoritos** aparece no topo com as decisões recentes ligadas a eles, por data.
8. **Baixar meus dados**: o JSON traz e-mail, consentimentos, favoritos e reações.
9. **Corrigir o e-mail**: peça o código para um e-mail novo, digite-o e confira a troca.
10. **Apagar todas as reações**, **Apagar todos os favoritos** e **Revogar o consentimento das reações**
    devem funcionar sozinhos; **Revogar todo o consentimento** apaga favoritos, preferências e reações.
11. **Excluir minha conta**: após confirmar, a conta some (o primeiro acesso volta a pedir consentimento).
12. Peça o código 4 vezes seguidas com o mesmo e-mail: a 4ª mostra o aviso de limite (3 a cada 15
    minutos por e-mail; 10 a cada 15 minutos por IP).
13. Se configurou o Google, teste "Entrar com Google" com uma conta que já entrou por e-mail: deve
    cair na mesma conta.

Testes automáticos (sem serviços externos; usam um Postgres em memória):

```bash
cd web
npm run test:conta
```

Teste local completo (opcional): crie um *branch* de desenvolvimento no Neon, ponha a URL dele em
`web/.env.local` com as demais variáveis e `AUTH_URL=http://localhost:3000`, rode
`npm run db:migrar` e `npm run dev`.

## 7. Desligar

Apague (ou esvazie) qualquer uma das quatro variáveis obrigatórias e faça Redeploy. As rotas de
conta voltam a responder 404 e a política volta à versão 1. Os dados continuam no banco até você
apagá-lo (aba Storage → banco → *Settings* → *Delete*), o que deve ser feito se o cadastro for
encerrado de vez — avise os usuários antes, por e-mail, conforme a política.

## O que fica gravado (resumo técnico)

| Tabela | Conteúdo |
|---|---|
| `usuarios` | e-mail, datas de criação, verificação, último acesso e aviso de inatividade, início do período sem consentimento (**sem nome**) |
| `contas_externas` | vínculo com o Google (provedor e identificador; **sem** tokens) |
| `sessoes` | token da sessão e validade |
| `tokens_verificacao` | hash do código (o mesmo do link), validade (10 minutos) e tentativas erradas (máx. 5) |
| `consentimentos` | versão da política aceita e data, declaração de 18 anos ou mais, data do consentimento das reações, estado onde vota (opcional) e data desse consentimento |
| `preferencias` | municípios e alertas por e-mail |
| `favoritos` | tipo (estado, tema, político, proposta) e o identificador do site |
| `reacoes` | proposta e reação (1 curti, -1 não curti), uma por conta por proposta |
| `reacoes_contagem` | totais por proposta (mantidos por gatilho; não guardam quem reagiu) |
| `limites_envio` | HMAC do e-mail, do IP ou da conta e horário (apagado em 24 horas) |

A limpeza automática (contas sem consentimento há mais de 7 dias, contas sem acesso há 24 meses e
avisadas por e-mail há 30 dias, sessões e códigos vencidos, registros de limite com mais de 24 horas)
roda a cada login e a cada pedido de código. O aviso de inatividade é enviado no login de qualquer
pessoa (até 20 por vez).

## Segurança das rotas `/api/conta/*`

- Só `POST` altera dados, sempre com sessão válida, `Origin` do próprio site, `Sec-Fetch-Site`
  `same-origin` (quando o navegador envia) e corpo JSON de até 2 KB.
- Limite por conta (60 a cada 10 minutos) e por IP (120 a cada 10 minutos) para reações e favoritos;
  20 conferências de código a cada 15 minutos por IP.
- Ids de proposta e de político conferidos contra o formato dos ids do site
  (`web/src/features/conta/ids.ts`).
- Contadores só para quem tem sessão; nunca aparecem em listas, comparador, crachá ou ordenação.

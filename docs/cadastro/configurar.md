# Cadastro de usuários — como configurar

O cadastro (login por link no e-mail e, opcionalmente, "Entrar com Google") **só liga quando as
quatro variáveis obrigatórias existem** no ambiente da Vercel:

| Variável | Obrigatória | O que é |
|---|---|---|
| `DATABASE_URL` | sim | Endereço do banco Neon Postgres (a integração da Vercel cria) |
| `AUTH_SECRET` | sim | Segredo do Auth.js (assina e protege cookies e tokens) |
| `AUTH_RESEND_KEY` | sim | Chave de API do Resend (envio do e-mail com o link) |
| `EMAIL_FROM` | sim | Remetente, ex.: `Brasil Transparente <no-reply@brasiltransparente.com.br>` |
| `AUTH_GOOGLE_ID` | não | ID do cliente OAuth do Google |
| `AUTH_GOOGLE_SECRET` | não | Segredo do cliente OAuth do Google |

Sem qualquer uma das quatro, o site funciona exatamente como antes: as páginas `/entrar` e
`/minha-conta` respondem "Página não encontrada", o botão "Minha conta" não aparece e a Política
de Privacidade mostra a versão 1 (sem cadastro).

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
4. Plano: o gratuito basta para começar. Dê um nome (ex.: `placar-cadastro`) → **Create**.
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

Pré-requisito: o domínio `brasiltransparente.com.br` registrado (Registro.br) e com acesso ao DNS.

1. Crie a conta em <https://resend.com> (use o e-mail do responsável).
2. **Domains → Add Domain** → digite `brasiltransparente.com.br`. Se o Resend oferecer escolha de
   região, prefira **São Paulo (sa-east-1)**.
3. O Resend mostra os registros DNS a criar. Normalmente são:
   - **MX** em `send` → `feedback-smtp.<região>.amazonses.com` (prioridade 10);
   - **TXT** em `send` → `v=spf1 include:amazonses.com ~all`;
   - **TXT** em `resend._domainkey` → a chave DKIM longa mostrada na tela.
   Copie **exatamente** os valores da tela do Resend (eles podem diferir dos exemplos acima).
4. No DNS do domínio (Registro.br → *Editar zona*, ou na Vercel se o DNS estiver lá), crie esses
   registros. Recomendado também: **TXT** em `_dmarc` → `v=DMARC1; p=none;`.
5. Volte ao Resend e clique **Verify DNS Records**. Pode levar de minutos a algumas horas.
6. **API Keys → Create API Key**: nome `placar-producao`, permissão **Sending access**, domínio
   `brasiltransparente.com.br`. Copie a chave (ela só aparece uma vez).
7. Na Vercel (Settings → Environment Variables, ambiente Production), crie:
   - `AUTH_RESEND_KEY` = a chave copiada (marque como *Sensitive*);
   - `EMAIL_FROM` = `Brasil Transparente <no-reply@brasiltransparente.com.br>`.

Antes de o domínio estar verificado, dá para testar com `EMAIL_FROM=onboarding@resend.dev`: nesse
modo o Resend só entrega para o e-mail da própria conta Resend.

## 3. "Entrar com Google" (opcional)

1. Acesse <https://console.cloud.google.com> → crie um projeto (ex.: `brasil-transparente`).
2. **APIs e serviços → Tela de consentimento OAuth** (ou **Google Auth Platform → Branding**):
   - Nome do app: `Brasil Transparente`; e-mail de suporte: o do responsável;
   - Domínio autorizado: `brasiltransparente.com.br`;
   - Página inicial: `https://brasiltransparente.com.br`;
   - Política de privacidade: `https://brasiltransparente.com.br/privacidade`;
   - Público: **Externo**. Escopos: só `openid`, `email` e `profile` (não exigem verificação
     especial do Google).
   - Publique o app (**Em produção**); em modo "Teste" só os e-mails cadastrados como testadores
     conseguem entrar.
3. **Credenciais → Criar credenciais → ID do cliente OAuth** → tipo **Aplicativo da Web**:
   - **Origens JavaScript autorizadas**:
     `https://brasiltransparente.com.br` e `http://localhost:3000`
     (acrescente `https://www.brasiltransparente.com.br` se o site também responder em `www`);
   - **URIs de redirecionamento autorizados**:
     `https://brasiltransparente.com.br/api/auth/callback/google` e
     `http://localhost:3000/api/auth/callback/google`
     (e `https://www.brasiltransparente.com.br/api/auth/callback/google`, se usar `www`).
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

A saída esperada é `aplicada: 001_cadastro.sql`. Rodar de novo mostra "Banco já está atualizado".
O arquivo `.env.local` fica fora do Git (está no `.gitignore`); apague-o se não precisar mais.

Rode `npm run db:migrar` de novo sempre que surgir uma migração nova, **antes** do deploy que a usa.

## 6. Ligar e testar

1. Com as variáveis criadas e a migração aplicada, faça **Redeploy** de produção.
2. Confira que o botão **Minha conta** aparece no cabeçalho e que `/privacidade` mostra a
   **versão 2**, com o item 9 "Cadastro (opcional)".
3. Em `/entrar`, peça o link com o seu e-mail. Confira a chegada (e a caixa de spam).
4. Clique no link: deve abrir **Minha conta** com a tela de consentimento (caixa desmarcada).
   - "Não concordo" deve apagar a conta e mostrar "Conta excluída".
   - "Concordo" deve mostrar as preferências (alertas desligados).
5. Marque estados e temas, salve, recarregue a página e confira que ficaram gravados.
6. **Baixar meus dados**: deve baixar um JSON com e-mail, consentimento e preferências.
7. **Revogar consentimento**: as preferências somem e a tela de consentimento volta.
8. **Excluir minha conta**: após confirmar, a conta some (peça um link de novo: o primeiro acesso
   volta a pedir consentimento).
9. Peça o link 4 vezes seguidas com o mesmo e-mail: a 4ª deve mostrar o aviso de limite (3 a cada
   15 minutos por e-mail; 10 a cada 15 minutos por IP).
10. Se configurou o Google, teste "Entrar com Google" com uma conta que já entrou por e-mail: deve
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
| `usuarios` | e-mail, nome (só do Google), datas de criação, verificação e último acesso, início do período sem consentimento |
| `contas_externas` | vínculo com o Google (provedor e identificador; **sem** tokens) |
| `sessoes` | token da sessão e validade |
| `tokens_verificacao` | hash do link de acesso e validade (1 hora) |
| `consentimentos` | versão da política aceita e data |
| `preferencias` | UFs, municípios, temas, políticos e itens acompanhados, alertas por e-mail |
| `limites_envio` | HMAC do e-mail ou do IP e horário (apagado em 24 horas) |

A limpeza automática (contas sem consentimento há mais de 7 dias, sem acesso há mais de 24 meses,
sessões e links vencidos, registros de limite com mais de 24 horas) roda a cada login e a cada
pedido de link.

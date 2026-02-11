

## Corrigir Cadastro com Confirmacao de E-mail

### Contexto Atual

O sistema ja possui a trigger `handle_new_user` que cria profile + role automaticamente no server-side ao inserir em `auth.users`. O `register()` no AuthContext ja retorna `{ needsEmailConfirmation: true }` quando nao ha sessao. Porem, as paginas de cadastro redirecionam para `/login` em vez de uma pagina dedicada de confirmacao, e nao ha opcao de reenviar e-mail.

### Alteracoes Planejadas

**1. Criar `src/pages/CheckEmail.tsx`**
- Pagina com visual futurista/glass consistente com o app (NetworkBackground, motion animations)
- Le `?email=` da querystring para exibir o email do usuario
- Botao "Reenviar e-mail" usando `supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: window.location.origin + "/login" } })`
- Tratamento de rate limit com toast "Aguarde alguns minutos para reenviar"
- Texto sobre verificar Spam/Lixo Eletronico
- Link para voltar ao Login

**2. Adicionar rota publica em `src/App.tsx`**
- Import do CheckEmail
- Nova rota: `<Route path="/check-email" element={<CheckEmail />} />`

**3. Atualizar `src/pages/registration/ContractorRegistration.tsx`**
- Quando `needsEmailConfirmation === true`: navegar para `/check-email?email=...` em vez de `/login`

**4. Atualizar `src/pages/registration/InfluencerRegistration.tsx`**
- Mesma alteracao: navegar para `/check-email?email=...`

**5. Atualizar `src/pages/Login.tsx`**
- Detectar erro "Email not confirmed" no signIn
- Mostrar toast "Confirme seu e-mail. Verifique Inbox/Spam."
- Redirecionar para `/check-email?email=...`

**6. Sobre localStorage `orbty_pending_registration`**
- A trigger `handle_new_user` ja cria profile + role no servidor ao signup, mesmo sem sessao. Portanto, o localStorage como mecanismo principal de finalizacao e redundante.
- Sera adicionado como fallback de seguranca no `fetchUserData`: se sessao existe mas profile nao, tenta ler localStorage e criar via insert direto (ja autenticado nesse ponto).

### Detalhes Tecnicos

Arquivos criados:
- `src/pages/CheckEmail.tsx`

Arquivos modificados:
- `src/App.tsx` (nova rota)
- `src/pages/registration/ContractorRegistration.tsx` (redirect para /check-email)
- `src/pages/registration/InfluencerRegistration.tsx` (redirect para /check-email)
- `src/pages/Login.tsx` (tratamento "Email not confirmed")
- `src/contexts/AuthContext.tsx` (fallback localStorage no fetchUserData + emailRedirectTo ajustado para /login)

Nenhuma migration SQL necessaria - a trigger `handle_new_user` ja resolve a criacao server-side.


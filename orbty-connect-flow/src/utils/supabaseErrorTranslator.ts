export function translateSupabaseError(message?: string | null): string {
  if (!message) {
    return "Ocorreu um erro inesperado.";
  }

  const msg = message.toLowerCase().trim();

  // LOGIN
  if (msg.includes("invalid login credentials")) {
    return "Email ou senha incorretos.";
  }

  if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }

  // CADASTRO
  if (msg.includes("user already registered")) {
    return "Este e-mail já está cadastrado.";
  }

  if (msg.includes("signup is disabled")) {
    return "O cadastro está indisponível no momento.";
  }

  // SENHA
  if (
    (msg.includes("password") && msg.includes("different")) ||
    msg.includes("same password") ||
    msg.includes("old password")
  ) {
    return "A nova senha precisa ser diferente da senha anterior.";
  }

  if (
    (msg.includes("password") && msg.includes("short")) ||
    msg.includes("password should be at least")
  ) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }

  if (msg.includes("weak password")) {
    return "Escolha uma senha mais forte.";
  }

  // TOKEN / LINK
  if (msg.includes("expired")) {
    return "Este link expirou. Solicite um novo.";
  }

  if (
    msg.includes("invalid token") ||
    msg.includes("token has expired") ||
    msg.includes("otp expired") ||
    msg.includes("otp is expired")
  ) {
    return "Este link é inválido ou expirou. Solicite um novo.";
  }

  if (
    msg.includes("session not found") ||
    msg.includes("auth session missing") ||
    msg.includes("session missing")
  ) {
    return "Sua sessão expirou. Faça login novamente.";
  }

  // RATE LIMIT
  if (
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("over_email_send_rate_limit")
  ) {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }

  // EMAIL
  if (msg.includes("email address") && msg.includes("invalid")) {
    return "Informe um e-mail válido.";
  }

  // REDE / GENÉRICO
  if (
    msg.includes("failed to fetch") ||
    msg.includes("network error") ||
    msg.includes("network request failed")
  ) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }

  if (msg.includes("unexpected_failure")) {
    return "Não foi possível concluir a operação. Tente novamente.";
  }

  return "Não foi possível concluir a operação.";
}
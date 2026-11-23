/** Traduit les messages d'erreur de l'authentification Supabase. */
export function traduireErreurAuth(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'E-mail ou mot de passe incorrect.';
  if (/already registered/i.test(message)) return 'Un compte existe déjà avec cet e-mail.';
  if (/email not confirmed/i.test(message)) return 'Confirmez d’abord votre e-mail (lien reçu par courrier).';
  if (/at least \d+ characters|password should be/i.test(message)) return 'Mot de passe trop court ou trop simple.';
  if (/same.*password|different from the old/i.test(message)) return 'Choisissez un mot de passe différent de l’ancien.';
  if (/weak|pwned|leaked/i.test(message)) return 'Ce mot de passe est trop courant : choisissez-en un autre.';
  if (/rate limit|too many|security purposes/i.test(message)) return 'Trop de tentatives : réessayez dans quelques minutes.';
  if (/failed to fetch|network|load failed/i.test(message)) return 'Pas de connexion à internet.';
  if (/invalid email|unable to validate email/i.test(message)) return 'Adresse e-mail invalide.';
  return message;
}

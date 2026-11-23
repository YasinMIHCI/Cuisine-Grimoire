// Petites définitions partagées, séparées de l'écran des amis (chargé à la demande).

export type Onglet = 'courrier' | 'amis' | 'profil';

/** Clé de stockage d'un code d'invitation reçu par lien, en attente de traitement. */
export const CLE_INVITATION = 'grimoire:invitation';

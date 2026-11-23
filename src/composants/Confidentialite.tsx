import { usePanneauHistorique } from '../utilitaires/historique';
import { usePiegeFocus } from '../utilitaires/focus';

/**
 * Adresse de contact affichée dans la page de confidentialité (responsable des
 * données). À renseigner avant d'ouvrir l'appli au public ; vide = non affichée.
 */
export const CONTACT_CONFIDENTIALITE = '';

/** Confidentialité et données personnelles (RGPD), en langage simple. */
export function Confidentialite({ surFermer }: { surFermer: () => void }) {
  const fermer = usePanneauHistorique(surFermer);
  const ref = usePiegeFocus<HTMLDivElement>(fermer);
  return (
    <div className="voile" onClick={fermer}>
      <div
        ref={ref}
        className="panneau panneau--defilant parchemin texte-legal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-confidentialite"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="titre-confidentialite" className="recette__section">
          Confidentialité
        </h2>
        <h3>Ce qui est enregistré</h3>
        <ul>
          <li>votre adresse e-mail et votre mot de passe (chiffré), pour vous connecter ;</li>
          <li>vos livres, recettes et photos ;</li>
          <li>si vous utilisez le cercle des amis : votre pseudo, votre avatar, vos amis, ce que vous transmettez et vos photos de réalisations.</li>
        </ul>
        <h3>Où et pourquoi</h3>
        <p>
          Les données sont gardées sur votre appareil (pour fonctionner hors ligne) et chez l’hébergeur Supabase (pour les
          retrouver sur vos autres appareils et les partager avec vos amis). Elles servent uniquement au fonctionnement de
          l’appli : ni publicité, ni revente, ni pistage.
        </p>
        <h3>Qui les voit</h3>
        <p>
          Vos recettes ne sont visibles que de vous. Un ami ne voit que ce que vous lui transmettez, votre pseudo, votre
          avatar et vos photos de réalisations des recettes qu’il possède aussi.
        </p>
        <h3>Vos droits</h3>
        <p>
          Vous pouvez modifier vos recettes et votre profil à tout moment, et supprimer définitivement votre compte et toutes
          vos données depuis le panneau « Compte ». À la déconnexion, vous pouvez aussi effacer les données gardées sur
          l’appareil.
        </p>
        {CONTACT_CONFIDENTIALITE && (
          <p>
            Pour toute question sur vos données : <a href={`mailto:${CONTACT_CONFIDENTIALITE}`}>{CONTACT_CONFIDENTIALITE}</a>.
          </p>
        )}
        <button type="button" className="bouton" onClick={fermer}>
          Fermer
        </button>
      </div>
    </div>
  );
}

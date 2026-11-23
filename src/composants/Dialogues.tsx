// Petites fenêtres de dialogue au style du grimoire, à la place des fenêtres
// du navigateur (alert, confirm, prompt), qui s'affichent mal dans l'appli
// installée. S'utilisent comme des promesses, depuis n'importe où :
//   if (await confirmer('Supprimer ?')) …
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { usePiegeFocus } from '../utilitaires/focus';

interface OptionsDialogue {
  titre?: string;
  /** Libellé du bouton de validation. */
  oui?: string;
  /** Libellé du bouton d'abandon (absent pour une simple information). */
  non?: string;
  /** Bouton de validation en rouge (action destructrice). */
  danger?: boolean;
}

interface OptionsSaisie extends OptionsDialogue {
  valeur?: string;
  multiligne?: boolean;
  /** Clavier numérique sur téléphone. */
  numerique?: boolean;
  aide?: string;
}

type Demande =
  | ({ type: 'confirmation' | 'information'; message: string; resoudre: (r: boolean) => void } & OptionsDialogue)
  | ({ type: 'saisie'; message: string; resoudre: (r: string | null) => void } & OptionsSaisie);

// --- File d'attente des dialogues (un seul affiché à la fois) ---------------
let file: Demande[] = [];
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());
const ajouter = (demande: Demande) => {
  file = [...file, demande];
  prevenir();
};
const retirer = (demande: Demande) => {
  file = file.filter((d) => d !== demande);
  prevenir();
};

/** Demande une confirmation. Renvoie vrai si l'utilisateur valide. */
export function confirmer(message: string, options: OptionsDialogue = {}): Promise<boolean> {
  return new Promise((resoudre) => ajouter({ type: 'confirmation', message, resoudre, oui: 'Confirmer', non: 'Annuler', ...options }));
}

/** Affiche un message, avec un seul bouton. */
export function informer(message: string, options: OptionsDialogue = {}): Promise<void> {
  return new Promise((resoudre) => ajouter({ type: 'information', message, resoudre: () => resoudre(), oui: 'D’accord', ...options }));
}

/** Demande un texte. Renvoie null si l'utilisateur abandonne. */
export function demanderTexte(message: string, options: OptionsSaisie = {}): Promise<string | null> {
  return new Promise((resoudre) => ajouter({ type: 'saisie', message, resoudre, oui: 'Valider', non: 'Annuler', ...options }));
}

/** À placer une fois à la racine de l'appli. */
export function Dialogues() {
  const liste = useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => file,
  );
  const demande = liste[0];
  return demande ? <Dialogue key={liste.length + demande.message} demande={demande} /> : null;
}

function Dialogue({ demande }: { demande: Demande }) {
  const [texte, setTexte] = useState(demande.type === 'saisie' ? (demande.valeur ?? '') : '');
  const reponse = useRef<boolean | string | null>(null);
  const fini = useRef(false);
  const marque = useRef(crypto.randomUUID());

  /** Rend la réponse à l'appelant, une seule fois. */
  const terminer = () => {
    if (fini.current) return;
    fini.current = true;
    retirer(demande);
    if (demande.type === 'saisie') demande.resoudre(typeof reponse.current === 'string' ? reponse.current : null);
    else demande.resoudre(reponse.current === true);
  };

  // Comme les panneaux, le dialogue occupe une entrée de l'historique : le geste
  // « retour » d'Android le referme. La réponse n'est rendue qu'une fois cette
  // entrée retirée, pour que l'appelant puisse naviguer sans conflit.
  useEffect(() => {
    window.history.pushState({ ...window.history.state, dialogue: marque.current }, '');
    const surRetour = () => {
      if (window.history.state?.dialogue !== marque.current) terminer();
    };
    window.addEventListener('popstate', surRetour);
    return () => window.removeEventListener('popstate', surRetour);
  }, []);

  const fermer = (valeur: boolean | string | null) => {
    reponse.current = valeur;
    if (window.history.state?.dialogue === marque.current) window.history.back();
    else terminer();
  };

  const ref = usePiegeFocus<HTMLFormElement>(() => fermer(demande.type === 'information' ? true : null));

  const valider = (e: FormEvent) => {
    e.preventDefault();
    fermer(demande.type === 'saisie' ? texte : true);
  };

  return (
    <div className="voile voile--dialogue" onClick={() => fermer(demande.type === 'information' ? true : null)}>
      <form
        ref={ref}
        className="panneau parchemin formulaire dialogue"
        role={demande.type === 'information' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby="dialogue-message"
        onClick={(e) => e.stopPropagation()}
        onSubmit={valider}
      >
        {demande.titre && <h2 className="recette__section">{demande.titre}</h2>}
        <p id="dialogue-message" className="dialogue__message">
          {demande.message}
        </p>
        {demande.type === 'saisie' &&
          (demande.multiligne ? (
            <textarea rows={8} aria-label={demande.message} value={texte} onChange={(e) => setTexte(e.target.value)} />
          ) : (
            <input
              type="text"
              inputMode={demande.numerique ? 'decimal' : undefined}
              aria-label={demande.message}
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
            />
          ))}
        {demande.type === 'saisie' && demande.aide && <p className="message">{demande.aide}</p>}
        <div className="formulaire__actions">
          <button type="submit" className={demande.danger ? 'bouton bouton--danger' : 'bouton bouton--principal'}>
            {demande.oui}
          </button>
          {demande.non && (
            <button type="button" className="bouton" onClick={() => fermer(null)}>
              {demande.non}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

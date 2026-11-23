import { useEffect, useState } from 'react';
import { useDepot } from '../donnees/contexte';
import { usePanneauHistorique } from '../utilitaires/historique';
import { usePiegeFocus } from '../utilitaires/focus';
import { partagerTexte, recetteEnTexte } from '../utilitaires/texte';
import { Avatar } from './Avatar';
import { useSocial } from './contexte';
import { chargerCercle, transmettre, type MembreCercle, type SourceEnvoi } from './social';

interface Props {
  source: SourceEnvoi;
  surFermer: () => void;
  /** Ouvre l'écran des amis (pour choisir un pseudo ou inviter quelqu'un). */
  surVoirAmis: () => void;
}

/** Transmettre un livre ou une recette à un ou plusieurs amis. */
export function PanneauTransmettre({ source, surFermer, surVoirAmis }: Props) {
  const fermer = usePanneauHistorique(surFermer);
  const refPiege = usePiegeFocus<HTMLDivElement>(fermer);
  const depot = useDepot();
  const social = useSocial();
  const [amis, setAmis] = useState<MembreCercle[] | null>(null);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [etat, setEtat] = useState<{ type: 'pret' } | { type: 'envoi'; texte: string } | { type: 'fini'; texte: string }>({ type: 'pret' });
  const [erreur, setErreur] = useState<string | null>(null);

  const pret = social.actif && social.disponible && social.profil?.pseudo;

  useEffect(() => {
    if (!pret) return;
    chargerCercle()
      .then((cercle) => setAmis(cercle.filter((m) => m.statut === 'acceptee')))
      .catch((e: Error) => setErreur(e.message));
  }, [pret]);

  const titre = source.type === 'recette' ? source.recette.titre : source.livre.titre;
  const nombreRecettes = source.type === 'livre' ? source.recettes.length : 1;

  const basculer = (id: string) =>
    setChoisis((actuel) => {
      const suivant = new Set(actuel);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });

  const envoyer = async () => {
    setErreur(null);
    try {
      await transmettre(depot, source, [...choisis], (texte) => setEtat({ type: 'envoi', texte }));
      const noms = amis!.filter((a) => choisis.has(a.id)).map((a) => a.pseudo);
      setEtat({
        type: 'fini',
        texte: `Transmis à ${noms.join(', ')} : la proposition attend dans ${noms.length > 1 ? 'leur' : 'son'} courrier.`,
      });
    } catch (e) {
      setErreur((e as Error).message);
      setEtat({ type: 'pret' });
    }
  };

  const enTexte = async () => {
    if (source.type !== 'recette') return;
    const resultat = await partagerTexte(source.recette.titre, recetteEnTexte(source.recette));
    if (resultat === 'copie') setErreur('Recette copiée : collez-la dans votre message.');
  };

  return (
    <div className="voile" onClick={fermer}>
      <div ref={refPiege} className="panneau panneau--defilant parchemin" role="dialog" aria-modal="true" aria-label="Transmettre" onClick={(e) => e.stopPropagation()}>
        <h2 className="recette__section">Transmettre</h2>
        <p className="message">
          {source.type === 'recette'
            ? `La recette « ${titre} » sera proposée à vos amis`
            : `Le livre « ${titre} » (${nombreRecettes} recette${nombreRecettes > 1 ? 's' : ''}) sera proposé à vos amis`}{' '}
          : s’ils l’acceptent, ils en recevront leur propre copie.
        </p>

        {!social.actif && <p className="message">Connectez-vous à un compte pour transmettre à des amis.</p>}
        {social.actif && social.disponible === false && (
          <p className="message message--erreur">La base doit être mise à jour (script supabase/03_amis.sql).</p>
        )}
        {social.actif && social.disponible && !social.profil?.pseudo && (
          <>
            <p className="message">Choisissez d’abord un pseudo pour échanger avec vos amis.</p>
            <button type="button" className="bouton" onClick={surVoirAmis}>
              Choisir mon pseudo
            </button>
          </>
        )}

        {pret && etat.type !== 'fini' && (
          <>
            {amis === null && !erreur && <p className="message">Chargement de vos amis…</p>}
            {amis?.length === 0 && (
              <>
                <p className="message">Vous n’avez pas encore d’amis dans votre cercle.</p>
                <button type="button" className="bouton" onClick={surVoirAmis}>
                  Inviter des amis
                </button>
              </>
            )}
            {amis && amis.length > 0 && (
              <ul className="liste-amis">
                {amis.map((ami) => (
                  <li key={ami.id}>
                    <label className="liste-amis__choix">
                      <input
                        type="checkbox"
                        checked={choisis.has(ami.id)}
                        onChange={() => basculer(ami.id)}
                        disabled={etat.type === 'envoi'}
                      />
                      <Avatar pseudo={ami.pseudo} avatar={ami.avatar} taille={36} />
                      <span>{ami.pseudo}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {etat.type === 'envoi' && <p className="message" role="status">{etat.texte}</p>}
            {amis && amis.length > 0 && (
              <button
                type="button"
                className="bouton bouton--principal"
                disabled={choisis.size === 0 || etat.type === 'envoi'}
                onClick={envoyer}
              >
                Transmettre{choisis.size > 0 ? ` (${choisis.size})` : ''}
              </button>
            )}
          </>
        )}

        {etat.type === 'fini' && <p className="message" role="status">{etat.texte}</p>}
        {erreur && <p className="message message--erreur" role="alert">{erreur}</p>}

        {/* Pour les proches qui n'ont pas l'appli */}
        {source.type === 'recette' && etat.type !== 'envoi' && (
          <button type="button" className="bouton" onClick={enTexte}>
            Envoyer le texte (SMS, messagerie…)
          </button>
        )}
        <button type="button" className="bouton bouton--lien" onClick={fermer}>
          {etat.type === 'fini' ? 'Fermer' : 'Annuler'}
        </button>
      </div>
    </div>
  );
}

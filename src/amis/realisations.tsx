import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Recette } from '../types';
import { usePanneauHistorique } from '../utilitaires/historique';
import { ilYa } from '../utilitaires/texte';
import { useSocial } from './contexte';
import { BaseNonAJour, chargerRealisations, publierRealisation, supprimerRealisation, type Realisation } from './social';

export interface EtatRealisations {
  /** Faux si la fonction n'est pas disponible (mode local, base pas à jour). */
  visible: boolean;
  liste: Realisation[];
  /** Vrai si la liste n'a pas pu être chargée (hors ligne…). */
  indisponible: boolean;
  recharger: () => void;
}

/** Réalisations (photos de plats) liées à une recette, chargées depuis le cloud. */
export function useRealisations(recette: Recette | undefined): EtatRealisations {
  const social = useSocial();
  const [liste, setListe] = useState<Realisation[]>([]);
  const [indisponible, setIndisponible] = useState(false);
  const [version, setVersion] = useState(0);
  const origine = recette?.origineId;
  const visible = social.actif && social.disponible === true && origine !== undefined;

  useEffect(() => {
    setListe([]);
    if (!visible || !origine) return;
    let annule = false;
    chargerRealisations(origine)
      .then((r) => {
        if (annule) return;
        setListe(r);
        setIndisponible(false);
      })
      .catch((e) => {
        if (!annule) setIndisponible(!(e instanceof BaseNonAJour));
      });
    return () => {
      annule = true;
    };
  }, [visible, origine, version]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  return useMemo(() => ({ visible, liste, indisponible, recharger }), [visible, liste, indisponible, recharger]);
}

/** Une réalisation, présentée comme une photo collée avec sa légende manuscrite. */
export function CarteRealisation({
  realisation,
  estAuteur,
  surAgrandir,
  surSupprimee,
}: {
  realisation: Realisation;
  estAuteur: boolean;
  surAgrandir: (adresse: string) => void;
  surSupprimee: () => void;
}) {
  const supprimer = async () => {
    if (!window.confirm('Supprimer cette photo et son commentaire ?')) return;
    try {
      await supprimerRealisation(realisation);
    } catch (e) {
      window.alert((e as Error).message);
    }
    surSupprimee();
  };
  const adresse = realisation.adressePhoto;
  return (
    <figure className="realisation">
      <button
        type="button"
        className="image-collee image-collee--etape"
        onClick={() => adresse && surAgrandir(adresse)}
        aria-label="Agrandir la photo"
      >
        {adresse && <img src={adresse} alt={`Réalisation de ${realisation.auteurPseudo}`} decoding="async" />}
      </button>
      <figcaption>
        <span className="realisation__auteur">
          {realisation.auteurPseudo}, {ilYa(realisation.creeLe)}
        </span>
        {realisation.commentaire && <span className="realisation__commentaire">« {realisation.commentaire} »</span>}
        {estAuteur && (
          <button type="button" className="bouton bouton--lien realisation__supprimer" onClick={supprimer}>
            Supprimer
          </button>
        )}
      </figcaption>
    </figure>
  );
}

/** Publier la photo de son plat, avec un petit commentaire. */
export function PanneauRealisation({
  recette,
  surFermer,
  surPubliee,
}: {
  recette: Recette;
  surFermer: () => void;
  surPubliee: () => void;
}) {
  const fermer = usePanneauHistorique(surFermer);
  const { uid } = useSocial();
  const [photo, setPhoto] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const refAppareil = useRef<HTMLInputElement>(null);
  const refGalerie = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) return;
    const adresse = URL.createObjectURL(photo);
    setApercu(adresse);
    return () => URL.revokeObjectURL(adresse);
  }, [photo]);

  const publier = async () => {
    if (!photo) return;
    setEnCours(true);
    setErreur(null);
    try {
      await publierRealisation(uid, recette, photo, commentaire);
      surPubliee();
      fermer();
    } catch (e) {
      setErreur((e as Error).message);
      setEnCours(false);
    }
  };

  const choisir = (champ: HTMLInputElement) => {
    const fichier = champ.files?.[0];
    champ.value = '';
    if (fichier) setPhoto(fichier);
  };

  return (
    <div className="voile" onClick={fermer}>
      <div className="panneau panneau--defilant parchemin formulaire" role="dialog" aria-label="Ma réalisation" onClick={(e) => e.stopPropagation()}>
        <h2 className="recette__section">Ma réalisation</h2>
        <p className="message">Une photo de votre « {recette.titre} », visible de vos amis qui ont cette recette.</p>
        {apercu && (
          <span className="image-collee image-collee--etape">
            <img src={apercu} alt="" />
          </span>
        )}
        <input ref={refAppareil} type="file" accept="image/*" capture="environment" hidden onChange={(e) => choisir(e.target)} />
        <input ref={refGalerie} type="file" accept="image/*" hidden onChange={(e) => choisir(e.target)} />
        <div>
          <button type="button" className="bouton bouton--petit" onClick={() => refAppareil.current?.click()}>
            Appareil photo
          </button>
          <button type="button" className="bouton bouton--petit" onClick={() => refGalerie.current?.click()}>
            Galerie
          </button>
        </div>
        <label className="champ">
          <span>Commentaire (facultatif)</span>
          <textarea rows={3} maxLength={500} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
        </label>
        {erreur && <p className="message message--erreur" role="alert">{erreur}</p>}
        <button type="button" className="bouton bouton--principal" disabled={!photo || enCours} onClick={publier}>
          {enCours ? 'Publication…' : 'Publier'}
        </button>
        <button type="button" className="bouton bouton--lien" onClick={fermer}>
          Annuler
        </button>
      </div>
    </div>
  );
}

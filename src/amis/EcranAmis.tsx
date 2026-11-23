import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PanneauCompte } from '../composants/PanneauCompte';
import { Ornement } from '../composants/Ornement';
import { confirmer } from '../composants/Dialogues';
import { ilYa } from '../utilitaires/texte';
import { Avatar } from './Avatar';
import { useSocial } from './contexte';
import { EditeurProfil } from './EditeurProfil';
import { Invitation } from './Invitation';
import { PanneauAccepter } from './PanneauAccepter';
import {
  accepterInvitation,
  chargerActivites,
  chargerCercle,
  chargerTransmissionsRecues,
  chercherProfil,
  demanderAmi,
  marquerActivitesLues,
  profilParCode,
  refuserTransmission,
  repondreAmi,
  retirerAmi,
  type Activite,
  type MembreCercle,
  type ProfilPublic,
  type TransmissionRecue,
} from './social';
import './amis.css';

export type Onglet = 'courrier' | 'amis' | 'profil';

/** Clé de stockage d'un code d'invitation reçu par lien, en attente de traitement. */
export const CLE_INVITATION = 'grimoire:invitation';

interface Props {
  ongletInitial: Onglet;
  surRetour: () => void;
  /** Ouvre la recette (de la bibliothèque) qui a cette origine. */
  surOuvrirOrigine: (origineId: string) => void;
  /** Ouvre un livre (après avoir rangé une transmission). */
  surOuvrirLivre: (livreId: string) => void;
}

/** « Cercle des amis » : courrier (transmissions, demandes, fil), amis, profil. */
export function EcranAmis({ ongletInitial, surRetour, surOuvrirOrigine, surOuvrirLivre }: Props) {
  const social = useSocial();
  const [onglet, setOnglet] = useState<Onglet>(ongletInitial);
  const sansPseudo = social.disponible && !social.profil?.pseudo;

  return (
    <main className="cadre-livre">
      <div className="feuille">
        <div className="feuille__recto parchemin">
          <div className="page page--defilante ecran-amis">
            <button type="button" className="ruban" onClick={surRetour} aria-label="Retour">
              <span>Retour</span>
            </button>
            <header className="frontispice">
              <h1 className="frontispice__titre">Cercle des amis</h1>
              <Ornement />
            </header>

            {!social.actif && <p className="message">Connectez-vous à un compte pour échanger avec vos amis.</p>}
            {social.actif && social.disponible === null && <p className="message">Ouverture du courrier…</p>}
            {social.actif && social.disponible === false && (
              <p className="message message--erreur">
                {navigator.onLine
                  ? 'La base de données doit être mise à jour : exécutez le script supabase/03_amis.sql dans Supabase.'
                  : 'Pas de connexion à internet : le cercle des amis n’est pas disponible hors ligne.'}
              </p>
            )}

            {sansPseudo && <EditeurProfil premiere />}

            {social.disponible && !sansPseudo && (
              <>
                <nav className="onglets" aria-label="Rubriques">
                  {(
                    [
                      ['courrier', 'Courrier', social.compteurs.transmissions + social.compteurs.demandes + social.compteurs.nouveautes],
                      ['amis', 'Amis', 0],
                      ['profil', 'Profil', 0],
                    ] as const
                  ).map(([cle, libelle, nombre]) => (
                    <button
                      key={cle}
                      type="button"
                      className="onglet"
                      aria-pressed={onglet === cle}
                      onClick={() => setOnglet(cle)}
                    >
                      {libelle}
                      {nombre > 0 && <span className="onglet__nombre">{nombre}</span>}
                    </button>
                  ))}
                </nav>
                {onglet === 'courrier' && <OngletCourrier surOuvrirOrigine={surOuvrirOrigine} surOuvrirLivre={surOuvrirLivre} />}
                {onglet === 'amis' && <OngletAmis />}
                {onglet === 'profil' && <OngletProfil />}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// ================================================================ Courrier

function OngletCourrier({ surOuvrirOrigine, surOuvrirLivre }: Pick<Props, 'surOuvrirOrigine' | 'surOuvrirLivre'>) {
  const social = useSocial();
  const [transmissions, setTransmissions] = useState<TransmissionRecue[] | null>(null);
  const [demandes, setDemandes] = useState<MembreCercle[]>([]);
  const [activites, setActivites] = useState<Activite[]>([]);
  const [aRanger, setARanger] = useState<TransmissionRecue | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const [t, cercle, a] = await Promise.all([
        chargerTransmissionsRecues(social.uid),
        chargerCercle(),
        chargerActivites(),
      ]);
      setTransmissions(t);
      setDemandes(cercle.filter((m) => m.statut === 'en_attente' && m.sens === 'recue'));
      setActivites(a);
      setErreur(null);
      // Le fil a été vu : les nouveautés sont marquées comme lues
      if (a.some((x) => !x.lue)) await marquerActivitesLues();
      await social.rafraichir();
    } catch (e) {
      setErreur((e as Error).message);
    }
  }, [social]);

  useEffect(() => {
    void charger();
    // (chargement à l'ouverture de l'onglet)
  }, []);

  const agir = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (e) {
      setErreur((e as Error).message);
    }
    await charger();
  };

  if (!transmissions && !erreur) return <p className="message">Ouverture du courrier…</p>;
  const vide = transmissions?.length === 0 && demandes.length === 0 && activites.length === 0;

  return (
    <div className="courrier">
      {erreur && <p className="message message--erreur" role="alert">{erreur}</p>}

      {transmissions && transmissions.length > 0 && (
        <section>
          <h2 className="recette__section">Transmissions reçues</h2>
          {transmissions.map((t) => (
            <article key={t.id} className="carte-courrier">
              <p>
                <strong>{t.expediteurPseudo}</strong> vous transmet {t.type === 'livre' ? 'le livre' : 'la recette'}{' '}
                <em>« {t.titre} »</em>
                {t.type === 'livre' && ` (${t.contenu.recettes.length} recette${t.contenu.recettes.length > 1 ? 's' : ''})`}.
              </p>
              <p className="carte-courrier__date">{ilYa(t.creeLe)}</p>
              <div className="carte-courrier__actions">
                <button type="button" className="bouton bouton--petit bouton--principal" onClick={() => setARanger(t)}>
                  Accepter
                </button>
                <button
                  type="button"
                  className="bouton bouton--petit"
                  onClick={async () => {
                    if (await confirmer(`Refuser « ${t.titre} » ?`, { oui: 'Refuser' })) void agir(() => refuserTransmission(t.id));
                  }}
                >
                  Refuser
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {demandes.length > 0 && (
        <section>
          <h2 className="recette__section">Demandes d’amis</h2>
          {demandes.map((d) => (
            <article key={d.amitieId} className="carte-courrier carte-courrier--ami">
              <Avatar pseudo={d.pseudo} avatar={d.avatar} />
              <p>
                <strong>{d.pseudo}</strong> souhaite rejoindre votre cercle.
              </p>
              <div className="carte-courrier__actions">
                <button type="button" className="bouton bouton--petit bouton--principal" onClick={() => void agir(() => repondreAmi(d.amitieId, true))}>
                  Accepter
                </button>
                <button type="button" className="bouton bouton--petit" onClick={() => void agir(() => repondreAmi(d.amitieId, false))}>
                  Refuser
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {activites.length > 0 && (
        <section>
          <h2 className="recette__section">Fil d’activité</h2>
          <ul className="fil">
            {activites.map((a) => (
              <li key={a.id} className={a.lue ? 'fil__ligne' : 'fil__ligne fil__ligne--nouvelle'}>
                <span className="fil__texte">{texteActivite(a)}</span>
                <span className="fil__date">{ilYa(a.creeLe)}</span>
                {a.type === 'realisation' && a.details.origine_id && (
                  <button type="button" className="bouton bouton--petit" onClick={() => surOuvrirOrigine(a.details.origine_id!)}>
                    Voir
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {vide && <p className="sommaire__vide">Aucun courrier pour l’instant.</p>}

      {aRanger && (
        <PanneauAccepter
          transmission={aRanger}
          surFermer={() => setARanger(null)}
          surRangee={(livreId) => {
            void charger();
            // On laisse le panneau se fermer, puis on ouvre le livre où la copie est rangée
            setTimeout(async () => {
              if (await confirmer('Copie rangée ! Ouvrir le livre maintenant ?', { oui: 'Ouvrir le livre', non: 'Plus tard' })) surOuvrirLivre(livreId);
            }, 350);
          }}
        />
      )}
    </div>
  );
}

function texteActivite(a: Activite) {
  const qui = <strong>{a.acteurPseudo ?? 'Un ancien ami'}</strong>;
  const quoi = a.details.type === 'livre' ? 'le livre' : 'la recette';
  const titre = a.details.titre ? <em>« {a.details.titre} »</em> : null;
  switch (a.type) {
    case 'demande_ami':
      return <>{qui} souhaite rejoindre votre cercle.</>;
    case 'ami_accepte':
      return <>{qui} fait désormais partie de votre cercle.</>;
    case 'transmission':
      return <>{qui} vous a transmis {quoi} {titre}.</>;
    case 'transmission_acceptee':
      return <>{qui} a accepté {quoi} {titre}.</>;
    case 'realisation':
      return <>{qui} a publié une photo de sa réalisation : {titre}.</>;
    default:
      return <>{qui}</>;
  }
}

// =================================================================== Amis

function OngletAmis() {
  const [cercle, setCercle] = useState<MembreCercle[] | null>(null);
  const [recherche, setRecherche] = useState('');
  const [trouve, setTrouve] = useState<ProfilPublic | null | 'aucun'>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<{ code: string; profil: ProfilPublic | null } | null>(null);
  const social = useSocial();

  const charger = useCallback(async () => {
    try {
      setCercle(await chargerCercle());
    } catch (e) {
      setErreur((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void charger();
    // Lien d'invitation ouvert avant d'arriver ici
    const code = localStorage.getItem(CLE_INVITATION);
    if (code) {
      profilParCode(code)
        .then((profil) => setInvitation({ code, profil }))
        .catch((e: Error) => setErreur(e.message));
    }
  }, [charger]);

  const agir = async (action: () => Promise<unknown>, message?: string) => {
    setErreur(null);
    setInfo(null);
    try {
      await action();
      if (message) setInfo(message);
    } catch (e) {
      setErreur((e as Error).message);
    }
    await charger();
    await social.rafraichir();
  };

  const chercher = async (evenement: FormEvent) => {
    evenement.preventDefault();
    if (!recherche.trim()) return;
    setInfo(null);
    setErreur(null);
    try {
      setTrouve((await chercherProfil(recherche)) ?? 'aucun');
    } catch (e) {
      setErreur((e as Error).message);
    }
  };

  const demander = (profil: ProfilPublic) =>
    agir(async () => {
      const resultat = await demanderAmi(profil.id);
      setTrouve({ ...profil, relation: resultat === 'acceptee' || resultat === 'deja_amis' ? 'ami' : 'demande_envoyee' });
      setInfo(
        resultat === 'acceptee'
          ? `${profil.pseudo} fait maintenant partie de votre cercle.`
          : `Demande envoyée à ${profil.pseudo}.`,
      );
    });

  const amis = cercle?.filter((m) => m.statut === 'acceptee') ?? [];
  const envoyees = cercle?.filter((m) => m.statut === 'en_attente' && m.sens === 'envoyee') ?? [];

  return (
    <div className="onglet-amis">
      {invitation && (
        <section className="carte-courrier carte-courrier--invitation">
          {invitation.profil && invitation.profil.relation !== 'moi' ? (
            <>
              <Avatar pseudo={invitation.profil.pseudo} avatar={invitation.profil.avatar} taille={56} />
              <p>
                <strong>{invitation.profil.pseudo}</strong>{' '}
                {invitation.profil.relation === 'ami' ? 'fait déjà partie de votre cercle.' : 'vous invite à rejoindre son cercle.'}
              </p>
              {invitation.profil.relation !== 'ami' && (
                <button
                  type="button"
                  className="bouton bouton--principal"
                  onClick={() =>
                    void agir(async () => {
                      await accepterInvitation(invitation.code);
                      localStorage.removeItem(CLE_INVITATION);
                      setInvitation(null);
                    }, `Vous êtes maintenant ami avec ${invitation.profil!.pseudo} !`)
                  }
                >
                  Rejoindre son cercle
                </button>
              )}
            </>
          ) : (
            <p>{invitation.profil ? 'C’est votre propre lien d’invitation.' : 'Ce lien d’invitation n’est plus valable.'}</p>
          )}
          <button
            type="button"
            className="bouton bouton--lien"
            onClick={() => {
              localStorage.removeItem(CLE_INVITATION);
              setInvitation(null);
            }}
          >
            Ignorer
          </button>
        </section>
      )}

      {info && <p className="message" role="status">{info}</p>}
      {erreur && <p className="message message--erreur" role="alert">{erreur}</p>}

      <section>
        <h2 className="recette__section">Ajouter un ami</h2>
        <form className="formulaire ligne-copie" onSubmit={chercher}>
          <input
            type="search"
            placeholder="Pseudo exact de votre ami"
            aria-label="Pseudo à chercher"
            autoCapitalize="none"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value);
              setTrouve(null);
            }}
          />
          <button type="submit" className="bouton bouton--petit">
            Chercher
          </button>
        </form>
        {trouve === 'aucun' && <p className="message">Aucun grimoire à ce nom.</p>}
        {trouve && trouve !== 'aucun' && (
          <div className="carte-courrier carte-courrier--ami">
            <Avatar pseudo={trouve.pseudo} avatar={trouve.avatar} />
            <p>
              <strong>{trouve.pseudo}</strong>
            </p>
            <div className="carte-courrier__actions">
              {trouve.relation === 'aucune' && (
                <button type="button" className="bouton bouton--petit bouton--principal" onClick={() => void demander(trouve)}>
                  Envoyer une demande
                </button>
              )}
              {trouve.relation === 'demande_recue' && (
                <button type="button" className="bouton bouton--petit bouton--principal" onClick={() => void demander(trouve)}>
                  Accepter sa demande
                </button>
              )}
              {trouve.relation === 'demande_envoyee' && <span className="message">Demande envoyée</span>}
              {trouve.relation === 'ami' && <span className="message">Déjà dans votre cercle</span>}
              {trouve.relation === 'moi' && <span className="message">C’est vous !</span>}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="recette__section">Mon lien d’invitation</h2>
        <p className="message">
          Faites scanner ce QR code avec l’appareil photo d’un ami, ou envoyez-lui le lien : en l’ouvrant, il rejoint votre
          cercle.
        </p>
        <Invitation />
      </section>

      <section>
        <h2 className="recette__section">Mon cercle</h2>
        {cercle === null && !erreur && <p className="message">Chargement…</p>}
        {cercle && amis.length === 0 && <p className="message">Votre cercle est encore vide.</p>}
        <ul className="liste-amis">
          {amis.map((ami) => (
            <li key={ami.id} className="liste-amis__ligne">
              <Avatar pseudo={ami.pseudo} avatar={ami.avatar} taille={40} />
              <span>{ami.pseudo}</span>
              <button
                type="button"
                className="bouton bouton--petit"
                onClick={async () => {
                  if (await confirmer(`Retirer ${ami.pseudo} de votre cercle ?`, { oui: 'Retirer', danger: true })) void agir(() => retirerAmi(ami.id));
                }}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
        {envoyees.length > 0 && (
          <>
            <h3 className="sous-titre">Demandes envoyées</h3>
            <ul className="liste-amis">
              {envoyees.map((m) => (
                <li key={m.id} className="liste-amis__ligne">
                  <Avatar pseudo={m.pseudo} avatar={m.avatar} taille={40} />
                  <span>{m.pseudo}</span>
                  <button type="button" className="bouton bouton--petit" onClick={() => void agir(() => retirerAmi(m.id))}>
                    Annuler
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

// ================================================================= Profil

function OngletProfil() {
  const [compteOuvert, setCompteOuvert] = useState(false);
  return (
    <div>
      <EditeurProfil />
      <button type="button" className="bouton" onClick={() => setCompteOuvert(true)}>
        Compte et synchronisation
      </button>
      {compteOuvert && <PanneauCompte surFermer={() => setCompteOuvert(false)} />}
    </div>
  );
}

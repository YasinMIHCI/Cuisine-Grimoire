import './cuisine.css';
import { formaterCompte } from './minuteurs';
import { arreterMinuteur, useMinuteurs } from './minuteursEnCours';

/** Liste des minuteurs en cours (dans le mode cuisine, ou en bas de l'écran ailleurs). */
export function ListeMinuteurs({ classe = 'cuisine__minuteurs' }: { classe?: string }) {
  const { minuteurs, maintenant } = useMinuteurs();
  if (minuteurs.length === 0) return null;
  return (
    <ul className={classe} aria-label="Minuteurs">
      {minuteurs.map((m) => (
        <li key={m.id} className={m.sonne ? 'minuteur minuteur--fini' : 'minuteur'}>
          <span>{m.libelle}</span>
          <strong role={m.sonne ? 'alert' : undefined}>{m.sonne ? 'Terminé !' : formaterCompte((m.fin - maintenant) / 1000)}</strong>
          <button type="button" aria-label={`Arrêter le minuteur ${m.libelle}`} onClick={() => arreterMinuteur(m.id)}>
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Bandeau flottant : les minuteurs restent visibles hors du mode cuisine. */
export function BandeauMinuteurs() {
  return <ListeMinuteurs classe="bandeau-minuteurs" />;
}

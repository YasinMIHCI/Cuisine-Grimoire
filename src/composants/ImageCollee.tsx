import { useAdresseImage } from '../donnees/contexte';

interface Props {
  /** Identifiant de l'image. */
  id: string;
  /** Format : photo principale, image d'étape, vignette de galerie ou de sommaire. */
  format: 'principale' | 'etape' | 'galerie' | 'vignette';
  /** Appelé au tap (pour agrandir). Sans cela, l'image n'est pas cliquable. */
  surClic?: () => void;
  alt?: string;
}

/**
 * Photo affichée comme une illustration collée dans le grimoire : bord clair,
 * légère inclinaison, ombre. La taille est fixée par le format (et non par
 * l'image) pour que la pagination connaisse sa hauteur avant le chargement.
 */
export function ImageCollee({ id, format, surClic, alt = '' }: Props) {
  const adresse = useAdresseImage(id);
  const image = adresse ? <img src={adresse} alt={alt} decoding="async" draggable={false} /> : null;
  const classe = `image-collee image-collee--${format}`;
  return surClic ? (
    <button type="button" className={classe} onClick={surClic} aria-label="Agrandir l’image">
      {image}
    </button>
  ) : (
    <span className={classe}>{image}</span>
  );
}

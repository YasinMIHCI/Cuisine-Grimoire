import { useLayoutEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import type { ApparenceLivre } from '../types';
import { Couverture } from '../composants/Couverture';
import { DecorTable } from './DecorTable';
import { PageRunes } from './PageRunes';
import './intro.css';

interface Props {
  /** Le livre dont on montre la couverture (dernier livre ouvert). */
  livre: ApparenceLivre;
  /** Miniature de son image de couverture, s'il en a une. */
  miniature?: string | null;
  /** Appelé quand l'intro est terminée : l'appli peut être utilisée. */
  surFin: () => void;
}

// Moments clés de l'animation (en secondes)
const T_IMPACT = 1.5;
const T_OUVERTURE = 1.72;
const T_FEUILLES = 2.1;
const T_ZOOM = 2.7;
const T_FLASH = 4.1;
const T_REVELATION = 4.55;
const T_DISSIPATION = 4.9;

const NB_POUSSIERES = 26;
const NB_ETINCELLES = 12;
/** Feuilles qui défilent sans fin : quelques feuilles réutilisées en boucle. */
const NB_FEUILLES = 6;
const DUREE_FEUILLE = 0.55;
const ECART_FEUILLES = 0.13;

/**
 * Animation d'introduction, jouée à chaque lancement (~5,6 s) :
 * chute du livre vue du dessus, sur une table garnie d'objets → impact (poussière, secousse) → le livre
 * s'ouvre et ses pages de runes défilent sans fin → zoom sur ce défilement
 * → flash → l'appli apparaît.
 *
 * Seuls `transform` et `opacity` sont animés (GSAP), pour rester à 60 images/s.
 * Un tap pendant l'intro saute directement au flash.
 */
export function Intro({ livre, miniature, surFin }: Props) {
  const refScene = useRef<HTMLDivElement>(null);
  const refChronologie = useRef<gsap.core.Timeline | null>(null);
  const refSurFin = useRef(surFin);
  refSurFin.current = surFin;

  // Caractéristiques aléatoires de chaque volute de poussière et étincelle
  const poussieres = useMemo(
    () =>
      Array.from({ length: NB_POUSSIERES }, (_, i) => {
        // Les volutes partent surtout vers les côtés (gauche / droite)
        const cote = i % 2 === 0 ? 0 : Math.PI;
        return {
          angle: cote + (Math.random() - 0.5) * 2.3,
          distance: 0.5 + Math.random() * 1.1,
          taille: 0.22 + Math.random() * 0.33,
          duree: 0.9 + Math.random() * 0.7,
        };
      }),
    [],
  );
  const etincelles = useMemo(
    () =>
      Array.from({ length: NB_ETINCELLES }, () => ({
        gauche: 12 + Math.random() * 76,
        haut: 25 + Math.random() * 60,
        montee: 0.15 + Math.random() * 0.25,
        retard: Math.random() * 1.2,
      })),
    [],
  );

  useLayoutEffect(() => {
    const scene = refScene.current;
    if (!scene) return;
    let annule = false;
    const terminer = () => refSurFin.current();

    const contexte = gsap.context(() => {
      const chrono = gsap.timeline({ paused: true, onComplete: terminer });
      refChronologie.current = chrono;
      // En développement, la chronologie est accessible depuis la console du navigateur
      if (import.meta.env.DEV) Object.assign(window, { chronoIntro: chrono });

      // --- Version courte (prefers-reduced-motion) : couverture puis fondu ----
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set('.intro__ombre', { opacity: 0.5 });
        chrono.to(scene, { opacity: 0, duration: 0.5, ease: 'none' }, 0.8);
        return;
      }

      const livreEl = scene.querySelector<HTMLElement>('.intro__livre')!;
      const largeur = livreEl.offsetWidth;
      const hauteur = livreEl.offsetHeight;

      // 1. Chute : le livre s'éloigne de la caméra (il rapetisse) en tournoyant
      chrono.fromTo(
        livreEl,
        {
          scale: 3.4,
          rotation: -32,
          rotationX: 16,
          rotationY: -12,
          xPercent: -18,
          yPercent: -12,
          transformPerspective: 900,
        },
        {
          scale: 1,
          rotation: 4,
          rotationX: 0,
          rotationY: 0,
          xPercent: 0,
          yPercent: 0,
          duration: T_IMPACT,
          ease: 'power2.in', // accélération de la chute
          force3D: true,
        },
        0,
      );
      chrono.fromTo(livreEl, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0);
      // L'ombre au sol se resserre et fonce à mesure que le livre approche
      chrono.fromTo(
        '.intro__ombre',
        { scale: 1.9, x: largeur * 0.3, y: hauteur * 0.32, opacity: 0 },
        { scale: 1.06, x: largeur * 0.03, y: hauteur * 0.03, opacity: 0.65, duration: T_IMPACT, ease: 'power2.in' },
        0,
      );

      // 2. Impact : écrasement, secousse de caméra, onde et nuage de poussière
      chrono.to(livreEl, { scale: 0.96, rotation: 0, duration: 0.07, ease: 'power1.out' }, T_IMPACT);
      chrono.to(livreEl, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, T_IMPACT + 0.07);
      chrono.to(
        '.intro__camera',
        {
          keyframes: [
            { x: -10, y: 7 },
            { x: 9, y: -6 },
            { x: -6, y: -4 },
            { x: 4, y: 3 },
            { x: -2, y: 1 },
            { x: 0, y: 0 },
          ],
          duration: 0.45,
          ease: 'none',
        },
        T_IMPACT,
      );
      // Les objets de la table sursautent sous le choc
      gsap.utils.toArray<HTMLElement>('.intro__objet').forEach((objet, i) => {
        chrono.to(
          objet,
          { keyframes: [{ y: -7 - (i % 3) * 3, scale: 1.05 }, { y: 0, scale: 1 }], duration: 0.32, ease: 'power1.out' },
          T_IMPACT + 0.02 + (i % 4) * 0.02,
        );
      });
      // …et les plus proches du livre sont chassés vers l'extérieur par le souffle
      gsap.utils.toArray<SVGGElement>('.intro__ejectable').forEach((objet) => {
        chrono.to(
          objet,
          {
            x: Number(objet.dataset.dx),
            y: Number(objet.dataset.dy),
            rotation: Number(objet.dataset.rot),
            transformOrigin: '50% 50%',
            duration: 0.6,
            ease: 'power3.out', // départ vif, puis l'objet glisse et s'arrête
          },
          T_IMPACT + 0.02,
        );
      });
      chrono.fromTo(
        '.intro__onde',
        { scale: 0.6, opacity: 0.55 },
        { scale: 2.8, opacity: 0, duration: 0.9, ease: 'power2.out' },
        T_IMPACT,
      );
      gsap.utils.toArray<HTMLElement>('.intro__poussiere').forEach((volute, i) => {
        const p = poussieres[i];
        const x0 = Math.cos(p.angle) * largeur * 0.5;
        const y0 = Math.sin(p.angle) * hauteur * 0.5;
        chrono.fromTo(
          volute,
          { x: x0, y: y0, scale: 0.3 },
          {
            x: x0 + Math.cos(p.angle) * largeur * p.distance,
            y: y0 + Math.sin(p.angle) * largeur * p.distance * 0.6,
            scale: 1.6,
            duration: p.duree,
            ease: 'power2.out',
          },
          T_IMPACT,
        );
        chrono.to(volute, { opacity: 0.5, duration: 0.1 }, T_IMPACT);
        chrono.to(volute, { opacity: 0, duration: p.duree - 0.1, ease: 'power1.in' }, T_IMPACT + 0.1);
      });

      // 3. Sous le choc, la couverture bascule : le livre s'ouvre sur les runes.
      //    Le livre glisse d'une demi-largeur pour que la double page reste centrée.
      chrono.fromTo(
        '.intro__plat',
        { rotationY: 0, transformPerspective: 1100 },
        { rotationY: -180, duration: 1, ease: 'power2.out', force3D: true },
        T_OUVERTURE,
      );
      chrono.to(livreEl, { xPercent: 50, duration: 1, ease: 'power2.out' }, T_OUVERTURE);
      chrono.to('.intro__ombre', { scaleX: 2.1, x: 0, duration: 1, ease: 'power2.out' }, T_OUVERTURE);

      // Les pages se mettent à défiler sans fin, comme feuilletées par un souffle.
      // Chaque passage réutilise une des feuilles ; l'ordre d'empilement est mis à
      // jour au départ (sous les feuilles déjà en vol) et à mi-course, quand la
      // feuille est de profil (elle se pose alors par-dessus les précédentes).
      const feuilles = gsap.utils.toArray<HTMLElement>('.intro__feuille');
      gsap.set(feuilles, { transformPerspective: 1100 });
      for (let k = 0; T_FEUILLES + k * ECART_FEUILLES < T_REVELATION; k++) {
        const feuille = feuilles[k % feuilles.length];
        const debut = T_FEUILLES + k * ECART_FEUILLES;
        chrono.set(feuille, { rotationY: 0, opacity: 1, zIndex: 500 - k }, debut);
        chrono.to(feuille, { rotationY: -180, duration: DUREE_FEUILLE, ease: 'sine.inOut', force3D: true }, debut);
        chrono.set(feuille, { zIndex: 500 + k }, debut + DUREE_FEUILLE / 2);
      }

      // Touches magiques : lueur dorée sur les pages et étincelles qui montent
      chrono.to('.intro__lueur', { opacity: 0.5, duration: 1.6, ease: 'power1.in' }, T_FEUILLES + 0.3);
      gsap.utils.toArray<HTMLElement>('.intro__etincelle').forEach((etincelle, i) => {
        const e = etincelles[i];
        const debut = T_FEUILLES + e.retard;
        chrono.fromTo(etincelle, { y: 0 }, { y: -hauteur * e.montee, duration: 1.3, ease: 'power1.out' }, debut);
        chrono.to(etincelle, { opacity: 1, duration: 0.3 }, debut);
        chrono.to(etincelle, { opacity: 0, duration: 0.8 }, debut + 0.5);
      });

      // 4. La caméra plonge vers les pages qui défilent
      const centreX = scene.clientWidth / 2 + largeur * 0.2;
      const zoom = Math.max(scene.clientWidth / largeur, scene.clientHeight / hauteur) * 1.2;
      gsap.set('.intro__camera', { transformOrigin: `${centreX}px 50%` });
      chrono.to(
        '.intro__camera',
        { scale: zoom, duration: T_REVELATION - T_ZOOM, ease: 'power2.in', force3D: true },
        T_ZOOM,
      );

      // 5. Flash blanc doré plein écran
      chrono.addLabel('flash', T_FLASH);
      chrono.fromTo('.intro__flash', { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.in' }, T_FLASH);

      // 6. Derrière le flash, on retire la scène : l'appli est dessous.
      //    Le flash reste un instant à 99 % d'opacité : comme il n'est plus tout
      //    à fait opaque, le navigateur dessine l'appli dessous pendant ce temps,
      //    et la dissipation qui suit se fait sans à-coup.
      chrono.set('.intro__camera', { autoAlpha: 0 }, T_REVELATION);
      chrono.set(scene, { backgroundColor: 'transparent' }, T_REVELATION);
      chrono.set('.intro__flash', { opacity: 0.99 }, T_REVELATION);
      chrono.to('.intro__flash', { opacity: 0, duration: 0.7, ease: 'power1.out' }, T_DISSIPATION);
    }, scene);

    // On attend la police du titre et deux images, pour démarrer sans à-coup
    const attente = new Promise((resoudre) => setTimeout(resoudre, 700));
    Promise.race([document.fonts?.ready ?? attente, attente]).then(() => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!annule) refChronologie.current?.play();
        }),
      );
    });

    return () => {
      annule = true;
      contexte.revert();
    };
  }, [poussieres, etincelles]);

  /** Un tap pendant l'intro saute directement au flash final. */
  const passer = () => {
    const chrono = refChronologie.current;
    if (chrono && chrono.labels.flash !== undefined && chrono.time() < chrono.labels.flash) {
      chrono.play('flash');
    }
  };

  return (
    <div className="intro" ref={refScene} onPointerDown={passer} role="presentation">
      {/* La « caméra » : tout ce qu'elle contient tremble et zoome ensemble */}
      <div className="intro__camera">
        <div className="intro__sol" />
        <DecorTable />
        <div className="intro__ombre" />
        <div className="intro__onde" />
        {poussieres.map((p, i) => (
          <div
            key={i}
            className="intro__poussiere"
            style={{ width: `${p.taille * 100}vmin`, height: `${p.taille * 100}vmin` }}
          />
        ))}

        <div className="intro__livre">
          {/* Bloc de pages, avec une page de runes sur le dessus */}
          <div className="intro__page">
            <PageRunes />
          </div>
          {/* Plat de couverture : pivote autour du dos (bord gauche) */}
          <div className="intro__plat">
            <div className="intro__plat-face">
              <Couverture livre={livre} adresseImage={miniature} />
            </div>
            <div className="intro__plat-face intro__plat-face--interieur" style={{ '--cuir-livre': livre.couleurCuir } as React.CSSProperties} />
          </div>
          {/* Feuilles qui défilent : chacune pivote autour du dos, de droite à gauche */}
          <div className="intro__feuilles">
            {Array.from({ length: NB_FEUILLES }, (_, i) => (
              <div key={i} className="intro__feuille">
                <PageRunes graine={11 + i * 13} />
              </div>
            ))}
            <div className="intro__lueur" />
            {etincelles.map((e, i) => (
              <span key={i} className="intro__etincelle" style={{ left: `${e.gauche}%`, top: `${e.haut}%` }} />
            ))}
          </div>
        </div>
      </div>

      <div className="intro__flash" />
    </div>
  );
}

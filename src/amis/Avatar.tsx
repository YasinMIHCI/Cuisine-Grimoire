/** Avatar rond façon sceau de cire : la photo, ou l'initiale du pseudo. */
export function Avatar({ pseudo, avatar, taille = 44 }: { pseudo: string | null; avatar: string | null; taille?: number }) {
  return (
    <span className="avatar" style={{ width: taille, height: taille, fontSize: taille * 0.45 }} aria-hidden="true">
      {avatar ? <img src={avatar} alt="" /> : (pseudo?.[0] ?? '?').toUpperCase()}
    </span>
  );
}

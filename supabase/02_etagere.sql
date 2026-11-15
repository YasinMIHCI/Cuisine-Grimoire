-- ============================================================================
-- Grimoire de recettes — étape (e) : image de couverture des livres
-- À coller dans Supabase : SQL Editor → New query → Run. Peut être relancé.
-- ============================================================================

-- Identifiant de l'image de couverture (rangée dans le stockage « recettes »)
alter table public.livres add column if not exists image_couverture text;

-- Demande à l'API de prendre en compte la nouvelle colonne tout de suite
notify pgrst, 'reload schema';

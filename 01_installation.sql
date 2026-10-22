CREATE TABLE IF NOT EXISTS public.niveaux (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profils (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'etudiant',
  nom_complet text,
  matricule text,
  niveau_id uuid REFERENCES public.niveaux(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niveau_id uuid NOT NULL REFERENCES public.niveaux(id) ON DELETE CASCADE,
  titre text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ressources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  titre text NOT NULL,
  type text NOT NULL DEFAULT 'pdf',
  chemin text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etudiant_id uuid NOT NULL REFERENCES public.profils(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  valeur numeric(5,2) NOT NULL,
  session text NOT NULL DEFAULT 'normale',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pv (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  niveau_id uuid NOT NULL REFERENCES public.niveaux(id) ON DELETE CASCADE,
  etudiant_id uuid REFERENCES public.profils(id) ON DELETE CASCADE,
  titre text NOT NULL,
  chemin text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profils ADD COLUMN IF NOT EXISTS telephone text;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS commentaire text;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS coefficient numeric(4,2) NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS notes_unique_etudiant_module_session
ON public.notes (etudiant_id, module_id, session);

INSERT INTO storage.buckets (id, name, public)
VALUES ('cours', 'cours', false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.est_docteur()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profils
    WHERE id = auth.uid() AND role = 'docteur'
  );
END $$;

CREATE OR REPLACE FUNCTION public.niveau_etudiant()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_niveau uuid;
BEGIN
  SELECT niveau_id INTO v_niveau FROM public.profils WHERE id = auth.uid();
  RETURN v_niveau;
END $$;

CREATE OR REPLACE FUNCTION public.creer_profil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profils (id, nom_complet)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nom_complet', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.creer_profil();

ALTER TABLE public.niveaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profils ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ressources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pv ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS niveaux_lecture ON public.niveaux;
CREATE POLICY niveaux_lecture ON public.niveaux
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS niveaux_docteur ON public.niveaux;
CREATE POLICY niveaux_docteur ON public.niveaux
FOR ALL TO authenticated
USING (public.est_docteur())
WITH CHECK (public.est_docteur());

DROP POLICY IF EXISTS profils_lecture ON public.profils;
CREATE POLICY profils_lecture ON public.profils
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.est_docteur());

DROP POLICY IF EXISTS profils_docteur ON public.profils;
CREATE POLICY profils_docteur ON public.profils
FOR ALL TO authenticated
USING (public.est_docteur())
WITH CHECK (public.est_docteur());

DROP POLICY IF EXISTS modules_lecture ON public.modules;
CREATE POLICY modules_lecture ON public.modules
FOR SELECT TO authenticated
USING (public.est_docteur() OR niveau_id = public.niveau_etudiant());

DROP POLICY IF EXISTS modules_docteur ON public.modules;
CREATE POLICY modules_docteur ON public.modules
FOR ALL TO authenticated
USING (public.est_docteur())
WITH CHECK (public.est_docteur());

DROP POLICY IF EXISTS ressources_lecture ON public.ressources;
CREATE POLICY ressources_lecture ON public.ressources
FOR SELECT TO authenticated
USING (
  public.est_docteur()
  OR EXISTS (
    SELECT 1 FROM public.modules m
    WHERE m.id = ressources.module_id
    AND m.niveau_id = public.niveau_etudiant()
  )
);

DROP POLICY IF EXISTS ressources_docteur ON public.ressources;
CREATE POLICY ressources_docteur ON public.ressources
FOR ALL TO authenticated
USING (public.est_docteur())
WITH CHECK (public.est_docteur());

DROP POLICY IF EXISTS notes_lecture ON public.notes;
CREATE POLICY notes_lecture ON public.notes
FOR SELECT TO authenticated
USING (etudiant_id = auth.uid() OR public.est_docteur());

DROP POLICY IF EXISTS notes_docteur ON public.notes;
CREATE POLICY notes_docteur ON public.notes
FOR ALL TO authenticated
USING (public.est_docteur())
WITH CHECK (public.est_docteur());

DROP POLICY IF EXISTS pv_lecture ON public.pv;
CREATE POLICY pv_lecture ON public.pv
FOR SELECT TO authenticated
USING (
  public.est_docteur()
  OR etudiant_id = auth.uid()
  OR (etudiant_id IS NULL AND niveau_id = public.niveau_etudiant())
);

DROP POLICY IF EXISTS pv_docteur ON public.pv;
CREATE POLICY pv_docteur ON public.pv
FOR ALL TO authenticated
USING (public.est_docteur())
WITH CHECK (public.est_docteur());

DROP POLICY IF EXISTS cours_lecture ON storage.objects;
CREATE POLICY cours_lecture ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'cours'
  AND (
    public.est_docteur()
    OR (storage.foldername(name))[1] = public.niveau_etudiant()::text
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

DROP POLICY IF EXISTS cours_docteur ON storage.objects;
CREATE POLICY cours_docteur ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'cours' AND public.est_docteur())
WITH CHECK (bucket_id = 'cours' AND public.est_docteur());

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.niveaux TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profils TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ressources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pv TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'est_docteur'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.est_docteur() TO authenticated;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'niveau_etudiant'
  ) THEN
    GRANT EXECUTE ON FUNCTION public.niveau_etudiant() TO authenticated;
  END IF;
END $$;

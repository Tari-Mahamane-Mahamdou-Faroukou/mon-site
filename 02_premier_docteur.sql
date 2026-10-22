UPDATE public.profils
SET role = 'docteur'
WHERE id = (SELECT id FROM auth.users WHERE email = 'EMAIL_DU_DOCTEUR');

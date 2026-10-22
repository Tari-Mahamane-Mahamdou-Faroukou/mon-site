# Site de cours du docteur

Site statique (HTML, CSS, JavaScript) avec Supabase pour la connexion, la base de données et les fichiers.

## 1. Supabase
1. Créez un projet sur supabase.com.
2. SQL Editor : collez et exécutez `01_installation.sql`.
3. Authentication > Users > Add user : créez le compte du docteur.
4. Ouvrez `02_premier_docteur.sql`, remplacez `EMAIL_DU_DOCTEUR` par son e-mail, puis exécutez.
5. Project Settings > API : copiez l'URL du projet et la clé `anon public`.
6. Authentication > Providers > Email : désactivez « Confirm email » si les étudiants doivent entrer sans confirmer leur e-mail.

## 2. Configuration
Dans `config.js`, remplacez l'URL et la clé anon (cette clé est publique, la sécurité vient des règles RLS du script SQL).

## 3. GitHub
```
git init
git add .
git commit -m "Site de cours"
git branch -M main
git remote add origin https://github.com/VOTRE_COMPTE/site-docteur.git
git push -u origin main
```

## 4. Vercel
1. vercel.com > Add New > Project > importez le dépôt GitHub.
2. Framework Preset : Other. Build Command et Output Directory : laissez vides.
3. Deploy.
4. Supabase > Authentication > URL Configuration : mettez l'adresse Vercel dans Site URL.

## Utilisation
- Les étudiants créent leur compte sur la page d'accueil.
- Le docteur se connecte, crée les niveaux, affecte chaque étudiant à un niveau, crée les modules, publie fichiers, notes et PV.
- Chaque étudiant voit uniquement son niveau, ses notes et ses PV.

## Limites
Les fichiers sont limités à 50 Mo par défaut sur le plan gratuit de Supabase. Pour les longues vidéos, compressez-les avant l'envoi.

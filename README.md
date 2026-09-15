# ZitraDev Ticket System

Système de tickets type Discord pour GitHub Pages + Supabase.

## Fonctions incluses

- Connexion client par lien magique e-mail
- Création de commandes/tickets
- Historique privé par client
- Conversation client ↔ admin
- Pièces jointes privées (10 Mo max par fichier)
- Dashboard administrateur
- Statuts : Nouveau, En cours, En attente client, Terminé, Fermé
- Notes internes admin invisibles pour le client
- RLS Supabase : un client ne peut lire que ses propres tickets
- Compatible GitHub Pages

## 1. Créer un projet Supabase

Crée un projet sur Supabase.

Dans **Authentication > URL Configuration** :
- Site URL : mets l'URL de ton GitHub Pages
- Redirect URLs : ajoute aussi ton URL GitHub Pages avec `/**` si Supabase te le permet.

Exemple :
`https://tonpseudo.github.io/zxeportfolio/**`

## 2. Installer la base

Ouvre `supabase_schema.sql`.

Remplace :

```sql
admin@exemple.com
```

par TON adresse e-mail d'administration, en minuscules.

Dans Supabase : **SQL Editor > New query**, colle tout le fichier et exécute-le.

## 3. Configurer le site

Dans Supabase : **Project Settings > API**.

Copie :
- Project URL
- anon / public key

Puis ouvre `js/config.js` :

```js
window.ZITRA_CONFIG = {
  SUPABASE_URL: "https://TONPROJET.supabase.co",
  SUPABASE_ANON_KEY: "TA_CLE_ANON"
};
```

IMPORTANT : utilise uniquement la clé `anon/public`, jamais `service_role`.

## 4. Authentification e-mail

Dans **Authentication > Providers > Email**, garde l'authentification e-mail activée.

Le système utilise `signInWithOtp`, donc le client et l'admin reçoivent un lien magique de connexion.

## 5. Mettre sur GitHub Pages

Envoie à la racine du dépôt :

- `index.html`
- `ticket.html`
- `admin.html`
- dossier `assets`
- dossier `js`

Le fichier `supabase_schema.sql` et ce README peuvent rester dans le dépôt ou être retirés une fois l'installation terminée.

## Utilisation

### Client
1. Ouvre `index.html`
2. Entre son e-mail
3. Clique le lien reçu
4. Crée une commande
5. Ouvre le ticket et répond dans la conversation

### Admin
1. Ouvre `admin.html`
2. Se connecte avec l'e-mail ajouté dans `public.admins`
3. Consulte tous les tickets
4. Change leur statut
5. Répond au client
6. Peut écrire une note interne

## Sécurité

Le navigateur contient seulement la clé Supabase `anon`. La sécurité réelle repose sur les règles RLS du fichier SQL.

- Les clients ne peuvent sélectionner que leurs tickets.
- Ils ne peuvent pas changer eux-mêmes le statut.
- Les notes internes ne sont visibles que par les admins.
- Les fichiers sont stockés dans un bucket privé et servis par URL signée temporaire.

Ne désactive pas les RLS et ne mets jamais une clé `service_role` dans les fichiers JavaScript publics.

## Limite actuelle

Le système n'envoie pas encore de notification e-mail à chaque nouveau message. Le client voit la réponse en ouvrant son ticket. On peut ajouter ensuite une fonction Edge + Resend (ou un webhook Discord) pour notifier automatiquement les nouveaux tickets et réponses.

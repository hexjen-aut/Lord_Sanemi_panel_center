# Sanemi OS — Centre de Commandement

Dashboard personnel de Lord Sanemi (Hexjen Conceptions) : planning hebdo, suivi
des projets (WennaShop, Myria, Hexjen, Fixi), finance (règle 50/30/15/5),
idées, journal de bord, agent de sorties (Casablanca) et rappels par email.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- Tailwind CSS v4
- [Supabase](https://supabase.com) — auth email/mot de passe, Postgres, Storage

## Développement

```bash
npm install
cp .env.example .env.local   # renseigner les credentials Supabase
npm run dev
```

Autres scripts : `npm run build`, `npm run start`, `npm run lint`.

## Configuration Supabase

`NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (voir `.env.example`)
sont les credentials publics du projet Supabase. La clé `anon` est faite pour
être exposée côté client ; la sécurité des données dépend entièrement des
policies **Row Level Security (RLS)** activées sur chaque table pour ne
jamais autoriser un utilisateur à lire/écrire les lignes d'un autre.

Tables attendues (toutes avec une colonne `user_id` + policy RLS `user_id = auth.uid()`) :

- `sanemi_tasks`
- `sanemi_objectives`
- `sanemi_transactions`
- `sanemi_ideas`
- `sanemi_journal`
- `sanemi_reminders`
- `sanemi_sortie_prefs`

Storage bucket attendu :

- `ideas-images` (upload des images liées aux idées)

## Déploiement

Le projet est prévu pour être déployé sur [Vercel](https://vercel.com/new) :
importer le repo, renseigner les deux variables d'environnement ci-dessus,
déployer.

## Structure

```
app/                  routes Next.js (App Router)
components/ui/        primitives (Card, Badge, Button, Modal, Chip...)
components/auth/      écran de connexion
components/layout/    shell du dashboard (sidebar, nav mobile)
components/sections/  Planning, Projets, Finance, Idées, Journal, Sorties, Rappels
lib/                  client Supabase, types, constantes, helpers de date
hooks/                gestion de session Supabase
```

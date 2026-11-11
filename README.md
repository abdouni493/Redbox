# 🥐 Pâtisserie La Rose d'Or — Gestion

Application web complète de gestion de pâtisserie : stock, achats, production, comptoir, point de vente, ventes, clients, fournisseurs, employés, dépenses, rapports et paramètres. Interface premium bilingue **Français / Arabe (RTL)** avec animations Framer Motion. L'application démarre **vide** (aucune donnée de démonstration) : toutes les données sont enregistrées dans une base **Supabase** (PostgreSQL + Auth + Storage), synchronisée en temps réel entre tous les postes (caisse, cuisine, admin).

## 🛠️ Stack

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** (design system or / chocolat / rose / pistache)
- **Framer Motion** (animations de pages, cartes, modales)
- **Zustand** (état global) synchronisé avec **Supabase** (base de données, authentification, stockage des images, temps réel)
- **Recharts** (graphiques du tableau de bord & rapports)
- **React Router** (routage + protection des routes)
- **JsBarcode** (génération / impression de codes-barres EAN-13)
- **jsPDF / impression navigateur** (factures & rapports)
- **Lucide React** (icônes)

## ☁️ Base de données Supabase

1. Ouvrez votre projet Supabase → **SQL Editor** → collez le contenu de [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   Le script crée : les tables, les fonctions de comptes (admin + employés dans *Authentication*), les règles RLS, le temps réel et les buckets d'images `product-images` et `store-assets`. Il peut être relancé sans perte de données.
2. L'URL du projet et la clé *anon* sont déjà configurées dans `src/lib/supabase.ts` (modifiables via un fichier `.env`, voir `.env.example`).
3. Lancez l'application : la page de connexion propose **« Créer un compte admin »** tant qu'aucun administrateur n'existe. Ce bouton disparaît automatiquement après la création du compte.
4. Les comptes employés sont créés depuis **Employés → Compte de connexion** (ils apparaissent dans Supabase → Authentication → Users). Connexion par email **ou** nom d'utilisateur.

### 🖼️ Images

Les images (produits, fiches techniques, logo) sont redimensionnées et compressées en **WebP** dans le navigateur, puis enregistrées dans les buckets Supabase (seule l'URL est stockée en base). Réglages et conversion des anciennes images : **Paramètres → Images**.

## 🚀 Démarrage

### Le plus simple (Windows)

Double-cliquez sur le raccourci **« Pâtisserie La Rose d'Or »** (ou sur `run-app.bat`) à la racine du projet. Au premier lancement, les dépendances sont installées automatiquement, puis l'application s'ouvre dans le navigateur. Gardez la fenêtre noire ouverte pendant l'utilisation.

### En ligne de commande

```bash
npm install
npm run dev      # serveur de développement (http://localhost:5173)
npm run build    # build de production
npm run preview  # prévisualiser le build
```

### 📦 Installation sur un autre PC

Les polices, icônes et couleurs sont intégrées localement ; une connexion Internet est en revanche nécessaire pour accéder à la base Supabase.

Pour l'installer sur un autre ordinateur :

1. Installez **Node.js** sur le nouveau PC (installeur hors ligne depuis https://nodejs.org, à préparer à l'avance).
2. Copiez **tout le dossier du projet, y compris `node_modules`** (c'est lui qui contient les bibliothèques de design, polices et icônes). Une clé USB suffit.
3. Double-cliquez sur le raccourci **« Pâtisserie La Rose d'Or »** ou sur `run-app.bat`.

> ⚠️ Si vous oubliez le dossier `node_modules`, le lancement tentera un `npm install` qui échouera sans Internet. Copiez donc bien le dossier complet.

## 🔐 Connexion

- **Aucun compte par défaut.** Tant qu'aucun administrateur n'existe dans Supabase, la page de connexion affiche **« Créer un compte admin »**. Une fois le compte créé, cette option est masquée automatiquement.
- Les comptes (admin et employés) sont des utilisateurs **Supabase Authentication** ; les mots de passe ne sont jamais stockés dans les tables de l'application.

## ✨ Fonctionnalités principales

| Module | Description |
|--------|-------------|
| **Tableau de bord** | Statistiques animées, graphiques (ventes, achats, dépenses, catégories), top produits, alertes stock, expirations |
| **Stock** | CRUD produits, option **« Vente directe au POS »** (sinon réservé à la production), vues cartes/tableau, code-barres |
| **Achats** | Création de factures multi-produits, gestion des dettes fournisseurs, impression de factures |
| **Production** | Recettes, consommation de stock, ajout automatique au comptoir |
| **Comptoir** | Produits disponibles à la vente, destructions + historique |
| **Point de vente (POS)** | Catalogue + panier, réductions, ventes payées/à crédit |
| **Ventes** | Historique, paiement de dettes clients, impression |
| **Clients / Fournisseurs** | Fiches + historiques détaillés avec soldes |
| **Employés** | Création, permissions, acomptes, absences, paie nette |
| **Dépenses** | CRUD avec filtres par période |
| **Rapports** | Synthèse financière par période + export imprimable |
| **Paramètres** | Infos magasin, compte, optimisation des images, sauvegarde/restauration JSON |

## 🌍 Bilingue & RTL

Bascule FR ↔ AR depuis l'en-tête ou la page de connexion. En arabe, l'interface passe automatiquement en `dir="rtl"` (sidebar inversée, police Cairo).

## 🗂️ Structure

```
src/
├── components/   ui/ · layout/ · shared/
├── pages/        une page par module
├── store/        stores Zustand (un par domaine)
├── lib/          supabase · cloudSync · images · animations · utils · i18n · print
├── hooks/        useLanguage · usePermissions · useCountUp
└── types/        types TypeScript du domaine
```

## 💾 Persistance & réinitialisation

Chaque modification est envoyée automatiquement à Supabase et diffusée en temps réel aux autres postes connectés. Depuis **Paramètres → Base de données**, l'administrateur peut **exporter** une sauvegarde JSON, la **restaurer**, ou **effacer** les données métier (les comptes, employés et informations du magasin sont conservés).

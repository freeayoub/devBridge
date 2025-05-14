# DevBridge - Application de Gestion de Projet Intégrée

## Description

DevBridge est une application de gestion de projets académiques, développée avec
Angular (frontend) et Node.js (backend). Ce projet est conçu pour faciliter la
gestion des projets, la communication et la planification des équipes
académiques.

## Structure du Projet

Le projet utilise une structure **monorepo** avec un seul dépôt Git qui contient à la fois le **frontend** (Angular) et le **backend** (Node.js).

## Installation

1. Cloner le dépôt
```bash
git clone https://github.com/freeayoub/devBridge.git
cd devBridge
```

2. Installer les dépendances du backend
```bash
cd backend
npm install
```

3. Installer les dépendances du frontend
```bash
cd ../frontend
npm install
```

4. Configurer les variables d'environnement
   - Copier le fichier `.env.example` vers `.env` dans le dossier racine
   - Modifier les valeurs selon votre environnement

## Configuration

Créez un fichier `.env` à la racine du projet avec les variables suivantes:

```
# Configuration de base
PORT=5000
NODE_ENV=development

# Base de données MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/project_management

# Frontend
FRONTEND_URL=http://localhost:4200
CORS_ORIGIN=http://localhost:4200

# Authentification
JWT_SECRET=votre_secret_jwt
JWT_EXPIRES_IN=7d

# Email Configuration (requis pour l'envoi d'emails)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-password
```

## Démarrage

1. Démarrer le serveur backend
```bash
cd backend
npm start
```

2. Démarrer le serveur frontend
```bash
cd frontend
ng serve
```

3. Accéder à l'application
   - Frontend: http://localhost:4200
   - Backend API: http://localhost:5000/api

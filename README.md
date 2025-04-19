# PI // application de gestion de projet intégrée //

# devBridge

## Description

DevBridge est une application de gestion de projets académiques, développée avec
Angular (frontend) et Node.js (backend). Ce projet est conçu pour faciliter la
gestion des projets, la communication et la planification des équipes
académiques.

## Structure du Projet

## Le projet utilise une structure **monorepo** avec un seul dépôt Git qui contient à la fois le **frontend** (Angular) et le **backend** (Node.js). Voici la structure des dossiers :

# .gitignore

---

# .env

# node_modules/

# uploads/

---

# GitHub :

## git clone https://github.com/freeayoub/devBridge.git

# .env:

# Configuration de base

PORT=3000 NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/project_management
FRONTEND_URL=http://localhost:4200 CORS_ORIGIN=http://localhost:4200
JWT_SECRET=devbridge JWT_EXPIRES_IN=7d SECRET_KEY=2cinfo1 CLIENT_KEY=esprit
USE_GRAPHQL=true CLOUDINARY_CLOUD_NAME=dhefwodjk
CLOUDINARY_API_KEY=759654722199679
CLOUDINARY_API_SECRET=RWqD45DPdUXvDN6Bf096EcVrPdA
DEFAULT_IMAGE="https://res.cloudinary.com/dhefwodjk/image/upload/v1744417743/profile_images/profile_images/1744417744084-default-avatar.png.webp

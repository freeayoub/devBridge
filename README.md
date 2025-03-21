
# PI // application de gestion de projet intégrée // 
# devBridge

## Description
DevBridge est une application de gestion de projets académiques, développée avec Angular (frontend) et Node.js (backend). Ce projet est conçu pour faciliter la gestion des projets, la communication et la planification des équipes académiques.

## Structure du Projet

Le projet utilise une structure **monorepo** avec un seul dépôt Git qui contient à la fois le **frontend** (Angular) et le **backend** (Node.js). Voici la structure des dossiers :
##### 
devBridge/
├── backend/
│   ├── src/
│   ├── package.json
│   └── ...
├── frontend/
├── src/
│   ├── app/
│   │   ├── modules/
│   │   ├── components/
│   │   └── services/
│   ├── assets/
│   └── ...
├── angular.json
├── package.json
└── ...
└── README.md 
------------------------------------------------------------------------
#.env
#PORT=3000
#MONGO_URI='mongodb://127.0.0.1:27017/project_management'
----------------------------------------------------------
# .gitignore
# .env
# node_modules/
# uploads/
-------------------------------------------------------
# 1 Travailler sur un fork sur GitHub :
Forker un dépôt :
Sur GitHub, va sur la page du dépôt que tu veux forker.
Clique sur le bouton “Fork” en haut à droite.
Cela crée une copie du dépôt sous ton compte GitHub.
# 2 Cloner ton fork en local :
git clone https://github.com/freeayoub/devBridge.git
# 3 Créer une branche pour tes modifications :
git checkout -b ma-branche
# 4 Faire tes modifications dans ton dépôt local.
# 5 Ajouter et committer tes changements :
git add .
git commit -m "Description de mes modifications"
# 6 Envoyer tes modifications sur ton dépôt forké (GitHub) :
git push -u origin ma-branche
# 7 Créer une Pull Request (PR) :
Va sur la page de ton dépôt forké sur GitHub.
Clique sur "Compare & pull request".
Remplis les détails et clique sur "Create pull request".
# d'apres OpenAI et bon travail
---------------------------------------------------
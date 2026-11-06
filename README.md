# Carnet Bench

Appli de suivi de programme de musculation : l'athlète voit ses séances, note reps / charges / RPE, suit sa progression et remplit son bilan de la semaine. Le coach met à jour le programme depuis le **mode coach**.

- **Appli de l'athlète** : `https://<compte>.github.io/carnet-bench/`
- **Mode coach** : `https://<compte>.github.io/carnet-bench/coach.html`

## Pour le coach : modifier le programme

1. Ouvre le mode coach.
2. Pour changer les semaines à venir, clique sur **+ Nouveau programme**, choisis la semaine de départ et le programme à copier, puis modifie les séances et les exercices. Un programme s'applique à partir de sa semaine de départ, jusqu'au programme suivant. Les semaines passées gardent leur programme.
3. Clique sur **Publier sur GitHub**. L'athlète voit le nouveau programme d'ici 1 à 2 minutes.

**Première publication** : il faut un jeton GitHub, à créer une seule fois dans *Settings → Developer settings → Personal access tokens → Fine-grained tokens*. Donne-lui accès **uniquement à ce dépôt**, avec la permission **Contents : Read and write**. Colle-le dans la partie « Connexion GitHub » du mode coach. Il reste enregistré dans ton navigateur et n'est envoyé qu'à GitHub.

Sans jeton : clique sur **Télécharger programme.json**, puis sur GitHub fais *Add file → Upload files* pour remplacer le fichier.

## Pour l'athlète : les données

Les séances et les bilans sont enregistrés **uniquement sur le téléphone** (stockage du navigateur). Pense à faire **Bilan → Exporter une sauvegarde** de temps en temps. Pour retrouver tes données sur un autre appareil, utilise **Importer une sauvegarde**. Le bouton « Copier le résumé pour le coach » prépare un texte à envoyer au coach.

Astuce : sur le téléphone, ajoute l'appli à l'écran d'accueil (Safari : Partager → Sur l'écran d'accueil ; Chrome : ⋮ → Ajouter à l'écran d'accueil). Elle fonctionne aussi sans réseau à la salle.

## Fichiers

| Fichier | Rôle |
|---|---|
| `programme.json` | Le programme, avec une version par période (`from` = lundi de départ) |
| `index.html`, `app.js` | Appli de l'athlète |
| `coach.html`, `coach.js` | Mode coach |
| `common.js`, `style.css` | Code et styles partagés |
| `sw.js`, `manifest.webmanifest` | Installation sur le téléphone et mode hors ligne |

Aucune donnée d'entraînement de l'athlète n'est stockée dans ce dépôt public, seulement le programme.

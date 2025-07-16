# Guide de Conversion LaTeX - Rapport de Stage ETER

## 📋 Fichiers Générés

1. **`rapport_stage_s4_eter.md`** - Rapport complet en Markdown
2. **`latex_template.tex`** - Template LaTeX professionnel
3. **`convert_to_latex.py`** - Script de conversion automatique
4. **`README_LATEX.md`** - Ce guide d'utilisation

## 🚀 Conversion Rapide

### Option 1 : Script Python (Recommandé)
```bash
# Rendre le script exécutable
chmod +x convert_to_latex.py

# Exécuter la conversion
python3 convert_to_latex.py
```

### Option 2 : Pandoc (Alternative)
```bash
# Installer pandoc si nécessaire
sudo apt-get install pandoc texlive-full

# Conversion avec pandoc
pandoc rapport_stage_s4_eter.md -o rapport_stage_s4_eter.tex --template=latex_template.tex
```

## 📄 Compilation PDF

```bash
# Compilation LaTeX vers PDF
pdflatex rapport_stage_s4_eter.tex

# Pour les références croisées (optionnel)
pdflatex rapport_stage_s4_eter.tex
pdflatex rapport_stage_s4_eter.tex
```

## 🎨 Personnalisation du Template

### Couleurs ETER
```latex
\definecolor{eterblue}{RGB}{26, 86, 219}
\definecolor{etergray}{RGB}{108, 117, 125}
```

### Informations Personnelles
Modifiez dans `latex_template.tex` :
```latex
\textbf{Étudiant :} & [Votre Nom] \\
\textbf{Filière :} & [Votre Filière] \\
\textbf{Encadrant académique :} & [Nom] \\
```

### Logo Université
Décommentez et ajustez :
```latex
% \includegraphics[width=0.3\textwidth]{logo_universite.png}
```

## 🔧 Fonctionnalités du Template

### Formatage Automatique
- **Titres** : Couleur ETER blue avec numérotation
- **Code** : Syntax highlighting avec style personnalisé
- **Tableaux** : Format professionnel avec bordures
- **Liens** : Hyperlinks cliquables en PDF
- **Listes** : Puces colorées et numérotation

### Environnements Spéciaux
```latex
% Encadré d'information
\begin{infobox}
Contenu important
\end{infobox}

% Code avec coloration
\begin{lstlisting}[language=javascript]
// Code JavaScript
\end{lstlisting}

% Commandes personnalisées
\tech{Node.js}     % Technologie en bleu
\code{function()}  % Code inline
\file{server.js}   % Nom de fichier
```

## 📊 Structure du Document

```
1. Page de titre
2. Résumé
3. Remerciements
4. Table des matières
5. Liste des figures
6. Liste des tableaux
7. Corps du rapport (8 chapitres)
8. Annexes
9. Bibliographie
```

## 🔍 Résolution de Problèmes

### Erreurs de Compilation Communes

**Erreur** : Package non trouvé
```bash
# Installer texlive complet
sudo apt-get install texlive-full
```

**Erreur** : Caractères spéciaux
```bash
# Assurer l'encodage UTF-8
pdflatex -file-line-error -interaction=nonstopmode rapport_stage_s4_eter.tex
```

**Erreur** : Mémoire insuffisante
```bash
# Augmenter la mémoire LaTeX
export max_print_line=1000
export error_line=254
export half_error_line=127
```

### Packages Requis
```latex
% Minimums requis
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[french]{babel}
\usepackage{geometry}
\usepackage{graphicx}
\usepackage{xcolor}
\usepackage{hyperref}
\usepackage{listings}
\usepackage{longtable}
\usepackage{booktabs}
```

## 📈 Optimisations Avancées

### Compression PDF
```bash
# Après compilation
ps2pdf rapport_stage_s4_eter.pdf rapport_stage_s4_eter_compressed.pdf
```

### Génération d'Index
```bash
# Ajouter dans le préambule
\usepackage{makeidx}
\makeindex

# Compiler avec
pdflatex rapport_stage_s4_eter.tex
makeindex rapport_stage_s4_eter.idx
pdflatex rapport_stage_s4_eter.tex
```

### Bibliographie Automatique
```bash
# Ajouter un fichier .bib
bibtex rapport_stage_s4_eter
pdflatex rapport_stage_s4_eter.tex
pdflatex rapport_stage_s4_eter.tex
```

## 📝 Modifications Courantes

### Ajout d'Images
```latex
\begin{figure}[H]
    \centering
    \includegraphics[width=0.8\textwidth]{image.png}
    \caption{Description de l'image}
    \label{fig:image}
\end{figure}
```

### Tableaux Complexes
```latex
\begin{longtable}{|l|l|l|}
\hline
\textbf{Colonne 1} & \textbf{Colonne 2} & \textbf{Colonne 3} \\
\hline
Données & Données & Données \\
\hline
\end{longtable}
```

### Formules Mathématiques
```latex
% Inline
$E = mc^2$

% Block
\begin{equation}
    \int_{0}^{\infty} e^{-x} dx = 1
\end{equation}
```

## 🎯 Checklist Finale

- [ ] Informations personnelles mises à jour
- [ ] Logo université ajouté (si souhaité)
- [ ] Compilation sans erreurs
- [ ] Vérification des références croisées
- [ ] Test d'impression PDF
- [ ] Validation du formatage
- [ ] Numérotation des pages correcte
- [ ] Table des matières complète

## 📧 Support

Pour toute question sur la conversion LaTeX :
1. Vérifiez les erreurs de compilation
2. Consultez la documentation LaTeX
3. Testez avec un document minimal
4. Vérifiez les packages installés

## 🔗 Ressources Utiles

- [LaTeX Documentation](https://www.latex-project.org/help/documentation/)
- [Overleaf Templates](https://www.overleaf.com/latex/templates)
- [LaTeX Graphics](https://en.wikibooks.org/wiki/LaTeX/Importing_Graphics)
- [LaTeX Tables](https://en.wikibooks.org/wiki/LaTeX/Tables)

---

*Ce guide vous permet de convertir facilement le rapport Markdown en document LaTeX professionnel pour votre stage ETER.*
#!/bin/bash

# Script de compilation LaTeX pour le rapport de stage ETER
# Compile le document LaTeX en PDF avec gestion des erreurs

echo "🚀 Compilation du rapport de stage ETER en PDF..."

# Vérifier si le fichier LaTeX existe
if [ ! -f "rapport_stage_s4_eter.tex" ]; then
    echo "❌ Erreur : Fichier rapport_stage_s4_eter.tex non trouvé"
    echo "💡 Exécutez d'abord : python3 convert_to_latex.py"
    exit 1
fi

# Vérifier si pdflatex est installé
if ! command -v pdflatex &> /dev/null; then
    echo "❌ Erreur : pdflatex n'est pas installé"
    echo "💡 Installez avec : sudo apt-get install texlive-latex-base texlive-latex-extra"
    exit 1
fi

# Nettoyer les fichiers temporaires précédents
echo "🧹 Nettoyage des fichiers temporaires..."
rm -f *.aux *.log *.out *.toc *.lof *.lot *.fls *.fdb_latexmk *.synctex.gz

# Première compilation
echo "📄 Première compilation..."
pdflatex -interaction=nonstopmode rapport_stage_s4_eter.tex

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de la première compilation"
    echo "📋 Vérifiez les erreurs dans le fichier rapport_stage_s4_eter.log"
    exit 1
fi

# Deuxième compilation (pour les références croisées)
echo "🔄 Deuxième compilation pour les références..."
pdflatex -interaction=nonstopmode rapport_stage_s4_eter.tex

if [ $? -ne 0 ]; then
    echo "⚠️ Erreur lors de la deuxième compilation (références)"
    echo "📋 Le PDF peut avoir été généré mais avec des références incorrectes"
fi

# Troisième compilation (pour s'assurer que tout est correct)
echo "✅ Compilation finale..."
pdflatex -interaction=nonstopmode rapport_stage_s4_eter.tex

# Vérifier si le PDF a été généré
if [ -f "rapport_stage_s4_eter.pdf" ]; then
    echo "🎉 Compilation terminée avec succès !"
    echo "📄 Fichier PDF généré : rapport_stage_s4_eter.pdf"
    
    # Afficher la taille du fichier
    SIZE=$(du -h rapport_stage_s4_eter.pdf | cut -f1)
    echo "📊 Taille du fichier : $SIZE"
    
    # Nettoyer les fichiers temporaires
    echo "🧹 Nettoyage final..."
    rm -f *.aux *.log *.out *.toc *.lof *.lot *.fls *.fdb_latexmk *.synctex.gz
    
    # Ouvrir le PDF automatiquement (optionnel)
    if command -v xdg-open &> /dev/null; then
        read -p "🔍 Voulez-vous ouvrir le PDF ? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            xdg-open rapport_stage_s4_eter.pdf
        fi
    fi
    
else
    echo "❌ Erreur : Le fichier PDF n'a pas été généré"
    echo "📋 Vérifiez les erreurs dans le fichier rapport_stage_s4_eter.log"
    exit 1
fi

echo "✨ Processus terminé !"
#!/usr/bin/env python3
"""
Script de conversion Markdown vers LaTeX pour le rapport de stage ETER
Convertit le rapport Markdown en LaTeX professionnel avec formatage personnalisé
"""

import re
import sys
import os
from pathlib import Path

def convert_markdown_to_latex(markdown_content):
    """
    Convertit le contenu Markdown en LaTeX avec formatage personnalisé
    """
    latex_content = markdown_content
    
    # Conversion des titres
    latex_content = re.sub(r'^# (.+)$', r'\\chapter{\1}', latex_content, flags=re.MULTILINE)
    latex_content = re.sub(r'^## (.+)$', r'\\section{\1}', latex_content, flags=re.MULTILINE)
    latex_content = re.sub(r'^### (.+)$', r'\\subsection{\1}', latex_content, flags=re.MULTILINE)
    latex_content = re.sub(r'^#### (.+)$', r'\\subsubsection{\1}', latex_content, flags=re.MULTILINE)
    
    # Conversion des listes
    latex_content = re.sub(r'^\* (.+)$', r'\\item \1', latex_content, flags=re.MULTILINE)
    latex_content = re.sub(r'^\d+\. (.+)$', r'\\item \1', latex_content, flags=re.MULTILINE)
    
    # Gestion des listes imbriquées
    latex_content = re.sub(r'(\\item .+\n)(\\item)', r'\1\\begin{itemize}\n\2', latex_content)
    latex_content = re.sub(r'(\\item .+\n)(?!\\item)', r'\1\\end{itemize}\n', latex_content)
    
    # Conversion des blocs de code
    latex_content = re.sub(r'```(\w+)?\n(.*?)\n```', 
                          r'\\begin{lstlisting}[language=\1]\n\2\n\\end{lstlisting}', 
                          latex_content, flags=re.DOTALL)
    
    # Conversion du code inline
    latex_content = re.sub(r'`([^`]+)`', r'\\code{\1}', latex_content)
    
    # Conversion des liens
    latex_content = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\\href{\2}{\1}', latex_content)
    
    # Conversion du texte en gras
    latex_content = re.sub(r'\*\*([^*]+)\*\*', r'\\textbf{\1}', latex_content)
    
    # Conversion du texte en italique
    latex_content = re.sub(r'\*([^*]+)\*', r'\\textit{\1}', latex_content)
    
    # Conversion des tableaux
    latex_content = convert_tables(latex_content)
    
    # Conversion des caractères spéciaux LaTeX
    latex_content = escape_latex_chars(latex_content)
    
    # Ajout d'environnements pour les listes
    latex_content = add_list_environments(latex_content)
    
    # Conversion des émoticônes et symboles
    latex_content = convert_symbols(latex_content)
    
    return latex_content

def convert_tables(content):
    """
    Convertit les tableaux Markdown en tableaux LaTeX
    """
    # Pattern pour détecter les tableaux
    table_pattern = r'(\|[^|\n]+\|[^|\n]*\n\|[-| :]+\|[^|\n]*\n(?:\|[^|\n]+\|[^|\n]*\n)*)'
    
    def table_replacer(match):
        table = match.group(1)
        lines = table.strip().split('\n')
        
        # Extraire les en-têtes
        headers = [cell.strip() for cell in lines[0].split('|')[1:-1]]
        
        # Ignorer la ligne de séparation
        rows = []
        for line in lines[2:]:
            if line.strip():
                row = [cell.strip() for cell in line.split('|')[1:-1]]
                rows.append(row)
        
        # Générer le tableau LaTeX
        col_spec = '|' + 'l|' * len(headers)
        latex_table = f'\\begin{{longtable}}{{{col_spec}}}\n'
        latex_table += '\\hline\n'
        latex_table += ' & '.join(f'\\textbf{{{header}}}' for header in headers) + ' \\\\\n'
        latex_table += '\\hline\n'
        
        for row in rows:
            latex_table += ' & '.join(row) + ' \\\\\n'
            latex_table += '\\hline\n'
        
        latex_table += '\\end{longtable}\n'
        return latex_table
    
    return re.sub(table_pattern, table_replacer, content, flags=re.MULTILINE)

def escape_latex_chars(content):
    """
    Échappe les caractères spéciaux LaTeX
    """
    # Caractères à échapper
    chars_to_escape = {
        '&': r'\&',
        '%': r'\%',
        '$': r'\$',
        '#': r'\#',
        '^': r'\^{}',
        '_': r'\_',
        '{': r'\{',
        '}': r'\}',
        '~': r'\textasciitilde{}',
        '\\': r'\textbackslash{}'
    }
    
    for char, escaped in chars_to_escape.items():
        content = content.replace(char, escaped)
    
    return content

def add_list_environments(content):
    """
    Ajoute les environnements de liste LaTeX
    """
    # Trouver les groupes d'items
    lines = content.split('\n')
    result = []
    in_list = False
    
    for line in lines:
        if line.strip().startswith('\\item'):
            if not in_list:
                result.append('\\begin{itemize}')
                in_list = True
            result.append(line)
        else:
            if in_list:
                result.append('\\end{itemize}')
                in_list = False
            result.append(line)
    
    if in_list:
        result.append('\\end{itemize}')
    
    return '\n'.join(result)

def convert_symbols(content):
    """
    Convertit les symboles et émoticônes en LaTeX
    """
    symbols = {
        '✅': r'$\checkmark$',
        '❌': r'$\times$',
        '⚠️': r'$\triangle$',
        '📋': r'$\square$',
        '🔧': r'$\wrench$',
        '🚀': r'$\uparrow$',
        '📊': r'$\square$',
        '→': r'$\rightarrow$',
        '←': r'$\leftarrow$',
        '↑': r'$\uparrow$',
        '↓': r'$\downarrow$'
    }
    
    for symbol, latex_symbol in symbols.items():
        content = content.replace(symbol, latex_symbol)
    
    return content

def create_complete_latex_document(latex_content, template_path):
    """
    Crée le document LaTeX complet en insérant le contenu dans le template
    """
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            template = f.read()
        
        # Remplacer le placeholder par le contenu
        complete_document = template.replace('[CONTENT_PLACEHOLDER]', latex_content)
        
        return complete_document
    except FileNotFoundError:
        print(f"Erreur : Template non trouvé à {template_path}")
        return None

def main():
    """
    Fonction principale de conversion
    """
    # Chemins des fichiers
    markdown_file = 'rapport_stage_s4_eter.md'
    template_file = 'latex_template.tex'
    output_file = 'rapport_stage_s4_eter.tex'
    
    # Vérifier l'existence des fichiers
    if not os.path.exists(markdown_file):
        print(f"Erreur : Fichier Markdown non trouvé : {markdown_file}")
        return 1
    
    if not os.path.exists(template_file):
        print(f"Erreur : Template LaTeX non trouvé : {template_file}")
        return 1
    
    try:
        # Lire le fichier Markdown
        with open(markdown_file, 'r', encoding='utf-8') as f:
            markdown_content = f.read()
        
        print("Conversion du Markdown en LaTeX...")
        
        # Convertir en LaTeX
        latex_content = convert_markdown_to_latex(markdown_content)
        
        # Créer le document complet
        complete_document = create_complete_latex_document(latex_content, template_file)
        
        if complete_document:
            # Écrire le fichier LaTeX
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(complete_document)
            
            print(f"✅ Conversion terminée avec succès !")
            print(f"📄 Fichier LaTeX généré : {output_file}")
            print(f"🔧 Pour compiler : pdflatex {output_file}")
            
            return 0
        else:
            return 1
            
    except Exception as e:
        print(f"Erreur lors de la conversion : {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
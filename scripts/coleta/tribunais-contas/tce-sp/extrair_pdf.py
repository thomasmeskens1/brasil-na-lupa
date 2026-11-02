"""Extrai o texto de um PDF oficial, página a página, e imprime JSON (ASCII) no stdout.

Uso: python -I extrair_pdf.py <arquivo.pdf>
Roda sempre em modo isolado (-I) e num diretório temporário vazio: o PDF é dado não confiável.
Saída: {"paginas": ["texto da página 1", ...], "legivel": bool}
"legivel" é falso quando a maior parte dos caracteres não tem mapeamento Unicode
(fontes sem ToUnicode: o texto sai como "(cid:N)", caracteres de controle ou de uso privado).
"""
import json
import sys

import pdfplumber


def proporcao_ilegivel(texto):
    if not texto:
        return 1.0
    ruins = 0
    total = 0
    for ch in texto:
        if ch.isspace():
            continue
        total += 1
        cp = ord(ch)
        if cp < 32 or 0xE000 <= cp <= 0xF8FF or ch == "�" or (cp == 0xFFFD):
            ruins += 1
    return ruins / total if total else 1.0


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"erro": "uso: extrair_pdf.py <arquivo.pdf>"}))
        sys.exit(2)
    paginas = []
    with pdfplumber.open(sys.argv[1]) as pdf:
        for pagina in pdf.pages:
            paginas.append(pagina.extract_text() or "")
    junto = "\n".join(paginas)
    letras = sum(1 for c in junto if c.isalpha() and ord(c) < 0x250)
    # pdfplumber escreve "(cid:N)" para cada glifo sem mapeamento Unicode.
    cids = junto.count("(cid:")
    legivel = proporcao_ilegivel(junto) < 0.2 and letras > 200 and cids * 8 < len(junto) * 0.05
    sys.stdout.write(json.dumps({"paginas": paginas, "legivel": legivel}, ensure_ascii=True))


if __name__ == "__main__":
    main()

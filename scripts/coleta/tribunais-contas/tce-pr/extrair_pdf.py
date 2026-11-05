"""Extrai o texto das ultimas paginas de um PDF oficial do TCE-PR (onde fica a deliberacao) e imprime JSON.

Uso: python -I extrair_pdf.py <arquivo.pdf> [max_paginas]
Roda sempre em modo isolado (-I) e num diretorio temporario vazio: o PDF e dado nao confiavel.
Le de tras para frente e para quando acha o inicio da deliberacao ("Decidem"/"Acordam"/"Resolvem").
Saida: {"texto": str, "paginas_lidas": int, "total_paginas": int, "legivel": bool}
"""
import json
import re
import sys

import pdfplumber

INICIO = re.compile(r"\b(decidem|acordam|resolvem)\b[\s\S]{0,500}?\b(membros|conselheiros)\b", re.I)


def legivel(texto):
    letras = sum(1 for c in texto if c.isalpha() and ord(c) < 0x250)
    ruins = sum(1 for c in texto if (ord(c) < 32 and not c.isspace()) or 0xE000 <= ord(c) <= 0xF8FF or c == "�")
    return letras > 200 and ruins * 20 < max(1, letras) and texto.count("(cid:") * 8 < len(texto) * 0.05


def main():
    if len(sys.argv) not in (2, 3):
        print(json.dumps({"erro": "uso: extrair_pdf.py <arquivo.pdf> [max_paginas]"}))
        sys.exit(2)
    maximo = int(sys.argv[2]) if len(sys.argv) == 3 else 8
    paginas = []
    with pdfplumber.open(sys.argv[1]) as pdf:
        total = len(pdf.pages)
        for i in range(total - 1, max(-1, total - 1 - maximo), -1):
            paginas.insert(0, pdf.pages[i].extract_text() or "")
            if INICIO.search("\n".join(paginas)):
                break
    texto = "\n".join(paginas)
    sys.stdout.write(json.dumps({"texto": texto, "paginas_lidas": len(paginas), "total_paginas": total, "legivel": legivel(texto)}, ensure_ascii=True))


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""
Extrai as linhas de texto do "Boletim de Votação Nominal" (RVP) da ALES — Brasil na Lupa.

Uso (sempre com -I: o PDF é dado NÃO CONFIÁVEL):
    python -I extrair_boletim_pdf.py <arquivo.pdf>
Saída (stdout, JSON ASCII): { "ok": bool, "paginas": n, "linhas": ["...", ...], "erro": "..." }

Só lê o texto (pdfplumber.extract_text); não executa nada do PDF. A interpretação das linhas
(deputado, partido, voto, totais) e a conferência com os totais do próprio boletim são feitas no
Node (scripts/coleta/estados/es/ales.mjs), que é testado offline.
"""
import json
import sys


def main():
    saida = {"ok": False, "paginas": 0, "linhas": []}
    try:
        import pdfplumber
        with pdfplumber.open(sys.argv[1]) as pdf:
            saida["paginas"] = len(pdf.pages)
            for p in pdf.pages:
                texto = p.extract_text() or ""
                for l in texto.split("\n"):
                    l = " ".join(l.split())
                    if l:
                        saida["linhas"].append(l)
        saida["ok"] = True
    except Exception as e:  # qualquer falha vira "não publicado" no chamador
        saida["erro"] = "%s: %s" % (type(e).__name__, str(e)[:200])
    sys.stdout.write(json.dumps(saida, ensure_ascii=True))


if __name__ == "__main__":
    main()

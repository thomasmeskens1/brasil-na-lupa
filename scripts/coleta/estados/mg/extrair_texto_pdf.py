# -*- coding: utf-8 -*-
"""
Extrai o texto corrido de cada página de um PDF do Diário do Legislativo da ALMG.

Uso (sempre com -I, o PDF é dado NÃO CONFIÁVEL):
    python -I extrair_texto_pdf.py <arquivo.pdf>
Saída: JSON (ASCII) em stdout:
    { "ok": bool, "motor": "pypdfium2"|"pdfplumber", "paginas": ["texto da página 1", ...], "problemas": [...] }

Dependência: pdfplumber (requirements.txt), que já instala o pypdfium2. O pypdfium2 é usado primeiro
(cerca de 1 s por edição de 90 páginas, contra ~50 s do pdfplumber, com o mesmo texto); o pdfplumber
fica como alternativa. Só lê caracteres; não executa nada do PDF. O parser (Node) interpreta as atas e
confere nomes e totais.
"""
import json
import sys


def com_pdfium(caminho):
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(caminho)
    try:
        paginas = []
        for i in range(len(pdf)):
            texto = pdf[i].get_textpage().get_text_range()
            # Hifenização de fim de linha vem como U+FFFE; mantém o hífen e a quebra de linha.
            paginas.append(texto.replace("￾", "-\n").replace("\r\n", "\n").replace("\r", "\n"))
        return paginas
    finally:
        pdf.close()


def com_pdfplumber(caminho):
    import pdfplumber

    with pdfplumber.open(caminho) as pdf:
        return [(p.extract_text() or "") for p in pdf.pages]


def main(caminho):
    saida = {"ok": False, "motor": None, "paginas": [], "problemas": []}
    for nome, fn in (("pypdfium2", com_pdfium), ("pdfplumber", com_pdfplumber)):
        try:
            saida["paginas"] = fn(caminho)
            saida["motor"] = nome
            saida["ok"] = True
            break
        except Exception as e:  # PDF fora do padrão: tenta o outro motor; se ambos falharem, nada é publicado
            saida["problemas"].append("%s: %s" % (nome, str(e)[:200]))
    sys.stdout.write(json.dumps(saida, ensure_ascii=True))


if __name__ == "__main__":
    main(sys.argv[1])

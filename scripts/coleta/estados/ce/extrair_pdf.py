# -*- coding: utf-8 -*-
"""
Leitor de PDF do coletor do Ceará (Brasil na Lupa). Só lê caracteres; não executa nada do PDF.

Uso (sempre com -I: o PDF é dado NÃO CONFIÁVEL):
    python -I extrair_pdf.py palavras <arquivo.pdf>   # Relatório de Votação da ALECE
    python -I extrair_pdf.py texto <arquivo.pdf>      # Diário Oficial do Estado (DOE-CE)
Saída (stdout, JSON ASCII):
    palavras: { "ok": bool, "paginas": [ { "largura": n, "bordas_v": [x, ...], "palavras": [[x0, x1, topo, "texto"], ...] } ], "erro": "..." }
    texto:    { "ok": bool, "paginas": ["texto da página 1", ...], "erro": "..." }

Dependência: pdfplumber (requirements.txt), que já instala o pypdfium2. Nada de reconhecimento de
imagem (OCR): página sem camada de texto volta vazia e o chamador registra a lacuna. A interpretação
(nomes, partidos, votos, totais e atos do Diário) é feita no Node (alece.mjs, diario.mjs), testada offline.
"""
import json
import sys


def palavras(caminho):
    import pdfplumber

    out = []
    with pdfplumber.open(caminho) as pdf:
        for p in pdf.pages:
            # Alguns relatórios imprimem cada caractere duas vezes no mesmo lugar (negrito simulado):
            # dedupe_chars remove só o glifo repetido na mesma posição.
            ws = p.dedupe_chars(tolerance=1).extract_words(keep_blank_chars=False, use_text_flow=False, x_tolerance=1.5, y_tolerance=2)
            # Bordas verticais da tabela (limites das colunas Nº, Deputados, Partidos, Sim, Não, Abstenção).
            bordas = sorted({round(float(e["x0"]), 1) for e in p.edges
                             if e["orientation"] == "v" and float(e["bottom"]) - float(e["top"]) > 5})
            out.append({
                "largura": round(float(p.width), 1),
                "bordas_v": bordas,
                "palavras": [[round(w["x0"], 1), round(w["x1"], 1), round(w["top"], 1), w["text"]] for w in ws],
            })
    return out


def texto(caminho):
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(caminho)
    try:
        paginas = []
        for i in range(len(pdf)):
            t = pdf[i].get_textpage().get_text_range()
            paginas.append(t.replace("￾", "-\n").replace("\r\n", "\n").replace("\r", "\n"))
        return paginas
    finally:
        pdf.close()


def main(modo, caminho):
    saida = {"ok": False, "paginas": []}
    try:
        saida["paginas"] = palavras(caminho) if modo == "palavras" else texto(caminho)
        saida["ok"] = True
    except Exception as e:  # qualquer falha vira "não publicado" no chamador
        saida["erro"] = "%s: %s" % (type(e).__name__, str(e)[:200])
    sys.stdout.write(json.dumps(saida, ensure_ascii=True))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

"""Extrai o texto de uma edicao do Diario Oficial Eletronico do TCM-PA e imprime JSON.

Uso: python -I extrair_pdf.py <arquivo.pdf>
Roda sempre em modo isolado (-I) e num diretorio temporario vazio: o PDF e dado nao confiavel.
O DOE e diagramado em duas colunas; cada pagina e lida por metade (esquerda e depois direita)
para que as linhas das colunas nao se misturem. Usa o pypdfium2, que vem junto com o pdfplumber.
Saida: {"paginas": [str, ...], "total_paginas": int}
"""
import json
import sys

import pypdfium2 as pdfium


def divisao(tp, largura, altura):
    """x do vao entre as colunas: a faixa vertical (entre 25% e 75% da largura) com menos letras.
    Ignora o cabecalho e o rodape (10% de cima e de baixo), que ocupam a largura toda.
    Retorna None quando nao ha vao claro (pagina de uma coluna so)."""
    ini, fim = int(largura * 0.25), int(largura * 0.75)
    cobertura = [0] * (fim - ini + 1)
    total = 0
    for k in range(tp.count_chars()):
        esq, baixo, dir_, cima = tp.get_charbox(k)
        if cima < altura * 0.1 or baixo > altura * 0.9 or dir_ - esq <= 0:
            continue
        total += 1
        for x in range(max(ini, int(esq)), min(fim, int(dir_)) + 1):
            cobertura[x - ini] += 1
    if total < 200:
        return None
    menor = min(cobertura)
    if menor > total * 0.002:
        return None
    meio = largura / 2
    candidatos = [ini + i for i, c in enumerate(cobertura) if c == menor]
    return min(candidatos, key=lambda x: abs(x - meio))


def main():
    if len(sys.argv) != 2:
        print(json.dumps({"erro": "uso: extrair_pdf.py <arquivo.pdf>"}))
        sys.exit(2)
    pdf = pdfium.PdfDocument(sys.argv[1])
    paginas = []
    try:
        for i in range(len(pdf)):
            pg = pdf[i]
            largura, altura = pg.get_size()
            tp = pg.get_textpage()
            x = divisao(tp, largura, altura)
            if x is None:
                paginas.append(tp.get_text_range())
            else:
                esq = tp.get_text_bounded(left=0, bottom=0, right=x, top=altura)
                dir_ = tp.get_text_bounded(left=x, bottom=0, right=largura, top=altura)
                paginas.append(esq + "\n" + dir_)
            tp.close()
            pg.close()
        total = len(pdf)
    finally:
        pdf.close()
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps({"paginas": paginas, "total_paginas": total}, ensure_ascii=False))


if __name__ == "__main__":
    main()

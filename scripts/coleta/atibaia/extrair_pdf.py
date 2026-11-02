"""Extrai o texto de uma edição da Imprensa Oficial de Atibaia (PDF), página a página,
respeitando o layout em duas colunas.

Uso: python -I extrair_pdf.py <arquivo.pdf>   (imprime JSON em UTF-8 na saída padrão)

Para ganhar tempo, o texto bruto de cada página é lido primeiro com o pypdfium2
(rápido) e só as páginas com cabeçalho de ato em caixa alta (LEI, LEI
COMPLEMENTAR, DECRETO seguidos de "N", inclusive com letras espaçadas,
ex.: "D E C R E T O Nº") ou com lista de presença de sessão da
Câmara passam pela leitura por coordenadas do pdfplumber. A página 1 também é
lida, para conferir o número e a data da edição.

O PDF é tratado como dado NÃO confiável: só lemos palavras e coordenadas com o
pdfplumber; nada do conteúdo é interpretado como código. Rodar sempre com -I.

Ordem de leitura: a página é dividida em faixas horizontais. Uma linha que tem
palavra atravessando a calha central é "largura total"; sequências de linhas sem
palavra na calha são lidas como duas colunas (esquerda inteira, depois direita).
O carimbo de assinatura digital (texto girado na margem) é descartado.
"""
import json
import re
import site
import sys

# -I ignora o site-packages do usuário; ele é acrescentado de forma explícita
# (no fim do caminho), sem incluir o diretório atual nem o do PDF.
sys.path.append(site.getusersitepackages())
import pdfplumber  # noqa: E402
import pypdfium2  # noqa: E402  (dependência do próprio pdfplumber)

VERSAO = 2
CANDIDATA = re.compile(r"(?:L ?E ?I(?: C ?O ?M ?P ?L ?E ?M ?E ?N ?T ?A ?R)?|D ?E ?C ?R ?E ?T ?O)\s*N\s*[.º°oª]|ESTIVERAM PRESENTES")


def linhas_de(palavras, tol=2.5):
    linhas = []
    for w in sorted(palavras, key=lambda w: (round(w["top"]), w["x0"])):
        if linhas and abs(linhas[-1]["top"] - w["top"]) <= tol:
            linhas[-1]["ws"].append(w)
        else:
            linhas.append({"top": w["top"], "ws": [w]})
    for ln in linhas:
        ln["ws"].sort(key=lambda w: w["x0"])
    return linhas


def texto_linha(ws):
    return " ".join(w["text"] for w in ws)


def calha(palavras, largura):
    """Coordenada x da calha central (menor ocupação entre 40% e 60% da largura)."""
    ini, fim = int(largura * 0.40), int(largura * 0.60)
    occ = [0] * (int(largura) + 2)
    for w in palavras:
        for x in range(max(ini, int(w["x0"])), min(fim, int(w["x1"]) + 1)):
            occ[x] += 1
    melhor = min(range(ini, fim), key=lambda x: (occ[x], abs(x - largura / 2)))
    return melhor, occ[melhor]


def pagina(p):
    ws = [w for w in p.extract_words(extra_attrs=["size", "upright"], keep_blank_chars=False)
          if w["upright"]]
    if not ws:
        return {"blocos": []}
    meio, _ = calha(ws, p.width)
    linhas = linhas_de(ws)
    blocos = []  # cada bloco: {"tipo": "largura"|"colunas", "linhas": [...]}
    for ln in linhas:
        cruza = any(w["x0"] < meio - 1 and w["x1"] > meio + 1 for w in ln["ws"])
        tipo = "largura" if cruza else "colunas"
        if blocos and blocos[-1]["tipo"] == tipo:
            blocos[-1]["linhas"].append(ln)
        else:
            blocos.append({"tipo": tipo, "linhas": [ln]})
    saida = []
    for b in blocos:
        if b["tipo"] == "largura":
            saida.append({"col": "largura", "linhas": [texto_linha(l["ws"]) for l in b["linhas"]]})
            continue
        esq, dir_ = [], []
        for l in b["linhas"]:
            e = [w for w in l["ws"] if w["x1"] <= meio + 1]
            d = [w for w in l["ws"] if w["x0"] >= meio - 1]
            if e:
                esq.append(texto_linha(e))
            if d:
                dir_.append(texto_linha(d))
        if esq:
            saida.append({"col": "esquerda", "linhas": esq})
        if dir_:
            saida.append({"col": "direita", "linhas": dir_})
    return {"blocos": saida}


def candidatas(caminho):
    doc = pypdfium2.PdfDocument(caminho)
    try:
        total = len(doc)
        escolhidas = []
        for i in range(total):
            try:
                texto = doc[i].get_textpage().get_text_range()
            except Exception:
                texto = ""
            if i == 0 or CANDIDATA.search(re.sub(r"\s+", " ", texto)):
                escolhidas.append(i)
        return total, escolhidas
    finally:
        doc.close()


def main():
    caminho = sys.argv[1]
    total, escolhidas = candidatas(caminho)
    paginas = []
    with pdfplumber.open(caminho) as pdf:
        for i in escolhidas:
            try:
                r = pagina(pdf.pages[i])
            except Exception as e:  # página malformada não derruba a edição
                r = {"blocos": [], "erro": type(e).__name__}
            r["pagina"] = i + 1
            paginas.append(r)
    saida = {"versao": VERSAO, "total_paginas": total, "paginas": paginas}
    sys.stdout.buffer.write(json.dumps(saida, ensure_ascii=False).encode("utf-8"))


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""
Extrator por coordenadas do "Relatório de Verificação de Votação" (PDF oficial da ALESP).

Uso (sempre com -I, o PDF é dado NÃO CONFIÁVEL):
    python -I extrair_votacao_pdf.py <arquivo.pdf>
Saída: JSON (ASCII) em stdout:
    { "ok": bool, "problemas": [..], "cabecalho": {...}, "linhas": [...], "rodape": {...} }

Dependência: pdfplumber (ver requirements.txt). Não executa nada do PDF; só lê caracteres e
coordenadas. Qualquer coisa fora do padrão esperado vira "problema" e o chamador NÃO publica
votos individuais (só placar oficial + lacuna + link).

Layout conhecido (2025-2026): duas colunas "Parlamentar | Partido | Voto". Em cada linha o
nome e o partido têm o mesmo "top"; o voto fica ~0,75 pt ABAIXO (top maior). Partidos longos
(ex.: "FED PSDB/CIDADANIA") invadem a coluna do voto e o texto extraído por palavras fica
intercalado ("PSDB/CIDOAbDstAruNÇIÃAo"); por isso a separação é feita caractere a caractere
pela posição vertical. À esquerda do nome pode haver um marcador de uma letra (ex.: "L", "P",
"G"), cuja legenda não consta do relatório; "P" coincide com o campo "Presidente" do rodapé.
"""
import json
import re
import sys

import pdfplumber

VOTOS_CONHECIDOS = {"Sim", "Não", "Abstenção", "Obstrução", "Licenciado", "---", "Em Branco", "Branco"}
TOL_MESMA = 0.12      # mesma linha (nome/partido)
DESL_MIN, DESL_MAX = 0.4, 1.2   # deslocamento vertical do voto em relação ao nome


def cor(c):
    v = c.get("non_stroking_color")
    return tuple(round(x, 3) for x in v) if isinstance(v, (list, tuple)) else v


def agrupar_palavras(chars, gap=1.2):
    """Junta caracteres (já ordenados por x) em palavras pela distância horizontal."""
    palavras, atual, fim = [], "", None
    for c in chars:
        if c["text"].isspace():
            if atual:
                palavras.append(atual)
            atual, fim = "", None
            continue
        if fim is not None and c["x0"] - fim > gap:
            palavras.append(atual)
            atual = ""
        atual += c["text"]
        fim = c["x1"]
    if atual:
        palavras.append(atual)
    return palavras


def texto(chars):
    return " ".join(agrupar_palavras(sorted(chars, key=lambda c: c["x0"])))


def linhas_por_top(chars, tol=0.6):
    """Agrupa caracteres em linhas visuais (para cabeçalho e rodapé)."""
    linhas = []
    for c in sorted(chars, key=lambda c: (c["top"], c["x0"])):
        for l in linhas:
            if abs(l["top"] - c["top"]) <= tol:
                l["chars"].append(c)
                break
        else:
            linhas.append({"top": c["top"], "chars": [c]})
    return linhas


def extrair(caminho):
    problemas = []
    saida = {"ok": False, "problemas": problemas, "cabecalho": {}, "linhas": [], "rodape": {}}
    with pdfplumber.open(caminho) as pdf:
        paginas = pdf.pages
        saida["paginas"] = len(paginas)
        rodape_chars = []
        cab_chars = []
        for pi, p in enumerate(paginas):
            chars = [c for c in p.chars if c["text"] is not None]
            # Cabeçalho da tabela: palavras "Parlamentar", "Partido", "Voto" em negrito.
            ws = p.extract_words(extra_attrs=["size"])
            heads = [w for w in ws if w["text"] in ("Parlamentar", "Partido", "Voto")]
            if not heads:
                if pi == 0:
                    problemas.append("cabeçalho 'Parlamentar/Partido/Voto' não encontrado (layout diferente)")
                    return saida
                rodape_chars += chars
                continue
            top_head = min(w["top"] for w in heads)
            bottom_head = max(w["bottom"] for w in heads)
            parl = sorted([w for w in heads if w["text"] == "Parlamentar"], key=lambda w: w["x0"])
            part = sorted([w for w in heads if w["text"] == "Partido"], key=lambda w: w["x0"])
            voto = sorted([w for w in heads if w["text"] == "Voto"], key=lambda w: w["x0"])
            if not (len(parl) == len(part) == len(voto) == 2):
                problemas.append(f"página {pi + 1}: cabeçalho com {len(parl)}/{len(part)}/{len(voto)} colunas (esperado 2)")
                return saida
            colunas = []
            for k in range(2):
                colunas.append({
                    "x_ini": parl[k]["x0"] - 3,
                    "x_fim": parl[1]["x0"] - 3 if k == 0 else p.width,
                    "x_partido": part[k]["x0"] - 2,
                    "x_voto": voto[k]["x0"] - 3,
                })
            # Início do rodapé: primeira linha com "Votos" (ou "PARTIDOS") em fonte maior.
            fim_corpo = p.height
            for w in ws:
                if w["top"] > bottom_head and w["text"] in ("Votos", "PARTIDOS", "Total") and w["size"] >= 9.5:
                    fim_corpo = min(fim_corpo, w["top"] - 3)
            corpo = [c for c in chars if bottom_head < c["top"] < fim_corpo]
            cab_chars += [c for c in chars if c["top"] < top_head]
            rodape_chars += [c for c in chars if c["top"] >= fim_corpo]
            for ci, col in enumerate(colunas):
                cc = [c for c in corpo if col["x_ini"] <= c["x0"] < col["x_fim"] and not c["text"].isspace()]
                # tops "base": tops de caracteres na zona do nome
                bases = sorted({round(c["top"], 2) for c in cc if c["x0"] < col["x_partido"]})
                # junta bases muito próximas
                tops = []
                for t in bases:
                    if tops and t - tops[-1] <= TOL_MESMA:
                        continue
                    tops.append(t)
                usados = set()
                for t in tops:
                    nome_c, part_c, voto_c = [], [], []
                    for i, c in enumerate(cc):
                        d = c["top"] - t
                        if abs(d) <= TOL_MESMA:
                            (nome_c if c["x0"] < col["x_partido"] else part_c).append(c)
                            usados.add(i)
                        elif DESL_MIN <= d <= DESL_MAX:
                            voto_c.append(c)
                            usados.add(i)
                    nome_c.sort(key=lambda c: c["x0"])
                    # marcador de uma letra antes do nome (separado por espaço largo)
                    marcador = None
                    if len(nome_c) >= 2 and nome_c[1]["x0"] - nome_c[0]["x1"] > 4.0 and len(nome_c[0]["text"]) == 1:
                        marcador = nome_c[0]["text"]
                        nome_c = nome_c[1:]
                    nome = texto(nome_c)
                    partido = texto(part_c)
                    v = texto(voto_c)
                    linha = {"pagina": pi + 1, "coluna": ci + 1, "top": round(t, 2), "marcador": marcador,
                             "nome": nome, "partido": partido, "voto": v}
                    if not nome:
                        problemas.append(f"linha sem nome: {linha}")
                    if v not in VOTOS_CONHECIDOS:
                        problemas.append(f"voto não reconhecido para '{nome}': '{v}'")
                    if not partido:
                        problemas.append(f"partido vazio para '{nome}'")
                    # Conferência independente: no relatório, nome e voto da mesma linha são
                    # impressos na mesma cor. Cor diferente = ligação nome→voto incerta.
                    cor_nome = {cor(c) for c in nome_c}
                    cor_voto = {cor(c) for c in voto_c}
                    # Exceção única: quem preside (marcador "P", voto "---") tem o nome na cor do
                    # campo "Presidente" do rodapé; essa linha é conferida pela contagem do rodapé.
                    presidindo = marcador == "P" and v == "---"
                    if cor_nome != cor_voto and not presidindo:
                        problemas.append(f"cor do nome difere da cor do voto para '{nome}'")
                    if voto_c and part_c and min(c["x0"] for c in voto_c) < col["x_partido"]:
                        problemas.append(f"voto começa antes da coluna de partido para '{nome}'")
                    saida["linhas"].append(linha)
                sobras = [c for i, c in enumerate(cc) if i not in usados]
                if sobras:
                    problemas.append(f"página {pi + 1} coluna {ci + 1}: {len(sobras)} caractere(s) sem linha: "
                                     + texto(sobras)[:80])
        # Cabeçalho (título, sessão, verificação)
        cab = [texto(l["chars"]) for l in linhas_por_top(cab_chars)]
        saida["cabecalho"]["linhas"] = cab
        for l in cab:
            m = re.search(r"(\d{2})/(\d{2})/(\d{4})\s+às\s+(\d{2}:\d{2})", l)
            if m:
                saida["cabecalho"]["data"] = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
                saida["cabecalho"]["hora"] = m.group(4)
                saida["cabecalho"]["sessao"] = l
        # Rodapé: rótulos à esquerda (até x~110) com número logo à direita
        rod = {}
        esquerda = [c for c in rodape_chars if c["x0"] < 180]
        for l in linhas_por_top(esquerda, tol=1.6):
            t = texto(l["chars"])
            m = re.match(r"^(Votos Sim|Votos Não|Abstenção|Em Branco|Presidente|Total)\s+(\d+)$", t)
            if m:
                rod[m.group(1)] = int(m.group(2))
            elif t:
                rod.setdefault("_outros", []).append(t)
        meio = [c for c in rodape_chars if 180 <= c["x0"] < 270 and "Bold" in c["fontname"]]
        res = texto(meio)
        if res:
            rod["resultado"] = res
        direita = [c for c in rodape_chars if c["x0"] >= 270]
        txt_dir = " ".join(texto(l["chars"]) for l in linhas_por_top(direita, tol=1.6))
        m = re.search(r"PARTIDOS EM OBSTRUÇÃO\s*(.*)$", txt_dir)
        if m:
            rod["partidos_em_obstrucao"] = m.group(1).strip()
        elif txt_dir:
            rod["_direita"] = txt_dir
        saida["rodape"] = rod
    # Conferência com o rodapé
    L = saida["linhas"]
    cont = {}
    for l in L:
        cont[l["voto"]] = cont.get(l["voto"], 0) + 1
    saida["contagem"] = cont
    pres = sum(1 for l in L if l["marcador"] == "P")
    chk = {
        "Votos Sim": cont.get("Sim", 0),
        "Votos Não": cont.get("Não", 0),
        "Abstenção": cont.get("Abstenção", 0),
        "Em Branco": cont.get("Em Branco", 0) + cont.get("Branco", 0),
        "Presidente": pres,
    }
    for k, v in chk.items():
        if k not in rod:
            problemas.append(f"rodapé sem '{k}'")
        elif rod[k] != v:
            problemas.append(f"'{k}': rodapé {rod[k]} × contagem {v}")
    if "Total" in rod:
        soma = sum(rod.get(k, 0) for k in chk)
        if soma != rod["Total"]:
            problemas.append(f"Total do rodapé {rod['Total']} ≠ soma dos campos {soma}")
    else:
        problemas.append("rodapé sem 'Total'")
    nomes = [l["nome"] for l in L]
    if len(set(nomes)) != len(nomes):
        problemas.append("nome repetido no relatório")
    saida["ok"] = not problemas and len(L) > 0
    return saida


if __name__ == "__main__":
    try:
        r = extrair(sys.argv[1])
    except Exception as e:  # PDF malformado: falha fechada
        r = {"ok": False, "problemas": [f"erro ao ler PDF: {type(e).__name__}: {e}"], "linhas": [], "rodape": {}}
    sys.stdout.write(json.dumps(r, ensure_ascii=True))

# Resumo — Estados do Sudeste (RJ, MG, ES)

Pesquisa com acessos reais em **2026-11-02**. Detalhes, URLs testadas e exemplos em `rj.md`, `mg.md` e `es.md` (nesta pasta). SP já está coberto em `docs/pesquisa/fontes-sp-atibaia.md` e entra na tabela só como referência.

| UF | Deputados | Proposições / tramitação | Votos nominais (nome a nome) | Normas (leis, decretos, vetos) | Formato principal | Viabilidade |
|---|---|---|---|---|---|---|
| **MG** | API ALMG (77 em exercício) | API ALMG + CSV anual (robots proíbe paginar a API) | **Sim** — Diário do Legislativo (PDF com texto: "Registraram 'sim': Nome (Partido)…"); comissões em JSON na API | API ALMG (leis e decretos com texto) + Jornal Minas Gerais (API interna, PDF assinado) | JSON/XML + PDF texto | **Alta** — total, exceto voto de plenário (parcial: parser de texto + conferência). Esforço **médio** |
| **ES** | API ALES (35 registros na 20ª legislatura) | API ALES `/api/publico/proposicao/` (JSON) | **Sim** — "Boletim de Votação Nominal" (tipo RVP, 462 boletins), PDF tabular gerado pelo painel | API ALES de legislação (leis); DIO-ES (API interna + PDF) para decretos e vetos | JSON + PDF texto | **Alta** — total para Legislativo, parcial para decretos. Esforço **baixo/médio**. Atenção: a API expõe CPF/e-mail de autores, que devem ser descartados |
| **RJ** | Portal ALERJ (70, HTML) | Lotus Notes `scpro2327.nsf` (HTML legado, sem API) | **Não encontrado** — notas taquigráficas só trazem o placar; sem lista nominal publicada acessível | Leis: Lotus `contlei.nsf` (em dia); decretos: DOERJ com download de PDF intencionalmente ofuscado (não contornado) | HTML legado + PDF bloqueado | **Baixa/média** — scraping de legado; votos nominais só por curadoria/LAI. Esforço **alto** |
| SP (ref.) | API ALESP | API ALESP (OpenAPI) | Sim — PDF de verificação de votação (parser por coordenadas) | Dump ALESP + API DOE-SP | JSON/XML + PDF | Alta (já implementado) |

## Ordem sugerida de implementação
1. **ES** — menor esforço; o voto nominal já vem em documento próprio e tabular.
2. **MG** — maior volume e melhor API; parser de ata em texto corrido.
3. **RJ** — começar só por projetos, leis e placares; abrir pedido pela Lei de Acesso à Informação para os espelhos do painel e para acesso ao DOERJ antes de qualquer coleta de votos ou decretos.

## Regras que valem para os três
- Voto individual só aparece quando há documento nominal oficial (diretriz 5). No RJ, por ora, mostrar apenas o placar.
- Nomes e documentos de servidores e particulares nos diários oficiais (MASP, CPF) não são coletados nem exibidos (diretriz 12).
- Nenhum bloqueio foi contornado: robots da ALMG respeitado (sem paginação), visualizador do DOERJ não foi decodificado.

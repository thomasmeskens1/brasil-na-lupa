# Estados: resumo do Nordeste, grupo 1 (MA, PI, CE, RN, PB)

Pesquisa com acessos reais em **2026-11-02**. Detalhes, URLs e exemplos em `ma.md`, `pi.md`, `ce.md`, `rn.md` e `pb.md` (nesta pasta).

| UF | Deputados | Proposições / tramitação | Votos nominais | Normas (leis, decretos) | Formato principal | Viabilidade |
|---|---|---|---|---|---|---|
| **MA** | 42. API ALEMALEGIS (JSON; filtrar pela legislatura 20) | API ALEMALEGIS `/api/v1/public/legislative-matter` + `processing` (JSON) | **Não estruturados.** A rota de votos existe mas está vazia; o plenário vota de forma simbólica (Diário da Assembleia em PDF) | API `legal-norm` (2.998 normas) + DOE-MA (busca JSON + PDF `download.php?arq=`) | JSON / PDF | **Parcial**: proposições e normas automáticas; votos por curadoria. Esforço médio |
| **PI** | 30. SAPL 3.1 `/api/parlamentares/` (JSON) | SAPL `/api/materia/` (623 matérias em 2026; 105 mil tramitações) | **Sim, JSON** (`votoparlamentar`): 150 votações nominais desde 2022 (14 em 2026). As demais só têm o resultado agregado | SAPL `/api/norma/` (PDF) + DOE-PI (lista JSON `listardiarios.json` + PDF) | JSON / PDF | **Total** no Legislativo; parcial no DOE. Esforço baixo |
| **CE** | 46. HTML `al.ce.gov.br/deputados` | HTML legado `www2.../proposicoes/numero.php` (com tramitação e nº da lei) | **Sim, mas em PDF**: 60 votações (2023–2026); índice em CSV no Portal da Transparência | DOE-CE em PDF com URL previsível (`imagens.seplag.ce.gov.br/PDF/AAAAMMDD/...`) + busca OCR | HTML / CSV + PDF | **Parcial**: raspagem de HTML + extração de PDF. Esforço médio/alto |
| **RN** | 24. API eLegis `parlamentar` (JSON; **descartar CPF**) | API eLegis `processo/{id}` + `tramitacao` (JSON) | **Sim, JSON**: plenário e comissões, com presença e obstrução (2.454 votações) | Lista HTML + PDF em `al.rn.leg.br/legislacao/*` + DOE-RN em PDF com URL previsível (`webdisk.../Jornal/1AAAA-MM-DD.pdf`) | JSON / PDF | **Total** no Legislativo; parcial no DOE. Esforço médio (API sem documentação) |
| **PB** | 36. SAPL 3.1 (JSON; cruzar com os mandatos) | SAPL `/api/materia/` (8.143 matérias em 2026; 540 mil tramitações) | **Sim, JSON** (`votoparlamentar`): 17.148 votos individuais; o mais recente é de 17/08/2026 | SAPL `/api/norma/` (533 leis ordinárias em 2026) + DOE-PB em PDF (`auniao.pb.gov.br/servicos/doe/...`) | JSON / PDF | **Total** no Legislativo (**`Crawl-delay: 60`**); parcial no DOE. Esforço baixo/médio |

## Conclusões

1. **Coletor SAPL único**: PI e PB usam SAPL 3.1 com API REST aberta e voto por deputado. Um coletor genérico atende os dois e pode ser reaproveitado em outras casas com SAPL. Ele precisa respeitar o `Crawl-delay` de cada casa (60 s na PB).
2. **Melhor dado de voto**: RN (JSON com plenário e comissões). Depois vêm PB e PI (JSON, mas só para as votações nominais feitas no painel).
3. **Votação simbólica predomina** em todas as casas. O CE afirma isso oficialmente; no MA e no CE, as transcrições mostram "permaneçam como estão". O site deve mostrar o resultado agregado oficial e "Informação não disponível em fonte oficial" para o voto individual, **sem inferir** voto a partir de "unanimidade".
4. **Diários Oficiais**: nenhum dos cinco tem API de atos. Todos têm PDF com texto e URL previsível ou listável. Leis, decretos e vetos exigem segmentação por cabeçalho e conferência humana.
5. **Atenção ao ICMS (piloto)**: a Lei nº 19.915/2026 do CE (parcelamento de ICMS, IPVA e ITCD) foi encontrada no DOE-CE de 28/10/2026.
6. **Fontes não oficiais a evitar**: `leisestaduais.com.br`, que a ALRN linka, é um serviço privado. As plataformas de fornecedor (`deirn.sdoe.com.br`) devem ser preteridas em favor do domínio `.gov.br` com o mesmo PDF.
7. **Bloqueios e robots**: nenhum bloqueio anti-robô foi contornado. O `robots.txt` de `www.ce.gov.br` respondeu 403 e não pôde ser lido; usei apenas o PDF em `imagens.seplag.ce.gov.br` e a busca da própria página, em volume mínimo.

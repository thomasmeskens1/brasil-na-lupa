// Coleções editoriais de acórdãos do TCU que ganham arquivo próprio no formato "julgamento".
//
// A escolha dos acórdãos vem da pesquisa docs/pesquisa/fontes-tcu-tce.md (seções 3 e 4), feita por triagem
// de palavras e revisada; o coletor NÃO amplia a lista sozinho. Cada item é identificado pela KEY oficial
// (o número do acórdão se repete entre colegiados: ex.: 2833/2025-Plenário e 2833/2025-Segunda Câmara).
// O coletor confere número, ano e colegiado da KEY contra a API e registra divergência em meta.json.
//
// Os campos "exercicio" e "mcn" das Contas do Presidente vêm da própria tramitação oficial no Congresso
// (o informe "Recebido o Parecer Prévio … referente ao exercício de AAAA" da MCN, conferido pelo coletor).

export const COLECOES = {
  'contas-do-presidente': {
    titulo: 'Parecer prévio sobre as Contas do Presidente da República',
    natureza: 'parecer-previo',
    itens: [
      { key: 'ACORDAO-COMPLETO-2715321', numero: '1326', ano: 2025, colegiado: 'Plenário', exercicio: '2024', mcn: { numero: 1, ano: 2025 } },
      { key: 'ACORDAO-COMPLETO-2767896', numero: '1442', ano: 2026, colegiado: 'Plenário', exercicio: '2025', mcn: { numero: 1, ano: 2026 } },
    ],
    // Contas cujo acórdão do TCU é anterior a 2025 (fora do período da coleta): só a situação no Congresso.
    somente_congresso: [
      { exercicio: '2023', mcn: { numero: 1, ano: 2024 } },
    ],
  },
  impostos: {
    titulo: 'Renúncias e benefícios tributários e reforma tributária',
    natureza: 'acordao',
    itens: [
      { key: 'ACORDAO-COMPLETO-2701124', numero: '735', ano: 2025, colegiado: 'Plenário' },
      { key: 'ACORDAO-COMPLETO-2656622', numero: '756', ano: 2025, colegiado: 'Plenário' },
      { key: 'ACORDAO-COMPLETO-2727986', numero: '2101', ano: 2025, colegiado: 'Plenário' },
      { key: 'ACORDAO-COMPLETO-2722098', numero: '2517', ano: 2025, colegiado: 'Plenário' },
      { key: 'ACORDAO-COMPLETO-2732702', numero: '2537', ano: 2025, colegiado: 'Plenário' },
      { key: 'ACORDAO-COMPLETO-2739181', numero: '2833', ano: 2025, colegiado: 'Plenário' },
      { key: 'ACORDAO-COMPLETO-2754222', numero: '858', ano: 2026, colegiado: 'Plenário' },
      { key: 'ACORDAO-COMPLETO-2763993', numero: '1197', ano: 2026, colegiado: 'Plenário' },
      { key: 'ACORDAO-COMPLETO-2764175', numero: '1493', ano: 2026, colegiado: 'Plenário' },
      { key: 'ACORDAO-COMPLETO-2771738', numero: '1620', ano: 2026, colegiado: 'Plenário' },
      { key: 'ACORDAO-COMPLETO-2778995', numero: '2607', ano: 2026, colegiado: 'Plenário' },
      { key: 'ACORDAO-COMPLETO-2784300', numero: '2933', ano: 2026, colegiado: 'Plenário' },
    ],
  },
};

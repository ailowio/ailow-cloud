import { describe, expect, it } from 'vitest';
import { VALOR_MAXIMO_CENTAVOS } from './financeiro.js';
import {
  PRECO_MAXIMO_CENTAVOS,
  ajusteEstoqueSchema,
  atribuirCodigosDeCor,
  chaveCor,
  codigoCor,
  compararTamanhos,
  faixaDePreco,
  montarCodigoSku,
  movimentoNovoSchema,
  precoSugeridoCentavos,
  produtoNovoSchema,
  skuNovoSchema,
} from './produtos.js';

const CAT = '0b6f5f9e-4c1d-4b0e-9a43-7d2f0f6f3a11';

const sku = (extra: Record<string, unknown> = {}) => ({
  tamanho: '46',
  cor: 'Chocolate',
  estoque_inicial: 3,
  estoque_minimo: 1,
  ...extra,
});

const produto = (extra: Record<string, unknown> = {}) => ({
  nome: 'Tomara que caia Essência',
  categoria_id: CAT,
  porte: 'slim',
  atributos: ['bojo'],
  fornecedor: 'Fina Paixão',
  custo_centavos: 4500,
  preco_centavos: 8990,
  skus: [sku()],
  ...extra,
});

describe('teto de preço', () => {
  it('é o mesmo teto de R$ 20 milhões do Financeiro (RN-01)', () => {
    expect(PRECO_MAXIMO_CENTAVOS).toBe(VALOR_MAXIMO_CENTAVOS);
  });
});

describe('preço sugerido (RN-05)', () => {
  it('custo × (1 + markup), em centavos inteiros', () => {
    expect(precoSugeridoCentavos(5000, 10000)).toBe(10000); // 100% de markup
    expect(precoSugeridoCentavos(4500, 0)).toBe(4500); // sem markup: o preço é o custo
    expect(precoSugeridoCentavos(3000, 12000)).toBe(6600); // 120%
  });

  it('arredonda para o centavo mais próximo, metade para cima', () => {
    expect(precoSugeridoCentavos(1, 5000)).toBe(2); // 1,5 -> 2
    expect(precoSugeridoCentavos(3333, 5000)).toBe(5000); // 4999,5 -> 5000
    expect(precoSugeridoCentavos(1, 3333)).toBe(1); // 1,3333 -> 1
    expect(precoSugeridoCentavos(999, 1)).toBe(999); // 999,0999 -> 999
  });

  it('custo zero dá preço sugerido zero (a tela exige que o preço seja informado)', () => {
    expect(precoSugeridoCentavos(0, 10000)).toBe(0);
  });

  it('não usa ponto flutuante: valores grandes continuam exatos', () => {
    expect(precoSugeridoCentavos(2_000_000_000, 100_000)).toBe(22_000_000_000);
  });

  it('recusa custo ou markup que não sejam inteiros não negativos', () => {
    expect(() => precoSugeridoCentavos(10.5, 100)).toThrow();
    expect(() => precoSugeridoCentavos(-1, 100)).toThrow();
    expect(() => precoSugeridoCentavos(100, -1)).toThrow();
    expect(() => precoSugeridoCentavos(100, 0.5)).toThrow();
  });
});

describe('código do SKU: PPPP-TT-CCC (P1 §4)', () => {
  it('junta número com 4 dígitos, tamanho e código da cor', () => {
    expect(montarCodigoSku(42, '46', 'CHO')).toBe('0042-46-CHO');
    expect(montarCodigoSku(1, 'GG', 'PRE')).toBe('0001-GG-PRE');
    expect(montarCodigoSku(9999, 'U', 'NUD')).toBe('9999-U-NUD');
  });

  it('recusa número fora de 1 a 9999', () => {
    expect(() => montarCodigoSku(0, 'P', 'PRE')).toThrow();
    expect(() => montarCodigoSku(10000, 'P', 'PRE')).toThrow();
    expect(() => montarCodigoSku(1.5, 'P', 'PRE')).toThrow();
  });

  it('só gera maiúsculas, dígitos e hífen (cabe no modo alfanumérico do QR)', () => {
    expect(montarCodigoSku(7, 'G1', 'AZU')).toMatch(/^[0-9A-Z-]+$/);
  });
});

describe('ordem dos tamanhos', () => {
  it('letras na ordem de grade, depois números crescentes (não alfabética)', () => {
    expect(['GG', 'P', 'M', 'G', 'PP'].sort(compararTamanhos)).toEqual(['PP', 'P', 'M', 'G', 'GG']);
    expect(['50', '40', '48', '9'].sort(compararTamanhos)).toEqual(['9', '40', '48', '50']);
  });

  it('tamanho desconhecido vai para o fim, em ordem alfabética', () => {
    expect(['ZZ9', 'M', 'AB1'].sort(compararTamanhos)).toEqual(['M', 'AB1', 'ZZ9']);
  });
});

describe('busca por preço (RF-PRO-03)', () => {
  it('com centavos é exato', () => {
    expect(faixaDePreco('89,90')).toEqual({ min: 8990, max: 8990 });
    expect(faixaDePreco('R$ 25,00')).toEqual({ min: 2500, max: 2500 });
    expect(faixaDePreco('0,5')).toEqual({ min: 50, max: 50 });
    expect(faixaDePreco('12.5')).toEqual({ min: 1250, max: 1250 });
  });

  it('só os reais pega a faixa daquele real', () => {
    expect(faixaDePreco('89')).toEqual({ min: 8900, max: 8999 });
    expect(faixaDePreco('  R$89 ')).toEqual({ min: 8900, max: 8999 });
  });

  it.each(['', 'sutiã', '89,999', '1.234,56', '8x', '-5', '12345678'])('"%s" não é um preço', (q) => {
    expect(faixaDePreco(q)).toBeNull();
  });
});

describe('código da cor (3 caracteres)', () => {
  it('são as 3 primeiras letras, sem acento, em maiúsculas', () => {
    expect(codigoCor('Chocolate', new Set())).toBe('CHO');
    expect(codigoCor('preto', new Set())).toBe('PRE');
    expect(codigoCor('Água', new Set())).toBe('AGU');
    expect(codigoCor('Rosa Chá', new Set())).toBe('ROS');
  });

  it('nome curto é completado com X', () => {
    expect(codigoCor('Pó', new Set())).toBe('POX');
    expect(codigoCor('A', new Set())).toBe('AXX');
  });

  it('se o código já é de outra cor do mesmo produto, troca o último caractere', () => {
    expect(codigoCor('Rosa Bebê', new Set(['ROS']))).toBe('RO2');
    expect(codigoCor('Rosa Pink', new Set(['ROS', 'RO2']))).toBe('RO3');
  });

  it('recusa nome sem letra nem número', () => {
    expect(() => codigoCor('---', new Set())).toThrow();
    expect(() => codigoCor('', new Set())).toThrow();
  });

  it('chaveCor ignora maiúsculas, acento e espaços repetidos', () => {
    expect(chaveCor('  Rosa   Chá ')).toBe('rosa cha');
    expect(chaveCor('ROSA CHA')).toBe('rosa cha');
  });

  it('a mesma cor tem o mesmo código em todos os tamanhos; cores diferentes nunca repetem código', () => {
    const mapa = atribuirCodigosDeCor(['Rosa Chá', 'Rosa Bebê', 'rosa cha', 'Preto']);
    expect(mapa.get(chaveCor('Rosa Chá'))).toBe('ROS');
    expect(mapa.get(chaveCor('Rosa Bebê'))).toBe('RO2');
    expect(mapa.get(chaveCor('Preto'))).toBe('PRE');
    expect(new Set(mapa.values()).size).toBe(mapa.size);
    expect(mapa.size).toBe(3);
  });
});

describe('SKU novo no cadastro do produto', () => {
  it('normaliza o tamanho para maiúsculas e aparas', () => {
    expect(skuNovoSchema.parse(sku({ tamanho: ' gg ' })).tamanho).toBe('GG');
  });

  it.each([
    ['tamanho vazio', { tamanho: '' }],
    ['tamanho com 4 caracteres', { tamanho: 'ABCD' }],
    ['tamanho com espaço', { tamanho: 'P M' }],
    ['tamanho com símbolo', { tamanho: '4-6' }],
    ['cor vazia', { cor: '   ' }],
    ['cor só com símbolos', { cor: '---' }],
    ['cor com 31 caracteres', { cor: 'x'.repeat(31) }],
    ['estoque inicial negativo', { estoque_inicial: -1 }],
    ['estoque inicial fracionado', { estoque_inicial: 1.5 }],
    ['estoque inicial acima do limite', { estoque_inicial: 100_001 }],
    ['estoque mínimo negativo', { estoque_minimo: -1 }],
    ['estoque mínimo ausente (é obrigatório no cadastro, RF-PRO-05)', { estoque_minimo: undefined }],
  ])('recusa %s', (_nome, extra) => {
    expect(skuNovoSchema.safeParse(sku(extra)).success).toBe(false);
  });

  it('aceita estoque inicial 0 e mínimo 0', () => {
    expect(skuNovoSchema.safeParse(sku({ estoque_inicial: 0, estoque_minimo: 0 })).success).toBe(true);
  });
});

describe('produto novo (RF-PRO-01)', () => {
  it('aceita o caso comum', () => {
    expect(produtoNovoSchema.safeParse(produto()).success).toBe(true);
  });

  it.each([
    ['porte inventado', { porte: 'medio' }],
    ['nome vazio', { nome: '  ' }],
    ['nome com 81 caracteres', { nome: 'x'.repeat(81) }],
    ['categoria que não é UUID', { categoria_id: 'sutia' }],
    ['custo negativo', { custo_centavos: -1 }],
    ['custo fracionado (RN-01)', { custo_centavos: 45.5 }],
    ['preço zero', { preco_centavos: 0 }],
    ['preço acima do teto de R$ 20 milhões', { preco_centavos: 2_000_000_001 }],
    ['sem nenhum SKU', { skus: [] }],
    ['atributos repetidos', { atributos: ['bojo', 'Bojo'] }],
    ['fornecedor vazio', { fornecedor: '' }],
    ['fornecedor com 81 caracteres', { fornecedor: 'x'.repeat(81) }],
  ])('recusa %s', (_nome, extra) => {
    expect(produtoNovoSchema.safeParse(produto(extra)).success).toBe(false);
  });

  it('fornecedor pode ser nulo', () => {
    expect(produtoNovoSchema.safeParse(produto({ fornecedor: null })).success).toBe(true);
  });

  it('recusa o mesmo tamanho e a mesma cor duas vezes (mesmo com outra grafia)', () => {
    const repetido = [sku(), sku({ cor: 'CHOCOLATE', tamanho: '46' })];
    expect(produtoNovoSchema.safeParse(produto({ skus: repetido })).success).toBe(false);
    const semAcento = [sku({ cor: 'Rosa Chá' }), sku({ cor: 'rosa  cha' })];
    expect(produtoNovoSchema.safeParse(produto({ skus: semAcento })).success).toBe(false);
  });

  it('o mesmo tamanho em cores diferentes, e a mesma cor em tamanhos diferentes, são SKUs diferentes', () => {
    const skus = [sku(), sku({ tamanho: '48' }), sku({ cor: 'Preto' })];
    expect(produtoNovoSchema.safeParse(produto({ skus })).success).toBe(true);
  });

  it('aceita no máximo 144 SKUs e 12 cores', () => {
    const tamanhos = ['P', 'M', 'G', 'GG', '40', '42', '44', '46', '48', '50', '52', '54'];
    const cores = (n: number) => Array.from({ length: n }, (_, i) => `Cor${String.fromCharCode(65 + i)}`);
    const grade = (ncores: number) => tamanhos.flatMap((t) => cores(ncores).map((c) => sku({ tamanho: t, cor: c })));
    expect(produtoNovoSchema.safeParse(produto({ skus: grade(12) })).success).toBe(true); // 144
    expect(produtoNovoSchema.safeParse(produto({ skus: grade(13) })).success).toBe(false); // 13 cores
    expect(produtoNovoSchema.safeParse(produto({ skus: [...grade(12), sku({ tamanho: '56' })] })).success).toBe(false);
  });
});

describe('movimento de estoque da interface pública (espelha os CHECKs do banco)', () => {
  const base = { skuId: CAT, tipo: 'ajuste', quantidade: -1, motivo: 'Contagem' };
  const VENDA = '5d1f0f6e-0c1d-4b0e-9a43-7d2f0f6f3a99';

  it('aceita ajuste negativo, entrada positiva e venda com origem', () => {
    expect(movimentoNovoSchema.safeParse(base).success).toBe(true);
    expect(movimentoNovoSchema.safeParse({ ...base, tipo: 'entrada', quantidade: 4 }).success).toBe(true);
    expect(movimentoNovoSchema.safeParse({ ...base, tipo: 'venda', origemId: VENDA }).success).toBe(true);
    expect(movimentoNovoSchema.safeParse({ ...base, tipo: 'estorno_venda', quantidade: 1, origemId: VENDA }).success).toBe(true);
  });

  it.each([
    ['venda positiva', { tipo: 'venda', quantidade: 1, origemId: VENDA }],
    ['venda sem origem', { tipo: 'venda' }],
    ['estorno de venda negativo', { tipo: 'estorno_venda', quantidade: -1, origemId: VENDA }],
    ['entrada com origem de venda', { tipo: 'entrada', quantidade: 1, origemId: VENDA }],
    ['entrada negativa', { tipo: 'entrada', quantidade: -1 }],
    ['inicial negativo', { tipo: 'inicial', quantidade: -1 }],
    ['quantidade zero', { quantidade: 0 }],
    ['quantidade fracionada', { quantidade: 0.5 }],
    ['motivo curto', { motivo: 'x' }],
    ['SKU que não é UUID', { skuId: 'abc' }],
  ])('recusa %s', (_nome, extra) => {
    expect(movimentoNovoSchema.safeParse({ ...base, ...extra }).success).toBe(false);
  });
});

describe('entrada e ajuste de estoque (RF-PRO-04)', () => {
  it('entrada é positiva e exige motivo', () => {
    expect(ajusteEstoqueSchema.safeParse({ tipo: 'entrada', quantidade: 5, motivo: 'Chegou pedido' }).success).toBe(true);
    expect(ajusteEstoqueSchema.safeParse({ tipo: 'entrada', quantidade: -5, motivo: 'Chegou pedido' }).success).toBe(false);
  });

  it('ajuste pode ser negativo (perda, contagem) mas nunca zero', () => {
    expect(ajusteEstoqueSchema.safeParse({ tipo: 'ajuste', quantidade: -2, motivo: 'Peça com defeito' }).success).toBe(true);
    expect(ajusteEstoqueSchema.safeParse({ tipo: 'ajuste', quantidade: 0, motivo: 'Peça com defeito' }).success).toBe(false);
  });

  it.each([
    ['sem motivo', { motivo: '' }],
    ['motivo de 2 letras', { motivo: 'ok' }],
    ['motivo com 201 caracteres', { motivo: 'x'.repeat(201) }],
    ['quantidade fracionada', { quantidade: 1.5 }],
    ['quantidade acima do limite', { quantidade: 100_001 }],
    ['tipo venda (só a Vendas grava)', { tipo: 'venda' }],
    ['tipo inicial (só o cadastro grava)', { tipo: 'inicial' }],
  ])('recusa %s', (_nome, extra) => {
    expect(ajusteEstoqueSchema.safeParse({ tipo: 'ajuste', quantidade: 2, motivo: 'Contagem', ...extra }).success).toBe(false);
  });
});

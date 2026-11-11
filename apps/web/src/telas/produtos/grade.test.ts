import { describe, expect, it } from 'vitest';
import {
  CORES_SUGERIDAS,
  GRADES,
  adicionarCor,
  adicionarTamanho,
  alternarCor,
  alternarTamanho,
  chaveSku,
  combinacoes,
  inteiroOuNulo,
  precosDoFormulario,
  skusDoFormulario,
} from './grade';

describe('grades de tamanho (P1 §3)', () => {
  it('as três grades da pesquisa: letras, sutiã numérico e único', () => {
    expect(GRADES.map((g) => g.id)).toEqual(['letras', 'sutia', 'unico']);
    expect(GRADES[0]?.tamanhos).toEqual(['P', 'M', 'G', 'GG']);
    expect(GRADES[1]?.tamanhos).toEqual(['40', '42', '44', '46', '48', '50', '52', '54', '56']);
    expect(GRADES[2]?.tamanhos).toEqual(['U']);
  });

  it('há cores sugeridas, todas diferentes', () => {
    expect(CORES_SUGERIDAS.length).toBeGreaterThan(4);
    expect(new Set(CORES_SUGERIDAS.map((c) => c.toLowerCase())).size).toBe(CORES_SUGERIDAS.length);
  });
});

describe('escolha de tamanhos', () => {
  it('liga e desliga um tamanho, mantendo a ordem de grade', () => {
    expect(alternarTamanho(['P', 'G'], 'M')).toEqual(['P', 'M', 'G']);
    expect(alternarTamanho(['P', 'M', 'G'], 'M')).toEqual(['P', 'G']);
  });

  it('tamanho digitado entra em maiúsculas; repetido, vazio e inválido são ignorados', () => {
    expect(adicionarTamanho(['P'], ' g1 ')).toEqual(['P', 'G1']);
    expect(adicionarTamanho(['P'], 'p')).toEqual(['P']);
    expect(adicionarTamanho(['P'], '')).toEqual(['P']);
    expect(adicionarTamanho(['P'], 'ABCD')).toEqual(['P']);
    expect(adicionarTamanho(['P'], '4-6')).toEqual(['P']);
  });
});

describe('escolha de cores', () => {
  it('liga e desliga uma cor sem diferenciar maiúsculas nem acento', () => {
    expect(alternarCor(['Preto'], 'Nude')).toEqual(['Preto', 'Nude']);
    expect(alternarCor(['Preto', 'Nude'], 'preto')).toEqual(['Nude']);
    expect(alternarCor(['Rosa Chá'], 'rosa cha')).toEqual([]);
  });

  it('cor digitada: apara, ignora repetida e vazia, e respeita o limite de 12', () => {
    expect(adicionarCor(['Preto'], '  Vinho  ')).toEqual(['Preto', 'Vinho']);
    expect(adicionarCor(['Preto'], 'PRETO')).toEqual(['Preto']);
    expect(adicionarCor(['Preto'], '   ')).toEqual(['Preto']);
    expect(adicionarCor(['Preto'], '---')).toEqual(['Preto']);
    const doze = Array.from({ length: 12 }, (_, i) => `Cor${String.fromCharCode(65 + i)}`);
    expect(adicionarCor(doze, 'Outra')).toEqual(doze);
  });
});

describe('combinações tamanho × cor', () => {
  it('uma por par, ordenadas por tamanho (ordem de grade) e depois pela ordem das cores escolhidas', () => {
    const c = combinacoes(['GG', 'P'], ['Preto', 'Nude']);
    expect(c.map((x) => `${x.tamanho}/${x.cor}`)).toEqual(['P/Preto', 'P/Nude', 'GG/Preto', 'GG/Nude']);
    expect(c[0]?.chave).toBe(chaveSku('P', 'Preto'));
  });

  it('sem tamanho ou sem cor não há combinação', () => {
    expect(combinacoes([], ['Preto'])).toEqual([]);
    expect(combinacoes(['P'], [])).toEqual([]);
  });

  it('a chave ignora maiúsculas e acento da cor', () => {
    expect(chaveSku('P', 'Rosa Chá')).toBe(chaveSku('P', 'rosa cha'));
    expect(chaveSku('P', 'Preto')).not.toBe(chaveSku('M', 'Preto'));
  });
});

describe('quantidade digitada', () => {
  it.each([
    ['0', 0],
    ['7', 7],
    [' 12 ', 12],
    ['100000', 100000],
  ])('"%s" vale %s', (texto, esperado) => {
    expect(inteiroOuNulo(texto)).toBe(esperado);
  });

  it.each(['', '  ', '-1', '1,5', '1.5', 'abc', '100001', '1e3', '0x10'])('"%s" não é uma quantidade válida', (texto) => {
    expect(inteiroOuNulo(texto)).toBeNull();
  });
});

describe('SKUs do formulário (estoque inicial e mínimo por SKU)', () => {
  const tamanhos = ['P', 'M'];
  const cores = ['Preto'];
  const linhas = {
    [chaveSku('P', 'Preto')]: { inicial: '4', minimo: '1' },
    [chaveSku('M', 'Preto')]: { inicial: '0', minimo: '2' },
  };

  it('monta os SKUs do contrato quando todas as linhas estão preenchidas', () => {
    expect(skusDoFormulario(tamanhos, cores, linhas)).toEqual({
      pendentes: 0,
      skus: [
        { tamanho: 'P', cor: 'Preto', estoque_inicial: 4, estoque_minimo: 1 },
        { tamanho: 'M', cor: 'Preto', estoque_inicial: 0, estoque_minimo: 2 },
      ],
    });
  });

  it('conta as linhas pendentes: mínimo em branco, inicial inválido ou linha que nem existe', () => {
    const faltando = {
      [chaveSku('P', 'Preto')]: { inicial: '4', minimo: '' },
      [chaveSku('M', 'Preto')]: { inicial: 'x', minimo: '2' },
    };
    expect(skusDoFormulario(tamanhos, cores, faltando).pendentes).toBe(2);
    expect(skusDoFormulario(tamanhos, cores, {}).pendentes).toBe(2);
  });

  it('com pendência não devolve SKUs (nada de enviar pela metade)', () => {
    expect(skusDoFormulario(tamanhos, cores, {}).skus).toEqual([]);
  });

  it('sem combinação nenhuma também está pendente', () => {
    expect(skusDoFormulario([], cores, {}).pendentes).toBeGreaterThan(0);
  });
});

describe('custo, preço e sugestão (RN-05)', () => {
  it('sugere custo × (1 + markup) em centavos', () => {
    expect(precosDoFormulario('45,00', '', 10_000)).toEqual({ custo: 4500, preco: null, sugerido: 9000 });
    expect(precosDoFormulario('45,00', '89,90', 10_000)).toEqual({ custo: 4500, preco: 8990, sugerido: 9000 });
  });

  it('o preço digitado é o que vale, mesmo diferente da sugestão', () => {
    expect(precosDoFormulario('45,00', '120', 10_000).preco).toBe(12_000);
  });

  it('custo vazio ou inválido não gera sugestão', () => {
    expect(precosDoFormulario('', '89,90', 10_000).sugerido).toBeNull();
    expect(precosDoFormulario('abc', '89,90', 10_000).custo).toBeNull();
    expect(precosDoFormulario('abc', '89,90', 10_000).sugerido).toBeNull();
  });

  it('custo zero não gera sugestão (a sugestão seria R$ 0,00)', () => {
    expect(precosDoFormulario('0', '', 10_000)).toMatchObject({ custo: 0, sugerido: null });
  });

  it('sugestão acima do teto de R$ 20 milhões não é oferecida', () => {
    expect(precosDoFormulario('15000000', '', 100_000).sugerido).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { formatarReais } from '../../lib/dinheiro';
import { textoEntraNoFinanceiroHoje } from './financeiro-hoje';

// F02: Fechamento e comprovante mostram o que entra no caixa hoje, por forma (D-A2 = à vista).
describe('textoEntraNoFinanceiroHoje (F02)', () => {
  it('uma forma: "Entra no financeiro hoje: R$ X (Pix)"', () => {
    expect(textoEntraNoFinanceiroHoje([{ forma: 'pix', valor_centavos: 8990 }])).toBe(
      `Entra no financeiro hoje: ${formatarReais(8990)} (Pix)`,
    );
  });

  it('várias formas na ordem, separadas por ·', () => {
    expect(
      textoEntraNoFinanceiroHoje([
        { forma: 'pix', valor_centavos: 5000 },
        { forma: 'dinheiro', valor_centavos: 3990 },
      ]),
    ).toBe(`Entra no financeiro hoje: ${formatarReais(5000)} (Pix) · ${formatarReais(3990)} (Dinheiro)`);
  });

  it('lista vazia ou total zero não gera linha', () => {
    expect(textoEntraNoFinanceiroHoje([])).toBeNull();
    expect(textoEntraNoFinanceiroHoje([{ forma: 'pix', valor_centavos: 0 }])).toBeNull();
  });
});

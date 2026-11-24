import { expect, test, type Page } from '@playwright/test';
import { entrarComoDono } from './apoio';

// M04 (plano aprimoramentos-voz-2026-11-23) em navegador real (360×640), Dono, nos 2 temas: com `voltar`, a seta e
// o <h1> ficam na mesma linha (seta · divisor · título), o título começa à direita da seta, nada sobra entre a linha
// e o conteúdo além do subtítulo, e não há rolagem horizontal. Um título longo quebra sem mover a seta (D23).
// Tudo medido no DOM (L-0015, L-0017). E2E_CAPTURAS=<pasta> imprime as medidas e salva screenshots (revisão humana).
const TEMAS = ['light', 'dark'] as const;
const ROTAS: [string, string][] = [
  ['compras', '/compras'],
  ['produtos', '/produtos'],
  ['financeiro', '/financeiro'],
  ['novo-produto', '/produtos/novo'],
];
const pasta = process.env.E2E_CAPTURAS;

async function usarTema(page: Page, tema: (typeof TEMAS)[number]) {
  await page.evaluate((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
}

/** Medidas do topo do conteúdo: seta, h1, divisor e o 1º elemento depois do bloco do título. */
async function medir(page: Page) {
  return page.evaluate(() => {
    const caixa = (e: Element | null) => {
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, fim: r.y + r.height, dir: r.x + r.width };
    };
    const main = document.getElementById('conteudo') as HTMLElement;
    const h1 = main.querySelector('h1') as HTMLElement;
    const seta = main.querySelector('button[aria-label^="Voltar para "]');
    // O bloco do título é o filho da coluna principal (Container > Stack) que contém o h1; o 1º conteúdo vem depois.
    const coluna = main.firstElementChild?.firstElementChild as HTMLElement;
    const bloco = Array.from(coluna.children).find((c) => c.contains(h1)) ?? null;
    const conteudo = bloco?.nextElementSibling ?? null;
    const subtitulo = h1.closest('[data-topo-modulo]')?.parentElement?.querySelector('[data-subtitulo]') ?? null;
    const estilo = getComputedStyle(h1);
    return {
      main: caixa(main),
      h1: caixa(h1),
      seta: caixa(seta),
      divisor: caixa(main.querySelector('[data-divisor-voltar]')),
      conteudo: caixa(conteudo),
      subtitulo: caixa(subtitulo),
      linhaH1: parseFloat(estilo.lineHeight) || parseFloat(estilo.fontSize) * 1.3,
      fonteH1: parseFloat(estilo.fontSize),
      reticencias: estilo.textOverflow === 'ellipsis' || estilo.whiteSpace === 'nowrap',
      h1Sw: h1.scrollWidth,
      h1Cw: h1.clientWidth,
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
      mainSw: main.scrollWidth,
      mainCw: main.clientWidth,
    };
  });
}

type Medidas = Awaited<ReturnType<typeof medir>>;
const r = (n: number | undefined) => (n === undefined ? '-' : Math.round(n * 10) / 10);

function conferirLinha(m: Medidas, rotulo: string) {
  const { h1, seta, divisor } = m;
  if (!h1 || !seta) throw new Error(`${rotulo}: h1 ou seta ausente`);
  expect(seta.w, `${rotulo}: alvo da seta`).toBeGreaterThanOrEqual(48);
  expect(seta.h, `${rotulo}: alvo da seta`).toBeGreaterThanOrEqual(48);
  // O título começa à direita da seta e na mesma faixa vertical (não embaixo dela).
  expect(h1.x, `${rotulo}: h1 x ${r(h1.x)} vs fim da seta ${r(seta.dir)}`).toBeGreaterThan(seta.dir);
  expect(h1.y, `${rotulo}: h1 começa ${r(h1.y)} depois do fim da seta ${r(seta.fim)}`).toBeLessThan(seta.fim);
  expect(h1.fim, `${rotulo}: h1 acaba acima da seta`).toBeGreaterThan(seta.y);
  // Divisor sutil entre a seta e o título.
  if (!divisor) throw new Error(`${rotulo}: divisor ausente`);
  expect(divisor.w, `${rotulo}: largura do divisor`).toBeLessThanOrEqual(2);
  expect(divisor.h, `${rotulo}: altura do divisor`).toBeGreaterThanOrEqual(20);
  expect(divisor.h, `${rotulo}: altura do divisor`).toBeLessThanOrEqual(36);
  expect(divisor.x, `${rotulo}: divisor depois da seta`).toBeGreaterThanOrEqual(seta.dir);
  expect(divisor.dir, `${rotulo}: divisor antes do título`).toBeLessThanOrEqual(h1.x);
  expect(m.reticencias, `${rotulo}: título com reticências/nowrap`).toBe(false);
  // Sem rolagem horizontal (página e coluna rolável) e o h1 não transborda.
  expect(m.sw, `${rotulo}: scrollWidth ${m.sw} > clientWidth ${m.cw}`).toBeLessThanOrEqual(m.cw);
  expect(m.mainSw, `${rotulo}: main scrollWidth ${m.mainSw} > clientWidth ${m.mainCw}`).toBeLessThanOrEqual(m.mainCw);
  expect(m.h1Sw, `${rotulo}: h1 transborda (${m.h1Sw} > ${m.h1Cw})`).toBeLessThanOrEqual(m.h1Cw);
  expect(h1.dir, `${rotulo}: h1 passa da tela`).toBeLessThanOrEqual(m.cw);
}

test('M04: seta e título na mesma linha, sem rolagem horizontal, conteúdo sobe (Compras, Produtos, Financeiro, Novo produto; 2 temas)', async ({ page }) => {
  await entrarComoDono(page);
  for (const tema of TEMAS) {
    for (const [nome, rota] of ROTAS) {
      await page.goto(rota);
      if (nome === ROTAS[0]![0]) await usarTema(page, tema);
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).not.toHaveText('Ailow Cloud');
      await expect(page.getByRole('button', { name: /^Voltar para / })).toBeVisible();
      const rotulo = `${nome}/${tema}`;
      const m = await medir(page);
      const topoConteudo = m.conteudo && m.main ? m.conteudo.y - m.main.y : NaN;
      if (pasta) {
        console.log(
          `${rotulo}: seta x ${r(m.seta?.x)}..${r(m.seta?.dir)} y ${r(m.seta?.y)}..${r(m.seta?.fim)} | h1 x ${r(m.h1?.x)} y ${r(m.h1?.y)}..${r(m.h1?.fim)} fz ${m.fonteH1}` +
            ` | divisor ${m.divisor ? `${r(m.divisor.w)}x${r(m.divisor.h)}` : '-'} | 1º conteúdo top (rel. main) ${r(topoConteudo)} | sw ${m.sw}/cw ${m.cw} main ${m.mainSw}/${m.mainCw}`,
        );
        await page.screenshot({ path: `${pasta}/m04-${nome}-${tema}.png` });
      }
      conferirLinha(m, rotulo);
      // Entre a linha da seta e o 1º conteúdo só cabem o subtítulo (se houver) e os espaçamentos da coluna.
      if (!m.conteudo || !m.seta) throw new Error(`${rotulo}: 1º conteúdo ausente`);
      const sub = m.subtitulo ? m.subtitulo.h + 8 : 0;
      expect(m.conteudo.y - m.seta.fim, `${rotulo}: sobra entre a linha da seta e o conteúdo`).toBeLessThanOrEqual(20 + sub + 2);
      // Título de 1 linha fica centrado na seta.
      if (m.h1 && m.h1.h < m.linhaH1 * 1.5) {
        expect(Math.abs(m.h1.y + m.h1.h / 2 - (m.seta.y + m.seta.h / 2)), `${rotulo}: título centrado na seta`).toBeLessThanOrEqual(2);
      }
    }
  }
});

test('M04: título longo quebra linha sem mover a seta e sem rolagem horizontal (D23, 2 temas)', async ({ page }) => {
  await entrarComoDono(page);
  await page.goto('/financeiro/contas-a-pagar');
  const LONGOS = [
    'Contas a receber dos clientes do atacado em dezembro',
    'Vestidolongodefestabordadocompedrariaecaudaextra',
  ];
  for (const tema of TEMAS) {
    await usarTema(page, tema);
    const h1 = page.getByRole('heading', { level: 1, name: 'Contas a pagar' });
    await expect(h1).toBeVisible();
    const antes = await medir(page);
    for (const [i, texto] of LONGOS.entries()) {
      // Sonda de layout: só o texto do h1 muda; o CSS e a estrutura são os reais da Moldura.
      await page.evaluate((t) => {
        const el = document.querySelector('#conteudo h1') as HTMLElement;
        el.textContent = t;
      }, texto);
      const m = await medir(page);
      const rotulo = `longo${i + 1}/${tema}`;
      if (pasta) {
        console.log(`${rotulo}: seta y ${r(m.seta?.y)} (antes ${r(antes.seta?.y)}) x ${r(m.seta?.x)} | h1 ${r(m.h1?.w)}x${r(m.h1?.h)} (linha ${r(m.linhaH1)}) | sw ${m.sw}/cw ${m.cw}`);
        await page.screenshot({ path: `${pasta}/m04-${rotulo.replace('/', '-')}.png`, clip: { x: 0, y: 0, width: 360, height: 260 } });
      }
      conferirLinha(m, rotulo);
      if (!m.seta || !antes.seta || !m.h1) throw new Error(`${rotulo}: caixas ausentes`);
      // Quebrou em 2+ linhas e a seta não foi empurrada nem encolhida.
      expect(m.h1.h, `${rotulo}: título não quebrou (${r(m.h1.h)} px)`).toBeGreaterThan(m.linhaH1 * 1.5);
      expect(Math.abs(m.seta.x - antes.seta.x), `${rotulo}: seta andou na horizontal`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(m.seta.y - antes.seta.y), `${rotulo}: seta andou na vertical`).toBeLessThanOrEqual(0.5);
      expect(m.seta.w, `${rotulo}: seta encolheu`).toBeGreaterThanOrEqual(48);
      // Título quebrado começa no topo da linha (alinhado à seta), não acima dela.
      expect(m.h1.y, `${rotulo}: título sobe acima da seta`).toBeGreaterThanOrEqual(m.seta.y - 1);
    }
    await page.reload();
  }
});

import { expect, test, type Page } from '@playwright/test';
import { contraste, hexNormalizado, saturacaoHsl } from '../src/tema/contraste';
import { abrirInicio, entrarComoDono, sufixoUnico } from './apoio';

// M03 (plano aprimoramentos-voz-2026-11-23, D-A3) em navegador real (360×640), Dono e Vendedor, nos 2 temas:
// o selo de perfil fica no baixo-centro do avatar, inteiro dentro do topo sem encostar na borda, sem invadir o botão
// de Trocar, com cor diferente da do avatar e texto AA. Tudo medido no DOM (L-0015, L-0017).
// 1 login só do Dono (limite de 10/min por IP); o Vendedor entra pelo PIN na mesma sessão.
// E2E_CAPTURAS=<pasta> salva um screenshot do topo por perfil/tema (só para revisão humana).
const TEMAS = ['light', 'dark'] as const;
const FOLGA = 2;
const ANEL = 2;

async function usarTema(page: Page, tema: (typeof TEMAS)[number]) {
  await page.evaluate((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
}

async function medirTopo(page: Page, rotulo: string, nome: string) {
  const topo = page.locator('header.ailow-topo');
  const selo = page.locator('.ailow-menu-usuario__badge');
  const gatilho = page.getByRole('button', { name: new RegExp(`Menu de ${nome}`) });
  const trocar = page.getByRole('button', { name: 'Trocar de usuário' });
  await expect(selo).toBeVisible();
  await expect(trocar).toBeVisible();
  const [t, s, g, tr] = await Promise.all([topo.boundingBox(), selo.boundingBox(), gatilho.boundingBox(), trocar.boundingBox()]);
  if (!t || !s || !g || !tr) throw new Error(`${rotulo}: caixa ausente`);
  const largura = page.viewportSize()?.width ?? 360;
  const bordaTopo = await topo.evaluate((e) => parseFloat(getComputedStyle(e).borderBottomWidth) || 0);
  const fimUtil = t.y + t.height - bordaTopo;

  // Inteiro dentro do topo, sem encostar no limite de baixo, e dentro da largura da tela.
  expect(s.y, `${rotulo}: selo acima do topo`).toBeGreaterThanOrEqual(t.y + FOLGA);
  expect(s.y + s.height, `${rotulo}: fim do selo ${s.y + s.height} vs fim do topo ${fimUtil}`).toBeLessThanOrEqual(fimUtil - FOLGA);
  expect(s.x, `${rotulo}: selo sai pela esquerda`).toBeGreaterThanOrEqual(0);
  expect(s.x + s.width, `${rotulo}: selo sai pela direita`).toBeLessThanOrEqual(largura);
  // Baixo-centro do avatar, sobrepondo a borda inferior (estilo selo).
  expect(Math.abs(s.x + s.width / 2 - (g.x + g.width / 2)), `${rotulo}: selo centrado no avatar`).toBeLessThanOrEqual(1);
  expect(s.y, `${rotulo}: selo começa dentro do avatar`).toBeLessThan(g.y + g.height);
  expect(s.y + s.height, `${rotulo}: selo passa da borda inferior do avatar`).toBeGreaterThan(g.y + g.height);
  // Não invade o botão de Trocar: sobra pelo menos o anel de 2 px do selo + 2 px de ar.
  expect(s.x + s.width + ANEL + FOLGA, `${rotulo}: selo encosta no Trocar (${s.x + s.width} vs ${tr.x})`).toBeLessThanOrEqual(tr.x);
  expect(tr.height, `${rotulo}: alvo do Trocar`).toBeGreaterThanOrEqual(48);

  // Cor do selo != cor do avatar; texto do selo AA.
  const cores = await page.evaluate(() => {
    const b = document.querySelector('.ailow-menu-usuario__badge') as HTMLElement;
    const av = document.querySelector('[data-inicial-usuario] .mantine-Avatar-root') as HTMLElement;
    const ph = av.querySelector('.mantine-Avatar-placeholder') as HTMLElement | null;
    const visivel = (e: HTMLElement | null) => {
      const c = e ? getComputedStyle(e).backgroundColor : '';
      return c && c !== 'rgba(0, 0, 0, 0)' ? c : '';
    };
    return {
      fundo: getComputedStyle(b).backgroundColor,
      texto: getComputedStyle(b).color,
      avatar: visivel(ph) || visivel(av),
    };
  });
  expect(cores.avatar, `${rotulo}: cor do avatar medida`).not.toBe('');
  expect(hexNormalizado(cores.fundo), `${rotulo}: selo com a cor do avatar`).not.toBe(hexNormalizado(cores.avatar));
  // Cinza sobre cinza não basta (era a queixa): o avatar visível tem a cor da marca e o selo é neutro.
  expect(saturacaoHsl(cores.avatar), `${rotulo}: avatar visível ${cores.avatar} sem a cor da marca`).toBeGreaterThanOrEqual(50);
  expect(saturacaoHsl(cores.fundo), `${rotulo}: selo ${cores.fundo} não é neutro`).toBeLessThanOrEqual(15);
  const razao = contraste(cores.texto, cores.fundo);
  expect(razao, `${rotulo}: texto ${cores.texto} sobre ${cores.fundo} = ${razao.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);

  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(m.sw, `${rotulo}: scrollWidth ${m.sw} > clientWidth ${m.cw}`).toBeLessThanOrEqual(m.cw);

  const pasta = process.env.E2E_CAPTURAS;
  if (pasta) {
    const r = (n: number) => Math.round(n * 10) / 10;
    console.log(`${rotulo}: selo y ${r(s.y)}..${r(s.y + s.height)} x ${r(s.x)}..${r(s.x + s.width)} | topo y ${r(t.y)}..${r(fimUtil)} | trocar x ${r(tr.x)} | contraste ${razao.toFixed(2)}:1 (${cores.texto} sobre ${cores.fundo}; avatar ${cores.avatar}) | sw ${m.sw}/cw ${m.cw}`);
  }
  if (pasta) await page.screenshot({ path: `${pasta}/m03-${rotulo.replace('/', '-')}.png`, clip: { x: 0, y: 0, width: largura, height: 200 } });
  return { selo: s, topo: t, trocar: tr, razao, cores };
}

test('M03: selo de perfil no baixo-centro do avatar, dentro do topo, cor própria e AA (Dono e Vendedor, 2 temas)', async ({ page }) => {
  const api = await entrarComoDono(page);
  const nomeDono = ((await (await api.get('/acesso/eu')).json()) as { usuario: { nome: string } }).usuario.nome;
  await abrirInicio(page);
  for (const tema of TEMAS) {
    await usarTema(page, tema);
    await medirTopo(page, `dono/${tema}`, nomeDono);
  }
  // Sair continua no menu da inicial, com o ícone de porta de saída (o UXM-06 de pin-login confere o fluxo).
  await page.getByRole('button', { name: new RegExp(`Menu de ${nomeDono}`) }).click();
  await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible();
  if (process.env.E2E_CAPTURAS) await page.screenshot({ path: `${process.env.E2E_CAPTURAS}/m03-menu-sair-dark.png`, clip: { x: 0, y: 0, width: 360, height: 220 } });
  await page.keyboard.press('Escape');

  const pin = '2468';
  const nomeVendedor = `Vend Selo ${sufixoUnico()}`;
  const criado = await api.post('/usuarios', { data: { nome: nomeVendedor, pin } });
  expect(criado.status(), 'vendedor criado').toBe(201);
  const { id: usuario_id } = (await criado.json()) as { id: string };
  expect((await api.post('/acesso/pin', { data: { usuario_id, pin } })).status(), 'sessão do vendedor').toBe(200);
  await abrirInicio(page);
  for (const tema of TEMAS) {
    await usarTema(page, tema);
    await expect(page.locator('.ailow-menu-usuario__badge')).toHaveText(/vendedor/i);
    await medirTopo(page, `vendedor/${tema}`, nomeVendedor);
  }
});

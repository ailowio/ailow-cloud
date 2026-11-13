import { expect, test, type Page } from '@playwright/test';
import { abrirInicio, entrarComoDono } from './apoio';

// S14a / UXM-04: o erro de uma AÇÃO do usuário (aqui, bater ponto) aparece como toast e nada se mexe na tela.
// Antes virava um texto vermelho inline que empurrava o layout. A falha é provocada na rede do navegador
// (a API real não recusa uma batida válida) e a medida vem do DOM, nunca de constantes (L-0017).
const TEMAS = ['dark', 'light'] as const;

async function medidas(page: Page) {
  return page.evaluate(() => {
    const botao = [...document.querySelectorAll('main button')].find((b) => /Bater (entrada|saída)/.test(b.textContent ?? '')) as HTMLElement;
    const r = botao.getBoundingClientRect();
    const raiz = document.scrollingElement ?? document.documentElement;
    return {
      botao: { x: r.x, y: r.y, w: r.width, h: r.height },
      alturaDoDocumento: raiz.scrollHeight,
      alertasNoMain: document.querySelectorAll('main [role="alert"]').length,
    };
  });
}

for (const tema of TEMAS) {
  test(`bater ponto com erro (tema ${tema}): aviso em toast, sem bloco inline e o layout não se mexe`, async ({ page }) => {
    await entrarComoDono(page);
    await page.addInitScript((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
    await abrirInicio(page);
    await page.getByRole('button', { name: 'Pessoas' }).click();
    const bater = page.getByRole('button', { name: /^Bater (entrada|saída)$/ });
    await expect(bater).toBeVisible();
    const antes = await medidas(page);

    let chamadas = 0;
    await page.route('**/pontos', async (rota) => {
      if (rota.request().method() !== 'POST') return rota.fallback();
      chamadas += 1;
      return rota.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ erro: 'erro_interno' }) });
    });
    await bater.click();
    const toast = page.locator('.mantine-Notifications-notification').filter({ hasText: /./ });
    await expect(toast.first(), 'o erro aparece como toast').toBeVisible();
    expect(chamadas, 'a batida foi mesmo recusada pela rede simulada').toBe(1);

    const depois = await medidas(page);
    expect(depois.alertasNoMain, 'nenhum bloco de erro inline na tela').toBe(0);
    expect(depois.botao, 'o botão não se mexeu').toEqual(antes.botao);
    expect(depois.alturaDoDocumento, 'a altura da tela não mudou').toBe(antes.alturaDoDocumento);
  });
}

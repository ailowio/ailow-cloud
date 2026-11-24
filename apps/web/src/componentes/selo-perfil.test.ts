import { readFileSync } from 'node:fs';
import { IconDoorExit, IconReplaceUser } from '@tabler/icons-react';
import { describe, expect, it } from 'vitest';
import { contraste, hexNormalizado } from '../tema/contraste';

// M03 (plano aprimoramentos-voz-2026-11-23, D-A3): selo de perfil com cor própria (não a do avatar), ícone de troca
// com setas de ida e volta e Sair com ícone de porta de saída. As cores são lidas do tema.css real, nunca repetidas
// à mão aqui (L-0017); a geometria no navegador está em e2e/selo-perfil.e2e.ts.
const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const css = ler('../tema/tema.css');
const sessao = ler('./sessao.tsx');

function tokens(esquema: 'light' | 'dark'): Record<string, string> {
  const bloco = new RegExp(`:root\\[data-mantine-color-scheme='${esquema}'\\]\\s*\\{([^}]*)\\}`).exec(css);
  if (!bloco) throw new Error(`bloco ${esquema} ausente em tema.css`);
  const comum = /(?:^|\n):root\s*\{([^}]*)\}/.exec(css);
  const mapa: Record<string, string> = {};
  for (const texto of [comum?.[1] ?? '', bloco[1] as string]) {
    for (const m of texto.matchAll(/(--[\w-]+):\s*([^;]+);/g)) mapa[m[1] as string] = (m[2] as string).trim();
  }
  return mapa;
}

describe('selo de perfil, Trocar e Sair (M03)', () => {
  for (const esquema of ['light', 'dark'] as const) {
    describe(`tema ${esquema}`, () => {
      const t = tokens(esquema);
      const selo = t['--ailow-selo'] as string;
      const sobre = t['--ailow-sobre-selo'] as string;

      it('texto do selo sobre o fundo do selo >= 4,5:1', () => {
        const razao = contraste(sobre, selo);
        expect(razao, `${sobre} sobre ${selo} = ${razao.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      });

      it('o selo se destaca do topo (>= 3:1, componente gráfico)', () => {
        const razao = contraste(selo, t['--ailow-topo'] as string);
        expect(razao, `${selo} sobre topo ${t['--ailow-topo']} = ${razao.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
      });

      it('o selo não tem a cor do avatar (marca) nem a da ação', () => {
        expect(hexNormalizado(selo)).not.toBe(hexNormalizado(t['--ailow-marca'] as string));
        expect(hexNormalizado(selo)).not.toBe(hexNormalizado(t['--ailow-acao'] as string));
      });
    });
  }

  it('o selo usa os tokens próprios e não fica mais no topo do avatar', () => {
    const ini = sessao.indexOf('ailow-menu-usuario__badge');
    const bloco = sessao.slice(ini, sessao.indexOf('</Badge>', ini));
    expect(bloco).toContain('var(--ailow-selo)');
    expect(bloco).toContain('var(--ailow-sobre-selo)');
    expect(bloco).not.toMatch(/top:\s*0/);
    expect(bloco).not.toMatch(/color="gray"/);
  });

  it('os ícones escolhidos existem no @tabler/icons-react instalado', () => {
    expect(IconReplaceUser).toBeDefined();
    expect(IconDoorExit).toBeDefined();
  });

  it('Trocar de usuário usa setas de ida e volta + pessoa (IconReplaceUser)', () => {
    const ini = sessao.indexOf('export function BotaoTrocarUsuario');
    const botao = sessao.slice(ini, sessao.indexOf('</ActionIcon>', ini));
    expect(botao).toContain('aria-label="Trocar de usuário"');
    expect(botao).toContain('size={48}');
    expect(botao).toContain('<IconReplaceUser');
    expect(botao).not.toContain('<IconUsers');
  });

  it('Sair fica no menu, vermelho, com ícone de porta de saída', () => {
    const dropdown = sessao.slice(sessao.indexOf('<Menu.Dropdown>'), sessao.indexOf('</Menu.Dropdown>'));
    expect(dropdown).toMatch(/color="red"[^>]*<IconDoorExit/);
    expect(dropdown).toMatch(/>\s*Sair\s*</);
  });
});

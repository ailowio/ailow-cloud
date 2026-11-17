import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('chrome da marca e sessão (itens 1–4)', () => {
  it('wordmark da Moldura é só Ailow, menor e sem ERP', () => {
    const fonte = ler('../telas/Moldura.tsx');
    expect(fonte).toMatch(/>\s*Ailow\s*</);
    expect(fonte).not.toMatch(/Ailow ERP/);
    expect(fonte).toMatch(/fz=\{16\}/);
    expect(fonte).toMatch(/fw=\{600\}/);
  });

  it('Logo da marca usa currentColor alinhado a --ailow-marca-texto', () => {
    const fonte = ler('./Logo.tsx');
    expect(fonte).toContain('logo.svg?raw');
    expect(fonte).toContain('fill="currentColor"');
    expect(fonte).toContain('var(--ailow-marca-texto)');
  });

  it('MenuUsuario não trunca o nome e mostra badge de perfil', () => {
    const fonte = ler('./sessao.tsx');
    expect(fonte).not.toMatch(/maw=\{120\}/);
    expect(fonte).not.toMatch(/textOverflow:\s*'ellipsis'/);
    expect(fonte).toContain('Badge');
    expect(fonte).toContain('perfil');
    expect(fonte).toContain('BotaoTrocarUsuario');
  });

  it('Moldura expõe Trocar de usuário na toolbar', () => {
    const fonte = ler('../telas/Moldura.tsx');
    expect(fonte).toContain('BotaoTrocarUsuario');
  });

  it('QuemUsa renderiza perfil como Badge', () => {
    const fonte = ler('../telas/QuemUsa.tsx');
    expect(fonte).toMatch(/Badge[\s\S]*PERFIL\[u\.perfil\]/);
    expect(fonte).not.toMatch(/<Text size="sm" c="dimmed">\{PERFIL/);
  });
});

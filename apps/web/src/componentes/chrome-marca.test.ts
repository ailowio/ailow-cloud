import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inicialDoNome } from './sessao';

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

  it('inicialDoNome pega a primeira letra', () => {
    expect(inicialDoNome('Dono de Exemplo')).toBe('D');
    expect(inicialDoNome('  ana')).toBe('A');
    expect(inicialDoNome('')).toBe('?');
  });

  it('MenuUsuario: avatar com inicial, badge na borda e menu só com Sair', () => {
    const fonte = ler('./sessao.tsx');
    expect(fonte).toContain('data-inicial-usuario');
    expect(fonte).toContain('inicialDoNome');
    expect(fonte).toContain('Avatar');
    expect(fonte).toContain('ailow-menu-usuario__badge');
    expect(fonte).toMatch(/translate\(-50%,\s*-50%\)/);
    expect(fonte).toContain('Sair');
    // Trocar ficou no ícone da toolbar, não no dropdown.
    const dropdown = fonte.slice(fonte.indexOf('<Menu.Dropdown>'), fonte.indexOf('</Menu.Dropdown>'));
    expect(dropdown).not.toMatch(/Trocar de usuário/);
    expect(fonte).toContain('BotaoTrocarUsuario');
  });

  it('Moldura: toolbar = MenuUsuario, Trocar, Tema', () => {
    const fonte = ler('../telas/Moldura.tsx');
    expect(fonte).toContain('BotaoTrocarUsuario');
    expect(fonte).toContain('MenuUsuario');
    expect(fonte).toContain('AlternarTema');
    const trecho = fonte.slice(fonte.indexOf('<MenuUsuario'), fonte.indexOf('<AlternarTema'));
    expect(trecho.indexOf('MenuUsuario')).toBeLessThan(trecho.indexOf('BotaoTrocarUsuario'));
  });

  it('QuemUsa renderiza perfil como Badge', () => {
    const fonte = ler('../telas/QuemUsa.tsx');
    expect(fonte).toMatch(/Badge[\s\S]*PERFIL\[u\.perfil\]/);
    expect(fonte).not.toMatch(/<Text size="sm" c="dimmed">\{PERFIL/);
  });
});

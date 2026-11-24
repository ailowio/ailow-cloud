import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inicialDoNome } from './sessao';

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('chrome da marca e sessão (itens 1–4)', () => {
  // D-A3 (Pedro, 23/11): o topo mostra "Ailow" / "Cloud" em 2 linhas ao lado do A; nunca "Ailow ERP".
  it('wordmark da Moldura é Ailow/Cloud em 2 linhas, sem ERP', () => {
    const fonte = ler('../telas/Moldura.tsx');
    expect(fonte).not.toMatch(/Ailow ERP/);
    const ini = fonte.indexOf('data-wordmark');
    expect(ini).toBeGreaterThan(-1);
    const bloco = fonte.slice(ini, fonte.indexOf('</Stack>', ini));
    // Linha 1: Ailow (fw 700, cor da marca); linha 2: Cloud (fw 500, tom apagado), nessa ordem.
    expect(bloco).toMatch(/fw=\{700\}[^>]*>\s*Ailow\s*</);
    expect(bloco).toMatch(/fw=\{500\}[^>]*>\s*Cloud\s*</);
    expect(bloco.indexOf('Ailow')).toBeLessThan(bloco.indexOf('Cloud'));
    expect(bloco).toContain('var(--ailow-marca-texto)');
    expect(bloco).toContain('c="dimmed"');
    expect(bloco).toContain('var(--mantine-font-family-headings)');
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
    // M03/D-A3 (Pedro, 23/11): o selo de perfil sai do topo e fica no baixo-centro do avatar.
    expect(fonte).toMatch(/bottom:[^,]+,\s*left:\s*'50%',\s*transform:\s*'translateX\(-50%\)'/);
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

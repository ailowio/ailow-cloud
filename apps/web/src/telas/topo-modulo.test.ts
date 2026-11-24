import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// M04 (plano aprimoramentos-voz-2026-11-23): com `voltar`, a seta e o <h1> ficam na mesma linha (seta · divisor ·
// título) para ganhar altura no celular; o título quebra linha e nunca usa reticências (D23). A geometria real
// (título à direita da seta, mesma faixa, ganho vertical, sem rolagem horizontal) está em e2e/topo-modulo.e2e.ts.
const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const moldura = ler('./Moldura.tsx');

function blocoDoTopoDeModulo(): string {
  const ini = moldura.indexOf('data-topo-modulo');
  expect(ini, 'linha seta + título (data-topo-modulo) ausente na Moldura').toBeGreaterThan(-1);
  return moldura.slice(ini, moldura.indexOf('</Group>', ini));
}

describe('topo de módulo compacto (M04)', () => {
  it('seta, divisor e título ficam numa linha que não quebra (Group nowrap), nessa ordem', () => {
    const bloco = blocoDoTopoDeModulo();
    const abertura = moldura.slice(moldura.lastIndexOf('<Group', moldura.indexOf('data-topo-modulo')), moldura.indexOf('data-topo-modulo'));
    expect(abertura + bloco).toContain('wrap="nowrap"');
    const seta = bloco.indexOf('<ActionIcon');
    const divisor = bloco.indexOf('data-divisor-voltar');
    const titulo = bloco.indexOf('{titulo}');
    expect(seta).toBeGreaterThan(-1);
    expect(divisor).toBeGreaterThan(seta);
    expect(titulo).toBeGreaterThan(divisor);
  });

  it('a seta mantém alvo de 48 px e o rótulo "Voltar para <destino>"', () => {
    const bloco = blocoDoTopoDeModulo();
    const seta = bloco.slice(bloco.indexOf('<ActionIcon'), bloco.indexOf('</ActionIcon>'));
    expect(seta).toContain('size={48}');
    expect(seta).toContain('aria-label={`Voltar para ${props.voltar.rotulo}`}');
    expect(seta).toContain('<IconArrowLeft');
  });

  it('um só <h1> no código e o título quebra linha sem reticências (D23)', () => {
    expect(moldura.match(/<Title\s+order=\{1\}/g) ?? []).toHaveLength(1);
    const titulo = moldura.slice(moldura.indexOf('<Title order={1}'), moldura.indexOf('</Title>'));
    expect(titulo).toContain("overflowWrap: 'anywhere'");
    expect(titulo).not.toMatch(/lineClamp|truncate|ellipsis|nowrap/);
  });

  it('o título do módulo usa fz 22; sem voltar, a tela continua com o título de 28', () => {
    expect(moldura).toMatch(/fz=\{props\.voltar \? 22 : 28\}/);
  });
});

describe('Entrar: Trocar de usuário com o mesmo ícone da toolbar (M04)', () => {
  it('usa IconReplaceUser, não IconUsers, e mantém o rótulo', () => {
    const entrar = ler('./Entrar.tsx');
    expect(entrar).toContain('<IconReplaceUser');
    expect(entrar).not.toContain('IconUsers');
    expect(entrar).toMatch(/>\s*Trocar de usuário\s*</);
  });
});

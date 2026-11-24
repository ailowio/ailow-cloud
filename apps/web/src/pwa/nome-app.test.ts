import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// D-A3 (Pedro, 23/11): o nome do produto é "Ailow Cloud" em tudo (manifest, <title>, topo, tela inicial, catálogo).
const web = fileURLToPath(new URL('../../', import.meta.url));
const ler = (rel: string) => readFileSync(join(web, rel), 'utf8');

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : [caminho];
  });
}

describe('nome do app: Ailow Cloud (D-A3)', () => {
  it('manifest: name e short_name', () => {
    const manifest = JSON.parse(ler('public/manifest.webmanifest')) as { name: string; short_name: string };
    expect(manifest.name).toBe('Ailow Cloud');
    expect(manifest.short_name).toBe('Ailow Cloud');
  });

  it('index.html: <title> e apple-mobile-web-app-title', () => {
    const html = ler('index.html');
    expect(html).toMatch(/<title>Ailow Cloud<\/title>/);
    expect(html).toMatch(/<meta name="apple-mobile-web-app-title" content="Ailow Cloud" \/>/);
  });

  it('título da tela de carregamento (App) e do catálogo', () => {
    expect(ler('src/App.tsx')).toContain('<Moldura titulo="Ailow Cloud">');
    expect(ler('src/catalogo/Catalogo.tsx')).toMatch(/<Title order=\{1\}[^>]*>Ailow Cloud<\/Title>/);
  });

  it('nenhum "Ailow ERP" sobra em src/, public/ ou index.html', () => {
    const lista = [...arquivos(join(web, 'src')), ...arquivos(join(web, 'public')), join(web, 'index.html')]
      .filter((f) => /\.(tsx?|html|js|json|webmanifest|css|svg)$/.test(f))
      // Os próprios testes citam o nome antigo só para proibi-lo.
      .filter((f) => !/\.test\.ts$/.test(f));
    const sobras = lista.filter((f) => readFileSync(f, 'utf8').includes('Ailow ERP'));
    expect(sobras).toEqual([]);
  });
});

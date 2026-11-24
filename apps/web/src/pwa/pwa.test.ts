import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const publico = (nome: string) => new URL(`../../public/${nome}`, import.meta.url);
const ler = (nome: string) => readFileSync(publico(nome));

interface Icone {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

describe('manifest do PWA (instalável)', () => {
  const manifest = JSON.parse(ler('manifest.webmanifest').toString('utf8')) as {
    name: string;
    short_name: string;
    start_url: string;
    scope: string;
    display: string;
    lang: string;
    icons: Icone[];
    background_color: string;
    theme_color: string;
  };

  it('tem os campos exigidos para instalar no Android/Chrome', () => {
    expect(manifest.name).toBe('Ailow Cloud');
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.lang).toBe('pt-BR');
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('declara ícones de 192 e 512 px e um maskable, e cada arquivo é um PNG do tamanho declarado', () => {
    const tamanhos = manifest.icons.map((i) => `${i.sizes}:${i.purpose ?? 'any'}`).sort();
    expect(tamanhos).toEqual(['192x192:any', '512x512:any', '512x512:maskable']);
    for (const icone of manifest.icons) {
      expect(icone.type).toBe('image/png');
      const png = ler(icone.src.replace(/^\//, ''));
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      const [w, h] = icone.sizes.split('x').map(Number);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([w, h]);
    }
  });
});

describe('service worker mínimo', () => {
  type Ouvinte = (e: unknown) => void;
  const codigo = readFileSync(publico('sw.js'), 'utf8');

  function carregar() {
    const ouvintes: Record<string, Ouvinte> = {};
    const cache = { addAll: vi.fn(async () => {}), put: vi.fn(async () => {}), match: vi.fn(async () => undefined) };
    const sandbox = {
      self: {
        addEventListener: (tipo: string, fn: Ouvinte) => {
          ouvintes[tipo] = fn;
        },
        skipWaiting: vi.fn(),
        clients: { claim: vi.fn() },
        location: { origin: 'https://app.ailow.test' },
      },
      caches: {
        open: vi.fn(async () => cache),
        keys: vi.fn(async () => []),
        delete: vi.fn(async () => true),
        match: vi.fn(async () => undefined),
      },
      fetch: vi.fn(async () => new Response('ok')),
      URL,
      Response,
    };
    vm.runInNewContext(codigo, sandbox);
    return { ouvintes, cache, sandbox };
  }

  function pedido(ouvintes: Record<string, Ouvinte>, url: string, extra: { method?: string; mode?: string } = {}) {
    const respondWith = vi.fn();
    ouvintes.fetch?.({
      request: { url, method: extra.method ?? 'GET', mode: extra.mode ?? 'cors', clone: () => ({}) },
      respondWith,
    });
    return respondWith;
  }

  it('NUNCA intercepta chamadas da API (dados de negócio e sessão não podem ir para o cache)', () => {
    const { ouvintes } = carregar();
    const base = 'https://app.ailow.test';
    for (const caminho of ['/acesso/eu', '/acesso/usuarios', '/usuarios', '/empresa', '/categorias', '/health', '/openapi.json', '/admin/login']) {
      expect(pedido(ouvintes, base + caminho), caminho).not.toHaveBeenCalled();
      expect(pedido(ouvintes, base + caminho, { mode: 'navigate' }), `${caminho} (navegação)`).not.toHaveBeenCalled();
    }
  });

  it('não intercepta POST/PUT nem outra origem', () => {
    const { ouvintes } = carregar();
    expect(pedido(ouvintes, 'https://app.ailow.test/assets/app.js', { method: 'POST' })).not.toHaveBeenCalled();
    expect(pedido(ouvintes, 'https://cdn.exemplo.com/assets/app.js')).not.toHaveBeenCalled();
  });

  it('atende os arquivos estáticos do app e a navegação para a raiz', () => {
    const { ouvintes } = carregar();
    expect(pedido(ouvintes, 'https://app.ailow.test/assets/index-abc123.js')).toHaveBeenCalledTimes(1);
    expect(pedido(ouvintes, 'https://app.ailow.test/icons/icon-192.png')).toHaveBeenCalledTimes(1);
    expect(pedido(ouvintes, 'https://app.ailow.test/', { mode: 'navigate' })).toHaveBeenCalledTimes(1);
  });

  it('pré-carrega só a casca estática (sem rotas da API) ao instalar', async () => {
    const { ouvintes, cache } = carregar();
    const esperar: Promise<unknown>[] = [];
    ouvintes.install?.({ waitUntil: (p: Promise<unknown>) => esperar.push(p) });
    await Promise.all(esperar);
    const lista = (cache.addAll.mock.calls as unknown as string[][][])[0]?.[0] ?? [];
    expect(lista).toContain('/');
    for (const url of lista) expect(url).not.toMatch(/^\/(acesso|usuarios|empresa|categorias|admin|health|openapi)/);
  });
});

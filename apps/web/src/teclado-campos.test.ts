import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// T01 (plano aprimoramentos-voz-2026-11-23): teclado menor no celular. Todo campo de digitação diz ao navegador,
// explicitamente, se pode sugerir dado salvo ("off" quando o dado não é do próprio usuário; token quando é).
// Sem isso o Chrome/Gboard abre a barra de cartão/endereço por cima do formulário. A geometria com o teclado aberto
// (360×400) está em e2e/teclado-360x400.e2e.ts.
const raiz = fileURLToPath(new URL('.', import.meta.url));
const CAMPOS = ['TextInput', 'NumberInput', 'PasswordInput', 'Textarea', 'Select', 'Autocomplete', 'MultiSelect', 'TagsInput', 'ColorInput', 'NativeSelect', 'PinInput'];

function arquivosTsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) return arquivosTsx(caminho);
    return e.name.endsWith('.tsx') ? [caminho] : [];
  });
}

/** Tag de abertura inteira (até o `>` fora de chaves e aspas: `onChange={(e) => …}` não fecha a tag). */
function tagDeAbertura(fonte: string, ini: number): string {
  let chaves = 0;
  let aspa: string | null = null;
  for (let i = ini + 1; i < fonte.length; i++) {
    const c = fonte[i];
    if (aspa) {
      if (c === aspa) aspa = null;
    } else if (chaves === 0 && (c === '"' || c === "'")) aspa = c;
    else if (c === '{') chaves++;
    else if (c === '}') chaves--;
    else if (c === '>' && chaves === 0) return fonte.slice(ini, i + 1);
  }
  throw new Error(`tag sem fim a partir de ${ini}`);
}

interface Campo {
  onde: string;
  componente: string;
  tag: string;
}

const campos: Campo[] = arquivosTsx(raiz).flatMap((arquivo) => {
  const fonte = readFileSync(arquivo, 'utf8');
  const achados: Campo[] = [];
  for (const m of fonte.matchAll(new RegExp(`<(${CAMPOS.join('|')})\\b`, 'g'))) {
    const linha = fonte.slice(0, m.index).split('\n').length;
    achados.push({ onde: `${arquivo.slice(raiz.length)}:${linha}`, componente: m[1] as string, tag: tagDeAbertura(fonte, m.index as number) });
  }
  return achados;
});

const rotulo = (tag: string) => tag.match(/\b(?:label|aria-label)=(?:"([^"]*)"|\{`([^`]*)`\})/)?.slice(1).find(Boolean) ?? '';

describe('teclado no celular (T01)', () => {
  it('index.html pede que o teclado encolha o layout (interactive-widget=resizes-content), sem perder o resto do viewport', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const conteudo = html.match(/<meta\s+name="viewport"\s+content="([^"]+)"/)?.[1] ?? '';
    const chaves = conteudo.split(',').map((p) => p.trim());
    expect(chaves).toContain('interactive-widget=resizes-content');
    expect(chaves).toEqual(expect.arrayContaining(['width=device-width', 'initial-scale=1', 'viewport-fit=cover']));
  });

  it('acha os campos do app (o teste não passa por não ler nada)', () => {
    expect(campos.length).toBeGreaterThanOrEqual(60);
  });

  it('todo campo de digitação tem autoComplete explícito (PinInput: oneTimeCode={false}, senão o Mantine põe "one-time-code")', () => {
    const sem = campos
      .filter((c) => (c.componente === 'PinInput' ? !/\boneTimeCode=\{false\}/.test(c.tag) : !/\bautoComplete=/.test(c.tag)))
      .map((c) => `${c.onde} <${c.componente}> ${rotulo(c.tag)}`);
    expect(sem, 'campos sem autoComplete explícito').toEqual([]);
  });

  it('dinheiro, quantidade e PIN abrem o teclado numérico (inputMode numeric/decimal)', () => {
    // NumberInput fica de fora: o Mantine 9 sobrescreve o inputMode com "decimal" (teclado numérico) em qualquer caso.
    // "Novo valor" de eixo da grade (ex.: "A" de Taça) é texto: só conta rótulo que começa com "Valor".
    const numerico = /^valor|preço|custo|desconto|percentual|markup|quantidade|quantas|tenho|mínimo|parcela|pin/i;
    const sem = campos
      .filter((c) => c.componente !== 'NumberInput')
      .filter((c) => c.componente === 'PinInput' || numerico.test(rotulo(c.tag)))
      .filter((c) => !/\binputMode="(numeric|decimal)"/.test(c.tag))
      .map((c) => `${c.onde} <${c.componente}> ${rotulo(c.tag)}`);
    expect(sem, 'campos de número sem inputMode').toEqual([]);
  });
});

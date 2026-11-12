import { describe, expect, it } from 'vitest';
import {
  clienteNovoSchema,
  clientesQuerySchema,
  digitosDaBusca,
  linkWhatsApp,
  mascararCelular,
  normalizarCelular,
} from './index.js';
import * as puro from './puro.js';

// S09 / RF-CLI-01…04, D8: celular brasileiro de 11 dígitos (DDD + 9 + 8 dígitos), guardado só com dígitos.
describe('normalizarCelular (RF-CLI-01)', () => {
  it.each([
    ['11912345678', '11912345678'],
    ['(11) 91234-5678', '11912345678'],
    ['11 91234 5678', '11912345678'],
    ['+55 (11) 91234-5678', '11912345678'],
    ['5511912345678', '11912345678'],
    ['  21 99876-5432  ', '21998765432'],
  ])('aceita %j e guarda %j', (entrada, esperado) => {
    expect(normalizarCelular(entrada)).toBe(esperado);
  });

  it.each([
    ['vazio', ''],
    ['só espaços', '   '],
    ['fixo (10 dígitos)', '1132345678'],
    ['sem o 9 inicial', '11812345678'],
    ['curto', '1191234567'],
    ['longo', '119123456789'],
    ['DDD com zero', '01912345678'],
    ['DDD 10', '10912345678'],
    ['DDD terminado em 0', '30912345678'],
    ['55 sem DDD válido', '5501912345678'],
    ['letras no meio', '11 9123a-5678'],
    ['dígitos de outro alfabeto', '११९१२३४५६७८'],
    ['emoji', '11 91234-5678 😀'],
  ])('recusa %s', (_nome, entrada) => {
    expect(normalizarCelular(entrada)).toBeNull();
  });

  it('não confunde 13 dígitos que não começam com 55', () => {
    expect(normalizarCelular('4411912345678')).toBeNull();
  });
});

describe('mascararCelular e linkWhatsApp (RF-CLI-03)', () => {
  it('mostra (DDD) 9XXXX-XXXX', () => {
    expect(mascararCelular('11912345678')).toBe('(11) 91234-5678');
  });

  it('o link do WhatsApp usa o código do país e só dígitos', () => {
    expect(linkWhatsApp('11912345678')).toBe('https://wa.me/5511912345678');
  });
});

// A busca (RF-CLI-02) é por nome OU celular: só vira busca por número se o texto parece um telefone.
describe('digitosDaBusca (RF-CLI-02)', () => {
  it.each([
    ['(21) 98888-0002', '21988880002'],
    ['+55 21 98888-0001', '21988880001'],
    ['98888000', '98888000'],
    ['  9888 ', '9888'],
  ])('%j vira os dígitos %j', (texto, esperado) => {
    expect(digitosDaBusca(texto)).toBe(esperado);
  });

  it.each([['vazio', ''], ['só nome', 'Maria'], ['nome com número', 'Maria 2'], ['pontuação sem dígito', '() -'], ['letra no meio', '9888a']])(
    '%s não é busca por número',
    (_n, texto) => {
      expect(digitosDaBusca(texto)).toBe('');
    },
  );
});

describe('contrato de cliente', () => {
  it('aceita nome e celular com máscara e devolve só dígitos', () => {
    const r = clienteNovoSchema.parse({ nome: '  Ana Souza ', celular: '(11) 91234-5678', aviso_lgpd: true });
    expect(r).toEqual({ nome: 'Ana Souza', celular: '11912345678', aviso_lgpd: true });
  });

  it('o aviso é opcional e vale falso quando não vem', () => {
    expect(clienteNovoSchema.parse({ nome: 'Ana', celular: '11912345678' }).aviso_lgpd).toBe(false);
  });

  it.each([
    ['sem nome', { nome: '   ', celular: '11912345678' }],
    ['nome com 81 letras', { nome: 'a'.repeat(81), celular: '11912345678' }],
    ['celular inválido', { nome: 'Ana', celular: '123' }],
    ['sem celular', { nome: 'Ana' }],
    ['campo a mais (empresa_id vem da sessão)', { nome: 'Ana', celular: '11912345678', empresa_id: 'x' }],
  ])('recusa %s', (_nome, corpo) => {
    expect(clienteNovoSchema.safeParse(corpo).success).toBe(false);
  });

  it('a busca aceita até 80 caracteres', () => {
    expect(clientesQuerySchema.safeParse({ q: 'a'.repeat(80) }).success).toBe(true);
    expect(clientesQuerySchema.safeParse({ q: 'a'.repeat(81) }).success).toBe(false);
  });

  it('o ponto de entrada sem Zod expõe as regras do celular', () => {
    expect(puro.normalizarCelular('(11) 91234-5678')).toBe('11912345678');
    expect(puro.linkWhatsApp('11912345678')).toBe('https://wa.me/5511912345678');
  });
});

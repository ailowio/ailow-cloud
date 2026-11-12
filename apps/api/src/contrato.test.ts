import { describe, expect, it } from 'vitest';
import { operationIdDe, respostaBinariaDe } from './contrato.js';

// S13a: o contrato OpenAPI tem operationId único e declara as respostas binárias (PDF e imagem).

describe('operationId', () => {
  it('junta método e caminho: sem barras, sem dois-pontos, em minúsculas', () => {
    expect(operationIdDe('GET', '/compras/:id/enviar')).toBe('get_compras_id_enviar');
    expect(operationIdDe('post', '/pontos')).toBe('post_pontos');
    expect(operationIdDe('PUT', '/empresa/logo')).toBe('put_empresa_logo');
    expect(operationIdDe('GET', '/health')).toBe('get_health');
  });
  it('o mesmo caminho com métodos diferentes não colide', () => {
    expect(operationIdDe('GET', '/clientes/:id')).not.toBe(operationIdDe('PUT', '/clientes/:id'));
  });
  it('caminho com hífen vira sublinhado', () => {
    expect(operationIdDe('GET', '/skus/por-codigo')).toBe('get_skus_por_codigo');
  });
});

describe('respostas binárias documentadas', () => {
  it('a logo é imagem e as etiquetas são PDF', () => {
    expect(respostaBinariaDe('GET', '/empresa/logo')?.tipos).toEqual(['image/png', 'image/jpeg', 'image/webp']);
    expect(respostaBinariaDe('post', '/etiquetas')?.tipos).toEqual(['application/pdf']);
  });
  it('rota comum não tem resposta binária', () => {
    expect(respostaBinariaDe('GET', '/clientes')).toBeUndefined();
    expect(respostaBinariaDe('PUT', '/empresa/logo')).toBeUndefined();
  });
});

// Regras puras do cliente (S09, RF-CLI-01/03; D8). Sem Zod: o app web usa estas funções pelo ponto de entrada `puro`.

// Só dígitos e a pontuação comum de telefone; qualquer outro caractere (letra, emoji, dígito de outro alfabeto) recusa.
const FORMATO_DIGITADO = /^[0-9\s()+.-]+$/;
// DDD (2 dígitos, nenhum zero) + 9 + 8 dígitos. Fixo (10 dígitos) não serve: o WhatsApp é o canal (D8).
const CELULAR_BR = /^[1-9][1-9]9[0-9]{8}$/;

/** Celular só com dígitos (DDD + 9 dígitos) ou `null` se não for um celular brasileiro válido. Aceita máscara e +55. */
export function normalizarCelular(entrada: string): string | null {
  const texto = entrada.trim();
  if (!FORMATO_DIGITADO.test(texto)) return null;
  let digitos = texto.replace(/\D/g, '');
  if (digitos.length === 13 && digitos.startsWith('55')) digitos = digitos.slice(2);
  return CELULAR_BR.test(digitos) ? digitos : null;
}

/**
 * Dígitos a procurar no celular quando o texto da busca parece um telefone (RF-CLI-02); senão `''` e a busca é só por
 * nome. Um celular completo (inclusive com +55) vira os 11 dígitos; um pedaço fica como foi digitado.
 */
export function digitosDaBusca(texto: string): string {
  const completo = normalizarCelular(texto);
  if (completo !== null) return completo;
  const t = texto.trim();
  return FORMATO_DIGITADO.test(t) ? t.replace(/\D/g, '') : '';
}

/** "11912345678" → "(11) 91234-5678". Recebe um celular já normalizado. */
export function mascararCelular(celular: string): string {
  return `(${celular.slice(0, 2)}) ${celular.slice(2, 7)}-${celular.slice(7)}`;
}

/** Link que abre a conversa no WhatsApp (RF-CLI-03). Recebe um celular já normalizado. */
export function linkWhatsApp(celular: string): string {
  return `https://wa.me/55${celular}`;
}

/**
 * UXM-05: vibração curta no toque. Sem suporte (desktop, iOS, teste) ou se o navegador recusar, não faz nada.
 * Devolve true só se o navegador aceitou o pedido.
 */
export function vibrarToque(ms = 10): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    return navigator.vibrate(ms);
  } catch {
    return false;
  }
}

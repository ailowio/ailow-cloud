import { notifications } from '@mantine/notifications';

/**
 * UXM-04: erro de senha/PIN/formulário aparece como toast (no topo, ver main.tsx), nunca como bloco que
 * empurra a tela ou o teclado. Um toast por vez: o novo substitui o anterior.
 */
export function avisarErro(mensagem: string): void {
  notifications.clean();
  notifications.show({ message: mensagem, color: 'red', autoClose: 6000 });
}

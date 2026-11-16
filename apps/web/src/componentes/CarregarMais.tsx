import { Button } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';

/**
 * ADR 016: "Carregar mais" no fim de uma lista que o servidor entrega em páginas. Some quando não há próxima página.
 * Alvo de 48 px, largura toda (UXM-02); mostra quantos já estão na tela.
 */
export function CarregarMais(props: { proximo: string | null; carregando: boolean; quantos: number; aoTocar: () => void }) {
  if (!props.proximo) return null;
  return (
    <Button
      h={48}
      fullWidth
      variant="default"
      loading={props.carregando}
      leftSection={<IconChevronDown aria-hidden />}
      onClick={props.aoTocar}
      aria-description={`${props.quantos} carregados`}
    >
      Carregar mais
    </Button>
  );
}

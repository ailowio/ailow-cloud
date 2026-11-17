import { Button, Stack } from '@mantine/core';
import { Carrinho } from '../../componentes';
import { type ItemVenda, mudarQuantidade } from './carrinho';

/** Lista completa do carrinho da venda em andamento (/vendas/carrinho). */
export function TelaCarrinho(props: {
  itens: ItemVenda[];
  aoMudar: (itens: ItemVenda[]) => void;
  aoFechar: () => void;
  aoContinuar: () => void;
}) {
  return (
    <Stack gap="md">
      <Carrinho
        itens={props.itens}
        onMudar={(codigo, delta) => {
          const r = mudarQuantidade(props.itens, codigo, delta);
          props.aoMudar(r.itens);
        }}
      />
      {props.itens.length > 0 ? (
        <Button h={48} onClick={props.aoFechar}>
          Finalizar venda
        </Button>
      ) : (
        <Button h={48} variant="default" onClick={props.aoContinuar}>
          Buscar peças
        </Button>
      )}
    </Stack>
  );
}

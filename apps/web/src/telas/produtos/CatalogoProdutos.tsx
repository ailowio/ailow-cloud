import { SimpleGrid } from '@mantine/core';
import type { Produto } from '@ailow/shared';
import { ICONES, Opcao } from '../vendas/WizardCatalogo';
import { chaveIconeCategoria, resumoEstoqueProduto } from '../vendas/icone-categoria';

/** Visão Catálogo (P02): os mesmos tiles do catálogo da venda, só para navegar; tocar abre o detalhe do produto. */
export function CatalogoProdutos(props: { produtos: readonly Produto[]; aoAbrir: (id: string) => void }) {
  return (
    <SimpleGrid cols={2} spacing="xs" data-catalogo-produtos>
      {props.produtos.map((p) => {
        const resumo = resumoEstoqueProduto(p);
        return (
          <Opcao
            key={p.id}
            rotulo={p.nome}
            detalhe={p.categoria_nome}
            icone={ICONES[chaveIconeCategoria(p.categoria_nome)]}
            precoCentavos={resumo.precoCentavos}
            estoque={resumo.estoque}
            estoqueMinimo={resumo.estoqueMinimo}
            baixo={resumo.baixo}
            onClick={() => props.aoAbrir(p.id)}
          />
        );
      })}
    </SimpleGrid>
  );
}

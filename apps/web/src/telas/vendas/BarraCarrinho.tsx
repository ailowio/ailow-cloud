import { useEffect, useRef, useState } from 'react';
import { Box, Group, Indicator, Text, UnstyledButton } from '@mantine/core';
import { IconShoppingCart } from '@tabler/icons-react';
import { Valor } from '../../componentes';

/**
 * Barra fixa embaixo na montagem da venda: só aparece com peças no carrinho.
 * Toque abre a tela do carrinho (lista completa). Badge = quantidade total de peças.
 * Visual: preenchimento marca + pulse no ícone ao acrescentar.
 */
export function BarraCarrinho(props: { quantidade: number; totalCentavos: number; aoAbrir: () => void }) {
  const [pulse, setPulse] = useState(false);
  const anterior = useRef(props.quantidade);

  useEffect(() => {
    if (props.quantidade > anterior.current) {
      setPulse(true);
      const t = window.setTimeout(() => setPulse(false), 420);
      anterior.current = props.quantidade;
      return () => window.clearTimeout(t);
    }
    anterior.current = props.quantidade;
  }, [props.quantidade]);

  if (props.quantidade <= 0) return null;
  return (
    <Box
      component="nav"
      aria-label="Carrinho da venda"
      className={`ailow-barra-carrinho${pulse ? ' ailow-barra-carrinho--pulse' : ''}`}
      data-testid="barra-carrinho"
      pos="sticky"
      bottom={0}
      style={{ zIndex: 3 }}
    >
      <UnstyledButton
        onClick={props.aoAbrir}
        w="100%"
        py="sm"
        px="md"
        mih={64}
        aria-label={`Carrinho com ${props.quantidade} ${props.quantidade === 1 ? 'item' : 'itens'}. Abrir resumo.`}
        style={{ display: 'block', color: 'inherit' }}
      >
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Group gap="sm" wrap="nowrap">
            <Indicator label={props.quantidade} color="red" size={22} offset={4} className="ailow-barra-carrinho__icone">
              <Box lh={0} aria-hidden>
                <IconShoppingCart size={28} stroke={1.75} />
              </Box>
            </Indicator>
            <Box>
              <Text fw={650}>Carrinho</Text>
              <Text size="xs" className="ailow-barra-carrinho__dica">
                Toque para o resumo
              </Text>
            </Box>
          </Group>
          {/* Sem `destaque`: a cor da marca quebraria o contraste sobre o fundo --ailow-acao. */}
          <Text fw={700} fz="lg" style={{ fontVariantNumeric: 'tabular-nums', color: 'inherit' }}>
            <Valor centavos={props.totalCentavos} />
          </Text>
        </Group>
      </UnstyledButton>
    </Box>
  );
}

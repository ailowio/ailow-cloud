import { useState } from 'react';
import { Stack, Text } from '@mantine/core';
import { ErroApi } from '../api/cliente';
import { avisarErro } from '../lib/avisos';
import { TecladoPin } from '../componentes';
import { Moldura } from './Moldura';

/** Primeiro PIN do Dono (precisa_definir_pin): digita duas vezes para confirmar. */
export function DefinirPin(props: { nome: string; aoDefinir: (pin: string) => Promise<void> }) {
  const [primeiro, setPrimeiro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function completo(pin: string) {
    if (primeiro === null) {
      setPrimeiro(pin);
      return;
    }
    if (pin !== primeiro) {
      setPrimeiro(null);
      avisarErro('Os dois PINs são diferentes. Vamos de novo: escolha o PIN.');
      return;
    }
    setEnviando(true);
    try {
      await props.aoDefinir(pin);
    } catch (e) {
      setPrimeiro(null);
      setEnviando(false);
      avisarErro(
        e instanceof ErroApi && e.status === 0
          ? 'Sem conexão. Verifique a internet e tente de novo.'
          : 'Não foi possível salvar o PIN. Tente de novo.',
      );
    }
  }

  return (
    <Moldura
      titulo={primeiro === null ? 'Escolha seu PIN' : 'Digite o PIN de novo'}
      subtitulo={`${props.nome}, o PIN de 4 dígitos é como você abre o app no dia a dia.`}
    >
      <Stack gap="md" align="center">
        <Text c="dimmed" size="sm" role="status">
          {primeiro === null ? 'Passo 1 de 2' : 'Passo 2 de 2: confirme'}
        </Text>
        <TecladoPin onCompleto={(pin) => void completo(pin)} desabilitado={enviando} />
      </Stack>
    </Moldura>
  );
}

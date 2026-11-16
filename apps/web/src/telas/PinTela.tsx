import { useState } from 'react';
import { Alert, Stack } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import type { QuemUsaItem } from '../api/endpoints';
import { TecladoPin } from '../componentes';
import { avisarErro } from '../lib/avisos';
import { Moldura } from './Moldura';

/** PIN de 4 dígitos. `aoConfirmar` devolve a mensagem de erro (ou null se deu certo). */
export function PinTela(props: {
  alvo: QuemUsaItem;
  aoConfirmar: (pin: string) => Promise<string | null>;
  aoVoltar: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const bloqueado = props.alvo.bloqueado;

  async function completo(pin: string) {
    setEnviando(true);
    const mensagem = await props.aoConfirmar(pin);
    // Em caso de sucesso a tela é trocada pelo App; só voltamos a este estado se houve erro.
    if (mensagem) {
      // UXM-04: o erro é toast; o teclado e o resto da tela não se mexem.
      avisarErro(mensagem);
      setEnviando(false);
    }
  }

  return (
    <Moldura
      titulo={props.alvo.nome}
      subtitulo="Digite seu PIN de 4 dígitos."
      voltar={{ rotulo: 'Trocar de pessoa', aoVoltar: props.aoVoltar }}
    >
      <Stack gap="md" align="center">
        {/* Estado fixo desde a abertura da tela (não é resposta a um erro): não muda de altura depois. */}
        {bloqueado && (
          <Alert color="red" icon={<IconLock />} w="100%">
            Usuário bloqueado por PIN errado. Peça ao Dono para desbloquear.
          </Alert>
        )}
        <TecladoPin onCompleto={(pin) => void completo(pin)} desabilitado={enviando || bloqueado} />
      </Stack>
    </Moldura>
  );
}

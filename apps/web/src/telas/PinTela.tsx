import { useEffect, useState } from 'react';
import { Stack } from '@mantine/core';
import type { QuemUsaItem } from '../api/endpoints';
import { TecladoPin } from '../componentes';
import { MENSAGEM_BLOQUEADO } from '../acesso/mensagens';
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

  // Decisão do Pedro (2026-11-16): o bloqueio avisa em toast, como os outros erros do PIN (UXM-04); o teclado fica parado.
  useEffect(() => {
    if (bloqueado) avisarErro(MENSAGEM_BLOQUEADO);
  }, [bloqueado]);

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
        <TecladoPin onCompleto={(pin) => void completo(pin)} desabilitado={enviando || bloqueado} />
      </Stack>
    </Moldura>
  );
}

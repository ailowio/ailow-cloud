import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Skeleton, Stack } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { ErroApi } from '../api/cliente';
import { mensagemGenerica } from '../acesso/mensagens';

export type Carga<T> =
  | { fase: 'carregando' }
  | { fase: 'erro'; mensagem: string }
  | { fase: 'pronto'; dados: T };

/** Carrega dados ao abrir a tela; `recarregar` busca de novo (ex.: depois de salvar). */
export function useCarregar<T>(buscar: () => Promise<T>) {
  const [carga, setCarga] = useState<Carga<T>>({ fase: 'carregando' });
  const buscarRef = useRef(buscar);
  buscarRef.current = buscar;

  const recarregar = useCallback(async () => {
    try {
      setCarga({ fase: 'pronto', dados: await buscarRef.current() });
    } catch (e) {
      setCarga({ fase: 'erro', mensagem: mensagemGenerica(e instanceof ErroApi ? e : new ErroApi(0, 'sem_conexao')) });
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const tentarDeNovo = () => {
    setCarga({ fase: 'carregando' });
    void recarregar();
  };
  return { carga, recarregar, tentarDeNovo };
}

// Chaves fixas: as linhas do esqueleto são idênticas e nunca mudam de ordem.
const IDS_ESQUELETO = ['a', 'b', 'c', 'd', 'e'];

/** Esqueleto no formato da lista (nunca tela em branco enquanto carrega). */
export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <Stack gap="sm" aria-busy="true" aria-label="Carregando">
      {IDS_ESQUELETO.slice(0, linhas).map((id) => (
        <Skeleton key={id} h={72} radius="md" />
      ))}
    </Stack>
  );
}

/** Erro com o que fazer: tentar de novo. */
export function ErroCarregar({ mensagem, aoTentar }: { mensagem: string; aoTentar: () => void }) {
  return (
    <Alert color="red" icon={<IconAlertCircle />} title="Não foi possível carregar">
      <Stack gap="sm" align="flex-start">
        {mensagem}
        <Button variant="default" onClick={aoTentar}>Tentar de novo</Button>
      </Stack>
    </Alert>
  );
}

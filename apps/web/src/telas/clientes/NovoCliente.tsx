import { useState } from 'react';
import { Alert, Button, Stack, Switch, TextInput } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { mascararCelular, normalizarCelular } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { useAcao } from '../config/comum';
import { mensagemClientes } from './rotulos';

/** RF-CLI-01: cadastro mínimo, só nome e celular (D8). O aviso de finalidade (RF-CLI-04) já pode ser registrado aqui. */
export function NovoCliente(props: { api: Api; aoCriar: (id: string) => void }) {
  const [nome, setNome] = useState('');
  const [celular, setCelular] = useState('');
  const [aviso, setAviso] = useState(false);
  // O erro do celular só aparece depois que a pessoa sai do campo: não reclamar no meio da digitação.
  const [celularVisitado, setCelularVisitado] = useState(false);
  const { pendente, erro, rodar } = useAcao(mensagemClientes);

  const numero = normalizarCelular(celular);
  const celularComErro = celularVisitado && celular.trim() !== '' && numero === null;
  const pronto = nome.trim() !== '' && numero !== null;

  async function salvar() {
    if (!pronto) return;
    let id = '';
    const ok = await rodar(async () => {
      id = (await props.api.criarCliente({ nome: nome.trim(), celular, aviso_lgpd: aviso })).id;
    }, 'Cliente cadastrado');
    if (ok) props.aoCriar(id);
  }

  return (
    <Stack gap="md">
      <TextInput
        label="Nome"
        required
        size="lg"
        maxLength={80}
        autoComplete="off"
        placeholder="Ex.: Ana Souza"
        value={nome}
        onChange={(e) => setNome(e.currentTarget.value)}
      />
      <TextInput
        label="Celular com DDD"
        required
        size="lg"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        maxLength={40}
        placeholder="(21) 98888-0001"
        value={celular}
        onChange={(e) => setCelular(e.currentTarget.value)}
        onBlur={() => setCelularVisitado(true)}
        error={celularComErro ? 'Escreva o celular com DDD e 9 dígitos, por exemplo (21) 98888-0001.' : undefined}
        description={numero !== null ? `Fica ${mascararCelular(numero)}` : undefined}
      />
      <Switch
        size="lg"
        label="Já avisei para que uso o celular"
        description="Avise o cliente que o número serve para falar da compra e das novidades da loja. Fica registrada a data."
        checked={aviso}
        onChange={(e) => setAviso(e.currentTarget.checked)}
      />
      {erro && (
        <Alert color="red" icon={<IconAlertCircle />} role="alert">
          {erro}
        </Alert>
      )}
      <Button h={48} onClick={() => void salvar()} loading={pendente} disabled={!pronto}>
        Cadastrar cliente
      </Button>
    </Stack>
  );
}

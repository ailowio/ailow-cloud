import { useState } from 'react';
import { Alert, Button, Stack, Switch, TextInput } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { mascararCelular, normalizarCelular } from '@ailow/shared/puro';
import { useAcao } from '../config/comum';
import { mensagemClientes } from './rotulos';

export interface DadosCliente {
  nome: string;
  celular: string;
  aviso: boolean;
}

/**
 * Nome e celular do cliente (RF-CLI-01/05, D8), para cadastrar e para corrigir. O aviso de finalidade (LGPD) só
 * aparece no cadastro; na edição ele tem botão próprio na ficha. `salvar` faz a chamada à API.
 */
export function FormCliente<T = void>(props: {
  // Presente = edição: os campos já vêm preenchidos e "Salvar" só liga quando algo mudou.
  inicial?: { nome: string; celular: string };
  comAviso?: boolean;
  rotuloSalvar: string;
  sucesso: string;
  salvar: (d: DadosCliente) => Promise<T>;
  // Recebe o que `salvar` devolveu (ex.: o id do cliente recém-cadastrado).
  aoSalvo: (resultado: T) => void;
  aoCancelar?: () => void;
}) {
  const [nome, setNome] = useState(props.inicial?.nome ?? '');
  const [celular, setCelular] = useState(props.inicial ? mascararCelular(props.inicial.celular) : '');
  const [aviso, setAviso] = useState(false);
  // O erro do celular só aparece depois que a pessoa sai do campo: não reclamar no meio da digitação.
  const [celularVisitado, setCelularVisitado] = useState(false);
  const { pendente, erro, rodar } = useAcao(mensagemClientes);

  const numero = normalizarCelular(celular);
  const celularComErro = celularVisitado && celular.trim() !== '' && numero === null;
  const mudou = props.inicial === undefined || nome.trim() !== props.inicial.nome || numero !== props.inicial.celular;
  const pronto = nome.trim() !== '' && numero !== null && mudou;

  async function salvar() {
    if (!pronto) return;
    let resultado: T | undefined;
    const ok = await rodar(async () => {
      resultado = await props.salvar({ nome: nome.trim(), celular, aviso });
    }, props.sucesso);
    if (ok) props.aoSalvo(resultado as T);
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
      {props.comAviso && (
        <Switch
          size="lg"
          label="Já avisei para que uso o celular"
          description="Avise o cliente que o número serve para falar da compra e das novidades da loja. Fica registrada a data."
          checked={aviso}
          onChange={(e) => setAviso(e.currentTarget.checked)}
        />
      )}
      {erro && (
        <Alert color="red" icon={<IconAlertCircle />} role="alert">
          {erro}
        </Alert>
      )}
      <Button h={48} onClick={() => void salvar()} loading={pendente} disabled={!pronto}>
        {props.rotuloSalvar}
      </Button>
      {props.aoCancelar && (
        <Button h={48} variant="default" onClick={props.aoCancelar} disabled={pendente}>
          Cancelar
        </Button>
      )}
    </Stack>
  );
}

import { useState } from 'react';
import { Stack, Switch, Text, TextInput } from '@mantine/core';
import { mascararCelular, normalizarCelular } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { QuadroDoAssistente, avisoDoPasso, usePassoNoHistorico } from '../../componentes/Assistente';
import { useSalvarComToast } from '../config/comum';
import { PASSOS_CLIENTE, type PassoCliente, type RascunhoCliente, clienteParaApi, validarPassoCliente } from './cliente-passos';
import { mensagemClientes } from './rotulos';

const TITULOS: Record<PassoCliente, string> = {
  nome: 'Qual é o nome do cliente?',
  celular: 'Qual é o celular?',
  aviso: 'Avisou para que usa o número?',
  confirmar: 'Confira e salve',
};

/** RF-CLI-01 em passos curtos (nome → celular → aviso → confirmar, S13). O aviso de finalidade (RF-CLI-04) pode ser registrado aqui. */
export function NovoCliente(props: { api: Api; aoCriar: (id: string) => void; aoCancelar: () => void }) {
  const [r, setR] = useState<RascunhoCliente>({ nome: '', celular: '', aviso: false });
  const { atual, indice, ultimo, avancar, recuar } = usePassoNoHistorico(PASSOS_CLIENTE);
  const { pendente, rodar } = useSalvarComToast(mensagemClientes);
  const mudar = (parcial: Partial<RascunhoCliente>) => setR((x) => ({ ...x, ...parcial }));
  const numero = normalizarCelular(r.celular);

  async function salvar() {
    const corpo = clienteParaApi(r);
    if (!corpo) return;
    let id = '';
    const ok = await rodar(async () => {
      id = (await props.api.criarCliente(corpo)).id;
    }, 'Cliente cadastrado');
    if (ok) props.aoCriar(id);
  }

  // O botão principal nunca fica desabilitado: o que falta vira toast (não mexe no layout) e a pessoa fica no passo.
  function principal() {
    const problema = validarPassoCliente(atual, r);
    if (problema) {
      avisoDoPasso(problema);
      return;
    }
    if (ultimo) void salvar();
    else avancar();
  }

  return (
    <QuadroDoAssistente
      passo={atual}
      titulo={TITULOS[atual]}
      indice={indice}
      total={PASSOS_CLIENTE.length}
      rotuloPrincipal={ultimo ? 'Cadastrar cliente' : 'Continuar'}
      aoPrincipal={principal}
      aoCancelar={props.aoCancelar}
      aoVoltar={recuar}
      ocupado={pendente}
    >
      {atual === 'nome' && (
        <TextInput
          label="Nome"
          required
          size="lg"
          maxLength={80}
          autoComplete="off"
          placeholder="Ex.: Ana Souza"
          value={r.nome}
          onChange={(e) => mudar({ nome: e.currentTarget.value })}
        />
      )}

      {atual === 'celular' && (
        <TextInput
          label="Celular com DDD"
          required
          size="lg"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          maxLength={40}
          placeholder="(21) 98888-0001"
          value={r.celular}
          onChange={(e) => mudar({ celular: e.currentTarget.value })}
          description={numero !== null ? `Fica ${mascararCelular(numero)}` : 'DDD e 9 dígitos. O WhatsApp é o canal com o cliente.'}
        />
      )}

      {atual === 'aviso' && (
        <Switch
          size="lg"
          label="Já avisei para que uso o celular"
          description="Avise o cliente que o número serve para falar da compra e das novidades da loja. Fica registrada a data."
          checked={r.aviso}
          onChange={(e) => mudar({ aviso: e.currentTarget.checked })}
        />
      )}

      {atual === 'confirmar' && (
        <Stack gap={4} p="sm" className="ailow-cartao">
          <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>
            {r.nome.trim()}
          </Text>
          <Text c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {numero !== null ? mascararCelular(numero) : r.celular}
          </Text>
          <Text>{r.aviso ? 'Aviso sobre o celular: já feito' : 'Aviso sobre o celular: ainda não feito'}</Text>
        </Stack>
      )}
    </QuadroDoAssistente>
  );
}

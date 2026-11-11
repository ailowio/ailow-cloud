import { useState } from 'react';
import { Alert, Autocomplete, Button, Stack, Switch, Text, TextInput } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { FormaPagamento } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { formatarReais, reaisParaCentavos } from '../../lib/dinheiro';
import { hojeEmSaoPaulo } from '../../lib/datas';
import { useAcao } from '../config/comum';
import { EscolhaForma } from './Modais';
import { mensagemFinanceiro } from './rotulos';

// Sugestões de categoria: a categoria é texto livre (ADR 005); estas só evitam digitar o comum.
const SUGESTOES = ['Aluguel', 'Água', 'Luz', 'Internet', 'Condomínio', 'Sacolas', 'Salários', 'Impostos', 'Outros'];
const VALOR_MAXIMO = 2_000_000_000;

/** RF-FIN-02: nova despesa (descrição, categoria, valor, vencimento); pode já nascer paga. */
export function NovaDespesa(props: { api: Api; aoSalvar: (paga: boolean) => void }) {
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [valorTexto, setValorTexto] = useState('');
  const [vencimento, setVencimento] = useState(() => hojeEmSaoPaulo());
  const [paga, setPaga] = useState(false);
  const [forma, setForma] = useState<FormaPagamento | null>(null);
  const { pendente, erro, rodar } = useAcao(mensagemFinanceiro);

  const centavos = reaisParaCentavos(valorTexto);
  const valorValido = centavos !== null && centavos >= 1 && centavos <= VALOR_MAXIMO;
  const valorComErro = valorTexto.trim() !== '' && !valorValido;
  const pronto =
    descricao.trim() !== '' && categoria.trim() !== '' && valorValido && vencimento !== '' && (!paga || forma !== null);

  async function salvar() {
    if (!pronto || centavos === null) return;
    const ok = await rodar(
      () =>
        props.api.novaDespesa({
          descricao: descricao.trim(),
          categoria: categoria.trim(),
          valor_centavos: centavos,
          vencimento,
          forma_pagamento: paga ? forma : null,
          paga,
        }),
      paga ? 'Despesa salva e paga' : 'Despesa salva em contas a pagar',
    );
    if (ok) props.aoSalvar(paga);
  }

  return (
    <Stack gap="md">
      <TextInput
        label="O que é?"
        required
        size="lg"
        maxLength={120}
        placeholder="Ex.: Condomínio de novembro"
        value={descricao}
        onChange={(e) => setDescricao(e.currentTarget.value)}
      />
      <Autocomplete
        label="Categoria"
        description="Escolha uma sugestão ou escreva a sua."
        required
        size="lg"
        maxLength={40}
        data={SUGESTOES}
        classNames={{ option: 'ailow-opcao' }}
        value={categoria}
        onChange={setCategoria}
      />
      <TextInput
        label="Valor"
        required
        size="lg"
        inputMode="decimal"
        autoComplete="off"
        placeholder="150,00"
        leftSection={<Text fw={600}>R$</Text>}
        leftSectionWidth={48}
        value={valorTexto}
        onChange={(e) => setValorTexto(e.currentTarget.value)}
        error={valorComErro ? 'Escreva o valor com vírgula, por exemplo 150,00 (até 20 milhões).' : undefined}
        description={valorValido && centavos !== null ? `Fica ${formatarReais(centavos)}` : undefined}
      />
      <TextInput
        label="Vence em"
        required
        size="lg"
        type="date"
        value={vencimento}
        onChange={(e) => setVencimento(e.currentTarget.value)}
      />
      <Switch
        size="lg"
        label="Já foi paga"
        description="Se ligar, o dinheiro sai hoje e a conta não vai para “A pagar”."
        checked={paga}
        onChange={(e) => setPaga(e.currentTarget.checked)}
      />
      {paga && <EscolhaForma rotulo="Como foi pago?" valor={forma} aoMudar={setForma} />}
      {erro && (
        <Alert color="red" icon={<IconAlertCircle />} role="alert">
          {erro}
        </Alert>
      )}
      <Button h={48} onClick={() => void salvar()} loading={pendente} disabled={!pronto}>
        Salvar despesa
      </Button>
    </Stack>
  );
}

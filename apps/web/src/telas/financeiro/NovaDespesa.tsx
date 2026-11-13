import { useState } from 'react';
import { Alert, Button, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { FormaPagamento } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { EstadoVazio } from '../../componentes';
import { CampoData } from '../../componentes/CampoData';
import { formatarReais, reaisParaCentavos } from '../../lib/dinheiro';
import { hojeEmSaoPaulo } from '../../lib/datas';
import { useAcao } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { EscolhaForma } from './Modais';
import { mensagemFinanceiro } from './rotulos';

const VALOR_MAXIMO = 2_000_000_000;

/** RF-FIN-02: nova despesa (descrição, categoria, valor, vencimento); pode já nascer paga. */
export function NovaDespesa(props: { api: Api; aoSalvar: (paga: boolean) => void }) {
  // A categoria é uma das categorias FINANCEIRAS ativas da empresa (Configurações › Categorias).
  const { carga, tentarDeNovo } = useCarregar(() =>
    props.api.categorias('financeira').then((r) => r.categorias.filter((c) => c.ativa).map((c) => c.nome)),
  );
  if (carga.fase === 'carregando') return <Carregando linhas={3} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;
  if (carga.dados.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma categoria financeira"
        texto="Para lançar uma despesa, cadastre antes uma categoria em Configurações › Categorias › Financeiras."
      />
    );
  }
  return <FormDespesa api={props.api} categorias={carga.dados} aoSalvar={props.aoSalvar} />;
}

function FormDespesa(props: { api: Api; categorias: string[]; aoSalvar: (paga: boolean) => void }) {
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
      <Select
        label="Categoria"
        placeholder="Escolha uma categoria"
        required
        size="lg"
        allowDeselect={false}
        data={props.categorias}
        classNames={{ option: 'ailow-opcao' }}
        comboboxProps={{ withinPortal: true }}
        value={categoria || null}
        onChange={(v) => setCategoria(v ?? '')}
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
      <CampoData label="Vence em" required value={vencimento} onChange={setVencimento} />
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

import { useEffect, useState } from 'react';
import { Button, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import type { FormaPagamento, VendaFinalizar } from '@ailow/shared';
import { calcularFechamento, normalizarCelular, totaisDaVenda } from '@ailow/shared/puro';
import type { Api } from '../../api/endpoints';
import { Valor } from '../../componentes';
import { centavosParaTexto, reaisParaCentavos } from '../../lib/dinheiro';
import { useAcao } from '../config/comum';
import type { ItemVenda } from './carrinho';
import { FORMAS, ROTULOS_FORMA, mensagemVenda } from './rotulos';

type Desconto =
  | { tipo: 'nenhum' }
  | { tipo: 'percentual'; percentual: number }
  | { tipo: 'valor'; centavos: number };

/** RF-VEN-05: celular (cria o cliente se faltar), desconto e uma ou mais formas. O Pix do caminho curto leva o total. */
export function Fechamento(props: { api: Api; itens: ItemVenda[]; aoVoltar: () => void; aoFinalizar: (vendaId: string) => void }) {
  const { pendente, rodar } = useAcao(mensagemVenda);
  const [celular, setCelular] = useState('');
  const [nome, setNome] = useState('');
  const [nomeAchado, setNomeAchado] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [modo, setModo] = useState<'nenhum' | 'percentual' | 'valor'>('nenhum');
  const [percentual, setPercentual] = useState('');
  const [descontoTexto, setDescontoTexto] = useState('');
  const [pagamentos, setPagamentos] = useState<{ id: string; forma: FormaPagamento; valor: number }[]>([]);
  const [parcial, setParcial] = useState('');

  const digitos = normalizarCelular(celular);
  useEffect(() => {
    if (!digitos) {
      setNomeAchado(null);
      return;
    }
    let ativo = true;
    setBuscando(true);
    props.api
      .clientes(digitos)
      .then((r) => {
        if (!ativo) return;
        const achado = r.clientes.find((c) => c.celular === digitos);
        setNomeAchado(achado?.nome ?? null);
      })
      .catch(() => {
        if (ativo) setNomeAchado(null);
      })
      .finally(() => {
        if (ativo) setBuscando(false);
      });
    return () => {
      ativo = false;
    };
  }, [digitos, props.api]);

  const desconto: Desconto | null =
    modo === 'nenhum'
      ? { tipo: 'nenhum' }
      : modo === 'percentual'
        ? /^\d{1,3}$/.test(percentual) && Number(percentual) <= 100
          ? { tipo: 'percentual', percentual: Number(percentual) }
          : null
        : reaisParaCentavos(descontoTexto) === null
          ? null
          : { tipo: 'valor', centavos: reaisParaCentavos(descontoTexto) as number };

  const linhas = props.itens.map((i) => ({ precoCentavos: i.precoCentavos, quantidade: i.qtd }));
  const totais = desconto ? totaisDaVenda(linhas, desconto) : null;
  const conta = totais?.ok && desconto ? calcularFechamento(linhas, desconto, pagamentos.map((p) => p.valor)) : totais;
  const total = totais?.ok ? totais.totalCentavos : null;
  const soma = pagamentos.reduce((s, p) => s + p.valor, 0);
  const falta = total === null ? null : total - soma;
  const valorDesta = parcial.trim() === '' ? falta : reaisParaCentavos(parcial);
  const nomeOk = nomeAchado !== null || nome.trim().length > 0;
  const pode = !pendente && !buscando && digitos !== null && nomeOk && !!conta && conta.ok;

  function somarForma(forma: FormaPagamento) {
    if (valorDesta === null || falta === null || valorDesta < 1 || valorDesta > falta) return;
    setPagamentos((lista) => [...lista, { id: crypto.randomUUID(), forma, valor: valorDesta }]);
    setParcial('');
  }

  async function finalizar() {
    if (!pode || !digitos || !desconto) return;
    const corpo: VendaFinalizar = {
      itens: props.itens.map((i) => ({ sku_id: i.skuId, quantidade: i.qtd })),
      cliente: nomeAchado ? { celular: digitos } : { celular: digitos, nome: nome.trim() },
      desconto,
      pagamentos: pagamentos.map((p) => ({ forma: p.forma, valor_centavos: p.valor })),
    };
    const venda = await props.api.finalizarVenda(corpo);
    props.aoFinalizar(venda.id);
  }

  return (
    <Stack gap="md">
      <TextInput size="lg" label="Celular do cliente" placeholder="(11) 91234-5678" inputMode="tel" autoFocus autoComplete="off" value={celular} onChange={(e) => setCelular(e.currentTarget.value)} />
      {buscando && <Text c="dimmed">Procurando o cliente…</Text>}
      {nomeAchado && (
        <Text fw={650} style={{ overflowWrap: 'anywhere' }}>
          {nomeAchado}
        </Text>
      )}
      {digitos && !buscando && !nomeAchado && (
        <TextInput size="lg" label="Nome" description="Celular novo: o nome entra no cadastro junto com a venda." value={nome} onChange={(e) => setNome(e.currentTarget.value)} autoComplete="off" />
      )}
      {digitos === null && celular.trim() !== '' && <Text c="red">Celular com DDD e 9 dígitos, como (11) 91234-5678.</Text>}

      <Text fw={650}>Desconto</Text>
      <Stack gap="xs">
        {(
          [
            ['nenhum', 'Nenhum'],
            ['percentual', 'Percentual'],
            ['valor', 'Reais'],
          ] as const
        ).map(([id, rotulo]) => (
          <Button key={id} h={48} variant={modo === id ? 'filled' : 'default'} onClick={() => setModo(id)} aria-pressed={modo === id}>
            {rotulo}
          </Button>
        ))}
      </Stack>
      {modo === 'percentual' && (
        <TextInput size="lg" label="Percentual" inputMode="numeric" value={percentual} onChange={(e) => setPercentual(e.currentTarget.value)} />
      )}
      {modo === 'valor' && (
        <TextInput size="lg" label="Desconto em reais" placeholder="10,00" inputMode="decimal" value={descontoTexto} onChange={(e) => setDescontoTexto(e.currentTarget.value)} />
      )}
      {desconto === null && <Text c="red">Desconto inválido. Use um percentual de 0 a 100 ou um valor em reais.</Text>}
      {conta && !conta.ok && conta.erro === 'desconto_acima_do_subtotal' && (
        <Text c="red">O desconto não pode passar do total da venda.</Text>
      )}

      <Text fw={650}>Pagamento</Text>
      <Text>
        Falta <Valor centavos={Math.max(falta ?? 0, 0)} destaque />
      </Text>
      <TextInput size="lg"
        label="Valor desta forma"
        description="Em branco, usa o que falta. Preencha para dividir."
        placeholder="40,00"
        inputMode="decimal"
        value={parcial}
        onChange={(e) => setParcial(e.currentTarget.value)}
      />
      <SimpleGrid cols={2} spacing="xs">
        {FORMAS.map((forma) => (
          <Button key={forma} h={48} variant="default" disabled={valorDesta === null || valorDesta < 1 || falta === null || valorDesta > falta} onClick={() => somarForma(forma)}>
            {ROTULOS_FORMA[forma]}
          </Button>
        ))}
      </SimpleGrid>
      {pagamentos.map((p) => (
        <Text key={p.id} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {ROTULOS_FORMA[p.forma]} · {centavosParaTexto(p.valor)}
        </Text>
      ))}
      {pagamentos.length > 0 && (
        <Button h={48} variant="default" onClick={() => setPagamentos([])}>
          Limpar pagamentos
        </Button>
      )}

      {total !== null && (
        <Text fz="xl" fw={700}>
          Total <Valor centavos={total} destaque />
        </Text>
      )}
      <Button h={48} loading={pendente} disabled={!pode} onClick={() => void rodar(finalizar, 'Venda finalizada')}>
        Finalizar
      </Button>
      <Button h={48} variant="default" onClick={props.aoVoltar}>
        Voltar ao carrinho
      </Button>
    </Stack>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Alert, Box, Button, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { IconMinus, IconPlus, IconPrinter, IconSearch } from '@tabler/icons-react';
import { MAX_ETIQUETAS_POR_PDF } from '@ailow/shared/puro';
import type { Produto } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { ErroApi } from '../../api/cliente';
import { EstadoVazio, Valor } from '../../componentes';
import { Paginacao, usePaginacao } from '../../componentes/Paginacao';
import { filtrarPorBusca } from '../../lib/busca';
import { hojeEmSaoPaulo } from '../../lib/datas';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { ETIQUETAS_POR_PAGINA, camposDoProduto } from './busca-produto';
import {
  type Quantidades,
  mensagemEtiquetas,
  mudarQuantidade,
  quantidadesDoEstoque,
  resumoDasEtiquetas,
  textoDoResumo,
} from './selecao-etiquetas';

type Envio = { fase: 'parado' } | { fase: 'gerando' } | { fase: 'pronto'; arquivo: string } | { fase: 'erro'; mensagem: string };

const SEM_PRODUTOS: Produto[] = [];

/**
 * Etiquetas (S08, RF-PRO-06, só Dono): escolher SKUs e quantidades e baixar UM PDF. Feito para o computador ligado
 * à térmica, mas funciona no celular. A seleção sobrevive à busca: dá para juntar peças de vários produtos.
 */

export function Etiquetas(props: { api: Api }) {
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [quantidades, setQuantidades] = useState<Quantidades>({});
  const [envio, setEnvio] = useState<Envio>({ fase: 'parado' });
  const resumo = resumoDasEtiquetas(quantidades);
  // Lista inteira carregada uma vez; a busca ampla e a paginação acontecem no cliente (o servidor limita em 200).
  const { carga, tentarDeNovo } = useCarregar(() => props.api.produtos());
  const todos = carga.fase === 'pronto' ? carga.dados.produtos : SEM_PRODUTOS;
  const filtrados = useMemo(() => filtrarPorBusca(todos, busca, camposDoProduto), [todos, busca]);
  const pag = usePaginacao(filtrados, ETIQUETAS_POR_PAGINA);

  useEffect(() => {
    const t = setTimeout(() => setBusca(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  async function gerar() {
    setEnvio({ fase: 'gerando' });
    try {
      const pdf = await props.api.etiquetasPdf(resumo.itens);
      const arquivo = `etiquetas-${hojeEmSaoPaulo()}.pdf`;
      const url = URL.createObjectURL(pdf);
      const link = document.createElement('a');
      link.href = url;
      link.download = arquivo;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setEnvio({ fase: 'pronto', arquivo });
    } catch (e) {
      setEnvio({ fase: 'erro', mensagem: e instanceof ErroApi ? mensagemEtiquetas(e) : 'Algo deu errado. Tente de novo.' });
    }
  }

  const mudar = (q: Quantidades) => {
    setQuantidades(q);
    if (envio.fase !== 'gerando') setEnvio({ fase: 'parado' });
  };

  return (
    <Stack gap="md">
      <Text c="dimmed">
        Escolha quantas etiquetas de cada peça. A bobina é de 33 × 22 mm, com 3 etiquetas por fileira; o PDF sai com uma
        fileira por página.
      </Text>
      <TextInput
        size="lg"
        aria-label="Buscar produto"
        placeholder="Nome, código ou preço"
        leftSection={<IconSearch aria-hidden />}
        autoComplete="off"
        maxLength={80}
        value={texto}
        onChange={(e) => setTexto(e.currentTarget.value)}
      />
      {carga.fase === 'carregando' && <Carregando />}
      {carga.fase === 'erro' && <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />}
      {carga.fase === 'pronto' && (
        <ListaParaEtiquetas
          produtos={pag.itens}
          semNenhum={todos.length === 0}
          truncado={carga.dados.truncado}
          quantidades={quantidades}
          aoMudar={mudar}
        />
      )}

      {/* Barra fixa: o resumo e o botão ficam à vista enquanto a lista rola. */}
      <Box
        pos="sticky"
        bottom={0}
        py="sm"
        style={{ background: 'var(--mantine-color-body)', borderTop: '1px solid var(--ailow-borda)', zIndex: 2 }}
      >
        <Stack gap="xs">
          <Paginacao pagina={pag.pagina} totalPaginas={pag.totalPaginas} aoMudar={pag.irPara} />
          <Text fw={650} aria-live="polite">
            {textoDoResumo(resumo)}
          </Text>
          {resumo.acimaDoLimite && (
            <Text size="sm" c="red" role="alert">
              No máximo {MAX_ETIQUETAS_POR_PDF} etiquetas por PDF. Diminua as quantidades ou gere em duas vezes.
            </Text>
          )}
          {envio.fase === 'erro' && (
            <Alert color="red" role="alert">
              {envio.mensagem}
            </Alert>
          )}
          {envio.fase === 'pronto' && (
            <Alert color="green">
              Baixado: {envio.arquivo}. Abra o arquivo e imprima em <b>tamanho real (100%)</b>, sem "ajustar à página".
            </Alert>
          )}
          {/* "Gerar PDF" fica com a sobra da linha: com larguras iguais o rótulo era cortado em 360 px. */}
          <Group gap="sm" wrap="nowrap">
            <Button h={48} variant="default" disabled={resumo.total === 0} onClick={() => mudar({})}>
              Limpar
            </Button>
            <Button
              h={48}
              style={{ flex: 1 }}
              leftSection={<IconPrinter aria-hidden />}
              disabled={resumo.total === 0 || resumo.acimaDoLimite}
              loading={envio.fase === 'gerando'}
              onClick={gerar}
            >
              Gerar PDF
            </Button>
          </Group>
        </Stack>
      </Box>
    </Stack>
  );
}

function ListaParaEtiquetas(props: {
  produtos: Produto[];
  semNenhum: boolean;
  truncado: boolean;
  quantidades: Quantidades;
  aoMudar: (q: Quantidades) => void;
}) {
  if (props.produtos.length === 0) {
    return props.semNenhum ? (
      <EstadoVazio titulo="Nenhum produto ainda" texto="Cadastre um produto em Produtos para imprimir as etiquetas dele." />
    ) : (
      <EstadoVazio titulo="Nada encontrado" texto="Tente outro pedaço do nome, o código da peça ou o preço (ex.: 89,90)." />
    );
  }
  return (
    <Stack gap="sm">
      {props.produtos.map((p) => (
        <CartaoEtiquetas key={p.id} produto={p} quantidades={props.quantidades} aoMudar={props.aoMudar} />
      ))}
      {props.truncado && <Text size="sm" c="dimmed">A busca olha os primeiros 200 produtos. Há mais no cadastro.</Text>}
    </Stack>
  );
}

function CartaoEtiquetas(props: { produto: Produto; quantidades: Quantidades; aoMudar: (q: Quantidades) => void }) {
  const { produto: p, quantidades: q } = props;
  const pecas = p.skus.reduce((t, s) => t + s.estoque, 0);
  return (
    <Stack gap="xs" className="ailow-cartao" p="md">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
        <Stack gap={2} style={{ flex: 1, minWidth: 160 }}>
          {/* D23: o nome nunca é truncado na tela. */}
          <Text fw={650} fz="lg" style={{ overflowWrap: 'anywhere' }}>
            {p.nome}
          </Text>
          <Text fz="lg">
            <Valor centavos={p.preco_centavos} destaque />
          </Text>
        </Stack>
        <Button
          h={48}
          variant="light"
          disabled={pecas === 0}
          onClick={() => props.aoMudar(quantidadesDoEstoque(q, p.skus))}
          aria-label={`Uma etiqueta por peça em estoque de ${p.nome}`}
        >
          Usar o estoque
        </Button>
      </Group>
      {p.skus.map((s) => {
        const rotulo = `${s.tamanho} · ${s.cor}`;
        const n = q[s.id] ?? 0;
        return (
          <Group key={s.id} className="ailow-bloco" p="sm" justify="space-between" wrap="wrap" gap="xs">
            <Stack gap={0} style={{ flex: 1, minWidth: 120 }}>
              <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
                {rotulo}
              </Text>
              <Text size="xs" c="dimmed" ff="monospace">
                {s.codigo}
              </Text>
              <Text size="sm" c="dimmed">
                {s.estoque} em estoque
              </Text>
            </Stack>
            <Group gap={6} wrap="nowrap">
              <ActionIcon
                variant="default"
                size={48}
                disabled={n === 0}
                aria-label={`Menos uma etiqueta de ${rotulo}`}
                onClick={() => props.aoMudar(mudarQuantidade(q, s.id, n - 1))}
              >
                <IconMinus aria-hidden />
              </ActionIcon>
              <NumberInput
                w={68}
                size="lg"
                hideControls
                allowDecimal={false}
                allowNegative={false}
                min={0}
                max={MAX_ETIQUETAS_POR_PDF}
                // Acima do máximo vira 999 (mudarQuantidade) e o resumo avisa; "strict" só recusava a tecla, calado.
                clampBehavior="none"
                aria-label={`Etiquetas de ${rotulo}`}
                value={n}
                onChange={(v) => props.aoMudar(mudarQuantidade(q, s.id, typeof v === 'number' ? v : Number(v)))}
                styles={{ input: { textAlign: 'center', paddingInline: 4 } }}
              />
              <ActionIcon
                variant="default"
                size={48}
                disabled={n >= MAX_ETIQUETAS_POR_PDF}
                aria-label={`Mais uma etiqueta de ${rotulo}`}
                onClick={() => props.aoMudar(mudarQuantidade(q, s.id, n + 1))}
              >
                <IconPlus aria-hidden />
              </ActionIcon>
            </Group>
          </Group>
        );
      })}
    </Stack>
  );
}

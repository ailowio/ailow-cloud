import { useState } from 'react';
import { Button, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAdjustmentsHorizontal, IconArchive, IconPencil, IconTruckDelivery } from '@tabler/icons-react';
import type { Produto } from '@ailow/shared';
import { ErroApi } from '../../api/cliente';
import type { Api } from '../../api/endpoints';
import { SeloEstoque, Valor } from '../../componentes';
import { GradeAcoes } from '../../componentes/GradeAcoes';
import { Modal } from '../../componentes/navegacao';
import { fecharModal } from '../config/comum';
import { EditarProduto } from './EditarProduto';
import { type Acao, SkuFolha } from './SkuFolha';
import { mensagemProdutos, rotuloPorte } from './rotulos';

/**
 * Pop-up de detalhe do produto (UXM-10, S09): nome, categoria, preço (e custo, só para o Dono), variações com o
 * estoque e, para o Dono, as ações em ícones: Editar, Chegou mercadoria, Ajustar estoque e Arquivar. Arquivar é o
 * "excluir" do produto: ele sai das listas e da venda, mas SKUs, saldo e histórico ficam (nada é apagado).
 */
export function DetalheProduto(props: {
  api: Api;
  dono: boolean;
  produto: Produto;
  aoFechar: () => void;
  /** A lista precisa buscar de novo (editou, mexeu no estoque ou arquivou). */
  aoMudar: () => void;
}) {
  const p = props.produto;
  const [editando, setEditando] = useState(false);
  const [arquivando, setArquivando] = useState(false);
  // Com 2+ variações, "Chegou mercadoria" e "Ajustar" pedem para tocar em qual delas.
  const [escolhendo, setEscolhendo] = useState<Acao | null>(null);
  const [folha, setFolha] = useState<{ skuId: string; acao: Acao } | null>(null);
  const pecas = p.skus.reduce((soma, s) => soma + s.estoque, 0);
  const skuDaFolha = folha ? p.skus.find((s) => s.id === folha.skuId) : undefined;

  function pedirEstoque(acao: Acao) {
    const unica = p.skus.length === 1 ? p.skus[0] : undefined;
    if (unica) setFolha({ skuId: unica.id, acao });
    else setEscolhendo(acao);
  }

  return (
    <Modal opened onClose={props.aoFechar} title="Produto" closeButtonProps={fecharModal}>
      <Stack gap="md" data-detalhe-produto={p.numero}>
        <Stack gap={2}>
          <Text fw={700} fz="xl" style={{ overflowWrap: 'anywhere' }}>
            {p.nome}
          </Text>
          <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
            {p.categoria_nome} · {rotuloPorte(p.porte)} · nº {String(p.numero).padStart(4, '0')}
          </Text>
          {p.atributos.length > 0 && (
            <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
              {p.atributos.join(', ')}
            </Text>
          )}
        </Stack>

        <Group gap="md" align="baseline">
          <Text fz="xl">
            <Valor centavos={p.preco_centavos} destaque />
          </Text>
          {props.dono && p.custo_centavos !== undefined && (
            <Text size="sm" c="dimmed">
              custo <Valor centavos={p.custo_centavos} />
            </Text>
          )}
        </Group>
        {props.dono && p.fornecedor && (
          <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
            Fornecedor: {p.fornecedor}
          </Text>
        )}

        <Stack gap="xs">
          <Text fw={650}>
            {pecas} {pecas === 1 ? 'peça' : 'peças'} · {p.skus.length} {p.skus.length === 1 ? 'variação' : 'variações'}
          </Text>
          {escolhendo && (
            <Text size="sm" role="status" fw={600} c="var(--ailow-marca-texto)">
              Toque na variação que vai {escolhendo === 'chegou' ? 'receber mercadoria' : 'ter o estoque ajustado'}.
            </Text>
          )}
          {p.skus.map((s) => (
            <UnstyledButton
              key={s.id}
              className="ailow-bloco"
              data-sku-codigo={s.codigo}
              mih={56}
              p="sm"
              w="100%"
              aria-label={`${s.tamanho} ${s.cor}, código ${s.codigo}, ${s.estoque} em estoque`}
              onClick={() => {
                setFolha({ skuId: s.id, acao: escolhendo ?? 'chegou' });
                setEscolhendo(null);
              }}
            >
              <Group justify="space-between" wrap="wrap" gap="xs">
                <Stack gap={0} style={{ minWidth: 0 }}>
                  <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
                    {s.tamanho} · {s.cor}
                  </Text>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {s.codigo}
                  </Text>
                </Stack>
                <SeloEstoque atual={s.estoque} minimo={s.estoque_minimo ?? 0} />
              </Group>
            </UnstyledButton>
          ))}
        </Stack>

        {props.dono && (
          <GradeAcoes
            acoes={[
              { id: 'editar', rotulo: 'Editar', icone: <IconPencil size={32} stroke={1.75} />, aoTocar: () => setEditando(true) },
              {
                id: 'chegou',
                rotulo: 'Chegou mercadoria',
                icone: <IconTruckDelivery size={32} stroke={1.75} />,
                aoTocar: () => pedirEstoque('chegou'),
              },
              {
                id: 'ajustar',
                rotulo: 'Ajustar estoque',
                descricao: 'Ajustar estoque, mais ou menos',
                icone: <IconAdjustmentsHorizontal size={32} stroke={1.75} />,
                aoTocar: () => pedirEstoque('mais'),
              },
              { id: 'arquivar', rotulo: 'Arquivar', icone: <IconArchive size={32} stroke={1.75} />, aoTocar: () => setArquivando(true) },
            ]}
          />
        )}
      </Stack>

      {folha && skuDaFolha && (
        <SkuFolha
          api={props.api}
          dono={props.dono}
          acaoInicial={folha.acao}
          sku={{
            id: skuDaFolha.id,
            codigo: skuDaFolha.codigo,
            produto: p.nome,
            tamanho: skuDaFolha.tamanho,
            cor: skuDaFolha.cor,
            estoque: skuDaFolha.estoque,
            estoque_minimo: skuDaFolha.estoque_minimo,
          }}
          aoFechar={() => setFolha(null)}
          aoMudar={props.aoMudar}
        />
      )}

      {editando && (
        <EditarProduto
          api={props.api}
          produto={p}
          aoFechar={() => setEditando(false)}
          aoSalvo={() => {
            setEditando(false);
            props.aoMudar();
          }}
        />
      )}

      <ConfirmarArquivar
        api={props.api}
        produto={p}
        pecas={pecas}
        aberto={arquivando}
        aoCancelar={() => setArquivando(false)}
        aoArquivado={() => {
          // A lista busca de novo e, sem o produto arquivado, o pai desmonta este pop-up (uma entrada de histórico por vez).
          setArquivando(false);
          props.aoMudar();
        }}
      />
    </Modal>
  );
}

function ConfirmarArquivar(props: {
  api: Api;
  produto: Produto;
  pecas: number;
  aberto: boolean;
  aoCancelar: () => void;
  aoArquivado: () => void;
}) {
  const [pendente, setPendente] = useState(false);

  async function arquivar() {
    setPendente(true);
    try {
      await props.api.arquivarProduto(props.produto.id);
      notifications.show({ message: 'Produto arquivado', color: 'teal', autoClose: 3500, withCloseButton: false });
      props.aoArquivado();
    } catch (e) {
      const erro = e instanceof ErroApi ? e : new ErroApi(500, 'erro_interno');
      notifications.show({ message: mensagemProdutos(erro), color: 'red', autoClose: 6000, withCloseButton: false });
    } finally {
      setPendente(false);
    }
  }

  return (
    <Modal opened={props.aberto} onClose={props.aoCancelar} title="Arquivar produto" closeButtonProps={fecharModal}>
      <Stack gap="md">
        <Text style={{ overflowWrap: 'anywhere' }}>
          Arquivar <strong>{props.produto.nome}</strong>? Ele sai da lista, da venda e das etiquetas.
          {props.pecas > 0 ? ` As ${props.pecas} peças em estoque e o histórico ficam guardados.` : ' O histórico fica guardado.'} Nada é apagado.
        </Text>
        <Group grow gap="xs" wrap="nowrap">
          <Button h={48} variant="default" onClick={props.aoCancelar} disabled={pendente}>
            Cancelar
          </Button>
          <Button h={48} color="red" loading={pendente} onClick={() => void arquivar()}>
            Arquivar
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

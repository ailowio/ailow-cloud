import { useState } from 'react';
import { Button, Group, NativeSelect, SegmentedControl, Stack } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { IconFilter, IconX } from '@tabler/icons-react';
import type { Api } from '../../api/endpoints';
import { Modal } from '../../componentes/navegacao';
import { fecharModal } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';
import { type FiltrosProdutos, categoriasDoFiltro, coresDoFiltro, quantosFiltros } from './filtros-produtos';

export type VisaoProdutos = 'lista' | 'catalogo';

/** Lista ou Catálogo: preferência do aparelho (P02). */
export function useVisaoProdutos(): [VisaoProdutos, (v: VisaoProdutos) => void] {
  const [visao, setVisao] = useLocalStorage<VisaoProdutos>({
    key: 'ailow-produtos-visao',
    defaultValue: 'lista',
    getInitialValueInEffect: false,
  });
  return [visao === 'catalogo' ? 'catalogo' : 'lista', setVisao];
}

/** Alternância Lista | Catálogo, botão Filtros e os chips dos filtros ativos (cada chip tira o seu filtro). */
export function BarraProdutos(props: {
  api: Api;
  visao: VisaoProdutos;
  aoMudarVisao: (v: VisaoProdutos) => void;
  filtros: FiltrosProdutos;
  aoMudarFiltros: (f: FiltrosProdutos) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const { categoria, cor } = props.filtros;
  const n = quantosFiltros(props.filtros);

  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="nowrap">
        <SegmentedControl
          data-visao-produtos={props.visao}
          aria-label="Ver produtos como"
          size="md"
          style={{ flex: 1 }}
          value={props.visao}
          onChange={(v) => props.aoMudarVisao(v === 'catalogo' ? 'catalogo' : 'lista')}
          data={[
            { value: 'lista', label: 'Lista' },
            { value: 'catalogo', label: 'Catálogo' },
          ]}
        />
        <Button
          h={48}
          px="sm"
          variant={n > 0 ? 'light' : 'default'}
          leftSection={<IconFilter size={20} aria-hidden />}
          aria-haspopup="dialog"
          onClick={() => setAberto(true)}
        >
          {n > 0 ? `Filtros (${n})` : 'Filtros'}
        </Button>
      </Group>

      {n > 0 && (
        <Group gap="xs" data-filtros-ativos>
          {categoria && <ChipFiltro rotulo={`Categoria: ${categoria.nome}`} aoTirar={() => props.aoMudarFiltros(cor ? { cor } : {})} />}
          {cor && <ChipFiltro rotulo={`Cor: ${cor}`} aoTirar={() => props.aoMudarFiltros(categoria ? { categoria } : {})} />}
          <Button h={44} variant="subtle" onClick={() => props.aoMudarFiltros({})}>
            Limpar filtros
          </Button>
        </Group>
      )}

      {aberto && (
        <ModalFiltros
          api={props.api}
          filtros={props.filtros}
          aoFechar={() => setAberto(false)}
          aoAplicar={(f) => {
            setAberto(false);
            props.aoMudarFiltros(f);
          }}
        />
      )}
    </Stack>
  );
}

function ChipFiltro(props: { rotulo: string; aoTirar: () => void }) {
  return (
    <Button
      h="auto"
      mih={44}
      py={6}
      radius="xl"
      variant="light"
      rightSection={<IconX size={16} aria-hidden />}
      aria-label={`Tirar filtro ${props.rotulo}`}
      onClick={props.aoTirar}
      styles={{ label: { whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'left' } }}
      data-chip-filtro
    >
      {props.rotulo}
    </Button>
  );
}

/**
 * Categoria e cor (exata, D-A7) para filtrar no servidor. As opções juntam o cadastro da empresa (só o Dono lê
 * /categorias e /opcoes-grade) com o que aparece nos produtos da 1ª página, para o Vendedor também ter o que escolher.
 */
function ModalFiltros(props: {
  api: Api;
  filtros: FiltrosProdutos;
  aoFechar: () => void;
  aoAplicar: (f: FiltrosProdutos) => void;
}) {
  const { carga, tentarDeNovo } = useCarregar(() =>
    Promise.all([
      props.api.categorias('produto').catch(() => null),
      props.api.opcoesGrade().catch(() => null),
      props.api.produtos(),
    ]).then(([c, g, p]) => ({
      categorias: categoriasDoFiltro(c?.categorias ?? null, p.produtos),
      cores: coresDoFiltro(g?.cores ?? null, p.produtos),
    })),
  );
  const [categoriaId, setCategoriaId] = useState(props.filtros.categoria?.id ?? '');
  const [cor, setCor] = useState(props.filtros.cor ?? '');

  return (
    <Modal opened onClose={props.aoFechar} title="Filtros" closeButtonProps={fecharModal}>
      {carga.fase === 'carregando' && <Carregando linhas={2} />}
      {carga.fase === 'erro' && <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />}
      {carga.fase === 'pronto' && (
        <Stack gap="md" data-filtros-produtos>
          <NativeSelect
            size="lg"
            label="Categoria"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.currentTarget.value)}
            data={[{ value: '', label: 'Todas' }, ...carga.dados.categorias.map((c) => ({ value: c.id, label: c.nome }))]}
          />
          <NativeSelect
            size="lg"
            label="Cor"
            value={cor}
            onChange={(e) => setCor(e.currentTarget.value)}
            data={[{ value: '', label: 'Todas' }, ...carga.dados.cores]}
          />
          <Group gap="xs" wrap="nowrap">
            <Button h={48} variant="default" onClick={() => props.aoAplicar({})}>
              Limpar
            </Button>
            <Button
              h={48}
              style={{ flex: 1 }}
              onClick={() => {
                const c = carga.dados.categorias.find((x) => x.id === categoriaId);
                props.aoAplicar({ ...(c && { categoria: c }), ...(cor && { cor }) });
              }}
            >
              Aplicar
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

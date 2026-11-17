import { ActionIcon, Alert, Box, Button, Stack, Text } from '@mantine/core';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  IconAlertTriangle,
  IconCash,
  IconClockHour4,
  IconGripVertical,
  IconSettings,
  IconShoppingBag,
  IconTag,
  IconTruckDelivery,
  IconUsers,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AlertaEstoque, UsuarioPublico } from '@ailow/shared';
import { modulosPara, ordenarModulos, type Modulo } from '../acesso/modulos';
import type { Api } from '../api/endpoints';
import { BlocoAcao, GradeModulos } from '../componentes';
import { Moldura } from './Moldura';
import { linhaDoAlerta, resumoDeRestantes, tituloDoAlerta } from './produtos/rotulos';

const ICONES: Record<Modulo['id'], React.ReactNode> = {
  vendas: <IconShoppingBag size={32} aria-hidden />,
  produtos: <IconTag size={32} aria-hidden />,
  compras: <IconTruckDelivery size={32} aria-hidden />,
  clientes: <IconUsers size={32} aria-hidden />,
  financeiro: <IconCash size={32} aria-hidden />,
  pessoas: <IconClockHour4 size={32} aria-hidden />,
  configuracoes: <IconSettings size={32} aria-hidden />,
};

const ITENS_NO_AVISO = 3;

/** Pouso suave após soltar (evita o "snap" seco do layout). */
export const TRANSICAO_POUSO_MODULO = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)';

const dropAnimation: DropAnimation = {
  duration: 320,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.35' } },
  }),
};

interface Alertas {
  total: number;
  itens: AlertaEstoque[];
}

function useAlertasDeEstoque(api: Api | undefined, dono: boolean): Alertas | null {
  const [alertas, setAlertas] = useState<Alertas | null>(null);
  useEffect(() => {
    if (!api || !dono) return;
    let ativo = true;
    api
      .alertasEstoque()
      .then((r) => ativo && setAlertas(r))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [api, dono]);
  return alertas;
}

/**
 * Handle de arraste separado do BlocoAcao.
 * O aria-label NÃO pode conter o rótulo do módulo: o Playwright casa `name: 'Vendas'` por substring
 * e o handle "Reordenar Vendas" virava um segundo botão (E2E strict mode / timeout).
 */
function ModuloArrastavel(props: {
  id: Modulo['id'];
  children: ReactNode;
  arrastando: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: props.id });
  return (
    <Box
      ref={setNodeRef}
      pos="relative"
      data-modulo={props.id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : TRANSICAO_POUSO_MODULO,
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 2 : undefined,
      }}
    >
      <ActionIcon
        {...attributes}
        {...listeners}
        className="ailow-reordenar"
        variant="transparent"
        size={44}
        aria-label="Arrastar para reordenar"
        data-reordenar={props.id}
        style={{
          position: 'absolute',
          top: 2,
          right: 2,
          zIndex: 1,
          cursor: props.arrastando || isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        <IconGripVertical size={14} stroke={1.5} aria-hidden />
      </ActionIcon>
      {props.children}
    </Box>
  );
}

function BlocoModulo(props: {
  modulo: Modulo;
  indice: number;
  alertaProdutos: number;
  aoAbrir: (m: Modulo['id']) => void;
}) {
  const { modulo: m, indice: i } = props;
  return (
    <BlocoAcao
      rotulo={m.rotulo}
      icone={ICONES[m.id]}
      destaque={i === 0}
      alerta={m.id === 'produtos' && props.alertaProdutos > 0 ? props.alertaProdutos : undefined}
      emBreve={!m.pronto}
      onClick={() => props.aoAbrir(m.id)}
    />
  );
}

/** Tela inicial: grade de 3 colunas com os módulos do perfil (RNF-05). Ordem arrastável (ADR 018). */
export function Inicio(props: {
  usuario: UsuarioPublico;
  api?: Api;
  aoAbrir: (m: Modulo['id']) => void;
}) {
  const base = useMemo(() => modulosPara(props.usuario.perfil), [props.usuario.perfil]);
  const [modulos, setModulos] = useState(base);
  const [arrastandoId, setArrastandoId] = useState<Modulo['id'] | null>(null);
  const alertas = useAlertasDeEstoque(props.api, props.usuario.perfil === 'dono');
  const total = alertas?.total ?? 0;
  const restantes = alertas ? resumoDeRestantes(total, Math.min(ITENS_NO_AVISO, alertas.itens.length)) : null;

  useEffect(() => {
    setModulos(base);
    if (!props.api) return;
    let ativo = true;
    props.api
      .preferenciasUi()
      .then((r) => {
        if (ativo) setModulos(ordenarModulos(base, r.modulos_ordem));
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [base, props.api]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persistir = useCallback(
    (ids: Modulo['id'][]) => {
      if (!props.api) return;
      void props.api.salvarPreferenciasUi({ chave: 'modulos_ordem', valor: ids }).catch(() => {});
    },
    [props.api],
  );

  function aoPegar(evento: DragStartEvent) {
    setArrastandoId(String(evento.active.id) as Modulo['id']);
  }

  function aoSoltar(evento: DragEndEvent) {
    const { active, over } = evento;
    setArrastandoId(null);
    if (!over || active.id === over.id) return;
    setModulos((atual) => {
      const de = atual.findIndex((m) => m.id === active.id);
      const para = atual.findIndex((m) => m.id === over.id);
      if (de < 0 || para < 0) return atual;
      const proximo = arrayMove(atual, de, para);
      persistir(proximo.map((m) => m.id));
      return proximo;
    });
  }

  const moduloArrastado = arrastandoId ? modulos.find((m) => m.id === arrastandoId) : undefined;
  const indiceArrastado = moduloArrastado ? modulos.findIndex((m) => m.id === arrastandoId) : -1;

  return (
    <Moldura
      titulo={`Olá, ${props.usuario.nome}`}
      subtitulo="O que vamos fazer? Segure e arraste para reordenar."
      logoEmpresa
    >
      <Stack gap="md">
        {alertas && total > 0 && (
          <Alert color="red" icon={<IconAlertTriangle aria-hidden />} title={tituloDoAlerta(total)} role="alert">
            <Stack gap="xs" align="flex-start">
              {alertas.itens.slice(0, ITENS_NO_AVISO).map((i) => (
                <Text key={i.sku_id} size="sm" style={{ overflowWrap: 'anywhere' }}>
                  {linhaDoAlerta(i)}
                </Text>
              ))}
              {restantes && (
                <Text size="sm" fw={600}>
                  {restantes}
                </Text>
              )}
              <Button h={48} color="red.9" onClick={() => props.aoAbrir('produtos')}>
                Ver produtos
              </Button>
            </Stack>
          </Alert>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={aoPegar}
          onDragEnd={aoSoltar}
          onDragCancel={() => setArrastandoId(null)}
        >
          <SortableContext items={modulos.map((m) => m.id)} strategy={rectSortingStrategy}>
            <GradeModulos>
              {modulos.map((m, i) => (
                <ModuloArrastavel key={m.id} id={m.id} arrastando={arrastandoId === m.id}>
                  <BlocoModulo modulo={m} indice={i} alertaProdutos={total} aoAbrir={props.aoAbrir} />
                </ModuloArrastavel>
              ))}
            </GradeModulos>
          </SortableContext>
          <DragOverlay dropAnimation={dropAnimation}>
            {moduloArrastado ? (
              <BlocoModulo
                modulo={moduloArrastado}
                indice={Math.max(0, indiceArrastado)}
                alertaProdutos={total}
                aoAbrir={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
        {modulos.some((m) => !m.pronto) && (
          <Text size="sm" c="dimmed">
            Os módulos marcados com “em breve” chegam nas próximas versões.
          </Text>
        )}
      </Stack>
    </Moldura>
  );
}

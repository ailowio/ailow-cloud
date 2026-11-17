import { ActionIcon, Alert, Box, Button, Stack, Text } from '@mantine/core';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
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

/** Handle de arraste separado do BlocoAcao: o DnD não pode virar um 2º role=button (quebra o E2E). */
function ModuloArrastavel(props: { id: Modulo['id']; rotulo: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id });
  return (
    <Box
      ref={setNodeRef}
      pos="relative"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.88 : 1,
        zIndex: isDragging ? 2 : undefined,
      }}
    >
      <ActionIcon
        {...attributes}
        {...listeners}
        variant="subtle"
        size={48}
        aria-label={`Reordenar ${props.rotulo}`}
        style={{ position: 'absolute', top: 0, right: 0, zIndex: 1, cursor: 'grab', touchAction: 'none' }}
      >
        <IconGripVertical size={20} aria-hidden />
      </ActionIcon>
      {props.children}
    </Box>
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

  function aoSoltar(evento: DragEndEvent) {
    const { active, over } = evento;
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
          <SortableContext items={modulos.map((m) => m.id)} strategy={rectSortingStrategy}>
            <GradeModulos>
              {modulos.map((m, i) => (
                <ModuloArrastavel key={m.id} id={m.id} rotulo={m.rotulo}>
                  <BlocoAcao
                    rotulo={m.rotulo}
                    icone={ICONES[m.id]}
                    destaque={i === 0}
                    alerta={m.id === 'produtos' && total > 0 ? total : undefined}
                    emBreve={!m.pronto}
                    onClick={() => props.aoAbrir(m.id)}
                  />
                </ModuloArrastavel>
              ))}
            </GradeModulos>
          </SortableContext>
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

import { Stack, Text } from '@mantine/core';
import {
  IconCash,
  IconClockHour4,
  IconSettings,
  IconShoppingBag,
  IconTag,
  IconTruckDelivery,
  IconUsers,
} from '@tabler/icons-react';
import type { UsuarioPublico } from '@ailow/shared';
import { modulosPara, type Modulo } from '../acesso/modulos';
import { BlocoAcao, GradeModulos } from '../componentes';
import { Moldura } from './Moldura';

const ICONES: Record<Modulo['id'], React.ReactNode> = {
  vendas: <IconShoppingBag size={32} aria-hidden />,
  produtos: <IconTag size={32} aria-hidden />,
  compras: <IconTruckDelivery size={32} aria-hidden />,
  clientes: <IconUsers size={32} aria-hidden />,
  financeiro: <IconCash size={32} aria-hidden />,
  pessoas: <IconClockHour4 size={32} aria-hidden />,
  configuracoes: <IconSettings size={32} aria-hidden />,
};

/** Tela inicial: grade de 3 colunas com os módulos do perfil (RNF-05). Vendas é o primeiro (RF-VEN-01). */
export function Inicio(props: {
  usuario: UsuarioPublico;
  aoAbrir: (m: Modulo['id']) => void;
  aoTrocar: () => void;
}) {
  const modulos = modulosPara(props.usuario.perfil);
  return (
    <Moldura
      titulo={`Olá, ${props.usuario.nome}`}
      subtitulo="O que vamos fazer?"
      acaoTopo={{ rotulo: 'Trocar', aoClicar: props.aoTrocar }}
      logoEmpresa
    >
      <Stack gap="md">
        <GradeModulos>
          {modulos.map((m, i) => (
            <BlocoAcao
              key={m.id}
              rotulo={m.rotulo}
              icone={ICONES[m.id]}
              destaque={i === 0}
              emBreve={!m.pronto}
              onClick={() => props.aoAbrir(m.id)}
            />
          ))}
        </GradeModulos>
        <Text size="sm" c="dimmed">
          Os módulos marcados com “em breve” chegam nas próximas versões.
        </Text>
      </Stack>
    </Moldura>
  );
}

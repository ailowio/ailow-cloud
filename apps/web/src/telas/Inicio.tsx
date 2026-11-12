import { Alert, Button, Stack, Text } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCash,
  IconClockHour4,
  IconSettings,
  IconShoppingBag,
  IconTag,
  IconTruckDelivery,
  IconUsers,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import type { AlertaEstoque, UsuarioPublico } from '@ailow/shared';
import { modulosPara, type Modulo } from '../acesso/modulos';
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

// Quantos itens o aviso lista na própria tela inicial; o resto fica em Produtos › Abaixo do mínimo.
const ITENS_NO_AVISO = 3;

interface Alertas {
  total: number;
  itens: AlertaEstoque[];
}

/**
 * RF-PRO-05: só o Dono vê o aviso de estoque abaixo do mínimo. Se a consulta falhar, a tela inicial segue sem o
 * aviso (não deve travar a entrada na loja); o aviso volta na próxima vez que a tela abrir.
 */
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

/** Tela inicial: grade de 3 colunas com os módulos do perfil (RNF-05). Vendas é o primeiro (RF-VEN-01). */
export function Inicio(props: {
  usuario: UsuarioPublico;
  api?: Api;
  aoAbrir: (m: Modulo['id']) => void;
  aoTrocar: () => void;
}) {
  const modulos = modulosPara(props.usuario.perfil);
  const alertas = useAlertasDeEstoque(props.api, props.usuario.perfil === 'dono');
  const total = alertas?.total ?? 0;
  const restantes = alertas ? resumoDeRestantes(total, Math.min(ITENS_NO_AVISO, alertas.itens.length)) : null;

  return (
    <Moldura
      titulo={`Olá, ${props.usuario.nome}`}
      subtitulo="O que vamos fazer?"
      acaoTopo={{ rotulo: 'Trocar', aoClicar: props.aoTrocar }}
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
              {/* red.9: texto branco com contraste >= 4,5:1 sobre o vermelho do aviso */}
              <Button h={48} color="red.9" onClick={() => props.aoAbrir('produtos')}>
                Ver produtos
              </Button>
            </Stack>
          </Alert>
        )}
        <GradeModulos>
          {modulos.map((m, i) => (
            <BlocoAcao
              key={m.id}
              rotulo={m.rotulo}
              icone={ICONES[m.id]}
              destaque={i === 0}
              alerta={m.id === 'produtos' && total > 0 ? total : undefined}
              emBreve={!m.pronto}
              onClick={() => props.aoAbrir(m.id)}
            />
          ))}
        </GradeModulos>
        {modulos.some((m) => !m.pronto) && (
          <Text size="sm" c="dimmed">
            Os módulos marcados com “em breve” chegam nas próximas versões.
          </Text>
        )}
      </Stack>
    </Moldura>
  );
}

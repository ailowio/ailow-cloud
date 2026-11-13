import { type ReactNode, useEffect, useRef } from 'react';
import { Box, Button, Group, Progress, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useLocation, useNavigate } from 'react-router';

// Peças do assistente em passos (padrão da S10, "Novo produto"), compartilhadas pela "Nova despesa" (S11).

/** "Passo X de N" com barra de progresso. */
export function ProgressoDoPasso({ indice, total }: { indice: number; total: number }) {
  return (
    <Stack gap={6}>
      <Text size="sm" c="dimmed" data-progresso>
        Passo {indice + 1} de {total}
      </Text>
      <Progress value={((indice + 1) / total) * 100} size="sm" aria-label={`Passo ${indice + 1} de ${total}`} />
    </Stack>
  );
}

/** Rodapé fixo: secundário (contornado, 1/3) à esquerda e principal (cheio, 2/3) à direita, igual em todos os passos. */
export function RodapeDoAssistente(props: {
  rotuloSecundario: string;
  rotuloPrincipal: string;
  aoSecundario: () => void;
  aoPrincipal: () => void;
  ocupado?: boolean;
}) {
  return (
    <Box className="ailow-rodape-assistente" data-rodape-assistente>
      <Group wrap="nowrap" gap="sm">
        <Button
          data-botao="secundario"
          h={52}
          px="xs"
          variant="outline"
          color="gray"
          disabled={props.ocupado}
          onClick={props.aoSecundario}
          style={{ flex: '1 1 0' }}
        >
          {props.rotuloSecundario}
        </Button>
        <Button
          data-botao="principal"
          h={52}
          px="xs"
          fw={700}
          onClick={props.aoPrincipal}
          loading={props.ocupado}
          style={{ flex: '2 1 0' }}
        >
          {props.rotuloPrincipal}
        </Button>
      </Group>
    </Box>
  );
}

/** Erro de validação do passo: toast (UXM-04), nunca um bloco que empurre o layout. */
export const avisoDoPasso = (message: string) =>
  notifications.show({ message, color: 'red', autoClose: 4500, withCloseButton: false });

/**
 * Moldura comum dos assistentes de cadastro (S13): cartão com título, "Passo X de N", o conteúdo do passo e o rodapé
 * (Cancelar/Voltar à esquerda, Continuar/Salvar à direita). O botão principal nunca fica desabilitado: o que falta vira toast.
 */
export function QuadroDoAssistente(props: {
  passo: string;
  titulo: string;
  indice: number;
  total: number;
  rotuloPrincipal: string;
  aoPrincipal: () => void;
  aoCancelar: () => void;
  aoVoltar: () => void;
  ocupado?: boolean;
  children: ReactNode;
}) {
  const primeiro = props.indice === 0;
  return (
    <Stack gap="md" className="ailow-cartao" p="md" data-assistente={props.passo}>
      <Title order={2} fz="lg" style={{ overflowWrap: 'anywhere' }}>
        {props.titulo}
      </Title>
      <ProgressoDoPasso indice={props.indice} total={props.total} />
      {props.children}
      <RodapeDoAssistente
        rotuloSecundario={primeiro ? 'Cancelar' : 'Voltar'}
        rotuloPrincipal={props.rotuloPrincipal}
        aoSecundario={primeiro ? props.aoCancelar : props.aoVoltar}
        aoPrincipal={props.aoPrincipal}
        ocupado={props.ocupado}
      />
    </Stack>
  );
}

/**
 * O passo atual mora no histórico do navegador: o Voltar do sistema recua um passo antes de sair do assistente.
 * Cada passo à frente empurra uma entrada; ao desmontar com entradas sobrando, devolve-as (o Voltar do sistema
 * não cai em passos de um assistente que não existe mais).
 */
export function usePassoNoHistorico<P extends string>(passos: readonly P[]) {
  const navigate = useNavigate();
  const location = useLocation();
  const doHistorico = (location.state as { passo?: P } | null)?.passo;
  const atual: P = doHistorico && passos.includes(doHistorico) ? doHistorico : (passos[0] as P);
  const indice = passos.indexOf(atual);

  const empurrados = useRef(0);
  empurrados.current = indice;
  const navegar = useRef(navigate);
  navegar.current = navigate;
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      queueMicrotask(() => {
        const tem = (window.history.state as { usr?: { passo?: string } | null } | null)?.usr?.passo !== undefined;
        if (!montado.current && empurrados.current > 0 && tem) navegar.current(-empurrados.current);
      });
    };
  }, []);

  // Passo novo, rolagem do corpo da tela no topo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: o passo é o gatilho
  useEffect(() => {
    document.getElementById('conteudo')?.scrollTo({ top: 0 });
  }, [atual]);

  return {
    atual,
    indice,
    ultimo: indice === passos.length - 1,
    avancar: () => navigate(location.pathname + location.search, { state: { passo: passos[indice + 1] } }),
    recuar: () => navigate(-1),
  };
}

import { useState } from 'react';
import { Button, Group, Stack, Switch, Text, TextInput, Title } from '@mantine/core';
import type { EixoGrade } from '@ailow/shared';
import type { Api } from '../../api/endpoints';
import { EstadoVazio } from '../../componentes';
import { useAcao } from '../config/comum';
import { Carregando, ErroCarregar, useCarregar } from '../estados';

/**
 * Biblioteca de eixos da empresa: Tamanho/Cor (sistema) + custom (ex.: Taça).
 * Valores de tamanho/cor continuam na aba dedicada (ADR 017); aqui o Dono cria eixos extras.
 */
export function ListaEixosGrade({ api }: { api: Api }) {
  const { carga, recarregar, tentarDeNovo } = useCarregar(() => api.eixosGrade());
  const [nome, setNome] = useState('');
  const { pendente, rodar } = useAcao();

  if (carga.fase === 'carregando') return <Carregando linhas={4} />;
  if (carga.fase === 'erro') return <ErroCarregar mensagem={carga.mensagem} aoTentar={tentarDeNovo} />;

  const custom = carga.dados.eixos.filter((e) => !e.sistema);
  const sistema = carga.dados.eixos.filter((e) => e.sistema);

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Eixos geram variações com estoque e QR. Atributos (bojo, aro…) ficam na categoria e só descrevem a peça.
      </Text>
      <Stack gap="xs">
        <Title order={4}>Sistema</Title>
        {sistema.map((e) => (
          <Text key={e.id} fw={600}>
            {e.nome} · {e.valores.filter((v) => v.ativa).length} valores
          </Text>
        ))}
      </Stack>
      <Stack gap="xs">
        <Title order={4}>Extras</Title>
        {custom.length === 0 ? (
          <EstadoVazio titulo="Nenhum eixo extra" texto="Crie Taça ou outro eixo; depois ligue na categoria." />
        ) : (
          custom.map((e) => <LinhaEixo key={e.id} eixo={e} api={api} aoMudar={() => void recarregar()} />)
        )}
      </Stack>
      <Group align="flex-end" wrap="nowrap">
        <TextInput
          label="Novo eixo"
          placeholder="Taça"
          value={nome}
          onChange={(ev) => setNome(ev.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Button
          mih={48}
          loading={pendente}
          disabled={nome.trim() === ''}
          onClick={() =>
            void rodar(async () => {
              await api.criarEixoGrade({ nome: nome.trim(), tipo_valor: 'texto' });
              setNome('');
              await recarregar();
            }, 'Eixo criado')
          }
        >
          Criar eixo
        </Button>
      </Group>
    </Stack>
  );
}

function LinhaEixo({ eixo, api, aoMudar }: { eixo: EixoGrade; api: Api; aoMudar: () => void }) {
  const [valor, setValor] = useState('');
  const { pendente, rodar } = useAcao();
  return (
    <Stack gap="xs" p="sm" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
      <Text fw={650}>{eixo.nome}</Text>
      <Group gap="xs">
        {eixo.valores.map((v) => (
          <Switch
            key={v.id}
            label={v.nome}
            checked={v.ativa}
            disabled={pendente}
            onChange={(ev) =>
              void rodar(async () => {
                await api.alterarValorEixo(v.id, { nome: v.nome, amostra: v.amostra, ativa: ev.currentTarget.checked });
                aoMudar();
              }, v.ativa ? 'Valor desativado' : 'Valor ativado')
            }
          />
        ))}
      </Group>
      <Group wrap="nowrap" align="flex-end">
        <TextInput
          label="Novo valor"
          placeholder="A"
          value={valor}
          onChange={(ev) => setValor(ev.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Button
          mih={48}
          loading={pendente}
          disabled={valor.trim() === ''}
          onClick={() =>
            void rodar(async () => {
              await api.criarValorEixo(eixo.id, { nome: valor.trim() });
              setValor('');
              aoMudar();
            }, 'Valor adicionado')
          }
        >
          Adicionar
        </Button>
      </Group>
    </Stack>
  );
}

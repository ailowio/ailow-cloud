import { useState } from 'react';
import {
  ActionIcon, Alert, Badge, Button, Card, Container, Group, SimpleGrid, Stack, Text, TextInput, Title,
  useMantineColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { DataTable } from 'mantine-datatable';
import {
  IconBuildingStore, IconClock, IconCoin, IconMoon, IconPackage, IconPlus, IconSettings, IconSun, IconTruckDelivery, IconUsers,
} from '@tabler/icons-react';
import { marca, ouro } from '../tema/tema';
import {
  BlocoAcao, Carrinho, EstadoVazio, Etapas, GradeModulos, SeloEstoque, TecladoPin, Valor, type ItemCarrinho,
} from '../componentes';

const SKUS = [
  { codigo: '0042-46-CHO', nome: 'Tomara que caia Essência', tam: '46', cor: 'Chocolate', preco: 8900, estoque: 3, minimo: 2 },
  { codigo: '0042-48-CHO', nome: 'Tomara que caia Essência', tam: '48', cor: 'Chocolate', preco: 8900, estoque: 0, minimo: 2 },
  { codigo: '0107-M-PRE', nome: 'Calcinha Bombom', tam: 'M', cor: 'Preto', preco: 2900, estoque: 12, minimo: 4 },
];

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Stack gap="sm">
      <Title order={3}>{titulo}</Title>
      {children}
    </Stack>
  );
}

function Paleta({ nome, cores }: { nome: string; cores: readonly string[] }) {
  return (
    <div>
      <Text fw={600} mb={4}>{nome}</Text>
      <Group gap={0} wrap="nowrap">
        {cores.map((c, i) => (
          <div key={c} title={`${nome}.${i} ${c}`} style={{ background: c, flex: 1, height: 36 }} />
        ))}
      </Group>
    </div>
  );
}

export function Catalogo() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [itens, setItens] = useState<ItemCarrinho[]>([
    { codigo: SKUS[0].codigo, nome: SKUS[0].nome, detalhe: `${SKUS[0].tam} · ${SKUS[0].cor}`, precoCentavos: SKUS[0].preco, qtd: 1 },
  ]);
  const mudar = (codigo: string, delta: number) =>
    setItens((l) => l.map((i) => (i.codigo === codigo ? { ...i, qtd: i.qtd + delta } : i)).filter((i) => i.qtd > 0));

  return (
    <Container size="sm" py="md">
      <Stack gap="xl">
        <Group justify="space-between">
          <Title order={1}>Design System</Title>
          <ActionIcon variant="default" size={48} onClick={toggleColorScheme} aria-label="Trocar tema">
            {colorScheme === 'dark' ? <IconSun /> : <IconMoon />}
          </ActionIcon>
        </Group>
        <Alert color="gray" title="Catálogo">
          Mantine 9.7.3 + mantine-datatable. Tema em duas camadas: Ailow (fixa) e empresa (exemplo: Marcant). Dados de exemplo.
        </Alert>

        <Secao titulo="Cores">
          <Paleta nome="marca" cores={marca} />
          <Paleta nome="ouro" cores={ouro} />
          <Group gap="xs">
            <Badge color="green">Sucesso</Badge><Badge color="yellow" c="dark">Alerta</Badge>
            <Badge color="red">Perigo</Badge><Badge color="blue">Info</Badge>
          </Group>
        </Secao>

        <Secao titulo="Tela inicial: GradeModulos + BlocoAcao">
          <GradeModulos>
            <BlocoAcao destaque rotulo="Vendas" icone={<IconPlus size={32} />} />
            <BlocoAcao rotulo="Produtos" icone={<IconPackage size={32} />} alerta={2} />
            <BlocoAcao rotulo="Compras" icone={<IconTruckDelivery size={32} />} />
            <BlocoAcao rotulo="Clientes" icone={<IconUsers size={32} />} />
            <BlocoAcao rotulo="Financeiro" icone={<IconCoin size={32} />} />
            <BlocoAcao rotulo="Pessoas" icone={<IconClock size={32} />} />
            <BlocoAcao rotulo="Config." icone={<IconSettings size={32} />} />
          </GradeModulos>
        </Secao>

        <Secao titulo="PIN: TecladoPin">
          <TecladoPin onCompleto={(pin) => notifications.show({ message: `PIN digitado (${pin.length} dígitos)`, color: 'green' })} />
        </Secao>

        <Secao titulo="Carrinho + Valor">
          <Carrinho itens={itens} onMudar={mudar} />
          <Button onClick={() => setItens([{ codigo: SKUS[2].codigo, nome: SKUS[2].nome, detalhe: `${SKUS[2].tam} · ${SKUS[2].cor}`, precoCentavos: SKUS[2].preco, qtd: 1 }])}>
            Trocar item
          </Button>
          <Button variant="default" onClick={() => setItens([])}>Esvaziar (mostra o estado vazio)</Button>
        </Secao>

        <Secao titulo="Etapas (cadastro de produto / fechamento)">
          <Etapas
            passos={[
              { titulo: 'Categoria', conteudo: <Text py="md">Sutiã · Calcinha · Baby doll · Modelador…</Text> },
              { titulo: 'Tamanhos', conteudo: <Text py="md">Marque os tamanhos que você tem.</Text> },
              { titulo: 'Preço', conteudo: <TextInput py="md" label="Preço de venda" placeholder="89,00" /> },
            ]}
          />
        </Secao>

        <Secao titulo="Lista: cartões no celular, tabela no computador">
          <Stack gap="sm" hiddenFrom="sm">
            {SKUS.map((s) => (
              <Card key={s.codigo} withBorder>
                <Group justify="space-between" wrap="nowrap">
                  <div style={{ minWidth: 0 }}>
                    <Text truncate>{s.nome}</Text>
                    <Text size="sm" c="dimmed">{s.tam} · {s.cor} · {s.codigo}</Text>
                  </div>
                  <Stack gap={4} align="flex-end"><Valor centavos={s.preco} /><SeloEstoque atual={s.estoque} minimo={s.minimo} /></Stack>
                </Group>
              </Card>
            ))}
          </Stack>
          <div style={{ display: 'none' }} className="so-desktop">
            <DataTable
              withTableBorder
              records={SKUS}
              idAccessor="codigo"
              columns={[
                { accessor: 'codigo', title: 'Código' },
                { accessor: 'nome', title: 'Modelo' },
                { accessor: 'tam', title: 'Tam.' },
                { accessor: 'cor', title: 'Cor' },
                { accessor: 'preco', title: 'Preço', render: (s) => <Valor centavos={s.preco} /> },
                { accessor: 'estoque', title: 'Estoque', render: (s) => <SeloEstoque atual={s.estoque} minimo={s.minimo} /> },
              ]}
            />
          </div>
          <EstadoVazio titulo="Nenhum produto ainda" texto="Quando você cadastrar uma peça, ela aparece aqui." acao="Novo produto" />
        </Secao>

        <Secao titulo="Avisos">
          <SimpleGrid cols={2}>
            <Button color="green" leftSection={<IconBuildingStore size={18} />} onClick={() => notifications.show({ message: 'Venda 1827 finalizada.', color: 'green', autoClose: 3000 })}>
              Sucesso
            </Button>
            <Button color="red" onClick={() => notifications.show({ title: 'Peça sem estoque', message: 'Chame o Dono.', color: 'red', autoClose: false })}>
              Erro
            </Button>
          </SimpleGrid>
        </Secao>
      </Stack>
    </Container>
  );
}

import { useState, type ReactNode } from 'react';
import {
  ActionIcon, Badge, Box, Button, Container, Group, SimpleGrid, Stack, Text, TextInput, Title, useMantineColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { DataTable } from 'mantine-datatable';
import {
  IconCamera, IconCircleCheck, IconClock, IconCoin, IconMoon, IconPackage, IconPlus, IconReportAnalytics, IconSettings, IconSun,
  IconTruckDelivery, IconUsers,
} from '@tabler/icons-react';
import { GradeAcoes } from '../componentes/GradeAcoes';
import { Modal } from '../componentes/navegacao';
import { ambar, azul, chumbo, marca } from '../tema/tema';
import {
  BlocoAcao, Carrinho, EstadoVazio, Etapas, GradeModulos, SeloEstoque, TecladoPin, Valor, type ItemCarrinho,
} from '../componentes';

// Dados de exemplo (não são do cliente)
const SKUS = [
  { codigo: '0042-46-CHO', nome: 'Tomara que caia Essência', tam: '46', cor: 'Chocolate', preco: 8900, estoque: 3, minimo: 2 },
  { codigo: '0042-48-CHO', nome: 'Tomara que caia Essência', tam: '48', cor: 'Chocolate', preco: 8900, estoque: 0, minimo: 2 },
  { codigo: '0107-M-PRE', nome: 'Calcinha Bombom cintura alta renda francesa', tam: 'M', cor: 'Preto', preco: 2900, estoque: 12, minimo: 4 },
];

const LINHAS_DO_POPUP = Array.from({ length: 24 }, (_, i) => `Linha ${i + 1}: o corpo rola por dentro; a página atrás não se mexe.`);

const PALETAS = [
  { nome: 'marca', papel: 'Cor do A da logo: ações, seleção, totais, PIN', cores: marca, tom: 5 },
  { nome: 'azul', papel: 'Secundária: avisos informativos', cores: azul, tom: 6 },
  { nome: 'ambar', papel: 'Alerta: estoque baixo', cores: ambar, tom: 5 },
  { nome: 'chumbo', papel: 'Base neutra do tema escuro (cinza chumbo)', cores: chumbo, tom: 7 },
];

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Stack gap="sm" component="section">
      <Title order={3} fz="lg">{titulo}</Title>
      {children}
    </Stack>
  );
}

function Paleta({ nome, papel, cores, tom }: (typeof PALETAS)[number]) {
  return (
    <Box>
      <Group justify="space-between" gap="xs" mb={6}>
        <Text fw={650} size="sm">{nome}</Text>
        <Text size="xs" c="dimmed">{papel} · {cores[tom]}</Text>
      </Group>
      <Group gap={0} wrap="nowrap" style={{ borderRadius: 8, overflow: 'hidden' }}>
        {cores.map((c, i) => (
          <Box key={c} title={`${nome}.${i} ${c}`} h={i === tom ? 40 : 32} bg={c} style={{ flex: 1, alignSelf: 'end' }} />
        ))}
      </Group>
    </Box>
  );
}

export function Catalogo() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [itens, setItens] = useState<ItemCarrinho[]>([
    { codigo: SKUS[0].codigo, nome: SKUS[0].nome, detalhe: `${SKUS[0].tam} · ${SKUS[0].cor}`, precoCentavos: SKUS[0].preco, qtd: 1 },
    { codigo: SKUS[2].codigo, nome: SKUS[2].nome, detalhe: `${SKUS[2].tam} · ${SKUS[2].cor}`, precoCentavos: SKUS[2].preco, qtd: 2 },
  ]);
  const [popup, setPopup] = useState<'curto' | 'longo' | null>(null);
  const mudar = (codigo: string, delta: number) =>
    setItens((l) => l.map((i) => (i.codigo === codigo ? { ...i, qtd: i.qtd + delta } : i)).filter((i) => i.qtd > 0));

  return (
    <>
      <Box component="header" style={{ background: 'var(--ailow-topo)', borderBottom: '1px solid var(--ailow-borda)' }}>
        <Container size="sm" py="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <Box w={10} h={10} bg="marca.5" style={{ borderRadius: 3, boxShadow: '0 0 12px var(--ailow-marca)' }} />
              <Title order={1} fz="xl">Ailow ERP</Title>
              <Badge variant="light" color="marca">Design System</Badge>
            </Group>
            <ActionIcon variant="default" size={48} onClick={toggleColorScheme} aria-label="Trocar tema claro/escuro">
              {colorScheme === 'dark' ? <IconSun /> : <IconMoon />}
            </ActionIcon>
          </Group>
        </Container>
      </Box>

      <Container size="sm" py="lg">
        <Stack gap={36}>
          <Secao titulo="Cores">
            <Stack gap="md" p="md" className="ailow-cartao">
              {PALETAS.map((p) => <Paleta key={p.nome} {...p} />)}
            </Stack>
          </Secao>

          <Secao titulo="Tela inicial">
            <GradeModulos>
              <BlocoAcao destaque rotulo="Vendas" icone={<IconPlus size={32} stroke={1.75} />} />
              <BlocoAcao rotulo="Produtos" icone={<IconPackage size={32} stroke={1.75} />} alerta={2} />
              <BlocoAcao rotulo="Compras" icone={<IconTruckDelivery size={32} stroke={1.75} />} />
              <BlocoAcao rotulo="Clientes" icone={<IconUsers size={32} stroke={1.75} />} />
              <BlocoAcao rotulo="Financeiro" icone={<IconCoin size={32} stroke={1.75} />} />
              <BlocoAcao rotulo="Pessoas" icone={<IconClock size={32} stroke={1.75} />} />
              <BlocoAcao rotulo="Config." icone={<IconSettings size={32} stroke={1.75} />} />
            </GradeModulos>
          </Secao>

          <Secao titulo="Menu de ações">
            <GradeAcoes
              acoes={[
                { id: 'escanear', rotulo: 'Escanear', icone: <IconCamera size={32} stroke={1.75} />, aoTocar: () => notifications.show({ message: 'Escanear', color: 'marca' }) },
                { id: 'nova', rotulo: 'Nova venda', icone: <IconPlus size={32} stroke={1.75} />, aoTocar: () => notifications.show({ message: 'Nova venda', color: 'marca' }) },
                { id: 'gerenciar', rotulo: 'Gerenciar vendas', icone: <IconReportAnalytics size={32} stroke={1.75} />, aoTocar: () => notifications.show({ message: 'Gerenciar vendas', color: 'marca' }) },
                { id: 'contas', rotulo: 'Contas a pagar', icone: <IconCoin size={32} stroke={1.75} />, aoTocar: () => notifications.show({ message: 'Contas a pagar', color: 'marca' }) },
                { id: 'etiquetas', rotulo: 'Etiquetas', icone: <IconPackage size={32} stroke={1.75} />, aoTocar: () => notifications.show({ message: 'Etiquetas', color: 'marca' }) },
                { id: 'bloqueada', rotulo: 'Indisponível', icone: <IconSettings size={32} stroke={1.75} />, aoTocar: () => undefined, desabilitado: true },
              ]}
            />
          </Secao>

          <Secao titulo="Pop-up">
            <Group grow>
              <Button variant="default" onClick={() => setPopup('curto')}>Abrir pop-up</Button>
              <Button variant="default" onClick={() => setPopup('longo')}>Abrir pop-up longo</Button>
            </Group>
            <Modal opened={popup !== null} onClose={() => setPopup(null)} title="Pop-up de celular">
              <Stack gap="sm">
                <Text>Aparece no centro, com cantos arredondados e margem de 16 px. O Voltar do aparelho fecha.</Text>
                {popup === 'longo' && LINHAS_DO_POPUP.map((t) => <Text key={t} c="dimmed">{t}</Text>)}
                <Button onClick={() => setPopup(null)}>Entendi</Button>
              </Stack>
            </Modal>
          </Secao>

          <Secao titulo="Entrada por PIN">
            <Box p="md" className="ailow-cartao">
              <TecladoPin onCompleto={(pin) => notifications.show({ message: `PIN com ${pin.length} dígitos recebido.`, color: 'marca' })} />
            </Box>
          </Secao>

          <Secao titulo="Carrinho">
            <Carrinho itens={itens} onMudar={mudar} />
            <Button variant="default" onClick={() => setItens([])}>Esvaziar carrinho</Button>
          </Secao>

          <Secao titulo="Passo a passo">
            <Etapas
              passos={[
                { titulo: 'Categoria', conteudo: <Text c="dimmed">Sutiã · Calcinha · Baby doll · Modelador</Text> },
                { titulo: 'Tamanhos', conteudo: <Text c="dimmed">Marque os tamanhos que você tem.</Text> },
                { titulo: 'Preço', conteudo: <TextInput label="Preço de venda" placeholder="89,00" inputMode="decimal" size="lg" /> },
              ]}
            />
          </Secao>

          <Secao titulo="Lista de produtos">
            <Stack gap="sm" hiddenFrom="sm">
              {SKUS.map((s) => (
                <Group key={s.codigo} justify="space-between" wrap="nowrap" align="flex-start" p="md" className="ailow-cartao">
                  <Box miw={0} style={{ flex: 1 }}>
                    <Text fw={600} style={{ overflowWrap: 'anywhere' }}>{s.nome}</Text>
                    <Text size="sm" c="dimmed">{s.tam} · {s.cor} · {s.codigo}</Text>
                  </Box>
                  <Stack gap={4} align="flex-end"><Valor centavos={s.preco} /><SeloEstoque atual={s.estoque} minimo={s.minimo} /></Stack>
                </Group>
              ))}
            </Stack>
            <Box className="so-desktop ailow-cartao" p="xs">
              <DataTable
                records={SKUS}
                idAccessor="codigo"
                highlightOnHover
                columns={[
                  { accessor: 'codigo', title: 'Código' },
                  { accessor: 'nome', title: 'Modelo' },
                  { accessor: 'tam', title: 'Tam.' },
                  { accessor: 'cor', title: 'Cor' },
                  { accessor: 'preco', title: 'Preço', textAlign: 'right', render: (s) => <Valor centavos={s.preco} /> },
                  { accessor: 'estoque', title: 'Estoque', render: (s) => <SeloEstoque atual={s.estoque} minimo={s.minimo} /> },
                ]}
              />
            </Box>
            <EstadoVazio titulo="Nenhum produto ainda" texto="Quando você cadastrar uma peça, ela aparece aqui." acao="Novo produto" />
          </Secao>

          <Secao titulo="Avisos">
            <SimpleGrid cols={2}>
              <Button color="marca" leftSection={<IconCircleCheck size={20} />} onClick={() => notifications.show({ message: 'Venda 1827 finalizada.', color: 'marca', autoClose: 3000 })}>
                Sucesso
              </Button>
              <Button color="red" onClick={() => notifications.show({ title: 'Peça sem estoque', message: 'Chame o Dono.', color: 'red', autoClose: false })}>
                Erro
              </Button>
            </SimpleGrid>
          </Secao>
        </Stack>
      </Container>
    </>
  );
}

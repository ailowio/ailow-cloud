import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import 'mantine-datatable/styles.css';
import './catalogo/catalogo.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { temaAilow } from './tema/tema';
import { Catalogo } from './catalogo/Catalogo';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={temaAilow} defaultColorScheme="dark">
      <Notifications position="bottom-center" />
      <Catalogo />
    </MantineProvider>
  </StrictMode>,
);

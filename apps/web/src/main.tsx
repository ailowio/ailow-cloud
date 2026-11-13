import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import 'mantine-datatable/styles.css';
import '@fontsource-variable/sora';
import '@fontsource-variable/manrope';
import './tema/tema.css';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { BrowserRouter } from 'react-router';
import { temaAilow } from './tema/tema';
import { App } from './App';
import { registrarServiceWorker } from './pwa/registrar';

// Catálogo do Design System: só em desenvolvimento (http://localhost:5173/?catalogo). Fora do bundle de produção.
const Catalogo = import.meta.env.DEV
  ? lazy(() => import('./catalogo/Catalogo').then((m) => ({ default: m.Catalogo })))
  : null;
const mostrarCatalogo = Catalogo !== null && new URLSearchParams(location.search).has('catalogo');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={temaAilow} defaultColorScheme="dark">
      <BrowserRouter>
        <Notifications position="bottom-center" />
        {mostrarCatalogo && Catalogo ? (
          <Suspense fallback={null}>
            <Catalogo />
          </Suspense>
        ) : (
          <App />
        )}
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>,
);

registrarServiceWorker();

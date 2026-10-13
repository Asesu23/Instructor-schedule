import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { markUpdateReady } from './providers/appUpdate';
import { registerLifecycle } from './providers/lifecycle';
import { QueryProvider } from './providers/QueryProvider';
import { setupServiceWorker } from './providers/serviceWorker';
import './styles/index.css';

void markUpdateReady();
setupServiceWorker();
registerLifecycle();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>,
);

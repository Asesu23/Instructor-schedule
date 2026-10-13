import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerLifecycle } from './providers/lifecycle';
import { QueryProvider } from './providers/QueryProvider';
import './styles/index.css';

registerLifecycle();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>,
);

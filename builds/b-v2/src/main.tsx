import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import './index.css';

const root = createRoot(document.getElementById('root')!);

// Config is validated on import (e.g. refuses a secret key in the browser).
// Load the app dynamically so a misconfiguration shows a clear screen instead
// of a blank page.
import('./App')
  .then(({ App }) =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  .catch((err: unknown) => {
    const message = err instanceof Error && err.name === 'Error' ? err.message : 'The app failed to start.';
    root.render(
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="card max-w-lg p-8">
          <h1 className="text-xl font-bold">Curio can’t start</h1>
          <p className="mt-2 text-muted">{import.meta.env.DEV ? message : 'Please try again later.'}</p>
        </div>
      </div>,
    );
  });

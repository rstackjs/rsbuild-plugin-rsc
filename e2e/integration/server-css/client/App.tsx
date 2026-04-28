import { type ReactElement, Suspense, use } from 'react';
import { createFromFetch } from 'react-server-dom-rspack/client.browser';

function fetchRSC(): Promise<ReactElement> {
  return createFromFetch(
    fetch('/', {
      headers: {
        Accept: 'text/x-component',
      },
    }),
  );
}

let request: Promise<ReactElement> | undefined;

function ServerContent() {
  request ??= fetchRSC();
  return use(request);
}

export function App() {
  return (
    <main>
      <h1>Client shell</h1>
      <Suspense fallback={<p>Loading RSC</p>}>
        <ServerContent />
      </Suspense>
    </main>
  );
}

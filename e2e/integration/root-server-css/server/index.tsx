import type { IncomingMessage, ServerResponse } from 'node:http';
import { renderToReadableStream } from 'react-server-dom-rspack/server.node';
import { toNodeHandler } from 'srvx/node';
import { RootServerCssPanel } from './RootServerCssPanel';

async function handler(): Promise<Response> {
  const rscStream = renderToReadableStream(<RootServerCssPanel />);

  return new Response(rscStream, {
    headers: {
      'content-type': 'text/x-component;charset=utf-8',
    },
  });
}

export default {
  fetch: handler,
  async nodeHandler(
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage>,
    next: () => void,
  ) {
    if (req.headers.accept?.includes('text/x-component')) {
      await toNodeHandler(() => handler())(req, res);
      return;
    }

    next();
  },
};

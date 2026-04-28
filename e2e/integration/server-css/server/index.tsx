import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  renderToReadableStream,
  type ServerEntry,
} from 'react-server-dom-rspack/server.node';
import { toNodeHandler } from 'srvx/node';
import { Root } from './Root';
import { Page1 } from './pages/Page1';
import { Page2 } from './pages/Page2';

async function handler(): Promise<Response> {
  const page1CssFiles =
    (Page1 as ServerEntry<typeof Page1>).entryCssFiles ?? [];
  const page2CssFiles =
    (Page2 as ServerEntry<typeof Page2>).entryCssFiles ?? [];
  const cssLinks = [...page1CssFiles, ...page2CssFiles].map((href) => (
    <link key={href} rel="stylesheet" href={href} precedence="default" />
  ));
  const rscStream = renderToReadableStream(
    <>
      {cssLinks}
      <Root />
    </>,
  );

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

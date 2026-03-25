import type { IncomingMessage, ServerResponse } from 'node:http';
import { unstable_matchRSCServerRequest as matchRSCServerRequest } from 'react-router';
import {
  createTemporaryReferenceSet,
  decodeAction,
  decodeFormState,
  decodeReply,
  loadServerAction,
  renderToReadableStream,
} from 'react-server-dom-rspack/server.node';
import { toNodeHandler } from 'srvx/node';
import { generateHTML } from './entry.ssr';
import { routes } from './routes/config';

async function fetchServer(request: Request) {
  let entryJsFiles: string[];

  const response = await matchRSCServerRequest({
    // Provide the React Server touchpoints.
    createTemporaryReferenceSet,
    decodeAction,
    decodeFormState,
    decodeReply,
    loadServerAction,
    request,
    // The app routes.
    routes: routes(),
    // Encode the match with the React Server implementation.
    generateResponse(match, options) {
      if (Array.isArray(match.payload.matches)) {
        for (const { element } of match.payload.matches) {
          if (Array.isArray(element.type?.entryJsFiles)) {
            entryJsFiles = element.type.entryJsFiles;
          }
        }
      }
      return new Response(renderToReadableStream(match.payload, options), {
        status: match.statusCode,
        headers: match.headers,
      });
    },
  });

  return {
    response,
    entryJsFiles,
  };
}

async function handler(request: Request): Promise<Response> {
  const { response, entryJsFiles } = await fetchServer(request);
  return generateHTML(request, response, {
    bootstrapScripts: entryJsFiles,
  });
}

const handleNodeRequest = toNodeHandler((request) => handler(request));

function shouldBypassRequest(req: IncomingMessage) {
  if (!req.url) {
    return true;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return true;
  }

  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (pathname.startsWith('/__rsbuild_')) {
    return true;
  }

  if (pathname.endsWith('.rsc') || pathname.endsWith('.manifest')) {
    return false;
  }

  if (pathname !== '/' && /\.[a-z0-9]+$/i.test(pathname)) {
    return true;
  }

  return false;
}

async function nodeHandler(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  next: () => void,
) {
  if (shouldBypassRequest(req)) {
    next();
    return;
  }

  await handleNodeRequest(req, res);
}

export default {
  nodeHandler,
};

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}

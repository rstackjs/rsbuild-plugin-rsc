import { renderToReadableStream } from 'react-server-dom-rspack/server.node'
import { parseRenderRequest } from './request'
import type { RscPayload } from './shared'
import { renderHtml } from './entry.ssr'
import { Page } from './ssg'

function getPages(): Map<string, Page> {
  const contextRequire = import.meta.webpackContext('../pages', {
    recursive: false,
    regExp: /\.tsx?$/,
  })
  return new Map(contextRequire.keys().map(path => {
    const name = path.replace('./', '').replace('.tsx', '')
    const route = name.toLowerCase()
    const page: Page = {
      url: `/${route}`,
      name
    };
    return [route, page]
  }))
}

const pages = getPages();

export default async function handler(request: Request): Promise<Response> {
  // differentiate RSC and SSR request
  const renderRequest = parseRenderRequest(request)

  const route = renderRequest.url.pathname.substring(1) ? renderRequest.url.pathname.substring(1).toLowerCase() : 'index'
  const page = pages.get(route)
  if (!page) {
    throw new Error(`Page not found: ${renderRequest.url.pathname}`)
  }
  const mod = await import(`../pages/${page.name}.tsx`)
  const Root = mod.default

  const rscPayload: RscPayload = { root: <Root pages={Array.from(pages.values())} currentPage={page} /> }
  const rscStream = renderToReadableStream(rscPayload)

  if (renderRequest.isRsc) {
    return new Response(rscStream, {
      headers: {
        'content-type': 'text/x-component;charset=utf-8',
      },
    })
  }

  const ssrResult = await renderHtml(rscStream, {
    bootstrapScripts: Root.entryJsFiles,
  })

  return new Response(ssrResult.stream, {
    status: ssrResult.status,
    headers: {
      'content-type': 'text/html;charset=utf-8',
    },
  })
}

// return both rsc and html streams at once for ssg
// export async function handleSsg(request: Request): Promise<{
//   html: ReadableStream<Uint8Array>
//   rsc: ReadableStream<Uint8Array>
// }> {
//   const url = new URL(request.url)
//   const rscPayload: RscPayload = { root: <Root url={url} /> }
//   const rscStream = renderToReadableStream(rscPayload)
//   const [rscStream1, rscStream2] = rscStream.tee()

//   const ssr = await import.meta.viteRsc.loadModule<
//     typeof import('./entry.ssr')
//   >('ssr', 'index')
//   const ssrResult = await ssr.renderHtml(rscStream1, {
//     ssg: true,
//   })

//   return { html: ssrResult.stream, rsc: rscStream2 }
// }

if (import.meta.hot) {
  import.meta.hot.accept()
}

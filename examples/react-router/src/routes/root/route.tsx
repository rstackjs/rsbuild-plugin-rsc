'use server-entry';

import { Outlet } from 'react-router';
import { Layout as ClientLayout } from './client';
import './styles.css';

export { ErrorBoundary } from './client';

export function Layout({ children }: { children: React.ReactNode }) {
  // This is required for the bundler to inject the necessary CSS assets.
  return (
    <>
      {
        // @ts-expect-error -- The plugin injects entryCssFiles on server-entry components at runtime.
        // Components annotated with 'use server-entry' can access the entryCssFiles property at runtime to inject CSS resources.
        Layout.entryCssFiles.map((href) => (
          <link key={href} rel="stylesheet" href={href} precedence="default" />
        ))
      }
      <ClientLayout>{children}</ClientLayout>
    </>
  );
}

export default function Component() {
  return <Outlet />;
}

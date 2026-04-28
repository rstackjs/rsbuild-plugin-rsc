import { Page1 } from './pages/Page1';
import { Page2 } from './pages/Page2';
import './Root.css';

export async function Root() {
  return (
    <section className="server-css-root" data-testid="server-css-root">
      <h2>Server CSS root</h2>
      <p>This root stylesheet is not owned by a server-entry component.</p>
      <div className="server-css-pages">
        <Page1 />
        <Page2 />
      </div>
    </section>
  );
}

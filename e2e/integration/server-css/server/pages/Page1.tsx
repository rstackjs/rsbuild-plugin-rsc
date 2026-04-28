'use server-entry';

import { Page1Child } from './Page1Child';
import './Page1.css';

export async function Page1() {
  return (
    <section className="page-one-css" data-testid="server-css-page-one">
      <h3>Page 1</h3>
      <Page1Child />
    </section>
  );
}

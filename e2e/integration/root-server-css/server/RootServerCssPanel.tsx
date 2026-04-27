import './RootServerCssPanel.css';

export function RootServerCssPanel() {
  return (
    <section
      className="root-server-css-panel"
      data-testid="root-server-css-panel"
    >
      <h2>Root server CSS</h2>
      <p>This stylesheet is imported from the root server component path.</p>
    </section>
  );
}

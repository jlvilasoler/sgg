export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="layout-frame app-footer-inner">
        <span className="app-footer-copy">© {year} SAG</span>
      </div>
    </footer>
  );
}

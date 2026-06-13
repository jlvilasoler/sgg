interface Props {
  apiOnline: boolean;
}

export default function AppFooter({ apiOnline }: Props) {
  return (
    <footer className="app-footer">
      <div className="layout-frame app-footer-inner">
        <p>
          Bases: <strong>PRESUPUESTO</strong> · <strong>PROVEEDORES</strong> ·{" "}
          <strong>DIVISAS_TC</strong> · GANADERA
          GUAVIYU · GANADERA CHIVILCOY
          {apiOnline ? " · API conectada" : " · API desconectada"}
        </p>
      </div>
    </footer>
  );
}

import type { CategoriaStockMonitorFila, StockEspecieMonitorResumen } from "../../types";

function fmtEntero(n: number): string {
  return n.toLocaleString("es-UY");
}

interface CategoriasTableProps {
  categorias: CategoriaStockMonitorFila[];
  emptyLabel?: string;
}

export function HomeLayoutMonitorCategoriasTable({
  categorias,
  emptyLabel = "Sin desglose por categoría.",
}: CategoriasTableProps) {
  if (categorias.length === 0) {
    return <p className="muted">{emptyLabel}</p>;
  }

  return (
    <table className="home-layout-monitor-stock-cat-table">
      <thead>
        <tr>
          <th scope="col">Categoría</th>
          <th scope="col" className="is-num">
            Machos
          </th>
          <th scope="col" className="is-num">
            Hembras
          </th>
          <th scope="col" className="is-num">
            Total
          </th>
        </tr>
      </thead>
      <tbody>
        {categorias.map((cat) => (
          <tr key={cat.key}>
            <th scope="row">{cat.label}</th>
            <td className="is-num">{cat.machos > 0 ? fmtEntero(cat.machos) : "—"}</td>
            <td className="is-num">{cat.hembras > 0 ? fmtEntero(cat.hembras) : "—"}</td>
            <td className="is-num is-total">{fmtEntero(cat.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface EspecieBlockProps {
  titulo: string;
  especie: StockEspecieMonitorResumen;
  kicker?: string;
}

export function HomeLayoutMonitorEspecieStockBlock({
  titulo,
  especie,
  kicker,
}: EspecieBlockProps) {
  return (
    <div className="home-layout-monitor-stock-especie">
      <header className="home-layout-monitor-stock-especie-head">
        <div>
          {kicker ? <p className="home-layout-monitor-stock-especie-kicker">{kicker}</p> : null}
          <h4>{titulo}</h4>
        </div>
        <div className="home-layout-monitor-stock-especie-kpis">
          <span>
            <strong>{fmtEntero(especie.total)}</strong> activos
          </span>
          <span className="muted">
            {fmtEntero(especie.machos)} M · {fmtEntero(especie.hembras)} H
            {especie.sin_definir > 0 ? ` · ${fmtEntero(especie.sin_definir)} s/d` : ""}
          </span>
        </div>
      </header>
      <HomeLayoutMonitorCategoriasTable categorias={especie.categorias} />
    </div>
  );
}

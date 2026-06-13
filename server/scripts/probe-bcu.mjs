async function fetchBcu(fd, fh) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="Cotiza">
  <soapenv:Body>
    <ws:wsbcucotizaciones.Execute>
      <ws:Entrada>
        <ws:Moneda><ws:item>2225</ws:item></ws:Moneda>
        <ws:FechaDesde>${fd}</ws:FechaDesde>
        <ws:FechaHasta>${fh}</ws:FechaHasta>
        <ws:Grupo>2</ws:Grupo>
      </ws:Entrada>
    </ws:wsbcucotizaciones.Execute>
  </soapenv:Body>
</soapenv:Envelope>`;
  const r = await fetch(
    "https://cotizaciones.bcu.gub.uy/wscotizaciones/servlet/awsbcucotizaciones",
    {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "Cotizaaction/AWSBCUCOTIZACIONES.Execute",
      },
      body: xml,
    }
  );
  const t = await r.text();
  const err = t.match(/<codigoerror>(\d+)<\/codigoerror>/)?.[1];
  const blocks = [...t.matchAll(/<datoscotizaciones\.dato[\s\S]*?<\/datoscotizaciones\.dato>/g)];
  const rows = blocks.map((b) => {
    const m = b[0];
    return {
      fecha: m.match(/<Fecha>([^<]+)<\/Fecha>/)?.[1],
      tcc: Number(m.match(/<TCC>([\d.]+)<\/TCC>/)?.[1]),
    };
  }).filter((r) => r.fecha && r.tcc > 0);
  return { err, rows };
}

for (const days of [90, 180, 365, 400]) {
  const end = new Date("2025-05-30");
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const fd = start.toISOString().slice(0, 10);
  const fh = end.toISOString().slice(0, 10);
  const r = await fetchBcu(fd, fh);
  console.log(days, "days", "err", r.err, "rows", r.rows.length);
}

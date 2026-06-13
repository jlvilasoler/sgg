const codes = ["2202", "1006", "2120", "2226", "1013", "2225"];

async function test(code) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="Cotiza">
  <soapenv:Body>
    <ws:wsbcucotizaciones.Execute>
      <ws:Entrada>
        <ws:Moneda><ws:item>${code}</ws:item></ws:Moneda>
        <ws:FechaDesde>2026-05-01</ws:FechaDesde>
        <ws:FechaHasta>2026-05-05</ws:FechaHasta>
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
  const tcc = t.match(/<TCC>([\d.]+)<\/TCC>/)?.[1];
  const rows = [...t.matchAll(/<TCC>/g)].length;
  console.log(code, "err", err, "rows", rows, "sample", tcc ?? "-");
}

for (const c of codes) await test(c);

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
  const blocks = [
    ...t.matchAll(/<datoscotizaciones\.dato[\s\S]*?<\/datoscotizaciones\.dato>/g),
  ];
  const rows = blocks
    .map((b) => ({
      fecha: b[0].match(/<Fecha>([^<]+)<\/Fecha>/)?.[1],
      tcc: Number(b[0].match(/<TCC>([\d.]+)<\/TCC>/)?.[1]),
    }))
    .filter((r) => r.fecha && r.tcc > 0);
  return { err, rows };
}

function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const fh = "2026-06-03";
const fd = addDays(fh, -730);
console.log("range", fd, "->", fh);

const single = await fetchBcu(fd, fh);
console.log("single 2y err", single.err, "rows", single.rows.length);

let cur = fd;
let chunks = 0;
let total = 0;
const all = [];
while (cur <= fh) {
  let chunkEnd = addDays(cur, 329);
  if (chunkEnd > fh) chunkEnd = fh;
  const c = await fetchBcu(cur, chunkEnd);
  chunks++;
  total += c.rows.length;
  if (c.err) console.log("ERR chunk", cur, chunkEnd, c.err, c.rows.length);
  all.push(...c.rows);
  if (chunkEnd >= fh) break;
  cur = addDays(chunkEnd, 1);
}
const seen = new Set();
const uniq = all.filter((r) => {
  if (seen.has(r.fecha)) return false;
  seen.add(r.fecha);
  return true;
});
console.log("chunks", chunks, "total", total, "unique", uniq.length);
console.log("first", uniq[0], "last", uniq[uniq.length - 1]);

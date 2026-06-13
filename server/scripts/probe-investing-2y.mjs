const url = "https://es.investing.com/currencies/usd-uyu-historical-data";
const r = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
});
const html = await r.text();
const m = html.match(/id="__NEXT_DATA__"[^>]*>(\{.+?\})<\/script>/s);
const pp = JSON.parse(m[1]).props.pageProps;
const sessionId = pp.sessionId;
const cookies = r.headers.getSetCookie?.().map((c) => c.split(";")[0]).join("; ") ?? "";
const cookie = [cookies, sessionId ? `PHPSESSID=${sessionId}` : ""].filter(Boolean).join("; ");

const end = new Date();
const start = new Date();
start.setFullYear(start.getFullYear() - 2);
const ddmmyyyy = (d) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const body = new URLSearchParams({
  curr_id: "2210",
  st_date: ddmmyyyy(start),
  end_date: ddmmyyyy(end),
  interval_sec: "Daily",
  sort_col: "date",
  sort_ord: "DESC",
  action: "historical_data",
});

const endpoints = [
  ["HistoricalDataAjax", "https://es.investing.com/instruments/HistoricalDataAjax"],
  ["financialdata/historical", `https://api.investing.com/api/financialdata/historical/2210?start-date=${start.toISOString().slice(0,10)}&end-date=${end.toISOString().slice(0,10)}&time-frame=Daily&add-missing-rows=false`],
  ["chart", "https://api.investing.com/api/financialdata/2210/historical-charts/data?period=P2Y&interval=P1D"],
];

for (const [name, ep] of endpoints) {
  const r2 = await fetch(ep, {
    method: name === "HistoricalDataAjax" ? "POST" : "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: url,
      Origin: "https://es.investing.com",
      "X-Requested-With": "XMLHttpRequest",
      "domain-id": "es",
      Cookie: cookie,
      Accept: "*/*",
      ...(name === "HistoricalDataAjax"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: name === "HistoricalDataAjax" ? body.toString() : undefined,
  });
  const t = await r2.text();
  const rows = (t.match(/dateTime=/g) || []).length;
  const tr = (t.match(/<tr/g) || []).length;
  console.log(name, r2.status, "len", t.length, "dateTime", rows, "tr", tr, t.slice(0, 120).replace(/\s+/g, " "));
}

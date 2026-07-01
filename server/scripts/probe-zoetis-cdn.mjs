const slugs = [
  "dectomax-x3-frascos", "draxxin", "draxxin-bovino", "excenel", "excede", "naxcel",
  "cydectin", "eprinex", "baycox", "panacur", "valbazen", "ivomec", "ivomec-gold",
  "banamine", "zactran", "zuprevo", "rycoben", "longrange", "terramicina-la",
  "baymec", "cobalt", "fasinex", "tulamax", "micotil", "metacam",
];

for (const s of slugs) {
  for (const ext of ["jpg", "png", "webp"]) {
    const url = `https://ar.zoetis.com/_locale-assets/img/productos-web/${s}.${ext}`;
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) console.log("OK", url);
  }
}

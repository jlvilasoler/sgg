const products = [
  ["Dectomax", "https://ar.zoetis.com/products/bovinos/dectomax.aspx"],
  ["Ivomec", "https://ar.zoetis.com/products/bovinos/ivomec.aspx"],
  ["Draxxin", "https://ar.zoetis.com/products/bovinos/draxxin-bovino.aspx"],
  ["Excenel", "https://ar.zoetis.com/products/bovinos/excenel.aspx"],
  ["Naxcel", "https://ar.zoetis.com/products/naxcel-vacuno.aspx"],
  ["Cydectin", "https://ar.zoetis.com/products/bovinos/cydectin.aspx"],
  ["Eprinex", "https://ar.zoetis.com/products/bovinos/eprinex.aspx"],
  ["Baycox", "https://ar.zoetis.com/products/bovinos/baycox.aspx"],
  ["Metacam", "https://www.boehringer-ingelheim.com/ar/products/metacam-bovinos"],
  ["Ivomec", "https://www.boehringer-ingelheim.com/ar/products/ivomec"],
  ["Banamine", "https://www.merck-animal-health.com.ar/productos/banamine/"],
  ["Micotil", "https://www.elanco.com/ar/products-and-solutions/micotil"],
  ["Valbazen", "https://ar.zoetis.com/products/bovinos/valbazen.aspx"],
  ["Panacur", "https://ar.zoetis.com/products/bovinos/panacur.aspx"],
  ["Fasinex", "https://www.msd-animal-health.com.ar/productos/fasinex"],
  ["Terramicina LA", "https://ar.zoetis.com/products/bovinos/terramicina-la.aspx"],
];

for (const [name, url] of products) {
  try {
    const html = await (await fetch(url, { redirect: "follow" })).text();
    const img = html.match(/\/_locale-assets\/img\/productos-web\/[^"']+\.(?:jpg|png|webp)/i)
      || html.match(/productos-web\/[^"']+\.(?:jpg|png|webp)/i)
      || html.match(/wp-content\/uploads\/[^"']+\.(?:jpg|png|webp)/i);
    console.log(name, img?.[0] ?? "NO");
  } catch (e) {
    console.log(name, "ERR", e.message);
  }
}

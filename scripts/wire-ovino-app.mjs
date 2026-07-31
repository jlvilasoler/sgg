/**
 * Wire Stock Ovino into App / Header / menus / config / titles / icons.
 */
import fs from "fs";

function patch(file, fn) {
  let s = fs.readFileSync(file, "utf8");
  const next = fn(s);
  if (next !== s) {
    fs.writeFileSync(file, next);
    console.log("patched", file);
  } else {
    console.log("unchanged", file);
  }
}

patch("client/src/components/Header.tsx", (s) =>
  s.includes('"stock_ovino"')
    ? s
    : s.replace('| "stock_equino"', '| "stock_equino"\n  | "stock_ovino"')
);

patch("client/src/utils/auth-permissions.ts", (s) =>
  s.includes("stock_ovino:")
    ? s
    : s.replace("  stock_equino: \"stock\",", "  stock_equino: \"stock\",\n  stock_ovino: \"stock\",")
);

patch("client/src/utils/screen-titles.ts", (s) =>
  s.includes("stock_ovino:")
    ? s
    : s.replace('  stock_equino: "Stock Equino",', '  stock_equino: "Stock Equino",\n  stock_ovino: "Stock Ovino",')
);

patch("client/src/utils/home-quick-modules.ts", (s) => {
  if (s.includes("stock_ovino")) return s;
  s = s.replace(
    'stock: ["stock_ganadero", "stock_equino", "campo_mapa", "tareas_operativas"],',
    'stock: ["stock_ganadero", "stock_equino", "stock_ovino", "campo_mapa", "tareas_operativas"],'
  );
  s = s.replace(
    "  stock_equino: \"stock_equino\",",
    "  stock_equino: \"stock_equino\",\n  stock_ovino: \"stock_ovino\","
  );
  s = s.replace(
    '  "Stock Equino": "stock_equino",',
    '  "Stock Equino": "stock_equino",\n  "Stock Ovino": "stock_ovino",'
  );
  s = s.replace('"stock_equino",', '"stock_equino",\n  "stock_ovino",');
  return s;
});

patch("client/src/components/HomeMenu.tsx", (s) => {
  if (s.includes('id: "stock_ovino"')) return s;
  s = s.replace(
    `  {
    id: "stock_equino",
    label: "Stock Equino",
    subtitle: "Alta genérica · lecturas RFID · stock y sanidad",
  },`,
    `  {
    id: "stock_equino",
    label: "Stock Equino",
    subtitle: "Alta genérica · lecturas RFID · stock y sanidad",
  },
  {
    id: "stock_ovino",
    label: "Stock Ovino",
    subtitle: "Alta genérica · REG 199 · stock y sanidad",
  },`
  );
  // stock section array of ids
  s = s.replace(
    '"stock_equino",',
    '"stock_equino",\n      "stock_ovino",'
  );
  return s;
});

patch("client/src/App.tsx", (s) => {
  if (s.includes("stock-ovino/StockOvino")) return s;
  s = s.replace(
    'import StockEquino from "./components/stock-equino/StockEquino";',
    'import StockEquino from "./components/stock-equino/StockEquino";\nimport StockOvino from "./components/stock-ovino/StockOvino";'
  );
  s = s.replace(
    `{screen === "stock_equino" && (
              <StockEquino
                apiOnline={apiOnline}
                currentUser={user}
                onError={(m) => notify(m, false)}
                onSuccess={(m, t) => notify(m, true, t)}
                onVolver={goHome}
              />
            )}`,
    `{screen === "stock_equino" && (
              <StockEquino
                apiOnline={apiOnline}
                currentUser={user}
                onError={(m) => notify(m, false)}
                onSuccess={(m, t) => notify(m, true, t)}
                onVolver={goHome}
              />
            )}
            {screen === "stock_ovino" && (
              <StockOvino
                apiOnline={apiOnline}
                currentUser={user}
                onError={(m) => notify(m, false)}
                onSuccess={(m, t) => notify(m, true, t)}
                onVolver={goHome}
              />
            )}`
  );
  return s;
});

patch("client/src/components/Configuracion.tsx", (s) => {
  if (s.includes("StockOvinoAdmin")) return s;
  s = s.replace(
    'import StockEquinoAdmin from "./stock-equino/StockEquinoAdmin";',
    'import StockEquinoAdmin from "./stock-equino/StockEquinoAdmin";\nimport StockOvinoAdmin from "./stock-ovino/StockOvinoAdmin";'
  );
  s = s.replace('| "stock_equino"', '| "stock_equino"\n  | "stock_ovino"');
  s = s.replace(
    '(modulo === "stock_ganadero" || modulo === "stock_equino")',
    '(modulo === "stock_ganadero" || modulo === "stock_equino" || modulo === "stock_ovino")'
  );
  s = s.replace(
    `  if (modulo === "stock_equino") {
    return wrapConfigSubmodule(
      "stock_equino",
      <StockEquinoAdmin
        apiOnline={apiOnline}
        currentUser={currentUser}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={() => volverConfigDashboard("stock_equino")}
      />
    );
  }`,
    `  if (modulo === "stock_equino") {
    return wrapConfigSubmodule(
      "stock_equino",
      <StockEquinoAdmin
        apiOnline={apiOnline}
        currentUser={currentUser}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={() => volverConfigDashboard("stock_equino")}
      />
    );
  }

  if (modulo === "stock_ovino") {
    return wrapConfigSubmodule(
      "stock_ovino",
      <StockOvinoAdmin
        apiOnline={apiOnline}
        currentUser={currentUser}
        onError={onError}
        onSuccess={onSuccess}
        onVolver={() => volverConfigDashboard("stock_ovino")}
      />
    );
  }`
  );
  return s;
});

patch("client/src/components/config/config-hub-items.ts", (s) => {
  if (s.includes('id: "stock_ovino"')) return s;
  s = s.replace(
    `  {
    id: "stock_equino",
    label: "Administración de Stock Equino",
    subtitle: "Vaciar y administrar la base de dispositivos equinos",
    icon: "stock_dispositivos",
  },
];`,
    `  {
    id: "stock_equino",
    label: "Administración de Stock Equino",
    subtitle: "Vaciar y administrar la base de dispositivos equinos",
    icon: "stock_dispositivos",
  },
  {
    id: "stock_ovino",
    label: "Administración de Stock Ovino",
    subtitle: "Vaciar y administrar la base de dispositivos ovinos",
    icon: "stock_dispositivos",
  },
];`
  );
  s = s.replace(
    'if (item.id === "stock_ganadero" || item.id === "stock_equino")',
    'if (item.id === "stock_ganadero" || item.id === "stock_equino" || item.id === "stock_ovino")'
  );
  s = s.replace('"stock_equino",', '"stock_equino",\n  "stock_ovino",');
  if (s.includes("stock_equino: {") && !s.includes("stock_ovino: {")) {
    s = s.replace(
      /stock_equino: \{[\s\S]*?\n    \},/,
      (m) => m + "\n    stock_ovino: {\n      title: \"Administración de Stock Ovino\",\n      subtitle: \"Vaciar y administrar la base de dispositivos ovinos\",\n    },"
    );
  }
  return s;
});

console.log("wire done");

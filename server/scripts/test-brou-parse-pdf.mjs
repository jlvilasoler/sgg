import { parseBrouTransferenciaText } from "../dist/parse-brou-transferencia.js";

// Texto típico de PDF con columnas mezcladas
const pdfLike = `
Transferencia a Otros Bancos
Número de la operación
2606220631356228
Número de transferencia
260622048210869
Cuenta de destino
0005007002277152
Banco
SANTANDER
Importe a debitar U$S 501,70
Importe a acreditar U$S 500,00
Concepto
OTROS
Beneficiario
Nombre Completo
Jose luis vila soler
Dirección
Valdivia 1226 apto202
Observaciones
Para depositar tarjeta est
Comisiones y gastos U$S 1,70
Fecha de realización
22/06/2026 10:54
`;

console.log(JSON.stringify(parseBrouTransferenciaText(pdfLike), null, 2));

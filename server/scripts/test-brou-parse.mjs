import { parseBrouTransferenciaText } from "../dist/parse-brou-transferencia.js";

const sample = `
Transferencia a Otros Bancos
Número de la operación 2606220631356228
Número de transferencia 260622048210869
Cuenta de origen CA 110385605-00001 U$S
Banco SANTANDER
Importe a acreditar U$S 500,00
Comisiones y gastos U$S 1,70
Beneficiario
Nombre Completo Jose luis vila soler
Dirección Valdivia 1226 apto202
Observaciones Para depositar tarjeta est
Fecha de realización 22/06/2026 10:54
Concepto OTROS
`;

console.log(JSON.stringify(parseBrouTransferenciaText(sample), null, 2));

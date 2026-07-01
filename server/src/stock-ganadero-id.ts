/** Longitud del prefijo EID en RFID Tru-Test (ej. 858). */
export const EID_PREFIX_LEN = 3;

/** Separa prefijo EID (858) y número de dispositivo VID. */
export function splitEidVid(
  eid: string,
  vid = ""
): { eid: string; vid: string } {
  const vidTrim = vid.trim();
  const vidDigits = vidTrim.replace(/\D/g, "");
  const eidDigits = eid.replace(/\D/g, "");

  if (vidDigits) {
    const eidPart =
      eidDigits.length >= EID_PREFIX_LEN
        ? eidDigits.slice(0, EID_PREFIX_LEN)
        : eidDigits || eid.trim();
    return { eid: eidPart, vid: vidDigits };
  }

  if (eidDigits.length > EID_PREFIX_LEN) {
    return {
      eid: eidDigits.slice(0, EID_PREFIX_LEN),
      vid: eidDigits.slice(EID_PREFIX_LEN),
    };
  }

  return { eid: eidDigits || eid.trim(), vid: "" };
}

/** Clave única del dispositivo (todos los dígitos del RFID). */
export function dispositivoClave(eid: string, vid = ""): string {
  const { eid: e, vid: v } = splitEidVid(eid, vid);
  const ed = e.replace(/\D/g, "");
  const vd = v.replace(/\D/g, "");
  return vd ? ed + vd : ed;
}

/** @deprecated Usar dispositivoClave(eid, vid) cuando haya ambos campos. */
export function eidClave(eid: string): string {
  return dispositivoClave(eid, "");
}

/** Coincide búsqueda por EID, VID o sufijo numérico de la caravana. */
export function coincideBusquedaDispositivo(
  d: { eid: string; vid: string; clave: string },
  q: string
): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const digits = t.replace(/\D/g, "");
  const eid = (d.eid ?? "").toLowerCase();
  const vid = (d.vid ?? "").toLowerCase();
  const clave = dispositivoClave(d.eid, d.vid);
  const vidDigits = vid.replace(/\D/g, "");
  const eidDigits = eid.replace(/\D/g, "");
  if (eid.includes(t) || vid.includes(t)) return true;
  if (digits) {
    if (clave.includes(digits)) return true;
    if (vidDigits.includes(digits)) return true;
    if (eidDigits.includes(digits)) return true;
  }
  return false;
}

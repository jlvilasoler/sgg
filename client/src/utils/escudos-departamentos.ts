import type { ContribucionRuralJurisdiccionId } from "../types/contribucion-rural";

/**
 * Escudos departamentales (PNG locales en /public/escudos-departamentos).
 * Fuentes: Wikimedia Commons / símbolos oficiales de cada departamento.
 */
export const ESCUDO_DEPARTAMENTO_SRC: Record<ContribucionRuralJurisdiccionId, string> = {
  artigas: "/escudos-departamentos/artigas.png",
  rivera: "/escudos-departamentos/rivera.png",
  rionegro: "/escudos-departamentos/rionegro.png",
  florida: "/escudos-departamentos/florida.png",
  flores: "/escudos-departamentos/flores.png",
  colonia: "/escudos-departamentos/colonia.png",
  soriano: "/escudos-departamentos/soriano.png",
  sanjose: "/escudos-departamentos/sanjose.png",
  montevideo: "/escudos-departamentos/montevideo.png",
  canelones: "/escudos-departamentos/canelones.png",
  maldonado: "/escudos-departamentos/maldonado.png",
  rocha: "/escudos-departamentos/rocha.png",
  lavalleja: "/escudos-departamentos/lavalleja.png",
  durazno: "/escudos-departamentos/durazno.png",
  cerrolargo: "/escudos-departamentos/cerrolargo.png",
  tacuarembo: "/escudos-departamentos/tacuarembo.png",
  paysandu: "/escudos-departamentos/paysandu.png",
  salto: "/escudos-departamentos/salto.png",
  treintaytres: "/escudos-departamentos/treintaytres.png",
};

export function escudoDepartamentoSrc(id: ContribucionRuralJurisdiccionId): string {
  return ESCUDO_DEPARTAMENTO_SRC[id];
}

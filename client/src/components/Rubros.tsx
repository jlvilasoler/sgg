import SubRubroListado from "./rubros/SubRubroListado";
import type { AuthUser } from "../types";
import {
  canDeleteRubrosCatalogo,
  canDeleteSubRubroItems,
  canManageRubrosCatalogo,
} from "../utils/auth-permissions";

interface Props {
  apiOnline: boolean;
  currentUser?: AuthUser | null;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onCatalogosChanged: () => void;
  onVolver: () => void;
  volverLabel?: string;
}

export default function Rubros({
  apiOnline,
  currentUser,
  onError,
  onSuccess,
  onCatalogosChanged,
  onVolver,
  volverLabel,
}: Props) {
  return (
    <SubRubroListado
      apiOnline={apiOnline}
      onError={onError}
      onSuccess={onSuccess}
      onCatalogosChanged={onCatalogosChanged}
      onVolver={onVolver}
      volverLabel={volverLabel}
      puedeEditar={canManageRubrosCatalogo(currentUser ?? null)}
      puedeEliminar={canDeleteRubrosCatalogo(currentUser ?? null)}
      puedeEliminarItems={canDeleteSubRubroItems(currentUser ?? null)}
    />
  );
}

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Lock, Palette, Pin, PinOff, Trash2, Users, X } from "lucide-react";
import { createNota, deleteNota, fetchUsuariosMiCuenta, updateNota } from "../../api";
import type { AuthUser, Nota, NotaColor } from "../../types";
import { NOTA_COLORES } from "../../types";
import { confirmAction } from "../../utils/confirm";
import { showToast } from "../../utils/toast";
import NotaCompartirPanel, {
  idsTodoElEquipo,
  nombresCompartidos,
} from "../notas/NotaCompartirPanel";

const COLOR_LABELS: Record<NotaColor, string> = {
  default: "Blanco",
  yellow: "Amarillo",
  green: "Verde",
  blue: "Azul",
  pink: "Rosa",
  purple: "Morado",
};

type VisibilidadNota = "personal" | "compartida";

function esTituloPlaceholder(titulo: string): boolean {
  return /^sin\s*t[ií]tulo$/i.test(titulo.trim());
}

function tituloParaEditor(titulo: string): string {
  return esTituloPlaceholder(titulo) ? "" : titulo;
}

function normalizarNota(nota: Nota): Nota {
  return esTituloPlaceholder(nota.titulo) ? { ...nota, titulo: "" } : nota;
}

interface Props {
  open: boolean;
  nota: Nota | null;
  currentUser: AuthUser;
  apiOnline: boolean;
  onClose: () => void;
  onSaved: (nota: Nota) => void;
  onDeleted: (id: number) => void;
}

export default function HomeNotaModal({
  open,
  nota,
  currentUser,
  apiOnline,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const currentUserId = currentUser.id;
  const cuentaLabel =
    currentUser.cuenta_actividad_nombre?.trim() ||
    currentUser.empresa_nombre?.trim() ||
    "tu cuenta";
  const perteneceACuenta =
    currentUser.empresa_id != null ||
    currentUser.cuenta_actividad_id != null ||
    Boolean(currentUser.cuenta_actividad_nombre?.trim() || currentUser.empresa_nombre?.trim());

  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [fijada, setFijada] = useState(false);
  const [color, setColor] = useState<NotaColor>("yellow");
  const [visibilidad, setVisibilidad] = useState<VisibilidadNota>("personal");
  const [compartidosCon, setCompartidosCon] = useState<number[]>([]);
  const [miembrosEquipo, setMiembrosEquipo] = useState<AuthUser[]>([]);
  const [cargandoMiembros, setCargandoMiembros] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const esNueva = nota == null;
  const soloLectura = nota != null && nota.usuario_id !== currentUserId;

  const miembrosParaCompartir = useMemo(
    () => miembrosEquipo.filter((m) => m.id !== currentUserId && m.activo !== false),
    [miembrosEquipo, currentUserId]
  );

  useEffect(() => {
    if (!open || !apiOnline) {
      setMiembrosEquipo([]);
      setCargandoMiembros(false);
      return;
    }
    setCargandoMiembros(true);
    void fetchUsuariosMiCuenta()
      .then(setMiembrosEquipo)
      .catch(() => setMiembrosEquipo([]))
      .finally(() => setCargandoMiembros(false));
  }, [open, apiOnline]);

  useEffect(() => {
    if (!open) return;
    if (nota) {
      setTitulo(tituloParaEditor(nota.titulo));
      setContenido(nota.contenido);
      setFijada(nota.fijada);
      setColor(nota.color);
      const compartida = nota.compartida || nota.compartidos_con.length > 0;
      setVisibilidad(compartida ? "compartida" : "personal");
      setCompartidosCon(nota.compartidos_con.map((u) => u.id));
    } else {
      setTitulo("");
      setContenido("");
      setFijada(false);
      setColor("yellow");
      setVisibilidad("personal");
      setCompartidosCon([]);
    }
  }, [open, nota]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !guardando) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, guardando, onClose]);

  if (!open) return null;

  const handleClose = () => {
    if (guardando) return;
    onClose();
  };

  const guardar = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!apiOnline || soloLectura) return;

    const compartidos =
      visibilidad === "compartida" && perteneceACuenta ? compartidosCon : [];
    if (visibilidad === "compartida" && perteneceACuenta) {
      if (cargandoMiembros) {
        showToast("Esperá a que cargue el equipo de la cuenta", false);
        return;
      }
      if (miembrosParaCompartir.length === 0) {
        showToast("No hay otros usuarios en la cuenta para compartir", false);
        return;
      }
      if (compartidos.length === 0) {
        showToast("Elegí con quién compartir la nota", false);
        return;
      }
    }

    const patch = {
      titulo,
      contenido,
      fijada,
      color,
      compartida: compartidos.length > 0,
      compartidos_con: compartidos,
    };

    setGuardando(true);
    try {
      if (esNueva) {
        const created = normalizarNota(await createNota(patch));
        onSaved(created);
        showToast(
          compartidos.length > 0 ? "Nota compartida en el pizarrón" : "Nota pegada en el pizarrón",
          true
        );
      } else {
        const updated = normalizarNota(await updateNota(nota.id, patch));
        onSaved(updated);
        showToast("Nota actualizada", true);
      }
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo guardar la nota", false);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (esNueva || nota == null || soloLectura) return;
    const ok = await confirmAction({
      title: "Quitar nota del pizarrón",
      message: "¿Eliminar esta nota? No se puede deshacer.",
      confirmText: "Eliminar",
      variant: "danger",
    });
    if (!ok) return;
    setGuardando(true);
    try {
      await deleteNota(nota.id);
      onDeleted(nota.id);
      showToast("Nota eliminada", true);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se pudo eliminar la nota", false);
    } finally {
      setGuardando(false);
    }
  };

  const cambiarVisibilidad = (modo: VisibilidadNota) => {
    setVisibilidad(modo);
    if (modo === "personal") {
      setCompartidosCon([]);
      return;
    }
    if (compartidosCon.length === 0 && miembrosParaCompartir.length > 0) {
      setCompartidosCon(idsTodoElEquipo(miembrosParaCompartir));
    }
  };

  const guardarLabel = guardando
    ? "Guardando…"
    : esNueva
      ? visibilidad === "compartida" && compartidosCon.length > 0
        ? "Pegar nota compartida"
        : "Pegar nota"
      : "Guardar";

  return (
    <div className="home-nota-modal-overlay" role="presentation" onClick={handleClose}>
      <div
        className={`home-nota-modal home-nota-modal--${color}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-nota-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="home-nota-modal-tape" aria-hidden />
        <header className="home-nota-modal-head">
          <div>
            <p className="home-nota-modal-kicker">{esNueva ? "Nueva nota" : "Editar nota"}</p>
            <h2 id="home-nota-modal-title">{esNueva ? "Pegá un apunte" : "Tu apunte"}</h2>
          </div>
          <button
            type="button"
            className="home-nota-modal-close"
            onClick={handleClose}
            disabled={guardando}
            aria-label="Cerrar"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <form className="home-nota-modal-form" onSubmit={(e) => void guardar(e)}>
          <div className="home-nota-modal-scroll">
            {soloLectura ? (
              <p className="home-nota-modal-readonly">
                Compartida por <strong>{nota?.autor_nombre || "el equipo"}</strong>
                {nota?.compartidos_con.length ? (
                  <> · con {nombresCompartidos(nota.compartidos_con)}</>
                ) : null}
                {" "}
                · solo lectura
              </p>
            ) : null}

            <section className="home-nota-modal-pad" aria-label="Contenido de la nota">
              <input
                type="text"
                className="home-nota-modal-title-input"
                placeholder="Título de la nota"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                disabled={!apiOnline || guardando || soloLectura}
                readOnly={soloLectura}
                aria-label="Título de la nota"
                autoFocus={!soloLectura}
              />
              <textarea
                className="home-nota-modal-body-input"
                placeholder="Escribí acá el contenido…"
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                disabled={!apiOnline || guardando || soloLectura}
                readOnly={soloLectura}
                aria-label="Contenido de la nota"
              />
            </section>

            {!soloLectura ? (
              <>
                <section className="home-nota-modal-section" aria-label="Apariencia de la nota">
                  <div className="home-nota-modal-section-head">
                    <Palette size={14} aria-hidden />
                    <h3>Color de la nota</h3>
                  </div>
                  <div className="home-nota-modal-toolbar">
                    <div className="home-nota-modal-color-picker" role="group" aria-label="Color">
                      {NOTA_COLORES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`home-nota-modal-swatch home-nota-modal-swatch--${c}${
                            color === c ? " home-nota-modal-swatch--active" : ""
                          }`}
                          title={COLOR_LABELS[c]}
                          aria-label={COLOR_LABELS[c]}
                          aria-pressed={color === c}
                          disabled={!apiOnline || guardando}
                          onClick={() => setColor(c)}
                        />
                      ))}
                    </div>
                    {!esNueva ? (
                      <div className="home-nota-modal-actions">
                        <button
                          type="button"
                          className={`home-nota-modal-icon-btn${
                            fijada ? " home-nota-modal-icon-btn--on" : ""
                          }`}
                          title={fijada ? "Desfijar" : "Fijar en el pizarrón"}
                          aria-label={fijada ? "Desfijar nota" : "Fijar nota"}
                          disabled={!apiOnline || guardando}
                          onClick={() => setFijada((v) => !v)}
                        >
                          {fijada ? <PinOff size={16} /> : <Pin size={16} />}
                        </button>
                        <button
                          type="button"
                          className="home-nota-modal-icon-btn home-nota-modal-icon-btn--danger"
                          title="Eliminar nota"
                          aria-label="Eliminar nota"
                          disabled={!apiOnline || guardando}
                          onClick={() => void eliminar()}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="home-nota-modal-section" aria-label="Visibilidad de la nota">
                  <div className="home-nota-modal-section-head">
                    {visibilidad === "compartida" ? (
                      <Users size={14} aria-hidden />
                    ) : (
                      <Lock size={14} aria-hidden />
                    )}
                    <h3>Quién puede verla</h3>
                  </div>

                  {perteneceACuenta ? (
                    <>
                      <div
                        className="home-nota-modal-visibility"
                        role="radiogroup"
                        aria-label="Tipo de nota"
                      >
                        <button
                          type="button"
                          role="radio"
                          aria-checked={visibilidad === "personal"}
                          className={`home-nota-modal-visibility-btn${
                            visibilidad === "personal" ? " home-nota-modal-visibility-btn--active" : ""
                          }`}
                          disabled={!apiOnline || guardando}
                          onClick={() => cambiarVisibilidad("personal")}
                        >
                          <Lock size={15} aria-hidden />
                          <span>
                            <strong>Personal</strong>
                            <small>Solo vos en {cuentaLabel}</small>
                          </span>
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={visibilidad === "compartida"}
                          className={`home-nota-modal-visibility-btn${
                            visibilidad === "compartida"
                              ? " home-nota-modal-visibility-btn--active"
                              : ""
                          }`}
                          disabled={!apiOnline || guardando || cargandoMiembros}
                          onClick={() => cambiarVisibilidad("compartida")}
                        >
                          <Users size={15} aria-hidden />
                          <span>
                            <strong>Compartida</strong>
                            <small>Otros usuarios de la cuenta</small>
                          </span>
                        </button>
                      </div>

                      {visibilidad === "compartida" ? (
                        <div className="home-nota-modal-share">
                          {cargandoMiembros ? (
                            <p className="home-nota-modal-share-hint muted">
                              Cargando usuarios de la cuenta…
                            </p>
                          ) : miembrosParaCompartir.length === 0 ? (
                            <p className="home-nota-modal-share-hint muted">
                              No hay otros usuarios activos en {cuentaLabel}. Usá una nota personal.
                            </p>
                          ) : (
                            <>
                              <p className="home-nota-modal-share-hint">
                                Elegí quién de <strong>{cuentaLabel}</strong> la verá en su pizarrón.
                              </p>
                              <NotaCompartirPanel
                                miembros={miembrosParaCompartir}
                                seleccionados={compartidosCon}
                                disabled={!apiOnline || guardando}
                                onChange={setCompartidosCon}
                              />
                            </>
                          )}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="home-nota-modal-share-hint muted home-nota-modal-share-hint--solo">
                      Esta nota queda <strong>personal</strong>: solo la ves vos.
                    </p>
                  )}
                </section>
              </>
            ) : null}
          </div>

          <footer className="home-nota-modal-footer">
            <button
              type="button"
              className="btn btn-secondary btn-sm home-nota-modal-btn-cancel"
              onClick={handleClose}
              disabled={guardando}
            >
              Cancelar
            </button>
            {!soloLectura ? (
              <button
                type="submit"
                className="btn btn-primary btn-sm home-nota-modal-btn-save"
                disabled={!apiOnline || guardando}
              >
                {guardarLabel}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm home-nota-modal-btn-save"
                onClick={handleClose}
              >
                Cerrar
              </button>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
}

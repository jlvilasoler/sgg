import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import {
  createPlatformNotification,
  deletePlatformNotification,
  fetchPlatformNotificationRecipients,
  fetchPlatformNotificationsAdmin,
  updatePlatformNotification,
} from "../../api";
import type {
  PlatformNotificationAdmin,
  PlatformNotificationInput,
  PlatformNotificationRecipient,
} from "../../types";
import { ROL_LABELS, type Rol } from "../../types";
import PlatformNotificationCard from "../PlatformNotificationCard";

interface Props {
  apiOnline: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string, title?: string) => void;
  onVolver: () => void;
  volverLabel?: string;
}

export const DEFAULT_PLATFORM_NOTIFICATION_MESSAGE =
  "Estimado usuario, le queremos contar que ya está disponible la posibilidad de configurar su cuenta con multiempresas y utilizarlas en sesiones separadas, para configurar esa modalidad deberá hacer lo siguiente: Configuracion / Administración de Cuenta / Mi Perfil / Modo de inicio de sesión / Elegir empresa al iniciar. Con esa opción van a poder elegir con que empresa iniciar sesión.";

function defaultDateRange(): Pick<PlatformNotificationInput, "fecha_inicio" | "fecha_fin"> {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 30);
  return {
    fecha_inicio: today.toISOString().slice(0, 10),
    fecha_fin: end.toISOString().slice(0, 10),
  };
}

function emptyForm(): PlatformNotificationInput {
  return {
    titulo: "Aviso de SAG",
    mensaje: DEFAULT_PLATFORM_NOTIFICATION_MESSAGE,
    ...defaultDateRange(),
    activo: false,
  };
}

function formFromRow(row: PlatformNotificationAdmin): PlatformNotificationInput {
  return {
    titulo: row.titulo,
    mensaje: row.mensaje,
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin,
    activo: row.activo === 1,
  };
}

function vigenciaLabel(row: Pick<PlatformNotificationAdmin, "fecha_inicio" | "fecha_fin">): string {
  return `${row.fecha_inicio} → ${row.fecha_fin}`;
}

function estadoVigencia(
  row: Pick<PlatformNotificationAdmin, "activo" | "fecha_inicio" | "fecha_fin">,
): "inactiva" | "programada" | "vigente" | "vencida" {
  if (row.activo !== 1) return "inactiva";
  const today = new Date().toISOString().slice(0, 10);
  if (row.fecha_inicio > today) return "programada";
  if (row.fecha_fin < today) return "vencida";
  return "vigente";
}

function formatLeidoEn(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-UY", { dateStyle: "short", timeStyle: "short" });
}

function rolLabel(rol: string): string {
  return ROL_LABELS[rol as Rol] ?? rol;
}

export default function ConfigEnvioNotificaciones({
  apiOnline,
  onError,
  onSuccess,
  onVolver,
  volverLabel = "Volver a Configuración SAG",
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [items, setItems] = useState<PlatformNotificationAdmin[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PlatformNotificationInput>(emptyForm);
  const [recipients, setRecipients] = useState<PlatformNotificationRecipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState("");

  const isEditing = editingId != null;
  const lecturaPct = useMemo(() => {
    if (!isEditing || !editingId) return null;
    const row = items.find((i) => i.id === editingId);
    if (!row || row.usuarios_elegibles <= 0) return null;
    return Math.round((row.lecturas / row.usuarios_elegibles) * 100);
  }, [editingId, isEditing, items]);

  const filteredRecipients = useMemo(() => {
    const q = recipientFilter.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter((row) => {
      const blob = `${row.nombre} ${row.email} ${row.cuenta_nombre ?? ""} ${rolLabel(row.rol)}`.toLowerCase();
      return blob.includes(q);
    });
  }, [recipientFilter, recipients]);

  const loadRecipients = useCallback(
    async (notificationId: number) => {
      if (!apiOnline) {
        setRecipients([]);
        return;
      }
      setLoadingRecipients(true);
      try {
        const data = await fetchPlatformNotificationRecipients(notificationId);
        setRecipients(data);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Error al cargar quién recibió el aviso");
        setRecipients([]);
      } finally {
        setLoadingRecipients(false);
      }
    },
    [apiOnline, onError],
  );

  const load = useCallback(async () => {
    if (!apiOnline) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchPlatformNotificationsAdmin();
      setItems(data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Error al cargar notificaciones");
    } finally {
      setLoading(false);
    }
  }, [apiOnline, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (editingId == null) {
      setRecipients([]);
      setRecipientFilter("");
      return;
    }
    void loadRecipients(editingId);
  }, [editingId, loadRecipients]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setRecipients([]);
    setRecipientFilter("");
  };

  const startEdit = (row: PlatformNotificationAdmin) => {
    setEditingId(row.id);
    setForm(formFromRow(row));
    setRecipientFilter("");
  };

  const handleSave = async () => {
    if (!apiOnline) return;
    setSaving(true);
    try {
      if (isEditing && editingId != null) {
        const updated = await updatePlatformNotification(editingId, form);
        setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
        onSuccess("Notificación actualizada");
      } else {
        const created = await createPlatformNotification(form);
        setItems((prev) => [created, ...prev]);
        setEditingId(created.id);
        onSuccess("Notificación creada");
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!apiOnline || editingId == null) return;
    if (!window.confirm("¿Eliminar esta notificación? Los usuarios que ya la leyeron no la volverán a ver.")) {
      return;
    }
    setDeleting(true);
    try {
      await deletePlatformNotification(editingId);
      setItems((prev) => prev.filter((row) => row.id !== editingId));
      setEditingId(null);
      setForm(emptyForm());
      onSuccess("Notificación eliminada");
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="sg-hub-embedded config-envio-notificaciones">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ {volverLabel}
      </button>

      <section className="sg-hub-panel config-envio-notificaciones-panel" aria-labelledby="config-envio-notif-title">
        <header className="sg-hub-panel-head config-envio-notificaciones-head">
          <div>
            <p className="sg-hub-panel-kicker">Plataforma SAG · Comunicación</p>
            <h2 id="config-envio-notif-title" className="sg-hub-panel-title">
              Envío de Notificaciones
            </h2>
            <p className="config-envio-notificaciones-lead muted">
              Avisos puntuales para usuarios de las cuentas. El mensaje aparece la primera vez que
              cada usuario entra a SAG dentro del rango de fechas que definas; al cerrarlo con
              «Entendido», no vuelve a mostrarse.
            </p>
          </div>
          <span className="config-envio-notificaciones-head-icon" aria-hidden>
            <Bell size={22} strokeWidth={1.75} />
          </span>
        </header>

        <div className="config-envio-notificaciones-layout">
          <aside className="config-envio-notificaciones-list" aria-label="Notificaciones creadas">
            <div className="config-envio-notificaciones-list-toolbar">
              <h3>Campañas</h3>
              <div className="config-envio-notificaciones-list-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={loading}>
                  <RefreshCw size={14} aria-hidden />
                  Actualizar
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={startCreate}>
                  <Plus size={14} aria-hidden />
                  Nueva
                </button>
              </div>
            </div>

            {loading ? (
              <p className="muted config-envio-notificaciones-empty">Cargando…</p>
            ) : items.length === 0 ? (
              <p className="muted config-envio-notificaciones-empty">
                Todavía no hay notificaciones. Creá la primera con el botón Nueva.
              </p>
            ) : (
              <ul className="config-envio-notificaciones-items">
                {items.map((row) => {
                  const estado = estadoVigencia(row);
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        className={`config-envio-notificaciones-item${editingId === row.id ? " is-active" : ""}`}
                        onClick={() => startEdit(row)}
                      >
                        <span className="config-envio-notificaciones-item-title">{row.titulo}</span>
                        <span className="config-envio-notificaciones-item-meta muted">
                          {vigenciaLabel(row)} · {row.lecturas}/{row.usuarios_elegibles} leídas ·
                          1× por usuario
                        </span>
                        <span className={`config-envio-notificaciones-estado config-envio-notificaciones-estado--${estado}`}>
                          {estado === "inactiva"
                            ? "Apagada"
                            : estado === "programada"
                              ? "Programada"
                              : estado === "vigente"
                                ? "Enviando"
                                : "Vencida"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <div className="config-envio-notificaciones-form-wrap">
            <h3>{isEditing ? "Editar notificación" : "Nueva notificación"}</h3>

            <div className="config-envio-notificaciones-form">
              <label className="field">
                <span>Título</span>
                <input
                  type="text"
                  value={form.titulo}
                  maxLength={200}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  placeholder="Aviso de SAG"
                />
              </label>

              <label className="field">
                <span>Mensaje</span>
                <textarea
                  value={form.mensaje}
                  rows={10}
                  maxLength={8000}
                  onChange={(e) => setForm((f) => ({ ...f, mensaje: e.target.value }))}
                  placeholder="Escribí el aviso para los usuarios…"
                />
              </label>

              <section
                className="config-envio-notificaciones-preview"
                aria-labelledby="config-envio-notif-preview-title"
              >
                <header className="config-envio-notificaciones-preview-head">
                  <h4 id="config-envio-notif-preview-title">Vista previa</h4>
                  <p className="muted">
                    Ejemplo de cómo verá el aviso el usuario al entrar, antes de activar la
                    campaña.
                  </p>
                </header>
                <div className="platform-notification-preview-stage">
                  <PlatformNotificationCard
                    titulo={form.titulo}
                    mensaje={form.mensaje}
                    preview
                  />
                </div>
              </section>

              <div className="config-envio-notificaciones-delivery" aria-labelledby="config-envio-notif-delivery-title">
                <h4 id="config-envio-notif-delivery-title">Modo de envío</h4>
                <label className="config-envio-notificaciones-once">
                  <input type="checkbox" checked readOnly disabled aria-readonly="true" />
                  <span>
                    <strong>Una sola vez por cada usuario</strong>
                    <small className="muted">
                      No se reenvía ni se repite. El sistema espera a que el usuario inicie sesión:
                      si entra dentro del rango de fechas y la campaña está activa, ve el aviso una
                      vez; después queda registrado como leído y no se muestra más.
                    </small>
                  </span>
                </label>
              </div>

              <div className="config-envio-notificaciones-dates">
                <label className="field">
                  <span>Vigencia — desde</span>
                  <input
                    type="date"
                    value={form.fecha_inicio}
                    onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
                  />
                  <small className="muted config-envio-notificaciones-field-hint">
                    Primera fecha en la que puede mostrarse al entrar.
                  </small>
                </label>
                <label className="field">
                  <span>Vigencia — hasta</span>
                  <input
                    type="date"
                    value={form.fecha_fin}
                    onChange={(e) => setForm((f) => ({ ...f, fecha_fin: e.target.value }))}
                  />
                  <small className="muted config-envio-notificaciones-field-hint">
                    Última fecha. Si el usuario no entró antes, ya no lo verá.
                  </small>
                </label>
              </div>

              <label className="config-envio-notificaciones-toggle">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                />
                <span>
                  <strong>Activo</strong>
                  <small className="muted">
                    Si está apagado, nadie recibe el mensaje aunque esté dentro de la vigencia.
                  </small>
                </span>
              </label>

              <p className="config-envio-notificaciones-flow muted">
                <CheckCircle2 size={14} aria-hidden />
                Flujo: usuario entra → si está activo y en vigencia → modal una vez → «Entendido» →
                fin para ese usuario.
              </p>

              {lecturaPct != null ? (
                <p className="config-envio-notificaciones-stats muted">
                  Lecturas: {items.find((i) => i.id === editingId)?.lecturas ?? 0} de{" "}
                  {items.find((i) => i.id === editingId)?.usuarios_elegibles ?? 0} usuarios elegibles
                  ({lecturaPct}%).
                </p>
              ) : null}

              <div className="config-envio-notificaciones-form-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleSave()}
                  disabled={saving || deleting || !apiOnline}
                >
                  <Save size={15} aria-hidden />
                  {saving ? "Guardando…" : isEditing ? "Guardar cambios" : "Crear notificación"}
                </button>
                {isEditing ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-ghost"
                    onClick={() => void handleDelete()}
                    disabled={saving || deleting || !apiOnline}
                  >
                    <Trash2 size={15} aria-hidden />
                    {deleting ? "Eliminando…" : "Eliminar"}
                  </button>
                ) : null}
              </div>
            </div>

            {isEditing && editingId != null ? (
              <section
                className="config-envio-notificaciones-recipients"
                aria-labelledby="config-envio-notif-recipients-title"
              >
                <header className="config-envio-notificaciones-recipients-head">
                  <div>
                    <h4 id="config-envio-notif-recipients-title">Usuarios que ya recibieron el aviso</h4>
                    <p className="muted config-envio-notificaciones-recipients-lead">
                      Solo visible para el superadministrador. Lista de quienes vieron el mensaje y
                      pulsaron «Entendido».
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void loadRecipients(editingId)}
                    disabled={loadingRecipients || !apiOnline}
                  >
                    <RefreshCw size={14} aria-hidden />
                    Actualizar
                  </button>
                </header>

                <label className="config-envio-notificaciones-recipients-search">
                  <span className="sr-only">Buscar en destinatarios</span>
                  <input
                    type="search"
                    value={recipientFilter}
                    onChange={(e) => setRecipientFilter(e.target.value)}
                    placeholder="Buscar por nombre, email o cuenta…"
                  />
                </label>

                {loadingRecipients ? (
                  <p className="muted config-envio-notificaciones-recipients-empty">Cargando destinatarios…</p>
                ) : filteredRecipients.length === 0 ? (
                  <p className="muted config-envio-notificaciones-recipients-empty">
                    {recipients.length === 0
                      ? "Todavía ningún usuario recibió este aviso."
                      : "No hay coincidencias con la búsqueda."}
                  </p>
                ) : (
                  <div className="config-envio-notificaciones-recipients-table-wrap">
                    <table className="config-envio-notificaciones-recipients-table">
                      <thead>
                        <tr>
                          <th scope="col">Usuario</th>
                          <th scope="col">Cuenta</th>
                          <th scope="col">Perfil</th>
                          <th scope="col">Recibido el</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecipients.map((row) => (
                          <tr key={row.user_id}>
                            <td>
                              <strong>{row.nombre}</strong>
                              <span className="config-envio-notificaciones-recipients-email muted">
                                {row.email}
                              </span>
                            </td>
                            <td>{row.cuenta_nombre ?? "—"}</td>
                            <td>{rolLabel(row.rol)}</td>
                            <td>{formatLeidoEn(row.leido_en)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

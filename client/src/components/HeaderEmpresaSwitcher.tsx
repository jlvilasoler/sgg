import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Building2, Check, ChevronDown, Layers } from "lucide-react";
import { fetchMisEmpresas, seleccionarEmpresaActiva } from "../api";
import type { AuthUser, EmpresaOperativa } from "../types";

/** Sentinel de sesión: ver todas las empresas visibles de la cuenta. */
export const EMPRESA_SESION_TODAS_ID = 0;

interface Props {
  user: AuthUser;
  onEmpresaSessionChanged: (user: AuthUser) => void;
  onError?: (message: string) => void;
}

function shortEmpresaLabel(nombre: string): string {
  const t = nombre.trim();
  if (t.length <= 22) return t;
  return `${t.slice(0, 20)}…`;
}

function isSesionTodas(activaId: number | null | undefined): boolean {
  return activaId === EMPRESA_SESION_TODAS_ID;
}

export default function HeaderEmpresaSwitcher({
  user,
  onEmpresaSessionChanged,
  onError,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [empresas, setEmpresas] = useState<EmpresaOperativa[]>([]);
  const [empresasReady, setEmpresasReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const visible =
    user.login_mode === "individual" &&
    user.empresa_operativa_activa_id != null;

  const puedeVerTodas = Boolean(user.puede_ver_todas_empresas);
  const sesionTodas = isSesionTodas(user.empresa_operativa_activa_id);

  const load = useCallback(async () => {
    if (!visible) return;
    setLoading(true);
    try {
      // Solo empresas con permiso de visibilidad (filtra denegadas por admin).
      const data = await fetchMisEmpresas();
      setEmpresas(data.filter((e) => e.activo !== false));
    } catch (e) {
      onError?.(
        e instanceof Error ? e.message : "No se pudieron cargar las empresas"
      );
      setEmpresas([]);
    } finally {
      setEmpresasReady(true);
      setLoading(false);
    }
  }, [visible, onError]);

  useEffect(() => {
    void load();
  }, [load, user.empresa_operativa_activa_id]);

  const activa =
    empresas.find((e) => e.id === user.empresa_operativa_activa_id) ?? null;
  const label = sesionTodas
    ? "Todas las empresas"
    : activa?.nombre ?? user.empresa_activa_nombre ?? "Empresa";
  const color = sesionTodas ? "#c9a227" : activa?.color || "#7cb342";
  /**
   * Flecha / menú solo si hay MÁS DE UNA empresa permitida.
   * La lista ya viene filtrada por permisos del admin/superadmin.
   * "Todas" solo aplica cuando ya hay 2+ visibles.
   */
  const canSwitch = empresasReady && empresas.length > 1;

  useEffect(() => {
    if (!canSwitch && open) setOpen(false);
  }, [canSwitch, open]);

  const updateMenuPos = useCallback(() => {
    // Mismo ancho/alineación que el contenedor EMPRESA del header.
    const el = rootRef.current ?? btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPos();
    const onResize = () => updateMenuPos();
    const onScroll = () => updateMenuPos();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, updateMenuPos]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!visible) return null;
  if (!loading && empresas.length === 0 && !user.empresa_activa_nombre) {
    return null;
  }

  const elegir = async (empresaId: number) => {
    if (switching != null) return;
    if (empresaId === user.empresa_operativa_activa_id) {
      setOpen(false);
      return;
    }
    setSwitching(empresaId);
    try {
      const actualizado = await seleccionarEmpresaActiva(empresaId);
      setOpen(false);
      onEmpresaSessionChanged(actualizado);
    } catch (e) {
      onError?.(
        e instanceof Error ? e.message : "No se pudo cambiar de empresa"
      );
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="main-header-empresa" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className={`main-header-empresa-btn${open ? " is-open" : ""}${
          canSwitch ? "" : " is-static"
        }`}
        onClick={() => {
          if (!canSwitch) return;
          if (!open) void load();
          setOpen((v) => !v);
        }}
        disabled={switching != null}
        aria-haspopup={canSwitch ? "listbox" : undefined}
        aria-expanded={canSwitch ? open : undefined}
        aria-controls={canSwitch && open ? listId : undefined}
        title={
          canSwitch
            ? `Empresa activa: ${label}. Clic para cambiar.`
            : `Empresa activa: ${label}`
        }
        aria-label={
          canSwitch
            ? `Cambiar empresa. Actual: ${label}`
            : `Empresa de la sesión: ${label}`
        }
      >
        <span
          className="main-header-empresa-dot"
          style={{ background: color }}
          aria-hidden
        />
        <span className="main-header-empresa-icon" aria-hidden>
          {sesionTodas ? (
            <Layers size={14} strokeWidth={2.2} />
          ) : (
            <Building2 size={14} strokeWidth={2.2} />
          )}
        </span>
        <span className="main-header-empresa-copy">
          <span className="main-header-empresa-kicker">Empresa</span>
          <span className="main-header-empresa-name">{shortEmpresaLabel(label)}</span>
        </span>
        {canSwitch ? (
          <ChevronDown
            className="main-header-empresa-chevron"
            size={14}
            strokeWidth={2.4}
            aria-hidden
          />
        ) : null}
      </button>

      {open &&
        canSwitch &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            className="main-header-empresa-menu"
            role="listbox"
            aria-label="Empresas de la cuenta"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
          >
            <p className="main-header-empresa-menu-title">Sesión de empresa</p>
            <ul className="main-header-empresa-menu-list">
              {puedeVerTodas ? (
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={sesionTodas}
                    className={`main-header-empresa-option${
                      sesionTodas ? " is-active" : ""
                    }`}
                    disabled={switching != null}
                    onClick={() => void elegir(EMPRESA_SESION_TODAS_ID)}
                  >
                    <span
                      className="main-header-empresa-option-dot main-header-empresa-option-dot--todas"
                      aria-hidden
                    >
                      <Layers size={12} strokeWidth={2.2} />
                    </span>
                    <span className="main-header-empresa-option-text">
                      <strong>Todas las empresas</strong>
                      <span>Vista combinada</span>
                    </span>
                    {switching === EMPRESA_SESION_TODAS_ID ? (
                      <span className="main-header-empresa-option-busy">…</span>
                    ) : sesionTodas ? (
                      <Check size={15} strokeWidth={2.4} aria-hidden />
                    ) : null}
                  </button>
                </li>
              ) : null}
              {empresas.map((e) => {
                const active = e.id === user.empresa_operativa_activa_id;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`main-header-empresa-option${
                        active ? " is-active" : ""
                      }`}
                      disabled={switching != null}
                      onClick={() => void elegir(e.id)}
                    >
                      <span
                        className="main-header-empresa-option-dot"
                        style={{ background: e.color || "#94a3b8" }}
                        aria-hidden
                      />
                      <span className="main-header-empresa-option-text">
                        <strong>{e.nombre}</strong>
                        <span>{e.codigo}</span>
                      </span>
                      {switching === e.id ? (
                        <span className="main-header-empresa-option-busy">
                          …
                        </span>
                      ) : active ? (
                        <Check size={15} strokeWidth={2.4} aria-hidden />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}

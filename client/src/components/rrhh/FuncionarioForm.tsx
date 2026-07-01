import { useEffect, useState } from "react";
import { createFuncionario, updateFuncionario } from "../../api";
import type { Funcionario, FuncionarioForm as FuncionarioFormData } from "../../types";
import { formatCuentaOtrosBancos, getBancoInfo, isBancoSantander } from "../../constants/bancosUruguay";
import { aMayusculas } from "../../utils/formText";
import SelectorBanco from "./SelectorBanco";
import { PageModuleHeadRow } from "../PageModuleHead";

const TIPOS_CUENTA = [
  "",
  "Pesos Uruguayos Caja de Ahorro",
  "Pesos Uruguayos C. Corriente",
  "Dólares Caja de Ahorro",
  "Dólares C. Corriente",
] as const;

interface Props {
  apiOnline: boolean;
  editFuncionario: Funcionario | null;
  onSaved: () => void;
  onCancel: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  onVolver: () => void;
}

const empty = (): FuncionarioFormData => ({
  cedula: "",
  nombre: "",
  apellido: "",
  domicilio: "",
  ciudad: "",
  departamento: "",
  celular: "",
  email: "",
  banco: "",
  sucursal: "",
  cuenta: "",
  tipo_cuenta: "",
  titular_cuenta: "",
  cuenta_otros_bancos: "",
  activo: true,
});

export default function FuncionarioForm({
  apiOnline,
  editFuncionario,
  onSaved,
  onCancel,
  onError,
  onSuccess,
  onVolver,
}: Props) {
  const [form, setForm] = useState<FuncionarioFormData>(empty);
  const editId = editFuncionario?.id ?? null;

  useEffect(() => {
    if (!editFuncionario) {
      setForm(empty());
      return;
    }
    setForm({
      cedula: aMayusculas(editFuncionario.cedula),
      nombre: aMayusculas(editFuncionario.nombre),
      apellido: aMayusculas(editFuncionario.apellido),
      domicilio: aMayusculas(editFuncionario.domicilio),
      ciudad: aMayusculas(editFuncionario.ciudad),
      departamento: aMayusculas(editFuncionario.departamento),
      celular: editFuncionario.celular?.trim() ?? "",
      email: editFuncionario.email?.trim().toLowerCase() ?? "",
      banco: (() => {
        const b = editFuncionario.banco.trim();
        if (!b) return "";
        const info = getBancoInfo(b);
        return info ? info.nombre : aMayusculas(b);
      })(),
      sucursal: aMayusculas(editFuncionario.sucursal),
      cuenta: aMayusculas(editFuncionario.cuenta),
      tipo_cuenta: editFuncionario.tipo_cuenta,
      titular_cuenta: aMayusculas(editFuncionario.titular_cuenta),
      cuenta_otros_bancos: isBancoSantander(editFuncionario.banco)
        ? formatCuentaOtrosBancos(editFuncionario.sucursal, editFuncionario.cuenta) ||
          aMayusculas(editFuncionario.cuenta_otros_bancos ?? "")
        : "",
      activo: editFuncionario.activo !== 0,
    });
  }, [editFuncionario]);

  const set = <K extends keyof FuncionarioFormData>(k: K, v: FuncionarioFormData[K]) => {
    let val = v;
    if (typeof v === "string") {
      if (k === "email") val = v.trim().toLowerCase() as FuncionarioFormData[K];
      else if (k !== "tipo_cuenta") val = aMayusculas(v) as FuncionarioFormData[K];
    }
    setForm((f) => {
      const next = { ...f, [k]: val };
      const banco = k === "banco" ? String(val) : f.banco;

      if (k === "banco") {
        next.cuenta_otros_bancos = isBancoSantander(banco)
          ? formatCuentaOtrosBancos(f.sucursal, f.cuenta)
          : "";
      } else if ((k === "sucursal" || k === "cuenta") && isBancoSantander(banco)) {
        const sucursal = k === "sucursal" ? String(val) : f.sucursal;
        const cuenta = k === "cuenta" ? String(val) : f.cuenta;
        next.cuenta_otros_bancos = formatCuentaOtrosBancos(sucursal, cuenta);
      }
      return next;
    });
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiOnline) {
      onError("API no conectada");
      return;
    }
    try {
      const payload: FuncionarioFormData = {
        ...form,
        cuenta_otros_bancos: isBancoSantander(form.banco) ? form.cuenta_otros_bancos : "",
      };
      if (editId) {
        await updateFuncionario(editId, payload);
        onSuccess("Funcionario actualizado");
      } else {
        await createFuncionario(payload);
        onSuccess("Funcionario registrado");
      }
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Error al guardar");
    }
  };

  return (
    <div className="subseccion-panel">
      <button type="button" className="subseccion-back" onClick={onVolver}>
        ‹ Volver a funcionarios
      </button>
      <div className="card">
        <div className="form-header">
          <PageModuleHeadRow
            icon={{ source: "hub", id: "rrhh_funcionarios" }}
            title={editId ? "Editar funcionario" : "Nuevo funcionario"}
            subtitle="Datos para transferencia de sueldo y vínculo con gastos por cédula."
          />
        </div>
        <form className="form-grid rrhh-form" onSubmit={guardar}>
          <fieldset className="rrhh-fieldset">
            <legend>Identificación</legend>
            <div className="field">
              <label htmlFor="f-cedula">Cédula de identidad *</label>
              <input
                id="f-cedula"
                value={form.cedula}
                onChange={(e) => set("cedula", e.target.value)}
                placeholder="Ej. 1234567-8"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="f-nombre">Nombre *</label>
              <input
                id="f-nombre"
                value={form.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="f-apellido">Apellido *</label>
              <input
                id="f-apellido"
                value={form.apellido}
                onChange={(e) => set("apellido", e.target.value)}
                required
              />
            </div>
          </fieldset>

          <fieldset className="rrhh-fieldset">
            <legend>Contacto</legend>
            <div className="field">
              <label htmlFor="f-celular">Celular</label>
              <input
                id="f-celular"
                type="tel"
                data-sin-mayusculas="true"
                value={form.celular}
                onChange={(e) => set("celular", e.target.value)}
                placeholder="Ej. 099 123 456"
                autoComplete="tel"
              />
            </div>
            <div className="field">
              <label htmlFor="f-email">Email</label>
              <input
                id="f-email"
                type="email"
                data-sin-mayusculas="true"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="Ej. nombre@empresa.com"
                autoComplete="email"
              />
            </div>
          </fieldset>

          <fieldset className="rrhh-fieldset">
            <legend>Domicilio</legend>
            <div className="field field-full">
              <label htmlFor="f-domicilio">Domicilio</label>
              <input
                id="f-domicilio"
                value={form.domicilio}
                onChange={(e) => set("domicilio", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="f-ciudad">Ciudad</label>
              <input
                id="f-ciudad"
                value={form.ciudad}
                onChange={(e) => set("ciudad", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="f-depto">Departamento</label>
              <input
                id="f-depto"
                value={form.departamento}
                onChange={(e) => set("departamento", e.target.value)}
              />
            </div>
          </fieldset>

          <fieldset className="rrhh-fieldset">
            <legend>Cuenta bancaria (transferencia de sueldo)</legend>
            <SelectorBanco
              id="f-banco"
              value={form.banco}
              onChange={(v) => set("banco", v)}
            />
            <div className="field">
              <label htmlFor="f-sucursal">Sucursal</label>
              <input
                id="f-sucursal"
                value={form.sucursal}
                onChange={(e) => set("sucursal", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="f-cuenta">Nº de cuenta</label>
              <input
                id="f-cuenta"
                value={form.cuenta}
                onChange={(e) => set("cuenta", e.target.value)}
              />
            </div>
            {isBancoSantander(form.banco) && (
              <div className="field">
                <label htmlFor="f-cuenta-otros">Nº de cuenta desde otros bancos</label>
                <input
                  id="f-cuenta-otros"
                  value={form.cuenta_otros_bancos}
                  onChange={(e) => set("cuenta_otros_bancos", e.target.value)}
                  placeholder="00 + sucursal + 00 + cuenta"
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="f-tipo">Tipo de cuenta</label>
              <select
                id="f-tipo"
                value={form.tipo_cuenta}
                onChange={(e) => set("tipo_cuenta", e.target.value)}
              >
                {TIPOS_CUENTA.map((t) => (
                  <option key={t || "vacio"} value={t}>
                    {t || "Seleccionar…"}
                  </option>
                ))}
                {form.tipo_cuenta &&
                  !TIPOS_CUENTA.includes(
                    form.tipo_cuenta as (typeof TIPOS_CUENTA)[number]
                  ) && (
                    <option value={form.tipo_cuenta}>{form.tipo_cuenta}</option>
                  )}
              </select>
            </div>
            <div className="field field-full">
              <label htmlFor="f-titular">Titular de la cuenta</label>
              <input
                id="f-titular"
                value={form.titular_cuenta}
                onChange={(e) => set("titular_cuenta", e.target.value)}
                placeholder="Si vacío: nombre y apellido"
              />
            </div>
          </fieldset>

          <fieldset className="rrhh-fieldset rrhh-fieldset--activo">
            <legend>Situación laboral</legend>
            <div className="field field-full">
              <label className="inline-check" htmlFor="f-activo">
                <input
                  id="f-activo"
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => set("activo", e.target.checked)}
                />
                Trabaja actualmente en la empresa
              </label>
              <p className="muted rrhh-activo-ayuda">
                {form.activo
                  ? "Aparece en el listado de sueldos y al registrar gastos por cédula."
                  : "Ya no trabaja en la empresa: la ficha se conserva, pero no se ofrece al cargar sueldos ni en búsquedas de activos."}
              </p>
            </div>
          </fieldset>

          <div className="form-actions field-full">
            <button type="submit" className="btn btn-primary" disabled={!apiOnline}>
              {editId ? "Guardar cambios" : "Registrar funcionario"}
            </button>
            <button type="button" className="btn" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

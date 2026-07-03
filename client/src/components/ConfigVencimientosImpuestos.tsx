import { useCallback, useEffect, useState } from "react";

import { PageModuleHeadRow } from "./PageModuleHead";

import VencimientosImpuestosCalendariosForm from "./VencimientosImpuestosCalendariosForm";

import PatenteSuciveCalendariosForm from "./PatenteSuciveCalendariosForm";

import BpsCajaRuralCalendariosForm from "./BpsCajaRuralCalendariosForm";

import PrimariaRuralCalendariosForm from "./PrimariaRuralCalendariosForm";

import type { ContribucionRuralCalendariosStore } from "../types/contribucion-rural";

import type { PatenteSuciveCalendariosStore } from "../types/patente-sucive";

import type { BpsCajaRuralCalendariosStore } from "../types/bps-caja-rural";

import type { PrimariaRuralCalendariosStore } from "../types/primaria-rural";

import {

  fetchContribucionRuralCalendarios,

  fetchPatenteSuciveCalendarios,

  fetchBpsCajaRuralCalendarios,

  fetchPrimariaRuralCalendarios,

  saveContribucionRuralCalendarios,

  savePatenteSuciveCalendarios,

  saveBpsCajaRuralCalendarios,

  savePrimariaRuralCalendarios,

} from "../api";



interface Props {

  apiOnline: boolean;

  onError: (msg: string) => void;

  onSuccess: (msg: string, title?: string) => void;

  onVolver: () => void;

  volverLabel?: string;

}



type ConfigTab = "rural" | "patente" | "bps" | "primaria";



export default function ConfigVencimientosImpuestos({

  apiOnline,

  onError,

  onSuccess,

  onVolver,

  volverLabel = "Volver a Configuración SAG",

}: Props) {

  const [store, setStore] = useState<ContribucionRuralCalendariosStore | null>(null);

  const [patenteStore, setPatenteStore] = useState<PatenteSuciveCalendariosStore | null>(null);

  const [bpsStore, setBpsStore] = useState<BpsCajaRuralCalendariosStore | null>(null);

  const [primariaStore, setPrimariaStore] = useState<PrimariaRuralCalendariosStore | null>(null);

  const [tab, setTab] = useState<ConfigTab>("rural");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);



  const load = useCallback(async () => {

    if (!apiOnline) {

      setLoading(false);

      return;

    }

    setLoading(true);

    try {

      const [calendarios, patente, bps, primaria] = await Promise.all([

        fetchContribucionRuralCalendarios(),

        fetchPatenteSuciveCalendarios(),

        fetchBpsCajaRuralCalendarios(),

        fetchPrimariaRuralCalendarios(),

      ]);

      setStore(calendarios);

      setPatenteStore(patente);

      setBpsStore(bps);

      setPrimariaStore(primaria);

    } catch (e) {

      onError(e instanceof Error ? e.message : "No se pudieron cargar los calendarios.");

    } finally {

      setLoading(false);

    }

  }, [apiOnline, onError]);



  useEffect(() => {

    void load();

  }, [load]);



  const handleSaveRural = async (next: ContribucionRuralCalendariosStore) => {

    if (!apiOnline) {

      onError("Sin conexión con el servidor.");

      return;

    }

    setSaving(true);

    try {

      const saved = await saveContribucionRuralCalendarios(next);

      setStore(saved);

      onSuccess("Calendarios de contribución rural actualizados.");

    } catch (e) {

      onError(e instanceof Error ? e.message : "No se pudieron guardar los calendarios.");

    } finally {

      setSaving(false);

    }

  };



  const handleSavePatente = async (next: PatenteSuciveCalendariosStore) => {

    if (!apiOnline) {

      onError("Sin conexión con el servidor.");

      return;

    }

    setSaving(true);

    try {

      const saved = await savePatenteSuciveCalendarios(next);

      setPatenteStore(saved);

      onSuccess("Calendario de patente SUCIVE actualizado.");

    } catch (e) {

      onError(e instanceof Error ? e.message : "No se pudo guardar el calendario SUCIVE.");

    } finally {

      setSaving(false);

    }

  };



  const handleSaveBps = async (next: BpsCajaRuralCalendariosStore) => {

    if (!apiOnline) {

      onError("Sin conexión con el servidor.");

      return;

    }

    setSaving(true);

    try {

      const saved = await saveBpsCajaRuralCalendarios(next);

      setBpsStore(saved);

      onSuccess("Calendario de BPS Caja rural actualizado.");

    } catch (e) {

      onError(e instanceof Error ? e.message : "No se pudo guardar el calendario BPS Caja rural.");

    } finally {

      setSaving(false);

    }

  };



  const handleSavePrimaria = async (next: PrimariaRuralCalendariosStore) => {

    if (!apiOnline) {

      onError("Sin conexión con el servidor.");

      return;

    }

    setSaving(true);

    try {

      const saved = await savePrimariaRuralCalendarios(next);

      setPrimariaStore(saved);

      onSuccess("Calendario de Primaria rural (DGI) actualizado.");

    } catch (e) {

      onError(e instanceof Error ? e.message : "No se pudo guardar el calendario Primaria rural.");

    } finally {

      setSaving(false);

    }

  };



  return (

    <div className="subseccion-panel configuracion-hub">

      <button type="button" className="subseccion-back" onClick={onVolver}>

        ‹ {volverLabel}

      </button>

      <div className="card configuracion-hub-card vencimientos-impuestos-config">

        <header className="module-hub-head">

          <PageModuleHeadRow

            icon={{ source: "app", id: "vencimientos_impuestos" }}

            title="Vencimientos Impuestos"

            subtitle="Contribución rural, patente SUCIVE, BPS Caja rural e Impuesto Primaria (DGI) · calendarios editables"

          />

        </header>



        <nav className="venc-imp-tabs venc-imp-tabs--config" aria-label="Calendarios a editar">

          <button

            type="button"

            className={`venc-imp-tab${tab === "rural" ? " venc-imp-tab--active" : ""}`}

            onClick={() => setTab("rural")}

          >

            Contribución rural

          </button>

          <button

            type="button"

            className={`venc-imp-tab${tab === "patente" ? " venc-imp-tab--active" : ""}`}

            onClick={() => setTab("patente")}

          >

            Patente SUCIVE

          </button>

          <button

            type="button"

            className={`venc-imp-tab${tab === "bps" ? " venc-imp-tab--active" : ""}`}

            onClick={() => setTab("bps")}

          >

            BPS Caja rural

          </button>

          <button

            type="button"

            className={`venc-imp-tab${tab === "primaria" ? " venc-imp-tab--active" : ""}`}

            onClick={() => setTab("primaria")}

          >

            Primaria rural (DGI)

          </button>

        </nav>



        {loading && <p className="venc-imp-loading">Cargando calendarios…</p>}



        {!loading && tab === "rural" && store && (

          <VencimientosImpuestosCalendariosForm

            key={store.updatedAt || "default-rural"}

            store={store}

            saving={saving}

            onSave={handleSaveRural}

          />

        )}



        {!loading && tab === "patente" && patenteStore && (

          <PatenteSuciveCalendariosForm

            key={patenteStore.updatedAt || "default-patente"}

            store={patenteStore}

            saving={saving}

            onSave={handleSavePatente}

          />

        )}



        {!loading && tab === "bps" && bpsStore && (

          <BpsCajaRuralCalendariosForm

            key={bpsStore.updatedAt || "default-bps"}

            store={bpsStore}

            saving={saving}

            onSave={handleSaveBps}

          />

        )}



        {!loading && tab === "primaria" && primariaStore && (

          <PrimariaRuralCalendariosForm

            key={primariaStore.updatedAt || "default-primaria"}

            store={primariaStore}

            saving={saving}

            onSave={handleSavePrimaria}

          />

        )}

      </div>

    </div>

  );

}



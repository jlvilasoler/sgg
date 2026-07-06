import {

  ArrowRight,

  CheckCircle2,

  ExternalLink,

  Lightbulb,

  Route,

  Sparkles,

} from "lucide-react";

import type { TabId } from "../Header";

import type { AuthUser } from "../../types";

import { canAccessScreen } from "../../utils/auth-permissions";

import { HubMenuIcon } from "../icons/HubMenuIcons";

import {

  AYUDA_GRUPOS,

  type AyudaArticulo,

  type AyudaBloque,

} from "../../help/ayuda-manual";

import { iconoParaBloque, limpiarPasoNumerado } from "./ayuda-bloque-icons";



interface Props {

  articulo: AyudaArticulo;

  currentUser: AuthUser;

  onOpenModulo?: (id: TabId) => void;

}



function grupoLabel(grupoId: AyudaArticulo["grupo"]): string {

  return AYUDA_GRUPOS.find((g) => g.id === grupoId)?.label ?? "Ayuda";

}



function BloqueAyudaCard({ bloque, index }: { bloque: AyudaBloque; index: number }) {

  const Icon = iconoParaBloque(bloque.titulo);

  const tienePasos = (bloque.pasos?.length ?? 0) > 0;

  const tieneConsejos = (bloque.consejos?.length ?? 0) > 0;



  return (

    <section

      className={`ayuda-bloque-card sg-hub-panel ayuda-bloque-panel${tienePasos ? " ayuda-bloque-card--pasos" : ""}`}

      style={{ animationDelay: `${index * 45}ms` }}

    >

      <header className="ayuda-bloque-card-head">

        <span className="ayuda-bloque-card-icon" aria-hidden>

          <Icon size={18} strokeWidth={2} />

        </span>

        <h3 className="ayuda-bloque-card-titulo">{bloque.titulo}</h3>

      </header>



      <div className="ayuda-bloque-card-body">

        {bloque.parrafos?.map((p, i) => (

          <div key={i} className="ayuda-info-line">

            <CheckCircle2 size={15} className="ayuda-info-line-icon" aria-hidden />

            <p>{p}</p>

          </div>

        ))}



        {tienePasos ? (

          <ol className="ayuda-pasos-timeline">

            {bloque.pasos!.map((paso, i) => (

              <li key={i} className="ayuda-paso-item">

                <span className="ayuda-paso-num" aria-hidden>

                  {i + 1}

                </span>

                <span className="ayuda-paso-texto">{paso}</span>

              </li>

            ))}

          </ol>

        ) : null}



        {tieneConsejos ? (

          <ul className="ayuda-consejos-premium">

            {bloque.consejos!.map((c, i) => (

              <li key={i}>

                <span className="ayuda-consejo-badge" aria-hidden>

                  <Lightbulb size={14} />

                </span>

                <span>{c}</span>

              </li>

            ))}

          </ul>

        ) : null}

      </div>

    </section>

  );

}



function ProcesoOperativoSection({ pasos }: { pasos: string[] }) {

  return (

    <section

      className="ayuda-proceso-section sg-hub-panel"

      aria-labelledby="ayuda-proceso-titulo"

    >

      <header className="sg-hub-panel-head ayuda-proceso-section-head">

        <span className="ayuda-proceso-section-icon" aria-hidden>

          <Route size={20} />

        </span>

        <div>

          <p className="sg-hub-panel-kicker" id="ayuda-proceso-titulo">

            Flujo recomendado

          </p>

          <h3 className="sg-hub-panel-title ayuda-proceso-section-title">Proceso operativo</h3>

        </div>

      </header>



      <ol className="ayuda-proceso-track">

        {pasos.map((paso, i) => (

          <li key={i} className="ayuda-proceso-step">

            <div className="ayuda-proceso-step-marker">

              <span>{i + 1}</span>

            </div>

            <div className="ayuda-proceso-step-card">

              <p>{limpiarPasoNumerado(paso)}</p>

            </div>

          </li>

        ))}

      </ol>

    </section>

  );

}



function AyudaCtaBar({

  label,

  onClick,

}: {

  label: string;

  onClick: () => void;

}) {

  return (

    <section className="ayuda-cta-bar sg-hub-panel ayuda-cta-bar--pro">

      <div className="ayuda-cta-bar-copy">

        <Sparkles size={18} aria-hidden />

        <div>

          <strong>¿Listo para practicar?</strong>

          <span>Abrí el módulo y seguí esta guía en vivo.</span>

        </div>

      </div>

      <button type="button" className="sg-hub-cta ayuda-cta-bar-btn" onClick={onClick}>

        Ir a {label}

        <ArrowRight size={16} aria-hidden />

      </button>

    </section>

  );

}



export default function AyudaArticuloView({

  articulo,

  currentUser,

  onOpenModulo,

}: Props) {

  const puedeIr =

    articulo.pantallaRelacionada &&

    canAccessScreen(currentUser, articulo.pantallaRelacionada);



  const abrirModulo = () => {

    if (articulo.pantallaRelacionada && onOpenModulo) {

      onOpenModulo(articulo.pantallaRelacionada);

    }

  };



  const pasosCount = articulo.procesoOperativo?.length ?? 0;

  const bloquesCount = articulo.bloques.length;



  return (

    <div className="ayuda-articulo-layout">

      <header className="ayuda-articulo-hero sg-hub-panel">
        <div className="ayuda-articulo-hero-top">
          <div className="ayuda-articulo-hero-main">
            <span className="ayuda-articulo-hero-icon" aria-hidden>
              <HubMenuIcon id={articulo.icon} />
            </span>
            <div className="ayuda-articulo-hero-copy">
              <p className="sg-hub-panel-kicker">{grupoLabel(articulo.grupo)}</p>
              <h2 className="ayuda-articulo-hero-title">{articulo.label}</h2>
              <p className="ayuda-articulo-hero-sub">{articulo.subtitle}</p>
            </div>
          </div>

          {puedeIr && onOpenModulo ? (
            <button
              type="button"
              className="sg-hub-cta sg-hub-cta--compact ayuda-articulo-hero-cta"
              onClick={abrirModulo}
            >
              <ExternalLink size={16} aria-hidden />
              Abrir módulo
            </button>
          ) : null}
        </div>

        {(pasosCount > 0 || bloquesCount > 0) && (
          <div className="sg-hub-kpi-strip ayuda-articulo-kpi-strip" aria-label="Resumen de la guía">
            {pasosCount > 0 ? (
              <div className="sg-hub-kpi sg-hub-kpi--dark">
                <p className="sg-hub-kpi-kicker">Flujo</p>
                <p className="sg-hub-kpi-value">{pasosCount}</p>
                <p className="sg-hub-kpi-hint">pasos recomendados</p>
              </div>
            ) : null}
            <div className="sg-hub-kpi sg-hub-kpi--dark">
              <p className="sg-hub-kpi-kicker">Detalle</p>
              <p className="sg-hub-kpi-value">{bloquesCount}</p>
              <p className="sg-hub-kpi-hint">
                sección{bloquesCount === 1 ? "" : "es"} de guía
              </p>
            </div>
          </div>
        )}
      </header>



      <section className="ayuda-articulo-intro-card sg-hub-panel ayuda-articulo-intro-card--pro">

        <p>{articulo.intro}</p>

      </section>



      {articulo.procesoOperativo && articulo.procesoOperativo.length > 0 ? (

        <ProcesoOperativoSection pasos={articulo.procesoOperativo} />

      ) : null}



      {articulo.bloques.length > 0 ? (

        <section className="ayuda-bloques-section sg-hub-panel">

          <header className="sg-hub-panel-head">

            <p className="sg-hub-panel-kicker">Detalle</p>

            <h3 className="sg-hub-panel-title">Guía paso a paso</h3>

          </header>

          <div className="ayuda-bloques-grid">

            {articulo.bloques.map((bloque, i) => (

              <BloqueAyudaCard key={bloque.titulo} bloque={bloque} index={i} />

            ))}

          </div>

        </section>

      ) : null}



      {puedeIr && onOpenModulo ? (

        <AyudaCtaBar label={articulo.label} onClick={abrirModulo} />

      ) : null}

    </div>

  );

}


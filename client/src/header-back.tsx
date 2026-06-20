import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type HeaderBackStep = {
  onBack: () => void;
  destinationLabel: string;
} | null;

type HeaderBackContextValue = {
  step: HeaderBackStep;
  setStep: (step: HeaderBackStep) => void;
};

const HeaderBackContext = createContext<HeaderBackContextValue | null>(null);

export function HeaderBackProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<HeaderBackStep>(null);
  const value = useMemo(() => ({ step, setStep }), [step]);
  return (
    <HeaderBackContext.Provider value={value}>{children}</HeaderBackContext.Provider>
  );
}

export function useHeaderBackContext() {
  return useContext(HeaderBackContext);
}

/** Registra un paso «atrás» dentro del módulo actual (subpantallas del hub). */
export function useHeaderBackStep(
  active: boolean,
  onBack: () => void,
  destinationLabel: string
) {
  const ctx = useHeaderBackContext();

  useEffect(() => {
    if (!ctx) return;
    if (active) {
      ctx.setStep({ onBack, destinationLabel });
    } else {
      ctx.setStep(null);
    }
    return () => ctx.setStep(null);
  }, [active, onBack, destinationLabel, ctx]);
}

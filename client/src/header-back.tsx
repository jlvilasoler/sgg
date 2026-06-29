import {
  createContext,
  useCallback,
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

function sameHeaderBackStep(a: HeaderBackStep, b: HeaderBackStep): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.destinationLabel === b.destinationLabel;
}

export function HeaderBackProvider({ children }: { children: ReactNode }) {
  const [step, setStepState] = useState<HeaderBackStep>(null);
  const setStep = useCallback((next: HeaderBackStep) => {
    setStepState((prev) => (sameHeaderBackStep(prev, next) ? prev : next));
  }, []);
  const value = useMemo(() => ({ step, setStep }), [step, setStep]);
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
  const setStep = ctx?.setStep;

  useEffect(() => {
    if (!setStep) return;
    if (active) {
      setStep({ onBack, destinationLabel });
    } else {
      setStep(null);
    }
    return () => setStep(null);
  }, [active, onBack, destinationLabel, setStep]);
}

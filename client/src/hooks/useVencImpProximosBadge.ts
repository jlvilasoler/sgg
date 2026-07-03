import { useEffect, useState } from "react";
import {
  getVencImpProximosCount,
  subscribeVencImpProximosCount,
} from "../utils/vencimientos-impuestos-proximos-badge";

export function useVencImpProximosBadge(): number {
  const [count, setCount] = useState(getVencImpProximosCount);

  useEffect(() => subscribeVencImpProximosCount(setCount), []);

  return count;
}

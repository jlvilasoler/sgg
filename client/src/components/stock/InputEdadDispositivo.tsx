import { useEffect, useState } from "react";

function parseEdadInput(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const next = Number(trimmed);
  if (!Number.isInteger(next) || next < 0 || next > 50) return undefined;
  return next;
}

interface Props {
  value: number | null;
  onSave?: (edad: number | null) => void;
  onChange?: (edad: number | null) => void;
  disabled?: boolean;
  id?: string;
}

export default function InputEdadDispositivo({
  value,
  onSave,
  onChange,
  disabled = false,
  id,
}: Props) {
  const [local, setLocal] = useState(value === null ? "" : String(value));

  useEffect(() => {
    setLocal(value === null ? "" : String(value));
  }, [value]);

  const commit = () => {
    const parsed = parseEdadInput(local);
    if (parsed === undefined) {
      setLocal(value === null ? "" : String(value));
      return;
    }
    if (onChange) onChange(parsed);
    else if (onSave && parsed !== value) onSave(parsed);
  };

  return (
    <span className="stock-edad-wrap">
      <input
        id={id}
        type="number"
        min={0}
        max={50}
        className="stock-edad-input"
        value={local}
        disabled={disabled}
        placeholder="—"
        onChange={(e) => {
          const raw = e.target.value;
          setLocal(raw);
          const parsed = parseEdadInput(raw);
          if (parsed !== undefined) onChange?.(parsed);
        }}
        onBlur={() => onSave && commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <span className="stock-edad-suffix">años</span>
    </span>
  );
}

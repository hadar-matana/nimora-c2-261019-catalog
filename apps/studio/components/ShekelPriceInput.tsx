import {useEffect, useState} from "react";
import {set, unset, type NumberInputProps} from "sanity";

function agorotToShekels(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  const shekels = Math.floor(value / 100);
  const agorot = Math.abs(value % 100);
  return agorot === 0 ? String(shekels) : `${shekels}.${String(agorot).padStart(2, "0")}`;
}

function shekelsToAgorot(value: string) {
  const normalized = value.trim().replace(/,/g, ".");
  if (!normalized) return undefined;
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;

  const [whole, fraction = ""] = normalized.split(".");
  const agorot = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(agorot) ? agorot : null;
}

export function ShekelPriceInput(props: NumberInputProps) {
  const [displayValue, setDisplayValue] = useState(() => agorotToShekels(props.value));

  useEffect(() => {
    setDisplayValue(agorotToShekels(props.value));
  }, [props.value]);

  return (
    <div>
      <input
        inputMode="decimal"
        dir="ltr"
        value={displayValue}
        placeholder="129 או 129.90"
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          setDisplayValue(nextValue);
          const agorot = shekelsToAgorot(nextValue);

          if (agorot === undefined) props.onChange(unset());
          if (typeof agorot === "number") props.onChange(set(agorot));
        }}
        style={{
          background: "var(--card-bg-color)",
          border: "1px solid var(--card-border-color)",
          borderRadius: 3,
          boxSizing: "border-box",
          color: "inherit",
          font: "inherit",
          padding: "0.65rem 0.75rem",
          width: "100%"
        }}
      />
      <p style={{fontSize: "0.8125rem", lineHeight: 1.5, margin: "0.4rem 0 0", opacity: 0.72}}>
        הזינו מחיר בשקלים. לדוגמה: 129 או 129.90. המערכת שומרת את המחיר באגורות באופן מדויק.
      </p>
    </div>
  );
}

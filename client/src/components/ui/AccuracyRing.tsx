interface AccuracyRingProps {
  value: number; // 0–100
  size?: number;
}

/** Circular gauge for the AI summary accuracy (PDF target: >85%). */
export function AccuracyRing({ value, size = 64 }: AccuracyRingProps) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  const color = value >= 85 ? "#2dd4bf" : value >= 70 ? "#fbbf24" : "#f43f5e";

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e2840" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span className="absolute font-display text-sm font-bold text-text-hi">
        {Math.round(value)}%
      </span>
    </div>
  );
}

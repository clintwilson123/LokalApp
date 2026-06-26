import { colors, radii } from "../uiStyles";

const widths = ["70%", "85%", "60%", "90%", "75%", "80%", "55%", "95%", "65%", "50%"];

export function SkeletonLine({ width = "100%", height = "14px" }) {
  return (
    <div
      style={{
        width, height, borderRadius: radii.sm,
        background: `linear-gradient(90deg, ${colors.border} 25%, #e8edf4 50%, ${colors.border} 75%)`,
        backgroundSize: "200% 100%",
        animation: "shimmer 1.2s ease-in-out infinite",
      }}
    />
  );
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div style={{
      backgroundColor: colors.white, padding: "20px", borderRadius: radii.xl,
      border: `1px solid ${colors.border}`,
    }}>
      <SkeletonLine width="60%" height="18px" />
      <div style={{ height: "12px" }} />
      <SkeletonLine width="40%" height="12px" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{ marginTop: "10px" }}>
          <SkeletonLine width={widths[i % widths.length]} height="12px" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div style={{
      backgroundColor: "rgba(255,255,255,0.7)", borderRadius: radii.lg, padding: "16px",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "12px", marginBottom: "16px" }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} height="12px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "12px", marginBottom: "12px" }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} height="12px" width={widths[(r * cols + c) % widths.length]} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({ cards = 4 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  );
}

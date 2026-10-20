import "../styles/analytics.css";

const HEIGHT = 280;
const PAD = { top: 28, right: 24, bottom: 34, left: 24 };
const STEP = 56; // sideways space for each point

// Line graph drawn with plain SVG (same props as BarChart).
export default function LineChart({
  rows,
  valueKey,
  format = (value) => value,
  labelFormat = (label) => label,
}) {
  if (!rows.length) {
    return <p className="chart-empty">No sales in this period.</p>;
  }

  const width = Math.max(600, PAD.left + PAD.right + rows.length * STEP);
  const innerWidth = width - PAD.left - PAD.right;
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const max = Math.max(...rows.map((row) => row[valueKey]), 0);

  const x = (index) =>
    PAD.left + (rows.length === 1 ? innerWidth / 2 : (index * innerWidth) / (rows.length - 1));
  const y = (value) => PAD.top + innerHeight - (max > 0 ? (value / max) * innerHeight : 0);

  const points = rows.map((row, index) => `${x(index)},${y(row[valueKey])}`).join(" ");
  const showValues = rows.length <= 14; // too many numbers get crowded; hover shows them instead

  return (
    <div className="line-chart-wrap">
      <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label="Line graph">
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const gy = PAD.top + innerHeight - step * innerHeight;
          return <line key={step} x1={PAD.left} x2={width - PAD.right} y1={gy} y2={gy} className="line-grid" />;
        })}

        <polyline points={points} className="line-path" fill="none" />

        {rows.map((row, index) => (
          <g key={row.label}>
            <circle cx={x(index)} cy={y(row[valueKey])} r="4" className="line-dot">
              <title>{`${row.label}: ${format(row[valueKey])}`}</title>
            </circle>
            {showValues && (
              <text x={x(index)} y={y(row[valueKey]) - 10} textAnchor="middle" className="line-value">
                {format(row[valueKey])}
              </text>
            )}
            <text x={x(index)} y={HEIGHT - 12} textAnchor="middle" className="line-label">
              {labelFormat(row.label)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

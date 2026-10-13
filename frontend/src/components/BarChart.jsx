import "../styles/analytics.css";

// Simple bar graph drawn with plain CSS (no chart library needed).
//   rows        [{ label, ...numbers }]
//   valueKey    which number to draw, e.g. "revenue"
//   format      how to print the number above each bar
//   labelFormat how to print the label under each bar
export default function BarChart({
  rows,
  valueKey,
  format = (value) => value,
  labelFormat = (label) => label,
}) {
  if (!rows.length) {
    return <p className="chart-empty">No sales in this period.</p>;
  }

  const max = Math.max(...rows.map((row) => row[valueKey]), 0);

  return (
    <div className="bar-chart">
      {rows.map((row) => {
        const value = row[valueKey];
        // Tiny non-zero values still get a visible sliver.
        const height =
          max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
        return (
          <div
            className="bar-col"
            key={row.label}
            title={`${row.label}: ${format(value)}`}
          >
            <span className="bar-value">{format(value)}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ height: `${height}%` }} />
            </div>
            <span className="bar-label">{labelFormat(row.label)}</span>
          </div>
        );
      })}
    </div>
  );
}

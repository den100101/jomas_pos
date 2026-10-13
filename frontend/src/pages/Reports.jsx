import { useEffect, useMemo, useState } from "react";
import api from "../api";
import BarChart from "../components/BarChart";
import "../styles/analytics.css";

const peso = (value) =>
  "₱" + Number(value).toLocaleString("en-PH", { maximumFractionDigits: 2 });

const METRICS = {
  revenue: { label: "Revenue", format: peso },
  orders: { label: "Orders", format: (value) => value },
  items_sold: { label: "Items sold", format: (value) => value },
  avg_ticket: { label: "Average ticket", format: peso },
};

const GROUPS = {
  day: "Day",
  hour: "Hour of day",
  product: "Product",
  payment: "Payment method",
};

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
];

const STORAGE_KEY = "joma_report_presets";

const toInputDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

function loadSavedReports() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export default function Reports() {
  const today = toInputDate(new Date());

  // What the admin picked
  const [preset, setPreset] = useState("today");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [groupBy, setGroupBy] = useState("hour");
  const [metric, setMetric] = useState("revenue");
  const [top, setTop] = useState(10);

  // What came back
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Saved report setups (kept in this browser)
  const [saved, setSaved] = useState(loadSavedReports);
  const [saveName, setSaveName] = useState("");

  const params = useMemo(
    () => ({ range: preset, start, end, group_by: groupBy, top }),
    [preset, start, end, groupBy, top],
  );

  useEffect(() => {
    if (preset === "custom" && (!start || !end)) return undefined;
    let ignore = false;
    setLoading(true);
    setError("");
    api
      .get("/reports/custom", { params })
      .then((res) => {
        if (!ignore) setReport(res.data);
      })
      .catch((err) => {
        if (!ignore) {
          setReport(null);
          setError(err.response?.data?.error || "Could not load the report.");
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [params, preset, start, end]);

  const selectPreset = (key) => {
    setPreset(key);
    // Pick a sensible grouping: hours for one day, days for longer ranges.
    if (groupBy === "day" || groupBy === "hour") {
      setGroupBy(key === "today" ? "hour" : "day");
    }
  };

  const exportCsv = async () => {
    try {
      const res = await api.get("/reports/custom", {
        params: { ...params, format: "csv" },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sales-by-${groupBy}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Could not export the report.");
    }
  };

  const persist = (next) => {
    setSaved(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const saveCurrent = () => {
    const name = saveName.trim();
    if (!name) return;
    const entry = { name, preset, start, end, groupBy, metric, top };
    persist([...saved.filter((item) => item.name !== name), entry].slice(-10));
    setSaveName("");
  };

  const applySaved = (item) => {
    setPreset(item.preset);
    setStart(item.start);
    setEnd(item.end);
    setGroupBy(item.groupBy);
    setMetric(item.metric);
    setTop(item.top);
  };

  const metricInfo = METRICS[metric];
  const rows = report ? report.rows : [];
  const totals = report ? report.totals : null;

  const labelFormat =
    groupBy === "day"
      ? (label) => label.slice(5)
      : groupBy === "payment"
        ? (label) => label.charAt(0).toUpperCase() + label.slice(1)
        : undefined;

  const chartTitle =
    groupBy === "product"
      ? `Top ${top} products - ${metricInfo.label.toLowerCase()}`
      : `${metricInfo.label} by ${GROUPS[groupBy].toLowerCase()}`;

  return (
    <div className="report-page">
      <h2>Sales Analytics</h2>

      <div className="report-controls">
        <div className="report-field">
          Period
          <div className="preset-buttons">
            {PRESETS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`report-btn ${preset === item.key ? "active" : ""}`}
                onClick={() => selectPreset(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {preset === "custom" && (
          <>
            <label className="report-field">
              From
              <input
                type="date"
                value={start}
                max={end || today}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="report-field">
              To
              <input
                type="date"
                value={end}
                min={start}
                max={today}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </>
        )}

        <label className="report-field">
          Group by
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            {Object.entries(GROUPS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="report-field">
          Show on graph
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {Object.entries(METRICS).map(([key, info]) => (
              <option key={key} value={key}>
                {info.label}
              </option>
            ))}
          </select>
        </label>

        {groupBy === "product" && (
          <label className="report-field">
            Products shown
            <select
              value={top}
              onChange={(e) => setTop(Number(e.target.value))}
            >
              {[5, 10, 20].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="report-field">
          Export
          <button
            type="button"
            className="report-btn primary"
            onClick={exportCsv}
          >
            Download CSV
          </button>
        </div>
      </div>

      <div className="report-saved">
        <input
          type="text"
          placeholder="Name this report setup..."
          value={saveName}
          maxLength={40}
          onChange={(e) => setSaveName(e.target.value)}
        />
        <button type="button" className="report-btn" onClick={saveCurrent}>
          Save setup
        </button>
        {saved.map((item) => (
          <span className="saved-chip" key={item.name}>
            <button type="button" onClick={() => applySaved(item)}>
              {item.name}
            </button>
            <button
              type="button"
              className="saved-remove"
              aria-label={`Delete ${item.name}`}
              onClick={() => persist(saved.filter((s) => s.name !== item.name))}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {error && <p className="report-error">{error}</p>}

      {totals && (
        <div className="report-cards">
          <div className="report-card">
            <span>Total revenue</span>
            <strong>{peso(totals.revenue)}</strong>
          </div>
          <div className="report-card">
            <span>Orders</span>
            <strong>{totals.orders}</strong>
          </div>
          <div className="report-card">
            <span>Items sold</span>
            <strong>{totals.items_sold}</strong>
          </div>
          <div className="report-card">
            <span>Average ticket</span>
            <strong>{peso(totals.avg_ticket)}</strong>
          </div>
        </div>
      )}

      <div className="report-panel">
        <h3>{chartTitle}</h3>
        {loading ? (
          <p className="chart-empty">Loading...</p>
        ) : (
          <BarChart
            rows={rows}
            valueKey={metric}
            format={metricInfo.format}
            labelFormat={labelFormat}
          />
        )}
      </div>

      {rows.length > 0 && (
        <div className="report-panel">
          <h3>Details</h3>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>{GROUPS[groupBy]}</th>
                  <th>Revenue</th>
                  <th>Orders</th>
                  <th>Items sold</th>
                  <th>Avg ticket</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{peso(row.revenue)}</td>
                    <td>{row.orders}</td>
                    <td>{row.items_sold}</td>
                    <td>{peso(row.avg_ticket)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

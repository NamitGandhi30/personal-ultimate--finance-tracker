"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthGate, useAuth } from "../auth-client";
import { ReceiptScanner } from "../receipt-scanner";
import "../workspace.css";

type ForecastPoint = { date: string; amount: number };
type CategoryPressure = { category: string; amount: number; share: number };

type ForecastResponse = {
  model: string;
  horizon_days: number;
  projected_total: number;
  confidence: number;
  trend: "rising" | "falling" | "flat";
  peak_day: ForecastPoint | null;
  points: ForecastPoint[];
  category_pressure: CategoryPressure[];
  insights: string[];
};

type MonthlyPoint = { month: string; amount: number };
type CategoryRanking = { category: string; amount: number };

type HistoricalInsightsResponse = {
  monthly: MonthlyPoint[];
  category_trends: { category: string; points: MonthlyPoint[] }[];
  top_categories: CategoryRanking[];
  month_over_month: { change_percent: number; direction: "up" | "down" | "flat" };
  insights: string[];
};

type Trip = {
  id: number;
  name: string;
  destination: string;
  budget: number;
  created_at: string;
};

export default function InsightsPage() {
  const auth = useAuth();
  const { token, username, sessionReady, login, register, logout, authFetch } = auth;
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [history, setHistory] = useState<HistoricalInsightsResponse | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    if (!token) return;

    async function loadInsights() {
      try {
        const [forecastResponse, historyResponse, tripsResponse] = await Promise.all([
          authFetch("/insights/forecast", { cache: "no-store" }),
          authFetch("/insights/history", { cache: "no-store" }),
          authFetch("/trips", { cache: "no-store" }),
        ]);
        if (!forecastResponse.ok || !historyResponse.ok || !tripsResponse.ok) throw new Error("API unavailable");
        setForecast((await forecastResponse.json()) as ForecastResponse);
        setHistory((await historyResponse.json()) as HistoricalInsightsResponse);
        setTrips((await tripsResponse.json()) as Trip[]);
        setApiStatus("online");
      } catch {
        setApiStatus("offline");
      } finally {
        setIsLoading(false);
      }
    }

    loadInsights();
  }, [token, authFetch]);

  const combinedInsights = useMemo(
    () => [...(forecast?.insights ?? []), ...(history?.insights ?? [])],
    [forecast, history],
  );

  return (
    <AuthGate
      token={token}
      username={username}
      sessionReady={sessionReady}
      onLogin={login}
      onRegister={register}
      onLogout={logout}
    >
      <main className="workspace">
        <section className="hero">
          <div>
            <Link className="back-link" href="/">
              Back to dashboard
            </Link>
            <p className="eyebrow">Forward-looking</p>
            <h1>Insights & forecast</h1>
            <p className="subcopy">
              Spending forecasts, historical trends, and receipt scanning so you can plan ahead instead of just
              looking back.
            </p>
          </div>
          <div className="status-card" aria-label={`API status ${apiStatus}`}>
            <span className={`status-dot ${apiStatus}`} />
            <span>FastAPI {apiStatus}</span>
          </div>
        </section>

        <ReceiptScanner authFetch={authFetch} trips={trips} onAdded={() => {}} />

        {isLoading ? (
          <p className="empty-state">Loading insights...</p>
        ) : (
          <>
            <section className="metrics">
              <Metric label="30-day projection" value={formatMoney(forecast?.projected_total ?? 0)} tone="blue" />
              <Metric
                label="Forecast confidence"
                value={`${Math.round((forecast?.confidence ?? 0) * 100)}%`}
                tone="green"
              />
              <Metric label="Spend trend" value={trendLabel(forecast?.trend)} tone="amber" />
              <Metric
                label="Month over month"
                value={`${monthOverMonthSign(history?.month_over_month.direction)}${Math.abs(
                  history?.month_over_month.change_percent ?? 0,
                )}%`}
                tone="ink"
              />
            </section>

            <div className="uniform-grid insights-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Forecast</p>
                    <h2>Next {forecast?.horizon_days ?? 30} days</h2>
                  </div>
                </div>
                <ForecastChart points={forecast?.points ?? []} peakDay={forecast?.peak_day ?? null} />
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Pressure</p>
                    <h2>Category pressure (30d)</h2>
                  </div>
                </div>
                <CategoryPressureList items={forecast?.category_pressure ?? []} />
              </div>
            </div>

            <div className="uniform-grid insights-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">History</p>
                    <h2>Monthly spend</h2>
                  </div>
                </div>
                <MonthlyBarChart points={history?.monthly ?? []} />
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Ranking</p>
                    <h2>Top categories all-time</h2>
                  </div>
                </div>
                <CategoryRankingList items={history?.top_categories ?? []} />
              </div>
            </div>

            <div className="panel insights-callouts">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Takeaways</p>
                  <h2>What this means</h2>
                </div>
              </div>
              {combinedInsights.length === 0 ? (
                <p className="empty-state">Add more transactions to unlock tailored insights.</p>
              ) : (
                <ul>
                  {combinedInsights.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>
    </AuthGate>
  );
}

function ForecastChart({ points, peakDay }: { points: ForecastPoint[]; peakDay: ForecastPoint | null }) {
  if (points.length === 0) {
    return <p className="empty-state">Add expense history to unlock spending forecasts.</p>;
  }

  const width = 600;
  const height = 160;
  const max = Math.max(...points.map((point) => point.amount), 1);
  const stepX = width / Math.max(points.length - 1, 1);
  const coords = points.map((point, idx) => {
    const x = idx * stepX;
    const y = height - (point.amount / max) * (height - 12) - 6;
    return [x, y] as const;
  });
  const pathD = coords.map(([x, y], idx) => `${idx === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L${width} ${height} L0 ${height} Z`;
  const peakIndex = peakDay ? points.findIndex((point) => point.date === peakDay.date) : -1;

  return (
    <div className="forecast-chart">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="160" preserveAspectRatio="none">
        <defs>
          <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#forecastGradient)" />
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
        {peakIndex >= 0 && <circle cx={coords[peakIndex][0]} cy={coords[peakIndex][1]} r="4" fill="#f59e0b" />}
      </svg>
      <div className="forecast-chart-labels">
        <span>{points[0].date}</span>
        {peakDay && (
          <span className="forecast-peak-label">
            Peak {formatMoney(peakDay.amount)} on {peakDay.date}
          </span>
        )}
        <span>{points[points.length - 1].date}</span>
      </div>
    </div>
  );
}

function CategoryPressureList({ items }: { items: CategoryPressure[] }) {
  if (items.length === 0) {
    return <p className="empty-state">No recent expenses to weigh categories against.</p>;
  }

  return (
    <div className="pressure-list">
      {items.map((item) => (
        <div className="pressure-item" key={item.category}>
          <div className="pressure-item-row">
            <span>{item.category}</span>
            <span>
              {formatMoney(item.amount)} &bull; {Math.round(item.share * 100)}%
            </span>
          </div>
          <div className="progress-track-bg">
            <div className="progress-track-fill" style={{ width: `${Math.round(item.share * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthlyBarChart({ points }: { points: MonthlyPoint[] }) {
  if (points.length === 0) {
    return <p className="empty-state">No expense history yet.</p>;
  }

  const recent = points.slice(-6);
  const max = Math.max(...recent.map((point) => point.amount), 1);

  return (
    <>
      <div className="bar-chart-container">
        {recent.map((point) => (
          <div className="chart-bar-group" key={point.month}>
            <div className="bar-dual-tracks">
              <div
                className="bar-track-single expenses month-bar"
                style={{ height: `${Math.max(4, (point.amount / max) * 100)}%` }}
                title={`${point.month}: ${formatMoney(point.amount)}`}
              />
            </div>
            <span className="bar-month-label">{point.month.slice(5)}</span>
          </div>
        ))}
      </div>
      <div className="bar-legend-inline">
        <div className="legend-label-group">
          <span className="legend-dot" style={{ backgroundColor: "#f59e0b" }} />
          <span>Monthly spend</span>
        </div>
      </div>
    </>
  );
}

function CategoryRankingList({ items }: { items: CategoryRanking[] }) {
  if (items.length === 0) {
    return <p className="empty-state">No historical spend recorded yet.</p>;
  }

  return (
    <div className="ranking-list">
      {items.map((item, idx) => (
        <div className="ranking-item" key={item.category}>
          <span>
            <span className="ranking-rank">{String(idx + 1).padStart(2, "0")}</span>
            {item.category}
          </span>
          <span>{formatMoney(item.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "blue" | "amber" | "green" | "ink" }) {
  return (
    <article className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function trendLabel(trend?: ForecastResponse["trend"]) {
  if (trend === "rising") return "Rising";
  if (trend === "falling") return "Falling";
  if (trend === "flat") return "Stable";
  return "—";
}

function monthOverMonthSign(direction?: HistoricalInsightsResponse["month_over_month"]["direction"]) {
  if (direction === "up") return "+";
  if (direction === "down") return "-";
  return "";
}

function formatMoney(value: number) {
  return `Rs ${Math.round(value).toLocaleString("en-IN")}`;
}

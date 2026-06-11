"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGate, useAuth } from "./auth-client";
import { EditableTransactionRow, TransactionPayload } from "./transaction-row";
import { CustomDatePicker } from "./custom-date-picker";
import "./workspace.css";

type Transaction = {
  id: number;
  amount: number;
  description: string;
  category: string;
  merchant: string;
  date: string;
  is_income: boolean;
  trip_id?: number | null;
  is_fixed?: boolean;
  fixed_id?: number | null;
  status?: string;
  occurrence_date?: string | null;
};

type CreateTransaction = Omit<Transaction, "id" | "date"> & { date?: string };

type Trip = {
  id: number;
  name: string;
  destination: string;
  budget: number;
  created_at: string;
};

const initialSeedDate = "2026-05-26T00:00:00.000Z";

const seedTransactions: Transaction[] = [
  {
    id: 1,
    amount: 250,
    description: "Lunch at Swiggy",
    category: "Food",
    merchant: "Swiggy",
    date: initialSeedDate,
    is_income: false,
  },
  {
    id: 2,
    amount: 800,
    description: "Petrol",
    category: "Transport",
    merchant: "Fuel",
    date: "2026-05-25T00:00:00.000Z",
    is_income: false,
  },
  {
    id: 3,
    amount: 50000,
    description: "Salary",
    category: "Income",
    merchant: "Employer",
    date: "2026-05-23T00:00:00.000Z",
    is_income: true,
  },
];

export default function Home() {
  const auth = useAuth();
  const { token, username, sessionReady, login, register, logout, authFetch } = auth;
  const [quickEntry, setQuickEntry] = useState("");
  const [selectedTripId, setSelectedTripId] = useState("");
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    if (!token) return;

    async function loadWorkspace() {
      try {
        const [transactionsResponse, tripsResponse] = await Promise.all([
          authFetch("/transactions", { cache: "no-store" }),
          authFetch("/trips", { cache: "no-store" }),
        ]);
        if (!transactionsResponse.ok || !tripsResponse.ok) throw new Error("API unavailable");
        setTransactions((await transactionsResponse.json()) as Transaction[]);
        setTrips((await tripsResponse.json()) as Trip[]);
        setApiStatus("online");
      } catch {
        setApiStatus("offline");
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkspace();
  }, [token, authFetch]);

  const monthSpend = useMemo(
    () => transactions.filter((item) => !item.is_income).reduce((sum, item) => sum + item.amount, 0),
    [transactions],
  );
  const monthIncome = useMemo(
    () => transactions.filter((item) => item.is_income).reduce((sum, item) => sum + item.amount, 0),
    [transactions],
  );
  const todaySpend = useMemo(() => {
    const today = new Date().toDateString();
    return transactions
      .filter((item) => !item.is_income && new Date(item.date).toDateString() === today)
      .reduce((sum, item) => sum + item.amount, 0);
  }, [transactions]);
  const categoryTotals = useMemo(() => {
    return transactions.reduce<Record<string, number>>((totals, transaction) => {
      if (transaction.is_income) return totals;
      totals[transaction.category] = (totals[transaction.category] ?? 0) + transaction.amount;
      return totals;
    }, {});
  }, [transactions]);
  const tripSpendTotals = useMemo(() => {
    return transactions.reduce<Record<number, number>>((totals, transaction) => {
      if (transaction.is_income || !transaction.trip_id) return totals;
      totals[transaction.trip_id] = (totals[transaction.trip_id] ?? 0) + transaction.amount;
      return totals;
    }, {});
  }, [transactions]);
  const tripNames = useMemo(() => {
    return trips.reduce<Record<number, string>>((names, trip) => {
      names[trip.id] = trip.name;
      return names;
    }, {});
  }, [trips]);
  const generalTransactions = useMemo(() => {
    return transactions.filter((transaction) => transaction.is_income || !transaction.trip_id);
  }, [transactions]);
  const tripSpend = useMemo(() => {
    return Object.values(tripSpendTotals).reduce((sum, value) => sum + value, 0);
  }, [tripSpendTotals]);

  const monthlyBreakdown = useMemo(() => {
    const result: {
      year: number;
      month: number;
      label: string;
      income: number;
      spend: number;
    }[] = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      result.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleDateString("en-US", { month: "short" }),
        income: 0,
        spend: 0,
      });
    }

    transactions.forEach((t) => {
      const txDate = new Date(t.date);
      const txYear = txDate.getFullYear();
      const txMonth = txDate.getMonth();

      const target = result.find((r) => r.year === txYear && r.month === txMonth);
      if (target) {
        if (t.is_income) {
          target.income += t.amount;
        } else {
          target.spend += t.amount;
        }
      }
    });

    const maxVal = Math.max(...result.map((r) => Math.max(r.income, r.spend)), 1);

    return result.map((r) => ({
      ...r,
      incomeHeight: r.income > 0 ? `${Math.max(5, (r.income / maxVal) * 100)}%` : "0%",
      spendHeight: r.spend > 0 ? `${Math.max(5, (r.spend / maxVal) * 100)}%` : "0%",
    }));
  }, [transactions]);

  async function submitQuickEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseQuickEntry(quickEntry);
    if (!parsed) return;
    const tripId = selectedTripId ? Number(selectedTripId) : null;
    const payload: CreateTransaction = {
      ...parsed,
      trip_id: parsed.is_income ? null : tripId,
      date: logDate ? new Date(logDate).toISOString() : new Date().toISOString(),
    };

    const optimisticTransaction: Transaction = {
      ...payload,
      id: Math.max(...transactions.map((item) => item.id), 0) + 1,
      date: payload.date || new Date().toISOString(),
    };

    setQuickEntry("");
    setLogDate(new Date().toISOString().split("T")[0]);
    setTransactions((current) => [optimisticTransaction, ...current]);

    try {
      // Send an empty category so the server auto-categorizes (learned rules +
      // AI); the optimistic row keeps the local keyword guess until then.
      const response = await authFetch("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, category: payload.is_income ? "Income" : "" }),
      });
      if (!response.ok) throw new Error("Failed to save transaction");
      const saved = (await response.json()) as Transaction;
      setTransactions((current) => [saved, ...current.filter((item) => item.id !== optimisticTransaction.id)]);
      setApiStatus("online");
    } catch {
      setApiStatus("offline");
    }
  }

  async function updateTransaction(transactionId: number, payload: TransactionPayload) {
    setTransactions((current) =>
      current.map((transaction) => (transaction.id === transactionId ? { ...transaction, ...payload } : transaction)),
    );

    try {
      const response = await authFetch(`/transactions/${transactionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to update transaction");
      const saved = (await response.json()) as Transaction;
      setTransactions((current) => current.map((transaction) => (transaction.id === saved.id ? saved : transaction)));
      setApiStatus("online");
    } catch {
      setApiStatus("offline");
    }
  }

  async function deleteTransaction(transactionId: number) {
    const previousTransactions = transactions;
    setTransactions((current) => current.filter((transaction) => transaction.id !== transactionId));

    try {
      const response = await authFetch(`/transactions/${transactionId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete transaction");
      setApiStatus("online");
    } catch {
      setTransactions(previousTransactions);
      setApiStatus("offline");
    }
  }

  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None";
  const savingsRate = monthIncome <= 0 ? 0 : Math.max(0, Math.round(((monthIncome - monthSpend) / monthIncome) * 100));

  const currentPortfolioValue = monthIncome - monthSpend;
  const netMonthlyChange = monthIncome - monthSpend;
  const portfolioChangeText = `${netMonthlyChange >= 0 ? "+" : ""}${formatMoney(netMonthlyChange)} this month`;

  // SVG Line Chart computation
  const balanceHistory = useMemo(() => {
    let running = 0; // Starts from 0 for clean accounts
    const sorted = [...transactions]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return sorted.map((t) => {
      running += t.is_income ? t.amount : -t.amount;
      return running;
    });
  }, [transactions]);

  const { pathD, areaD } = useMemo(() => {
    const data = balanceHistory.length > 1 ? balanceHistory : [0, 0, 0, 0, 0];
    const minVal = Math.min(...data) * 0.98;
    const maxVal = Math.max(...data) * 1.02;
    const range = maxVal - minVal || 1;
    const pts = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * 960 + 20;
      const y = 180 - ((val - minVal) / range) * 120 - 10;
      return `${x},${y}`;
    });
    return {
      pathD: `M ${pts.join(" L ")}`,
      areaD: `M 20,180 L ${pts.join(" L ")} L 980,180 Z`,
    };
  }, [balanceHistory]);

  // Donut chart calculations
  const donutSegments = useMemo(() => {
    const total = Object.values(categoryTotals).reduce((a, b) => a + b, 0) || 1;
    let accumulated = 0;
    const colors: Record<string, string> = {
      Housing: "#10b981",
      Food: "#f59e0b",
      Entertainment: "#ef4444",
      Transport: "#3b82f6",
      Shopping: "#ec4899",
      Utilities: "#8b5cf6",
      General: "#6b7280",
    };
    return Object.entries(categoryTotals).map(([cat, val]) => {
      const percent = (val / total) * 100;
      const strokeDasharray = `${percent} ${100 - percent}`;
      const strokeDashoffset = 100 - accumulated + 25;
      accumulated += percent;
      return {
        cat,
        val,
        percent,
        strokeDasharray,
        strokeDashoffset,
        color: colors[cat] ?? "#6b7280",
      };
    });
  }, [categoryTotals]);

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
            <p className="eyebrow">Personal command center</p>
            <h1>Dashboard</h1>
          </div>
          <div className="status-card" aria-label={`API status ${apiStatus}`}>
            <span className={`status-dot ${apiStatus}`} />
            <span>FastAPI {apiStatus}</span>
          </div>
        </section>

        {/* Quick entry box */}
        <form className="quick-entry with-date" onSubmit={submitQuickEntry}>
          <span className="quick-icon">+</span>
          <input
            aria-label="Quick expense entry"
            value={quickEntry}
            onChange={(event) => setQuickEntry(event.target.value)}
            placeholder='Try "250 lunch", "petrol 800", or "earned 50000 salary"'
          />
          <CustomDatePicker
            value={logDate}
            onChange={(val) => setLogDate(val)}
          />
          <select
            aria-label="Attach expense to trip"
            value={selectedTripId}
            onChange={(event) => setSelectedTripId(event.target.value)}
          >
            <option value="">No trip</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.name}
              </option>
            ))}
          </select>
          <button type="submit">Log</button>
        </form>

        {/* Portfolio Value top card */}
        <div className="premium-portfolio-card">
          <div className="portfolio-header">
            <p>Total Portfolio</p>
            <h2>{isLoading ? "..." : formatMoney(currentPortfolioValue)}</h2>
            <p className="portfolio-change">{isLoading ? "Loading your portfolio..." : portfolioChangeText}</p>
          </div>
          <div className="portfolio-graph" style={{ opacity: isLoading ? 0.25 : 1, transition: "opacity 0.3s ease" }}>
            <svg viewBox="0 0 1000 180" width="100%" height="100%" preserveAspectRatio="none">
              <defs>
                <linearGradient id="graphGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d={areaD} fill="url(#graphGradient)" />
              <path d={pathD} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Action Quick Links */}
        <section className="home-actions">
          <Link className="panel action-panel" href="/trips">
            <div>
              <p className="eyebrow">Trips</p>
              <h2>Manage trip workspaces</h2>
            </div>
            <div className="action-panel-metrics">
              <span>{isLoading ? "..." : `${trips.length} trips`}</span>
              <strong>{isLoading ? "..." : formatMoney(tripSpend)}</strong>
            </div>
          </Link>
          <Link className="panel action-panel" href="/daily">
            <div>
              <p className="eyebrow">Daily life</p>
              <h2>General spend</h2>
            </div>
            <div className="action-panel-metrics">
              <span>{isLoading ? "..." : `${generalTransactions.filter((item) => !item.is_income).length} expenses`}</span>
              <strong>{isLoading ? "..." : formatMoney(generalTransactions.filter((item) => !item.is_income).reduce((sum, item) => sum + item.amount, 0))}</strong>
            </div>
          </Link>
        </section>

        {/* 4 column layouts */}
        <div className="dashboard-four-cols">
          {/* Col 1: Spending Breakdown */}
          <div className="col-panel">
            <div className="col-panel-header">
              <h3>Spending Breakdown</h3>
              <p>Top category: {topCategory}</p>
            </div>
            <div className="donut-chart-container">
              {donutSegments.length === 0 ? (
                <p className="empty-state">No expenses</p>
              ) : (
                <>
                  <svg width="100" height="100" viewBox="0 0 42 42">
                    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#222222" strokeWidth="4" />
                    {donutSegments.map((seg, idx) => (
                      <circle
                        key={idx}
                        cx="21"
                        cy="21"
                        r="15.915"
                        fill="transparent"
                        stroke={seg.color}
                        strokeWidth="4.2"
                        strokeDasharray={seg.strokeDasharray}
                        strokeDashoffset={seg.strokeDashoffset}
                      />
                    ))}
                  </svg>
                  <div className="donut-legend">
                    {donutSegments.map((seg, idx) => (
                      <div className="legend-item" key={idx}>
                        <div className="legend-label-group">
                          <span className="legend-dot" style={{ backgroundColor: seg.color }} />
                          <span>{seg.cat}</span>
                        </div>
                        <span className="legend-value">{Math.round(seg.percent)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Col 2: Income vs Expenses */}
          <div className="col-panel">
            <div className="col-panel-header">
              <h3>Income vs Expenses</h3>
              <p>Last 6 months overview</p>
            </div>
            <div className="bar-chart-container" style={{ opacity: isLoading ? 0.35 : 1, transition: "opacity 0.3s" }}>
              {/* Render dynamic bars for last months */}
              {monthlyBreakdown.map((item, idx) => (
                <div className="chart-bar-group" key={idx}>
                  <div className="bar-dual-tracks">
                    <div className="bar-track-single income" style={{ height: item.incomeHeight }} title={`Income: Rs ${item.income}`} />
                    <div className="bar-track-single expenses" style={{ height: item.spendHeight }} title={`Expenses: Rs ${item.spend}`} />
                  </div>
                  <span className="bar-month-label">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="bar-legend-inline">
              <div className="legend-label-group"><span className="legend-dot" style={{ backgroundColor: "#10b981" }} /><span>Income</span></div>
              <div className="legend-label-group"><span className="legend-dot" style={{ backgroundColor: "#f59e0b" }} /><span>Expenses</span></div>
            </div>
          </div>

          {/* Col 3: Budget Status */}
          <div className="col-panel">
            <div className="col-panel-header">
              <h3>Budget Status</h3>
              <p>Active category thresholds</p>
            </div>
            <div className="progress-list">
              <div className="progress-item-horizontal">
                <div className="progress-info-row">
                  <span className="progress-label-main">Food</span>
                  <span className="progress-label-sub">{formatMoney(categoryTotals["Food"] ?? 0)} / Rs 5,000</span>
                </div>
                <div className="progress-track-bg">
                  <div className="progress-track-fill" style={{ width: `${Math.min(100, ((categoryTotals["Food"] ?? 0) / 5000) * 100)}%`, backgroundColor: (categoryTotals["Food"] ?? 0) > 5000 ? "#ef4444" : "#10b981" }} />
                </div>
              </div>
              <div className="progress-item-horizontal">
                <div className="progress-info-row">
                  <span className="progress-label-main">Transport</span>
                  <span className="progress-label-sub">{formatMoney(categoryTotals["Transport"] ?? 0)} / Rs 4,000</span>
                </div>
                <div className="progress-track-bg">
                  <div className="progress-track-fill" style={{ width: `${Math.min(100, ((categoryTotals["Transport"] ?? 0) / 4000) * 100)}%`, backgroundColor: (categoryTotals["Transport"] ?? 0) > 4000 ? "#ef4444" : "#10b981" }} />
                </div>
              </div>
              <div className="progress-item-horizontal">
                <div className="progress-info-row">
                  <span className="progress-label-main">Shopping</span>
                  <span className="progress-label-sub">{formatMoney(categoryTotals["Shopping"] ?? 0)} / Rs 10,000</span>
                </div>
                <div className="progress-track-bg">
                  <div className="progress-track-fill" style={{ width: `${Math.min(100, ((categoryTotals["Shopping"] ?? 0) / 10000) * 100)}%`, backgroundColor: (categoryTotals["Shopping"] ?? 0) > 10000 ? "#ef4444" : "#10b981" }} />
                </div>
              </div>
              <div className="progress-item-horizontal">
                <div className="progress-info-row">
                  <span className="progress-label-main">Utilities</span>
                  <span className="progress-label-sub">{formatMoney(categoryTotals["Utilities"] ?? 0)} / Rs 6,000</span>
                </div>
                <div className="progress-track-bg">
                  <div className="progress-track-fill" style={{ width: `${Math.min(100, ((categoryTotals["Utilities"] ?? 0) / 6000) * 100)}%`, backgroundColor: (categoryTotals["Utilities"] ?? 0) > 6000 ? "#ef4444" : "#10b981" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Col 4: Recent Activity */}
          <div className="col-panel">
            <div className="col-panel-header">
              <h3>Recent Activity</h3>
              <p>Last recorded logs</p>
            </div>
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 4).map((t) => {
                  const isCancelled = t.is_fixed && t.status === "cancelled";
                  return (
                    <tr key={t.id} style={isCancelled ? { opacity: 0.45 } : {}}>
                      <td>
                        <div className="table-desc-cell">
                          <div className="avatar-icon-square">
                            {t.is_fixed ? "🔁" : (t.is_income ? "📥" : "💸")}
                          </div>
                          <div>
                            <strong style={isCancelled ? { textDecoration: "line-through" } : {}}>{t.description}</strong>
                            <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                              {t.category} {t.is_fixed && <span style={{ color: "#a78bfa" }}>&bull; Fixed</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: t.is_income ? "var(--green)" : "inherit", textDecoration: isCancelled ? "line-through" : "none" }}>
                        {t.is_income ? "+" : "-"}{formatMoney(t.amount)}
                      </td>
                      <td>
                        {t.is_fixed ? (
                          <span className={`badge ${t.status === "cancelled" ? "spend" : (t.status === "paid" || t.status === "paid_prior" ? "income" : "pending")}`}>
                            {t.status === "paid_prior" ? "Paid Prior" : (t.status ? t.status.charAt(0).toUpperCase() + t.status.slice(1) : "Scheduled")}
                          </span>
                        ) : (
                          <span className={`badge ${t.id % 2 === 0 ? "pending" : "completed"}`}>
                            {t.id % 2 === 0 ? "Pending" : "Completed"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </AuthGate>
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

function parseQuickEntry(input: string): CreateTransaction | null {
  const amountMatch = input.match(/(\d+(?:\.\d{1,2})?)/);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const description = titleCase(input.replace(amountMatch[1], "").trim() || "Quick entry");
  const lowerInput = input.toLowerCase();
  const isIncome = ["earned", "salary", "income", "paid me"].some((word) => lowerInput.includes(word));

  return {
    amount,
    description,
    category: isIncome ? "Income" : suggestCategory(lowerInput),
    merchant: isIncome ? "Income" : suggestMerchant(lowerInput, description),
    is_income: isIncome,
  };
}

function suggestCategory(input: string) {
  const rules: Record<string, string[]> = {
    Food: ["lunch", "dinner", "breakfast", "coffee", "swiggy", "zomato"],
    Groceries: ["grocery", "groceries", "dmart", "bigbasket", "zepto", "blinkit"],
    Transport: ["petrol", "fuel", "uber", "ola", "cab", "metro", "bus"],
    Housing: ["rent", "maintenance"],
    Utilities: ["electricity", "water", "wifi", "internet", "mobile", "recharge"],
    Shopping: ["amazon", "flipkart", "clothes", "shopping"],
    Subscriptions: ["netflix", "spotify", "prime", "subscription"],
  };

  return Object.entries(rules).find(([, words]) => words.some((word) => input.includes(word)))?.[0] ?? "General";
}

function suggestMerchant(input: string, description: string) {
  const merchants = ["swiggy", "zomato", "dmart", "bigbasket", "zepto", "blinkit", "uber", "ola", "netflix"];
  const merchant = merchants.find((item) => input.includes(item));
  return merchant ? titleCase(merchant) : description.split(/\s+/)[0] || "Manual";
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

function formatMoney(value: number) {
  return `Rs ${Math.round(value).toLocaleString("en-IN")}`;
}

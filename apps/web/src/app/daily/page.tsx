"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuthGate, useAuth } from "../auth-client";
import { EditableTransactionRow, TransactionPayload } from "../transaction-row";
import { CustomDatePicker } from "../custom-date-picker";
import "../workspace.css";

type Transaction = {
  id: number;
  amount: number;
  description: string;
  category: string;
  merchant: string;
  date: string;
  is_income: boolean;
  trip_id?: number | null;
};

type CreateTransaction = Omit<Transaction, "id" | "date"> & { date?: string };

type Trip = {
  id: number;
  name: string;
  destination: string;
  budget: number;
  created_at: string;
};

type TotalItem = {
  label: string;
  value: number;
};

export default function DailyPage() {
  const auth = useAuth();
  const { token, username, sessionReady, login, register, logout, authFetch } = auth;
  const [quickEntry, setQuickEntry] = useState("");
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

  // Date Filtering states
  const [filterPreset, setFilterPreset] = useState<"all" | "today" | "yesterday" | "week" | "month" | "custom">("all");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [activeMonth, setActiveMonth] = useState<Date>(() => new Date());
  const [hoveredDate, setHoveredDate] = useState<{
    dateStr: string;
    spend: number;
    income: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!token) return;

    async function loadDailyWorkspace() {
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
      }
    }

    loadDailyWorkspace();
  }, [token, authFetch]);

  // Dynamic filter logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const txDate = new Date(t.date);
      txDate.setHours(0, 0, 0, 0);

      let start: Date | null = null;
      let end: Date | null = null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (filterPreset === "today") {
        start = today;
        end = today;
      } else if (filterPreset === "yesterday") {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        start = yesterday;
        end = yesterday;
      } else if (filterPreset === "week") {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        start = weekAgo;
        end = today;
      } else if (filterPreset === "month") {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        start = startOfMonth;
        end = today;
      } else if (filterPreset === "custom") {
        if (startDate) {
          start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
        }
        if (endDate) {
          end = new Date(endDate);
          end.setHours(0, 0, 0, 0);
        }
      }

      if (start && end) {
        return txDate >= start && txDate <= end;
      } else if (start) {
        return txDate.getTime() === start.getTime();
      }
      return true;
    });
  }, [transactions, filterPreset, startDate, endDate]);

  const dailyExpenses = useMemo(() => {
    return filteredTransactions.filter((transaction) => !transaction.is_income && !transaction.trip_id);
  }, [filteredTransactions]);
  const dailyIncome = useMemo(() => {
    return filteredTransactions.filter((transaction) => transaction.is_income && !transaction.trip_id);
  }, [filteredTransactions]);
  const tripNames = useMemo(() => {
    return trips.reduce<Record<number, string>>((names, trip) => {
      names[trip.id] = trip.name;
      return names;
    }, {});
  }, [trips]);

  const dailySpend = dailyExpenses.reduce((sum, transaction) => sum + transaction.amount, 0);
  const income = dailyIncome.reduce((sum, transaction) => sum + transaction.amount, 0);
  const avgExpense = dailyExpenses.length === 0 ? 0 : dailySpend / dailyExpenses.length;
  const categoryTotals = useMemo(() => groupTotals(dailyExpenses, "category"), [dailyExpenses]);
  const merchantTotals = useMemo(() => groupTotals(dailyExpenses, "merchant"), [dailyExpenses]);

  // Aggregate stats day-by-day in activeMonth for calendar dot markers
  const dailyStats = useMemo(() => {
    const stats: Record<string, { spend: number; income: number }> = {};
    const year = activeMonth.getFullYear();
    const month = activeMonth.getMonth();

    transactions.forEach((t) => {
      const d = new Date(t.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!stats[dateStr]) {
          stats[dateStr] = { spend: 0, income: 0 };
        }
        if (t.is_income) {
          stats[dateStr].income += t.amount;
        } else {
          stats[dateStr].spend += t.amount;
        }
      }
    });
    return stats;
  }, [transactions, activeMonth]);

  const handlePrevMonth = () => {
    setActiveMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setActiveMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleDateClick = (dateStr: string) => {
    setFilterPreset("custom");
    if (!startDate || (startDate && endDate)) {
      setStartDate(dateStr);
      setEndDate(null);
    } else {
      if (new Date(dateStr) < new Date(startDate)) {
        setStartDate(dateStr);
        setEndDate(startDate);
      } else {
        setEndDate(dateStr);
      }
    }
  };

  const handleDateMouseEnter = (dateStr: string, dayStats: { spend: number; income: number } | undefined, event: React.MouseEvent) => {
    if (!dayStats || (dayStats.spend === 0 && dayStats.income === 0)) {
      setHoveredDate(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const container = event.currentTarget.closest(".calendar-panel");
    const containerRect = container?.getBoundingClientRect();

    const x = rect.left - (containerRect?.left ?? 0) + rect.width / 2;
    const y = rect.top - (containerRect?.top ?? 0) - 8;

    setHoveredDate({
      dateStr,
      spend: dayStats.spend,
      income: dayStats.income,
      x,
      y
    });
  };

  const handleDateMouseLeave = () => {
    setHoveredDate(null);
  };

  const year = activeMonth.getFullYear();
  const month = activeMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const firstDayIndex = (() => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Mon = 0, Tue = 1, ..., Sun = 6
  })();

  const calendarDays = useMemo(() => {
    const days: (string | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    }
    while (days.length % 7 !== 0) {
      days.push(null);
    }
    return days;
  }, [year, month, daysInMonth, firstDayIndex]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const activeFilterText = useMemo(() => {
    if (filterPreset === "all") return "All Time";
    if (filterPreset === "today") return "Today";
    if (filterPreset === "yesterday") return "Yesterday";
    if (filterPreset === "week") return "Last 7 Days";
    if (filterPreset === "month") return "This Month";

    if (startDate && endDate) {
      return `${new Date(startDate).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })} - ${new Date(endDate).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}`;
    }
    if (startDate) {
      return `${new Date(startDate).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}`;
    }
    return "All Time";
  }, [filterPreset, startDate, endDate]);

  async function submitDailyExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseQuickEntry(quickEntry);
    if (!parsed) return;

    const payload: CreateTransaction = {
      ...parsed,
      date: logDate ? new Date(logDate).toISOString() : new Date().toISOString(),
    };

    const optimisticTransaction: Transaction = {
      ...payload,
      id: Math.max(...transactions.map((transaction) => transaction.id), 0) + 1,
      date: payload.date || new Date().toISOString(),
    };

    setQuickEntry("");
    setLogDate(new Date().toISOString().split("T")[0]);
    setTransactions((current) => [optimisticTransaction, ...current]);

    try {
      const response = await authFetch("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to save transaction");
      const saved = (await response.json()) as Transaction;
      setTransactions((current) => [saved, ...current.filter((transaction) => transaction.id !== optimisticTransaction.id)]);
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
      const response = await authFetch(`/transactions/${transactionId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete transaction");
      setApiStatus("online");
    } catch {
      setTransactions(previousTransactions);
      setApiStatus("offline");
    }
  }

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
        <section className="trip-hero">
          <div>
            <Link className="back-link" href="/">
              Back to dashboard
            </Link>
            <p className="eyebrow">Daily life</p>
            <h1>General spend</h1>
            <p className="subcopy">Everything not assigned to a trip lives here.</p>
          </div>
          <div className="status-card" aria-label={`API status ${apiStatus}`}>
            <span className={`status-dot ${apiStatus}`} />
            <span>FastAPI {apiStatus}</span>
          </div>
        </section>

        <form className="quick-entry trip-quick-entry with-date" onSubmit={submitDailyExpense}>
          <span className="quick-icon">+</span>
          <input
            aria-label="Daily expense entry"
            value={quickEntry}
            onChange={(event) => setQuickEntry(event.target.value)}
            placeholder='Try "250 lunch", "petrol 800", or "earned 50000 salary"'
          />
          <CustomDatePicker
            value={logDate}
            onChange={(val) => setLogDate(val)}
          />
          <button type="submit">Add daily</button>
        </form>

        {/* Custom Calendar Panel */}
        <section className="panel calendar-panel">
          <div className="calendar-panel-header">
            <div>
              <p className="eyebrow">Interactive Filter</p>
              <h2>Transaction Calendar</h2>
            </div>
            <div className="filter-presets">
              <button className={filterPreset === "all" ? "preset-btn active" : "preset-btn"} onClick={() => { setFilterPreset("all"); setStartDate(null); setEndDate(null); }}>All Time</button>
              <button className={filterPreset === "today" ? "preset-btn active" : "preset-btn"} onClick={() => { setFilterPreset("today"); setStartDate(null); setEndDate(null); }}>Today</button>
              <button className={filterPreset === "yesterday" ? "preset-btn active" : "preset-btn"} onClick={() => { setFilterPreset("yesterday"); setStartDate(null); setEndDate(null); }}>Yesterday</button>
              <button className={filterPreset === "week" ? "preset-btn active" : "preset-btn"} onClick={() => { setFilterPreset("week"); setStartDate(null); setEndDate(null); }}>7 Days</button>
              <button className={filterPreset === "month" ? "preset-btn active" : "preset-btn"} onClick={() => { setFilterPreset("month"); setStartDate(null); setEndDate(null); }}>This Month</button>
            </div>
          </div>

          <div className="calendar-workspace">
            <div className="calendar-month-selector">
              <button type="button" className="month-nav-btn" onClick={handlePrevMonth} aria-label="Previous Month">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className="current-month-label">{monthNames[month]} {year}</span>
              <button type="button" className="month-nav-btn" onClick={handleNextMonth} aria-label="Next Month">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>

            <div className="calendar-labels">
              <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
            </div>

            <div className="calendar-grid">
              {calendarDays.map((dayStr, idx) => {
                if (!dayStr) {
                  return <div key={`empty-${idx}`} className="calendar-cell empty" />;
                }
                const dayNum = new Date(dayStr).getDate();
                const stats = dailyStats[dayStr];

                const isSelectedStart = startDate === dayStr;
                const isSelectedEnd = endDate === dayStr;
                const isInRange = startDate && endDate && new Date(dayStr) > new Date(startDate) && new Date(dayStr) < new Date(endDate);

                let cellClass = "calendar-cell day";
                if (isSelectedStart) cellClass += " range-start";
                if (isSelectedEnd) cellClass += " range-end";
                if (isInRange) cellClass += " in-range";

                return (
                  <button
                    type="button"
                    key={dayStr}
                    className={cellClass}
                    onClick={() => handleDateClick(dayStr)}
                    onMouseEnter={(e) => handleDateMouseEnter(dayStr, stats, e)}
                    onMouseLeave={handleDateMouseLeave}
                  >
                    <span className="day-number">{dayNum}</span>
                    {stats && (stats.spend > 0 || stats.income > 0) && (
                      <span className={`day-dot ${stats.income > stats.spend ? "profit" : stats.spend > 2500 ? "high-spend" : "spend"}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {hoveredDate && (
            <div
              className="calendar-tooltip"
              style={{
                left: `${hoveredDate.x}px`,
                top: `${hoveredDate.y}px`,
              }}
            >
              <div className="tooltip-title">
                {new Date(hoveredDate.dateStr).toLocaleDateString("en-IN", { weekday: 'long', day: 'numeric', month: 'short' })}
              </div>
              <div className="tooltip-details">
                {hoveredDate.spend > 0 && (
                  <div className="tooltip-row spend">Spent: Rs {Math.round(hoveredDate.spend).toLocaleString("en-IN")}</div>
                )}
                {hoveredDate.income > 0 && (
                  <div className="tooltip-row income">Earned: Rs {Math.round(hoveredDate.income).toLocaleString("en-IN")}</div>
                )}
                <div className="tooltip-row net">
                  Net: {hoveredDate.income - hoveredDate.spend >= 0 ? "+" : ""}
                  Rs {Math.round(hoveredDate.income - hoveredDate.spend).toLocaleString("en-IN")}
                </div>
              </div>
            </div>
          )}

          <div className="calendar-footer">
            <span className="active-filter-badge">Filter Duration: {activeFilterText}</span>
            <div className="legend-row">
              <span className="legend-item"><span className="legend-dot profit" />Net Profit/Income</span>
              <span className="legend-item"><span className="legend-dot spend" />Moderate Spend</span>
              <span className="legend-item"><span className="legend-dot high-spend" />High Spend (&gt;2.5k)</span>
            </div>
          </div>
        </section>


        <section className="metrics" aria-label="Daily metrics">
          <Metric label="Daily spend" value={formatMoney(dailySpend)} tone="blue" />
          <Metric label="Income" value={formatMoney(income)} tone="green" />
          <Metric label="Entries" value={`${dailyExpenses.length}`} tone="ink" />
          <Metric label="Avg expense" value={formatMoney(avgExpense)} tone="amber" />
        </section>

        <section className="uniform-grid">
          <BreakdownPanel title="Daily categories" items={categoryTotals} total={dailySpend} />
          <BreakdownPanel title="Daily merchants" items={merchantTotals} total={dailySpend} />
        </section>

        <section className="panel trip-ledger-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Daily ledger</p>
              <h2>General expenses</h2>
            </div>
          </div>
          <div className="transactions">
            {dailyExpenses.length === 0 ? (
              <p className="empty-state">No daily expenses yet.</p>
            ) : (
              dailyExpenses.map((transaction) => (
                <EditableTransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  trips={trips}
                  tripNames={tripNames}
                  onSave={updateTransaction}
                  onDelete={deleteTransaction}
                />
              ))
            )}
          </div>
        </section>
      </main>
    </AuthGate>
  );
}

function BreakdownPanel({ title, items, total }: { title: string; items: TotalItem[]; total: number }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Daily life</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="bars">
        {items.length === 0 ? (
          <p className="empty-state">No data yet.</p>
        ) : (
          items.map((item) => (
            <div className="bar-row" key={item.label}>
              <div className="bar-label">
                <span>{item.label}</span>
                <strong>{formatMoney(item.value)}</strong>
              </div>
              <div className="bar-track">
                <span style={{ width: `${Math.max(8, (item.value / Math.max(total, 1)) * 100)}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
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

function groupTotals(transactions: Transaction[], key: "category" | "merchant") {
  const totals = transactions.reduce<Record<string, number>>((groups, transaction) => {
    groups[transaction[key]] = (groups[transaction[key]] ?? 0) + transaction.amount;
    return groups;
  }, {});

  return Object.entries(totals)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
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
    trip_id: null,
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

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGate, useAuth } from "./auth-client";
import { EditableTransactionRow, TransactionPayload } from "./transaction-row";
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
};

type CreateTransaction = Omit<Transaction, "id" | "date">;

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
  const { token, username, login, logout, authFetch } = auth;
  const [quickEntry, setQuickEntry] = useState("");
  const [selectedTripId, setSelectedTripId] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>(seedTransactions);
  const [trips, setTrips] = useState<Trip[]>([]);
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

  async function submitQuickEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseQuickEntry(quickEntry);
    if (!parsed) return;
    const tripId = selectedTripId ? Number(selectedTripId) : null;
    const payload: CreateTransaction = {
      ...parsed,
      trip_id: parsed.is_income ? null : tripId,
    };

    const optimisticTransaction: Transaction = {
      ...payload,
      id: Math.max(...transactions.map((item) => item.id), 0) + 1,
      date: new Date().toISOString(),
    };

    setQuickEntry("");
    setTransactions((current) => [optimisticTransaction, ...current]);

    try {
      const response = await authFetch("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  return (
    <AuthGate token={token} username={username} onLogin={login} onLogout={logout}>
      <main className="workspace">
      <section className="hero">
        <div>
          <p className="eyebrow">PUFT web command center</p>
          <h1>Track money at the speed of the spend.</h1>
          <p className="subcopy">
            React and Next.js for the web workspace, FastAPI for the finance brain, and quick-entry as the
            habit-forming core.
          </p>
        </div>
        <div className="status-card" aria-label={`API status ${apiStatus}`}>
          <span className={`status-dot ${apiStatus}`} />
          <span>FastAPI {apiStatus}</span>
        </div>
      </section>

      <form className="quick-entry" onSubmit={submitQuickEntry}>
        <span className="quick-icon">+</span>
        <input
          aria-label="Quick expense entry"
          value={quickEntry}
          onChange={(event) => setQuickEntry(event.target.value)}
          placeholder='Try "250 lunch", "petrol 800", or "earned 50000 salary"'
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

      <section className="metrics" aria-label="Dashboard metrics">
        <Metric label="Today spent" value={formatMoney(todaySpend)} tone="blue" />
        <Metric label="Month spend" value={formatMoney(monthSpend)} tone="amber" />
        <Metric label="Savings rate" value={`${savingsRate}%`} tone="green" />
        <Metric label="Top category" value={topCategory} tone="ink" />
      </section>

      <section className="home-actions">
        <Link className="panel action-panel" href="/trips">
          <div>
            <p className="eyebrow">Trips</p>
            <h2>Manage trip workspaces</h2>
          </div>
          <div className="action-panel-metrics">
            <span>{trips.length} trips</span>
            <strong>{formatMoney(tripSpend)}</strong>
          </div>
        </Link>
        <Link className="panel action-panel" href="/daily">
          <div>
            <p className="eyebrow">Daily life</p>
            <h2>General spend</h2>
          </div>
          <div className="action-panel-metrics">
            <span>{generalTransactions.filter((item) => !item.is_income).length} expenses</span>
            <strong>{formatMoney(generalTransactions.filter((item) => !item.is_income).reduce((sum, item) => sum + item.amount, 0))}</strong>
          </div>
        </Link>
      </section>

      <section className="grid uniform-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Category pulse</p>
              <h2>Month movement</h2>
            </div>
          </div>
          <div className="bars">
            {Object.entries(categoryTotals).map(([category, value]) => (
              <div className="bar-row" key={category}>
                <div className="bar-label">
                  <span>{category}</span>
                  <strong>{formatMoney(value)}</strong>
                </div>
                <div className="bar-track">
                  <span style={{ width: `${Math.max(8, (value / Math.max(monthSpend, 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Main ledger</p>
              <h2>Loose activity</h2>
            </div>
          </div>
          <div className="transactions">
            {generalTransactions.length === 0 ? (
              <p className="empty-state">No loose activity. Trip spending is grouped in trip pages.</p>
            ) : (
              generalTransactions
                .slice(0, 5)
                .map((transaction) => (
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
        </div>
      </section>
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

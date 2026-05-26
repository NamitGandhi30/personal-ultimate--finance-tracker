"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuthGate, useAuth } from "../auth-client";
import { EditableTransactionRow, TransactionPayload } from "../transaction-row";
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

type CreateTransaction = Omit<Transaction, "id" | "date">;

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
  const { token, username, login, logout, authFetch } = auth;
  const [quickEntry, setQuickEntry] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

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

  const dailyExpenses = useMemo(() => {
    return transactions.filter((transaction) => !transaction.is_income && !transaction.trip_id);
  }, [transactions]);
  const dailyIncome = useMemo(() => {
    return transactions.filter((transaction) => transaction.is_income && !transaction.trip_id);
  }, [transactions]);
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

  async function submitDailyExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseQuickEntry(quickEntry);
    if (!parsed) return;

    const optimisticTransaction: Transaction = {
      ...parsed,
      id: Math.max(...transactions.map((transaction) => transaction.id), 0) + 1,
      date: new Date().toISOString(),
    };

    setQuickEntry("");
    setTransactions((current) => [optimisticTransaction, ...current]);

    try {
      const response = await authFetch("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
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
    <AuthGate token={token} username={username} onLogin={login} onLogout={logout}>
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

        <form className="quick-entry trip-quick-entry" onSubmit={submitDailyExpense}>
          <span className="quick-icon">+</span>
          <input
            aria-label="Daily expense entry"
            value={quickEntry}
            onChange={(event) => setQuickEntry(event.target.value)}
            placeholder='Try "250 lunch", "petrol 800", or "earned 50000 salary"'
          />
          <button type="submit">Add daily</button>
        </form>

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

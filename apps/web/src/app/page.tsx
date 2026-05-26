"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import "./workspace.css";

type Transaction = {
  id: number;
  amount: number;
  description: string;
  category: string;
  merchant: string;
  date: string;
  is_income: boolean;
};

type CreateTransaction = Omit<Transaction, "id" | "date">;

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
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
  const [quickEntry, setQuickEntry] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>(seedTransactions);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    async function loadTransactions() {
      try {
        const response = await fetch(`${apiBase}/transactions`, { cache: "no-store" });
        if (!response.ok) throw new Error("API unavailable");
        setTransactions((await response.json()) as Transaction[]);
        setApiStatus("online");
      } catch {
        setApiStatus("offline");
      }
    }

    loadTransactions();
  }, []);

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

  async function submitQuickEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseQuickEntry(quickEntry);
    if (!parsed) return;

    const optimisticTransaction: Transaction = {
      ...parsed,
      id: Math.max(...transactions.map((item) => item.id), 0) + 1,
      date: new Date().toISOString(),
    };

    setQuickEntry("");
    setTransactions((current) => [optimisticTransaction, ...current]);

    try {
      const response = await fetch(`${apiBase}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!response.ok) throw new Error("Failed to save transaction");
      const saved = (await response.json()) as Transaction;
      setTransactions((current) => [saved, ...current.filter((item) => item.id !== optimisticTransaction.id)]);
      setApiStatus("online");
    } catch {
      setApiStatus("offline");
    }
  }

  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None";
  const savingsRate = monthIncome <= 0 ? 0 : Math.max(0, Math.round(((monthIncome - monthSpend) / monthIncome) * 100));

  return (
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
        <button type="submit">Log</button>
      </form>

      <section className="metrics" aria-label="Dashboard metrics">
        <Metric label="Today spent" value={formatMoney(todaySpend)} tone="blue" />
        <Metric label="Month spend" value={formatMoney(monthSpend)} tone="amber" />
        <Metric label="Savings rate" value={`${savingsRate}%`} tone="green" />
        <Metric label="Top category" value={topCategory} tone="ink" />
      </section>

      <section className="grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Category pulse</p>
              <h2>Where the month is moving</h2>
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
              <p className="eyebrow">Recent activity</p>
              <h2>Latest logs</h2>
            </div>
          </div>
          <div className="transactions">
            {transactions.slice(0, 8).map((transaction) => (
              <article className="transaction" key={transaction.id}>
                <span className={transaction.is_income ? "badge income" : "badge spend"}>
                  {transaction.is_income ? "In" : "Out"}
                </span>
                <div>
                  <strong>{transaction.description}</strong>
                  <small>
                    {transaction.category} / {transaction.merchant}
                  </small>
                </div>
                <b className={transaction.is_income ? "money income-text" : "money"}>
                  {transaction.is_income ? "+" : "-"}
                  {formatMoney(transaction.amount)}
                </b>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
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

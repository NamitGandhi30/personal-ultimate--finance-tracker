"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AuthGate, useAuth } from "../../auth-client";
import { EditableTransactionRow, TransactionPayload } from "../../transaction-row";
import { CustomDatePicker } from "../../custom-date-picker";
import "../../workspace.css";

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

export default function TripPage() {
  const auth = useAuth();
  const { token, username, sessionReady, login, register, logout, authFetch } = auth;
  const params = useParams<{ tripId: string }>();
  const tripId = Number(params.tripId);
  const [quickEntry, setQuickEntry] = useState("");
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    if (!token) return;

    async function loadTripWorkspace() {
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

    loadTripWorkspace();
  }, [token, authFetch]);

  const trip = trips.find((item) => item.id === tripId);
  const tripTransactions = useMemo(() => {
    return transactions.filter((transaction) => !transaction.is_income && transaction.trip_id === tripId);
  }, [transactions, tripId]);
  const looseExpenses = useMemo(() => {
    return transactions.filter((transaction) => !transaction.is_income && !transaction.trip_id);
  }, [transactions]);
  const spent = tripTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const budget = trip?.budget ?? 0;
  const remaining = Math.max(0, budget - spent);
  const overBudget = Math.max(0, spent - budget);
  const progress = budget <= 0 ? 0 : Math.min(100, (spent / budget) * 100);
  const avgExpense = tripTransactions.length === 0 ? 0 : spent / tripTransactions.length;
  const categoryTotals = useMemo(() => groupTotals(tripTransactions, "category"), [tripTransactions]);
  const merchantTotals = useMemo(() => groupTotals(tripTransactions, "merchant"), [tripTransactions]);
  const topCategory = categoryTotals[0]?.label ?? "None";
  const topMerchant = merchantTotals[0]?.label ?? "None";
  const tripNames = useMemo(() => {
    return trips.reduce<Record<number, string>>((names, tripItem) => {
      names[tripItem.id] = tripItem.name;
      return names;
    }, {});
  }, [trips]);

  async function submitTripExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseQuickEntry(quickEntry);
    if (!parsed || !trip) return;

    const payload: CreateTransaction = {
      ...parsed,
      is_income: false,
      trip_id: trip.id,
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
      current.map((transaction) =>
        transaction.id === transactionId ? { ...transaction, ...payload } : transaction,
      ),
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

  return (
    <AuthGate
      token={token}
      username={username}
      sessionReady={sessionReady}
      onLogin={login}
      onRegister={register}
      onLogout={logout}
    >
      <main className="workspace trip-workspace">
      <section className="trip-hero">
        <div>
          <Link className="back-link" href="/">
            Back to dashboard
          </Link>
          <p className="eyebrow">Trip workspace</p>
          <h1>{trip?.name ?? "Trip"}</h1>
          <p className="subcopy">{trip ? `${trip.destination} budget and spending analytics.` : "Loading trip details."}</p>
        </div>
        <div className="status-card" aria-label={`API status ${apiStatus}`}>
          <span className={`status-dot ${apiStatus}`} />
          <span>FastAPI {apiStatus}</span>
        </div>
      </section>

      <form className="quick-entry trip-quick-entry with-date" onSubmit={submitTripExpense}>
        <span className="quick-icon">+</span>
        <input
          aria-label="Trip expense entry"
          value={quickEntry}
          onChange={(event) => setQuickEntry(event.target.value)}
          placeholder={`Add ${trip?.name ?? "trip"} expense, e.g. "1500 airport cab"`}
        />
        <CustomDatePicker
          value={logDate}
          onChange={(val) => setLogDate(val)}
        />
        <button type="submit">Add to trip</button>
      </form>

      <section className="metrics" aria-label="Trip metrics">
        <Metric label="Trip spent" value={formatMoney(spent)} tone="blue" />
        <Metric label="Budget left" value={formatMoney(remaining)} tone="green" />
        <Metric label="Entries" value={`${tripTransactions.length}`} tone="ink" />
        <Metric label={overBudget > 0 ? "Over budget" : "Avg expense"} value={formatMoney(overBudget || avgExpense)} tone="amber" />
      </section>

      <section className="trip-detail-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Budget path</p>
              <h2>Trip burn rate</h2>
            </div>
          </div>
          <div className="trip-budget-focus">
            <strong>{Math.round(progress)}%</strong>
            <span>{formatMoney(spent)} of {formatMoney(budget)}</span>
            <div className="bar-track trip-progress">
              <span style={{ width: `${Math.max(4, progress)}%` }} />
            </div>
          </div>
        </div>

        <BreakdownPanel title="Category demographics" items={categoryTotals} total={spent} empty="No category data yet." />
        <BreakdownPanel title="Merchant demographics" items={merchantTotals} total={spent} empty="No merchant data yet." />

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Trip identity</p>
              <h2>Top signals</h2>
            </div>
          </div>
          <div className="signal-grid">
            <Signal label="Top category" value={topCategory} />
            <Signal label="Top merchant" value={topMerchant} />
            <Signal label="Loose expenses" value={`${looseExpenses.length}`} />
          </div>
        </div>
      </section>

      <section className="panel trip-ledger-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Trip ledger</p>
            <h2>{trip?.name ?? "Trip"} expenses</h2>
          </div>
        </div>
        <div className="transactions">
          {tripTransactions.length === 0 ? (
            <p className="empty-state">No expenses in this trip yet.</p>
          ) : (
            tripTransactions.map((transaction) => (
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

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Assign later</p>
            <h2>Unassigned expenses</h2>
          </div>
        </div>
        <div className="transactions">
          {looseExpenses.length === 0 ? (
            <p className="empty-state">No unassigned expenses right now.</p>
          ) : (
            looseExpenses.slice(0, 6).map((transaction) => (
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

function BreakdownPanel({ title, items, total, empty }: { title: string; items: TotalItem[]; total: number; empty: string }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Demographics</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="bars">
        {items.length === 0 ? (
          <p className="empty-state">{empty}</p>
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

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <article className="signal">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
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

type TotalItem = {
  label: string;
  value: number;
};

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

  return {
    amount,
    description,
    category: suggestCategory(lowerInput),
    merchant: suggestMerchant(lowerInput, description),
    is_income: false,
  };
}

function suggestCategory(input: string) {
  const rules: Record<string, string[]> = {
    Food: ["lunch", "dinner", "breakfast", "coffee", "swiggy", "zomato"],
    Stay: ["hotel", "hostel", "airbnb", "room", "resort"],
    Transport: ["petrol", "fuel", "uber", "ola", "cab", "metro", "bus", "airport", "flight", "train"],
    Shopping: ["shopping", "souvenir", "gift", "market"],
    Activities: ["ticket", "tour", "museum", "trek", "activity"],
  };

  return Object.entries(rules).find(([, words]) => words.some((word) => input.includes(word)))?.[0] ?? "General";
}

function suggestMerchant(input: string, description: string) {
  const merchants = ["swiggy", "zomato", "uber", "ola", "airbnb", "makemytrip", "irctc"];
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

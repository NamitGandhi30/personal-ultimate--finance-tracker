"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuthGate, useAuth } from "../auth-client";
import "../workspace.css";

type FixedTransaction = {
  id: number;
  amount: number;
  description: string;
  category: string;
  merchant: string;
  is_income: boolean;
  frequency: string;
  day_of_month: number;
  start_date: string;
  end_date?: string | null;
};

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

type CreateFixedTransaction = Omit<FixedTransaction, "id" | "start_date"> & { start_date?: string };

export default function FixedPage() {
  const auth = useAuth();
  const { token, username, sessionReady, login, register, logout, authFetch } = auth;

  const [fixedTransactions, setFixedTransactions] = useState<FixedTransaction[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

  // Form State
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Utilities");
  const [merchant, setMerchant] = useState("");
  const [isIncome, setIsIncome] = useState(false);
  const [frequency, setFrequency] = useState("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");

  async function loadWorkspaceData() {
    try {
      const [fixedRes, txsRes] = await Promise.all([
        authFetch("/fixed-transactions", { cache: "no-store" }),
        authFetch("/transactions", { cache: "no-store" }),
      ]);
      if (!fixedRes.ok || !txsRes.ok) throw new Error("API unavailable");
      
      setFixedTransactions((await fixedRes.json()) as FixedTransaction[]);
      setTransactions((await txsRes.json()) as Transaction[]);
      setApiStatus("online");
    } catch {
      setApiStatus("offline");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadWorkspaceData();
  }, [token]);

  // Aggregate monthly fixed metrics based on active templates
  const { monthlyFixedIncome, monthlyFixedExpenses, netFixedCashflow } = useMemo(() => {
    let incomeSum = 0;
    let expenseSum = 0;

    fixedTransactions.forEach((item) => {
      let monthlyFactor = 1;
      if (item.frequency === "weekly") {
        monthlyFactor = 4.33;
      } else if (item.frequency === "yearly") {
        monthlyFactor = 1 / 12;
      }

      const totalVal = item.amount * monthlyFactor;

      if (item.is_income) {
        incomeSum += totalVal;
      } else {
        expenseSum += totalVal;
      }
    });

    return {
      monthlyFixedIncome: Math.round(incomeSum),
      monthlyFixedExpenses: Math.round(expenseSum),
      netFixedCashflow: Math.round(incomeSum - expenseSum),
    };
  }, [fixedTransactions]);

  // Filter virtual transactions to show current month's projected auto-pays
  const currentMonthOccurrences = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

    return transactions.filter((t) => {
      if (!t.is_fixed) return false;
      const tDate = new Date(t.date);
      return tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [transactions]);

  async function submitCreateFixed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amt = Number(amount);
    if (!description.trim() || isNaN(amt) || amt <= 0) return;

    const payload: CreateFixedTransaction = {
      description: description.trim(),
      amount: amt,
      category,
      merchant: merchant.trim() || "Auto",
      is_income: isIncome,
      frequency,
      day_of_month: Number(dayOfMonth) || 1,
      start_date: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
      end_date: endDate ? new Date(endDate).toISOString() : null,
    };

    setIsLoading(true);

    try {
      const response = await authFetch("/fixed-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to create fixed transaction");
      
      // Reset inputs
      setDescription("");
      setAmount("");
      setMerchant("");
      setEndDate("");

      await loadWorkspaceData();
    } catch {
      setApiStatus("offline");
      setIsLoading(false);
    }
  }

  async function deleteFixed(id: number) {
    setIsLoading(true);
    try {
      const response = await authFetch(`/fixed-transactions/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      await loadWorkspaceData();
    } catch {
      setApiStatus("offline");
      setIsLoading(false);
    }
  }

  async function saveTransactionOverride(fixedId: number, occurrenceDate: string, status: string, actualDate?: string | null) {
    try {
      const response = await authFetch("/fixed-transactions/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fixed_transaction_id: fixedId,
          occurrence_date: occurrenceDate,
          status,
          actual_date: actualDate ? new Date(actualDate).toISOString() : null,
        }),
      });
      if (!response.ok) throw new Error("Failed to save override");

      await loadWorkspaceData();
    } catch {
      setApiStatus("offline");
    }
  }

  function formatMoney(value: number) {
    return `Rs ${value.toLocaleString("en-IN")}`;
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
            <p className="eyebrow">Recurrent Payments</p>
            <h1>Fixed Auto-Pays</h1>
            <p className="subcopy">
              Manage autopays, EMIs, salaries, SIPs, and status updates for scheduled occurrences.
            </p>
          </div>
          <div className="status-card" aria-label={`API status ${apiStatus}`}>
            <span className={`status-dot ${apiStatus}`} />
            <span>FastAPI {apiStatus}</span>
          </div>
        </section>

        {/* Cashflow Overview Metrics */}
        <section className="metrics" style={{ marginTop: "24px" }}>
          <article className="metric green">
            <span>Fixed Monthly Income</span>
            <strong>{formatMoney(monthlyFixedIncome)}</strong>
          </article>
          <article className="metric amber">
            <span>Fixed Monthly Expenses</span>
            <strong>{formatMoney(monthlyFixedExpenses)}</strong>
          </article>
          <article className={`metric ${netFixedCashflow >= 0 ? "blue" : "ink"}`}>
            <span>Net Fixed Cashflow</span>
            <strong>{formatMoney(netFixedCashflow)}</strong>
          </article>
        </section>

        <div className="fixed-grid">
          {/* Left Column: Form & Active Series */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Set Up Series</p>
                  <h2>Create Auto-Pay</h2>
                </div>
              </div>
              <form className="auth-form" onSubmit={submitCreateFixed} style={{ marginTop: "16px", padding: 0 }}>
                <label>
                  <span>Description</span>
                  <input
                    required
                    placeholder="e.g. Netflix Subscription, House EMI"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>

                <div className="auth-form-grid">
                  <label>
                    <span>Amount (Rs)</span>
                    <input
                      required
                      type="number"
                      min="1"
                      placeholder="500"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Flow Type</span>
                    <select
                      value={isIncome ? "income" : "expense"}
                      onChange={(e) => {
                        const value = e.target.value === "income";
                        setIsIncome(value);
                        setCategory(value ? "Income" : "Utilities");
                      }}
                    >
                      <option value="expense">Expense (Out)</option>
                      <option value="income">Income (In)</option>
                    </select>
                  </label>
                </div>

                <div className="auth-form-grid">
                  <label>
                    <span>Category</span>
                    {isIncome ? (
                      <select value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option value="Income">Income</option>
                        <option value="Investments">Investments</option>
                        <option value="General">General</option>
                      </select>
                    ) : (
                      <select value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option value="Utilities">Utilities</option>
                        <option value="Housing">Housing</option>
                        <option value="Food">Food</option>
                        <option value="Groceries">Groceries</option>
                        <option value="Transport">Transport</option>
                        <option value="Subscriptions">Subscriptions</option>
                        <option value="Entertainment">Entertainment</option>
                        <option value="Shopping">Shopping</option>
                        <option value="General">General</option>
                      </select>
                    )}
                  </label>
                  <label>
                    <span>Merchant</span>
                    <input
                      placeholder="e.g. Netflix, landlord name"
                      value={merchant}
                      onChange={(e) => setMerchant(e.target.value)}
                    />
                  </label>
                </div>

                <div className="auth-form-grid">
                  <label>
                    <span>Frequency</span>
                    <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </label>
                  {frequency === "monthly" && (
                    <label>
                      <span>Day of Month</span>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={dayOfMonth}
                        onChange={(e) => setDayOfMonth(e.target.value)}
                      />
                    </label>
                  )}
                </div>

                <div className="auth-form-grid">
                  <label style={{ display: "flex", flexDirection: "column" }}>
                    <span>Start Date</span>
                    <input
                      required
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "8px",
                        color: "var(--foreground)",
                        padding: "10px",
                        outline: "none",
                        width: "100%",
                      }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column" }}>
                    <span>End Date (Optional)</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "8px",
                        color: "var(--foreground)",
                        padding: "10px",
                        outline: "none",
                        width: "100%",
                      }}
                    />
                  </label>
                </div>

                <button type="submit" style={{ marginTop: "16px", width: "100%" }}>
                  Add Series
                </button>
              </form>
            </section>

            {/* Active Series definition list */}
            <section className="panel">
              <div className="panel-header" style={{ marginBottom: "16px" }}>
                <div>
                  <p className="eyebrow">Series Template Definitions</p>
                  <h2>Active Auto-Pay Series</h2>
                </div>
              </div>
              <div className="fixed-list-panel" style={{ maxHeight: "350px", overflowY: "auto" }}>
                {fixedTransactions.length === 0 ? (
                  <p className="empty-state">No recurring series set up yet.</p>
                ) : (
                  fixedTransactions.map((item) => (
                    <article className="fixed-item-card" key={item.id}>
                      <div className="fixed-item-info">
                        <strong>{item.description}</strong>
                        <small>{item.category} &bull; {item.merchant}</small>
                        <span className="fixed-series-tag">
                          {item.frequency} {item.frequency === "monthly" ? `(Day ${item.day_of_month})` : ""}
                          {item.end_date ? ` (Ends: ${new Date(item.end_date).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })})` : ""}
                        </span>
                      </div>
                      <div className="fixed-item-meta">
                        <b className={`fixed-item-amount ${item.is_income ? "income" : ""}`}>
                          {item.is_income ? "+" : "-"}{formatMoney(item.amount)}
                        </b>
                        <button
                          type="button"
                          className="fixed-delete-btn"
                          onClick={() => deleteFixed(item.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Occurrences Management */}
          <section className="panel" style={{ display: "flex", flexDirection: "column" }}>
            <div className="panel-header" style={{ marginBottom: "16px" }}>
              <div>
                <p className="eyebrow">Occurrence Tracker</p>
                <h2>This Month's Projected Auto-Pays</h2>
              </div>
            </div>

            <div className="fixed-list-panel" style={{ flex: 1, overflowY: "auto", maxHeight: "820px" }}>
              {isLoading ? (
                <p className="empty-state">Loading auto-pays...</p>
              ) : currentMonthOccurrences.length === 0 ? (
                <p className="empty-state">No occurrences scheduled for the current month.</p>
              ) : (
                currentMonthOccurrences.map((item) => {
                  const isCancelled = item.status === "cancelled";
                  return (
                    <article 
                      className={`fixed-item-card ${isCancelled ? "status-cancelled" : ""}`} 
                      key={item.id}
                      style={{ opacity: isCancelled ? 0.45 : 1 }}
                    >
                      <div className="fixed-item-info" style={{ width: "60%" }}>
                        <strong style={{ textDecoration: isCancelled ? "line-through" : "none" }}>
                          {item.description}
                        </strong>
                        <small>{item.category} &bull; {item.merchant}</small>
                        
                        {/* Status Select Box */}
                        <div className="status-override-container">
                          <select
                            aria-label={`Mark status for ${item.description}`}
                            className={`status-override-select ${item.status || "scheduled"}`}
                            value={item.status || "scheduled"}
                            onChange={(e) => saveTransactionOverride(
                              item.fixed_id!,
                              item.occurrence_date!,
                              e.target.value,
                              item.date
                            )}
                          >
                            <option value="scheduled">Scheduled</option>
                            <option value="paid">Paid</option>
                            <option value="paid_prior">Early Pay</option>
                            <option value="delayed">Delay Payment</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          
                          {/* Conditional Inline Date Selector */}
                          {["paid_prior", "delayed"].includes(item.status || "") && (
                            <input
                              type="date"
                              aria-label="Payment completion date"
                              className="status-override-date-picker"
                              value={item.date ? item.date.split("T")[0] : item.occurrence_date!}
                              onChange={(e) => saveTransactionOverride(
                                item.fixed_id!,
                                item.occurrence_date!,
                                item.status!,
                                e.target.value
                              )}
                            />
                          )}
                        </div>
                      </div>
                      <div className="fixed-item-meta" style={{ flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                        <b 
                          className={`fixed-item-amount ${item.is_income ? "income" : ""}`}
                          style={{ textDecoration: isCancelled ? "line-through" : "none" }}
                        >
                          {item.is_income ? "+" : "-"}{formatMoney(isCancelled ? 0 : item.amount)}
                        </b>
                        <span style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                          Scheduled: {new Date(item.occurrence_date! + "T00:00:00").toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </main>
    </AuthGate>
  );
}

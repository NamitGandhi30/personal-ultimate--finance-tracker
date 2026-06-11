"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export type Transaction = {
  id: number;
  amount: number;
  description: string;
  category: string;
  merchant: string;
  date: string;
  is_income: boolean;
  trip_id?: number | null;
  
  // fixed transaction properties
  is_fixed?: boolean;
  fixed_id?: number | null;
  status?: string;
  occurrence_date?: string | null;
};

export type TransactionPayload = Omit<Transaction, "id" | "date" | "is_fixed" | "fixed_id" | "status" | "occurrence_date">;

export type Trip = {
  id: number;
  name: string;
  destination: string;
  border?: number;
  budget: number;
  created_at: string;
};

type EditForm = {
  amount: string;
  description: string;
  category: string;
  merchant: string;
  is_income: boolean;
  trip_id: string;
};

export function EditableTransactionRow({
  transaction,
  trips,
  tripNames,
  onSave,
  onDelete,
  onSaveOverride,
}: {
  transaction: Transaction;
  trips: Trip[];
  tripNames?: Record<number, string>;
  onSave: (transactionId: number, payload: TransactionPayload) => Promise<void>;
  onDelete: (transactionId: number) => Promise<void>;
  onSaveOverride?: (fixedId: number, occurrenceDate: string, status: string, actualDate?: string | null) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [form, setForm] = useState<EditForm>(() => toForm(transaction));

  // State for fixed overrides
  const [statusState, setStatusState] = useState(transaction.status || "scheduled");
  const [actualDateState, setActualDateState] = useState(() => {
    if (transaction.date) {
      return new Date(transaction.date).toISOString().split("T")[0];
    }
    return transaction.occurrence_date || new Date().toISOString().split("T")[0];
  });

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = toPayload(form);
    if (!payload) return;

    await onSave(transaction.id, payload);
    setIsEditing(false);
  }

  async function saveTrip(tripIdValue: string) {
    await onSave(transaction.id, {
      amount: transaction.amount,
      description: transaction.description,
      category: transaction.category,
      merchant: transaction.merchant,
      is_income: transaction.is_income,
      trip_id: tripIdValue ? Number(tripIdValue) : null,
    });
  }

  async function deleteRow() {
    await onDelete(transaction.id);
  }

  async function handleStatusChange(newStatus: string) {
    setStatusState(newStatus);
    if (onSaveOverride && transaction.fixed_id && transaction.occurrence_date) {
      const actualDateVal = ["paid_prior", "delayed"].includes(newStatus)
        ? new Date(actualDateState).toISOString()
        : null;
      await onSaveOverride(transaction.fixed_id, transaction.occurrence_date, newStatus, actualDateVal);
    }
  }

  async function handleActualDateChange(newDateStr: string) {
    setActualDateState(newDateStr);
    if (onSaveOverride && transaction.fixed_id && transaction.occurrence_date) {
      await onSaveOverride(transaction.fixed_id, transaction.occurrence_date, statusState, new Date(newDateStr).toISOString());
    }
  }

  if (isEditing) {
    return (
      <form className="transaction edit" onSubmit={saveEdit}>
        <span className={form.is_income ? "badge income" : "badge spend"}>{form.is_income ? "In" : "Out"}</span>
        <div className="transaction-edit-grid">
          <input
            aria-label="Amount"
            inputMode="decimal"
            value={form.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
          />
          <input
            aria-label="Description"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
          <input
            aria-label="Category"
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
          />
          <input
            aria-label="Merchant"
            value={form.merchant}
            onChange={(event) => setForm((current) => ({ ...current, merchant: event.target.value }))}
          />
          <select
            aria-label="Income or expense"
            value={form.is_income ? "income" : "expense"}
            onChange={(event) =>
              setForm((current) => ({ ...current, is_income: event.target.value === "income" }))
            }
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
          <select
            aria-label="Trip"
            value={form.trip_id}
            onChange={(event) => setForm((current) => ({ ...current, trip_id: event.target.value }))}
          >
            <option value="">No trip</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.name}
              </option>
            ))}
          </select>
        </div>
        <div className="transaction-actions">
          <button type="submit">Save</button>
          <button type="button" className="ghost-button" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  if (transaction.is_fixed) {
    return (
      <article className={`transaction ${statusState === "cancelled" ? "status-cancelled" : ""}`}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span className={transaction.is_income ? "badge income" : "badge spend"}>
            {transaction.is_income ? "In" : "Out"}
          </span>
          <span className="badge fixed">Fixed</span>
        </div>
        <div>
          <strong>{transaction.description}</strong>
          <small>
            {transaction.category} / {transaction.merchant}
          </small>
          <div className="status-override-container">
            <select
              aria-label="Status override"
              className={`status-override-select ${statusState}`}
              value={statusState}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="scheduled">Scheduled</option>
              <option value="paid">Paid</option>
              <option value="paid_prior">Early Pay</option>
              <option value="delayed">Delay Payment</option>
              <option value="cancelled">Cancelled</option>
            </select>
            {["paid_prior", "delayed"].includes(statusState) && (
              <input
                type="date"
                className="status-override-date-picker"
                value={actualDateState}
                onChange={(e) => handleActualDateChange(e.target.value)}
              />
            )}
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              Series on {new Date(transaction.occurrence_date + "T00:00:00").toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}
            </span>
          </div>
        </div>
        <b className={transaction.is_income ? "money income-text" : "money"}>
          {transaction.is_income ? "+" : "-"}
          {formatMoney(statusState === "cancelled" ? 0 : transaction.amount)}
        </b>
        <div className="transaction-actions" style={{ minWidth: "120px" }}>
          <Link href="/fixed" style={{ fontSize: "11px", color: "var(--green)", textDecoration: "underline" }}>
            Edit Series
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="transaction">
      <span className={transaction.is_income ? "badge income" : "badge spend"}>{transaction.is_income ? "In" : "Out"}</span>
      <div>
        <strong>{transaction.description}</strong>
        <small>
          {transaction.category} / {transaction.merchant}
          {transaction.trip_id && tripNames?.[transaction.trip_id] ? ` / ${tripNames[transaction.trip_id]}` : ""}
        </small>
        {!transaction.is_income && trips.length > 0 ? (
          <select
            className="transaction-trip-select"
            aria-label={`Assign ${transaction.description} to trip`}
            value={transaction.trip_id ?? ""}
            onChange={(event) => saveTrip(event.target.value)}
          >
            <option value="">No trip</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <b className={transaction.is_income ? "money income-text" : "money"}>
        {transaction.is_income ? "+" : "-"}
        {formatMoney(transaction.amount)}
      </b>
      {isConfirmingDelete ? (
        <div className="delete-confirm">
          <span>Delete this expense?</span>
          <div className="transaction-actions">
            <button type="button" className="ghost-button" onClick={() => setIsConfirmingDelete(false)}>
              Cancel
            </button>
            <button type="button" className="danger-button" onClick={deleteRow}>
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="transaction-actions">
          <button type="button" onClick={() => setIsEditing(true)}>
            Edit
          </button>
          <button type="button" className="danger-button" onClick={() => setIsConfirmingDelete(true)}>
            Delete
          </button>
        </div>
      )}
    </article>
  );
}

function toForm(transaction: Transaction): EditForm {
  return {
    amount: String(transaction.amount),
    description: transaction.description,
    category: transaction.category,
    merchant: transaction.merchant,
    is_income: transaction.is_income,
    trip_id: transaction.trip_id ? String(transaction.trip_id) : "",
  };
}

function toPayload(form: EditForm): TransactionPayload | null {
  const amount = Number(form.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const description = form.description.trim();
  const category = form.category.trim();
  const merchant = form.merchant.trim();
  if (!description || !category || !merchant) return null;

  return {
    amount,
    description,
    category,
    merchant,
    is_income: form.is_income,
    trip_id: form.is_income || !form.trip_id ? null : Number(form.trip_id),
  };
}

function formatMoney(value: number) {
  return `Rs ${Math.round(value).toLocaleString("en-IN")}`;
}



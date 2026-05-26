"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuthGate, useAuth } from "../auth-client";
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

type Trip = {
  id: number;
  name: string;
  destination: string;
  budget: number;
  created_at: string;
};

type TripForm = {
  name: string;
  destination: string;
  budget: string;
};

export default function TripsPage() {
  const auth = useAuth();
  const { token, username, login, logout, authFetch } = auth;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripForm, setTripForm] = useState<TripForm>({
    name: "",
    destination: "",
    budget: "",
  });
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    if (!token) return;

    async function loadTripsWorkspace() {
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

    loadTripsWorkspace();
  }, [token, authFetch]);

  const tripSpendTotals = useMemo(() => {
    return transactions.reduce<Record<number, number>>((totals, transaction) => {
      if (transaction.is_income || !transaction.trip_id) return totals;
      totals[transaction.trip_id] = (totals[transaction.trip_id] ?? 0) + transaction.amount;
      return totals;
    }, {});
  }, [transactions]);
  const totalTripSpend = Object.values(tripSpendTotals).reduce((sum, value) => sum + value, 0);
  const totalBudget = trips.reduce((sum, trip) => sum + trip.budget, 0);
  const activeTrips = trips.filter((trip) => (tripSpendTotals[trip.id] ?? 0) > 0).length;

  async function submitTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = tripForm.name.trim();
    const destination = tripForm.destination.trim();
    const budget = Number(tripForm.budget || 0);
    if (!name || !destination || !Number.isFinite(budget) || budget < 0) return;

    const optimisticTrip: Trip = {
      id: Math.max(...trips.map((trip) => trip.id), 0) + 1,
      name,
      destination,
      budget,
      created_at: new Date().toISOString(),
    };

    setTrips((current) => [optimisticTrip, ...current]);
    setTripForm({ name: "", destination: "", budget: "" });

    try {
      const response = await authFetch("/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, destination, budget }),
      });
      if (!response.ok) throw new Error("Failed to save trip");
      const saved = (await response.json()) as Trip;
      setTrips((current) => [saved, ...current.filter((trip) => trip.id !== optimisticTrip.id)]);
      setApiStatus("online");
    } catch {
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
          <p className="eyebrow">Trip command</p>
          <h1>Trip workspaces</h1>
          <p className="subcopy">Create trips here, then open each trip for its own ledger and analytics.</p>
        </div>
        <div className="status-card" aria-label={`API status ${apiStatus}`}>
          <span className={`status-dot ${apiStatus}`} />
          <span>FastAPI {apiStatus}</span>
        </div>
      </section>

      <section className="metrics" aria-label="Trip metrics">
        <Metric label="Trips" value={`${trips.length}`} tone="ink" />
        <Metric label="Active trips" value={`${activeTrips}`} tone="green" />
        <Metric label="Trip spend" value={formatMoney(totalTripSpend)} tone="blue" />
        <Metric label="Trip budgets" value={formatMoney(totalBudget)} tone="amber" />
      </section>

      <section className="uniform-grid trips-home-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Trips</p>
              <h2>Create a trip budget</h2>
            </div>
          </div>
          <form className="trip-form stacked" onSubmit={submitTrip}>
            <label>
              <span>Trip name</span>
              <input
                value={tripForm.name}
                onChange={(event) => setTripForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Goa reset"
              />
            </label>
            <label>
              <span>Destination</span>
              <input
                value={tripForm.destination}
                onChange={(event) => setTripForm((current) => ({ ...current, destination: event.target.value }))}
                placeholder="Goa"
              />
            </label>
            <label>
              <span>Budget</span>
              <input
                inputMode="numeric"
                value={tripForm.budget}
                onChange={(event) => setTripForm((current) => ({ ...current, budget: event.target.value }))}
                placeholder="18000"
              />
            </label>
            <button type="submit">Create trip</button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Trip pages</p>
              <h2>Open a trip workspace</h2>
            </div>
          </div>
          <div className="trip-card-grid">
            {trips.length === 0 ? (
              <p className="empty-state">No trips yet. Create one to track travel spend separately.</p>
            ) : (
              trips.map((trip) => {
                const spent = tripSpendTotals[trip.id] ?? 0;
                const remaining = Math.max(0, trip.budget - spent);
                const progress = trip.budget <= 0 ? 0 : Math.min(100, (spent / trip.budget) * 100);

                return (
                  <article className="trip-card" key={trip.id}>
                    <div className="trip-card-top">
                      <div>
                        <strong>{trip.name}</strong>
                        <small>{trip.destination}</small>
                      </div>
                      <b>{formatMoney(spent)}</b>
                    </div>
                    <div className="bar-track trip-progress" aria-label={`${trip.name} trip spend progress`}>
                      <span style={{ width: `${Math.max(4, progress)}%` }} />
                    </div>
                    <div className="trip-card-meta">
                      <span>Budget {formatMoney(trip.budget)}</span>
                      <span>Left {formatMoney(remaining)}</span>
                    </div>
                    <Link className="trip-open-link" href={`/trips/${trip.id}`}>
                      Open trip page
                    </Link>
                  </article>
                );
              })
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

function formatMoney(value: number) {
  return `Rs ${Math.round(value).toLocaleString("en-IN")}`;
}

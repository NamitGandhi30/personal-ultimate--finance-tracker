"use client";

import { ChangeEvent, useState } from "react";

export type ReceiptDraft = {
  amount: number;
  description: string;
  category: string;
  merchant: string;
  is_income: boolean;
  trip_id: number | null;
};

type ReceiptScanResult = {
  filename: string;
  ai_provider: string | null;
  ocr_available: boolean;
  raw_text: string;
  confidence: number;
  needs_review: boolean;
  transaction: ReceiptDraft;
  warnings: string[];
};

type Trip = { id: number; name: string };

type ReceiptScannerProps<T> = {
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
  trips: Trip[];
  onAdded: (transaction: T) => void;
};

export function ReceiptScanner<T = unknown>({ authFetch, trips, onAdded }: ReceiptScannerProps<T>) {
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<ReceiptScanResult | null>(null);
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setSavedMessage(null);
    setResult(null);
    setDraft(null);
    setIsScanning(true);

    try {
      const imageBase64 = await fileToBase64(file);
      const response = await authFetch("/receipts/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: imageBase64, filename: file.name }),
      });
      if (!response.ok) throw new Error("Scan failed");
      const data = (await response.json()) as ReceiptScanResult;
      setResult(data);
      setDraft(data.transaction);
    } catch {
      setError("Could not scan this receipt. Try a clearer photo, or enter the expense manually.");
    } finally {
      setIsScanning(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    if (!(draft.amount > 0)) {
      setError("Enter an amount greater than zero before adding.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await authFetch("/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: draft.amount,
          description: draft.description.trim() || "Receipt expense",
          category: draft.category.trim(),
          merchant: draft.merchant.trim() || "Receipt",
          is_income: draft.is_income,
          trip_id: draft.trip_id,
        }),
      });
      if (!response.ok) throw new Error("Save failed");
      const saved = (await response.json()) as T;
      onAdded(saved);
      setSavedMessage("Added to your transactions.");
      setResult(null);
      setDraft(null);
    } catch {
      setError("Could not save this transaction. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function discard() {
    setResult(null);
    setDraft(null);
    setError(null);
    setSavedMessage(null);
  }

  return (
    <div className="panel receipt-scanner">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Receipts</p>
          <h2>Scan a receipt</h2>
        </div>
        <label className={`receipt-upload-btn ${isScanning ? "is-disabled" : ""}`}>
          {isScanning ? "Scanning..." : "Upload photo"}
          <input type="file" accept="image/*" onChange={handleFile} disabled={isScanning} hidden />
        </label>
      </div>

      {error && <p className="receipt-error">{error}</p>}
      {savedMessage && <p className="receipt-success">{savedMessage}</p>}

      {!result && !isScanning && !error && !savedMessage && (
        <p className="empty-state">Upload a photo of a receipt and we&apos;ll pre-fill an expense from it.</p>
      )}

      {draft && result && (
        <div className="receipt-draft">
          <div className="receipt-draft-meta">
            <span className={`badge ${result.needs_review ? "pending" : "completed"}`}>
              {result.needs_review ? "Needs review" : "Looks good"}
            </span>
            <span className="receipt-confidence">{Math.round(result.confidence * 100)}% confidence</span>
            {result.ai_provider && <span className="receipt-confidence">via {result.ai_provider}</span>}
          </div>

          <div className="receipt-draft-fields">
            <label>
              <span>Amount</span>
              <input
                inputMode="decimal"
                value={draft.amount}
                onChange={(event) =>
                  setDraft((current) => current && { ...current, amount: Number(event.target.value) || 0 })
                }
              />
            </label>
            <label>
              <span>Description</span>
              <input
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => current && { ...current, description: event.target.value })
                }
              />
            </label>
            <label>
              <span>Merchant</span>
              <input
                value={draft.merchant}
                onChange={(event) =>
                  setDraft((current) => current && { ...current, merchant: event.target.value })
                }
              />
            </label>
            <label>
              <span>Category</span>
              <input
                value={draft.category}
                onChange={(event) =>
                  setDraft((current) => current && { ...current, category: event.target.value })
                }
              />
            </label>
            <label>
              <span>Trip</span>
              <select
                value={draft.trip_id ?? ""}
                onChange={(event) =>
                  setDraft(
                    (current) =>
                      current && { ...current, trip_id: event.target.value ? Number(event.target.value) : null },
                  )
                }
              >
                <option value="">No trip</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {result.warnings.length > 0 && (
            <ul className="receipt-warnings">
              {result.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          )}

          <div className="receipt-draft-actions">
            <button type="button" className="receipt-save-btn" onClick={saveDraft} disabled={isSaving}>
              {isSaving ? "Adding..." : "Add expense"}
            </button>
            <button type="button" className="ghost-btn" onClick={discard}>
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

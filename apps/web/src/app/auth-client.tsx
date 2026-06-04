"use client";

import { FormEvent, ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const tokenKey = "puft_auth_token";

type AuthState = {
  token: string | null;
  username: string;
  sessionReady: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (payload: RegisterPayload) => Promise<AuthResult>;
  logout: () => void;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

type AuthResult = {
  ok: boolean;
  message?: string;
};

type RegisterPayload = {
  username: string;
  email: string;
  full_name: string;
  password: string;
  monthly_income: number;
  savings_goal: number;
  preferred_currency: string;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  const clearSession = useCallback(() => {
    window.localStorage.removeItem(tokenKey);
    window.localStorage.removeItem("puft_auth_user");
    setToken(null);
    setUsername("");
  }, []);

  const saveSession = useCallback((nextToken: string, nextUsername: string) => {
    window.localStorage.setItem(tokenKey, nextToken);
    window.localStorage.setItem("puft_auth_user", nextUsername);
    setToken(nextToken);
    setUsername(nextUsername);
  }, []);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(tokenKey);
    const savedUsername = window.localStorage.getItem("puft_auth_user") ?? "";

    if (!savedToken) {
      setSessionReady(true);
      return;
    }

    const tokenToRestore = savedToken;
    let cancelled = false;

    async function restoreSession() {
      try {
        const response = await fetch(`${apiBase}/auth/me`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${tokenToRestore}` },
        });

        if (!response.ok) throw new Error("Stored session expired");

        const profile = (await response.json()) as { username: string };
        if (cancelled) return;
        saveSession(tokenToRestore, profile.username || savedUsername);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setSessionReady(true);
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, [clearSession, saveSession]);

  const login = useCallback(async (nextUsername: string, password: string) => {
    const response = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: nextUsername, password }),
    });
    if (!response.ok) return false;

    const body = (await response.json()) as { token: string; username: string };
    saveSession(body.token, body.username);
    return true;
  }, [saveSession]);

  const register = useCallback(async (payload: RegisterPayload): Promise<AuthResult> => {
    const response = await fetch(`${apiBase}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { detail?: string } | null;
      return { ok: false, message: body?.detail ?? "Could not create this account." };
    }

    const body = (await response.json()) as { token: string; username: string };
    saveSession(body.token, body.username);
    return { ok: true };
  }, [saveSession]);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const authFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const currentToken = token ?? window.localStorage.getItem(tokenKey);
    let targetPath = path;
    const method = (init.method ?? "GET").toUpperCase();
    if (method === "GET") {
      const separator = path.includes("?") ? "&" : "?";
      targetPath = `${path}${separator}_t=${Date.now()}`;
    }

    const response = await fetch(`${apiBase}${targetPath}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      },
    });
    if (response.status === 401) clearSession();
    return response;
  }, [clearSession, token]);

  const value = { token, username, sessionReady, login, register, logout, authFetch };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthGate({
  token,
  username,
  sessionReady,
  onLogin,
  onRegister,
  onLogout,
  children,
}: {
  token: string | null;
  username: string;
  sessionReady: boolean;
  onLogin: (username: string, password: string) => Promise<boolean>;
  onRegister: (payload: RegisterPayload) => Promise<AuthResult>;
  onLogout: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginName, setLoginName] = useState("admin");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [savingsGoal, setSavingsGoal] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [error, setError] = useState("");

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const ok = await onLogin(loginName, password);
    if (!ok) setError("Invalid username or password.");
  }

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const result = await onRegister({
      username: loginName,
      email,
      full_name: fullName,
      password,
      monthly_income: Number(monthlyIncome || 0),
      savings_goal: Number(savingsGoal || 0),
      preferred_currency: currency,
    });
    if (!result.ok) setError(result.message ?? "Could not create this account.");
  }

  if (!sessionReady) {
    return (
      <main className="workspace auth-workspace">
        <section className="panel auth-panel auth-loading-panel">
          <div>
            <p className="eyebrow">Secure session</p>
            <h1>Checking your session</h1>
            <p className="subcopy">Hang tight while PUFT restores your workspace.</p>
          </div>
        </section>
      </main>
    );
  }

  if (!token) {
    const isRegistering = mode === "register";

    return (
      <main className="workspace auth-workspace">
        <section className="panel auth-panel">
          <div>
            <p className="eyebrow">{isRegistering ? "Customer onboarding" : "Protected workspace"}</p>
            <h1>{isRegistering ? "Create your PUFT account" : "Sign in to PUFT"}</h1>
            <p className="subcopy">
              {isRegistering
                ? "Set up a secure account before tracking dashboard, trips, and daily-life spend."
                : "Your dashboard, trips, and daily-life spend are locked behind this login."}
            </p>
            <div className="auth-switch" aria-label="Authentication mode">
              <button className={!isRegistering ? "active" : ""} type="button" onClick={() => setMode("login")}>
                Sign in
              </button>
              <button className={isRegistering ? "active" : ""} type="button" onClick={() => setMode("register")}>
                Create account
              </button>
            </div>
          </div>
          <form className="auth-form" onSubmit={isRegistering ? submitRegister : submitLogin}>
            <label>
              <span>Username</span>
              <input value={loginName} onChange={(event) => setLoginName(event.target.value)} />
            </label>
            {isRegistering ? (
              <>
                <label>
                  <span>Email</span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </label>
                <label>
                  <span>Full name</span>
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
                </label>
              </>
            ) : null}
            <label>
              <span>Password</span>
              <input
                autoComplete={isRegistering ? "new-password" : "current-password"}
                minLength={isRegistering ? 8 : 1}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {isRegistering ? (
              <>
                <div className="auth-form-grid">
                  <label>
                    <span>Monthly income</span>
                    <input
                      min="0"
                      type="number"
                      value={monthlyIncome}
                      onChange={(event) => setMonthlyIncome(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Savings goal</span>
                    <input
                      min="0"
                      type="number"
                      value={savingsGoal}
                      onChange={(event) => setSavingsGoal(event.target.value)}
                    />
                  </label>
                </div>
                <label>
                  <span>Currency</span>
                  <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </label>
              </>
            ) : null}
            {error ? <p className="auth-error">{error}</p> : null}
            <button type="submit">{isRegistering ? "Create account" : "Sign in"}</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="7" height="7" rx="2" fill="#10b981"/>
            <rect x="14" y="3" width="7" height="7" rx="2" fill="#10b981"/>
            <rect x="3" y="14" width="7" height="7" rx="2" fill="#10b981"/>
            <rect x="14" y="14" width="7" height="7" rx="2" fill="#10b981"/>
          </svg>
          <h2>PUFT</h2>
        </div>
        <nav className="sidebar-nav">
          <Link href="/" className={`nav-item ${pathname === "/" ? "active" : ""}`}>
            Dashboard
          </Link>
          <Link href="/daily" className={`nav-item ${pathname === "/daily" ? "active" : ""}`}>
            Transactions
          </Link>
          <Link href="/trips" className={`nav-item ${pathname === "/trips" ? "active" : ""}`}>
            Trips
          </Link>
          <a href="#" className="nav-item">
            Budgets
          </a>
          <a href="#" className="nav-item">
            Settings
          </a>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <span className="username">@{username || "admin"}</span>
          </div>
          <button type="button" className="logout-btn" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="main-content">
        {children}
      </div>
    </div>
  );
}

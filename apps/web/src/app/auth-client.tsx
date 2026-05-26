"use client";

import { FormEvent, ReactNode, useCallback, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const tokenKey = "puft_auth_token";

type AuthState = {
  token: string | null;
  username: string;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

export function useAuth(): AuthState {
  const [token, setToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(tokenKey),
  );
  const [username, setUsername] = useState(() =>
    typeof window === "undefined" ? "" : (window.localStorage.getItem("puft_auth_user") ?? ""),
  );

  const login = useCallback(async (nextUsername: string, password: string) => {
    const response = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: nextUsername, password }),
    });
    if (!response.ok) return false;

    const body = (await response.json()) as { token: string; username: string };
    window.localStorage.setItem(tokenKey, body.token);
    window.localStorage.setItem("puft_auth_user", body.username);
    setToken(body.token);
    setUsername(body.username);
    return true;
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(tokenKey);
    window.localStorage.removeItem("puft_auth_user");
    setToken(null);
    setUsername("");
  }, []);

  const authFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const currentToken = token ?? window.localStorage.getItem(tokenKey);
    return fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${currentToken}`,
      },
    });
  }, [token]);

  return { token, username, login, logout, authFetch };
}

export function AuthGate({
  token,
  username,
  onLogin,
  onLogout,
  children,
}: {
  token: string | null;
  username: string;
  onLogin: (username: string, password: string) => Promise<boolean>;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [loginName, setLoginName] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const ok = await onLogin(loginName, password);
    if (!ok) setError("Invalid username or password.");
  }

  if (!token) {
    return (
      <main className="workspace auth-workspace">
        <section className="panel auth-panel">
          <div>
            <p className="eyebrow">Protected workspace</p>
            <h1>Sign in to PUFT</h1>
            <p className="subcopy">Your dashboard, trips, and daily-life spend are locked behind this login.</p>
          </div>
          <form className="auth-form" onSubmit={submitLogin}>
            <label>
              <span>Username</span>
              <input value={loginName} onChange={(event) => setLoginName(event.target.value)} />
            </label>
            <label>
              <span>Password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {error ? <p className="auth-error">{error}</p> : null}
            <button type="submit">Sign in</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <>
      <div className="session-bar">
        <span>Signed in as {username || "admin"}</span>
        <button type="button" onClick={onLogout}>
          Sign out
        </button>
      </div>
      {children}
    </>
  );
}

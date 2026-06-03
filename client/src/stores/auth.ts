import { create } from "zustand";
import type { User } from "@/types";
import { authApi } from "@/api";
import { setAccessToken } from "@/lib/http";

interface AuthState {
  user: User | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated";
  setSession: (token: string, user: User) => void;
  /** Try to restore a session on app boot using the refresh cookie. */
  bootstrap: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: "idle",

  setSession: (token, user) => {
    setAccessToken(token);
    set({ user, status: "authenticated" });
  },

  bootstrap: async () => {
    set({ status: "loading" });
    try {
      // Exchange the httpOnly refresh cookie for a fresh access token, then
      // load the current user. Done with fetch (not the http client) to avoid
      // the interceptor's own refresh loop during boot.
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("no session");
      const data = await res.json();
      setAccessToken(data.accessToken);
      const user = await authApi.me();
      set({ user, status: "authenticated" });
    } catch {
      setAccessToken(null);
      set({ user: null, status: "unauthenticated" });
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore network errors on logout */
    }
    setAccessToken(null);
    set({ user: null, status: "unauthenticated" });
  },

  setUser: (user) => set({ user }),
}));

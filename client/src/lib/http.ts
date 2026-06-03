import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

// The access token lives in memory only (never localStorage) to limit XSS blast
// radius. The refresh token is an httpOnly cookie the browser sends automatically.
let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const getAccessToken = () => accessToken;

const baseURL = `${import.meta.env.VITE_API_URL ?? ""}/api`;

export const http: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true, // send the refresh cookie
});

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return config;
});

// ---- Silent refresh on 401 -------------------------------------------------
// If a request 401s, try POST /auth/refresh once, then replay the request.
// Concurrent 401s share a single in-flight refresh promise.
let refreshing: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  try {
    const res = await axios.post(
      `${baseURL}/auth/refresh`,
      {},
      { withCredentials: true }
    );
    setAccessToken(res.data.accessToken);
    return true;
  } catch {
    setAccessToken(null);
    return false;
  }
}

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    const isAuthCall = original?.url?.includes("/auth/refresh");

    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      refreshing ??= doRefresh();
      const ok = await refreshing;
      refreshing = null;
      if (ok) {
        original.headers.set("Authorization", `Bearer ${getAccessToken()}`);
        return http(original);
      }
    }
    return Promise.reject(error);
  }
);

/** Normalize backend error messages into Error.message for the UI. */
export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string })?.message ?? err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong";
}

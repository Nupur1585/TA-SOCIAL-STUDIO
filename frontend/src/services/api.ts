import axios from "axios";

/**
 * VITE_API_URL is public (it is baked into the bundle): never put secrets in a VITE_* variable.
 * Development falls back to the local backend. A production build without it uses same-origin "/api",
 * which suits a single host or reverse proxy and can never point at the visitor's own localhost.
 */
const configuredUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/+$/, "");
const baseURL = configuredUrl || (import.meta.env.PROD ? "/api" : "http://localhost:5000/api");

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let unauthorizedHandler: (() => void) | null = null;

/** AuthProvider registers this so an expired session on any API call signs the user out. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error?.config?.url ?? "";
    // Login/me handle their own 401s.
    const isAuthProbe = url.includes("/auth/login") || url.includes("/auth/me");
    if (error?.response?.status === 401 && !isAuthProbe) {
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  }
);

export default api;

import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
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

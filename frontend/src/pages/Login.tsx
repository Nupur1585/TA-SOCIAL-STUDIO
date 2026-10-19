import { useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { BrandLogo } from "../components/ui/BrandLogo";
import { useAuth } from "../context/AuthContext";

/** Only same-origin app paths are allowed as a post-login destination. */
function safeDestination(from: unknown): string {
  const path =
    from && typeof from === "object" && "pathname" in from
      ? String((from as { pathname: unknown }).pathname)
      : "";
  if (!path.startsWith("/") || path.startsWith("//") || path === "/login") {
    return "/dashboard";
  }
  return path;
}

function errorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      return "Cannot reach the server. Please check your connection and try again.";
    }
    const { status } = error.response;
    if (status === 429) {
      return "Too many attempts. Please wait a few minutes and try again.";
    }
    if (status === 400 || status === 401) {
      return "Invalid email or password.";
    }
  }
  return "Something went wrong on our side. Please try again shortly.";
}

export default function Login() {
  const { user, status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const destination = safeDestination(
    (location.state as { from?: unknown } | null)?.from
  );

  if (status === "authenticated" && user) {
    return <Navigate to={destination} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password, remember);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  const inputClass =
    "h-12 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f8fc] px-4">
      <main className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <BrandLogo
              className="h-16 w-16 rounded-2xl text-2xl shadow-lg shadow-blue-900/20"
              gradient="from-blue-500 to-indigo-600"
            />
            <p className="mt-4 text-sm font-bold tracking-widest text-[#0a1a4a]">
              TA SOCIAL STUDIO
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-2xl font-bold text-[#0a1a4a]">Welcome Back</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Sign in to manage your brands, content, and social media.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                />
                Remember me for 30 days
              </label>

              <button
                type="submit"
                disabled={submitting || !email || !password}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In to Dashboard"
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-slate-500">
        &copy; Tech Amdavad LLP &middot; TA Social Studio
      </footer>
    </div>
  );
}

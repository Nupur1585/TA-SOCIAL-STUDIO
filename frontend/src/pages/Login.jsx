import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await api.post(
        "/auth/login",
        formData
      );

      // Save JWT
      localStorage.setItem(
        "token",
        response.data.token
      );

      // Save user
      localStorage.setItem(
        "user",
        JSON.stringify(response.data.user)
      );

      // Go to Home
      navigate("/");

    } catch (error) {
      setError(
        error.response?.data?.message ||
          "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">

      <div className="w-full max-w-md">

        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">
            AI Content Creation
          </h1>

          <p className="text-slate-400 mt-2">
            Welcome back. Let's create something amazing.
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">

          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-white">
              Welcome back
            </h2>

            <p className="text-slate-400 text-sm mt-2">
              Login to continue to your workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>

              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>

              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-medium py-3 transition"
            >
              {loading
                ? "Logging in..."
                : "Login"}
            </button>

          </form>

          {/* Register Link */}
          <p className="text-center text-sm text-slate-400 mt-6">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-indigo-400 hover:text-indigo-300 font-medium transition"
            >
              Create an account
            </Link>
          </p>

        </div>

      </div>

    </div>
  );
}

export default Login;
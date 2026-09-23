import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

function Register() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
    });

    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const validatePassword = (password) => {
        const passwordRegex =
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

        return passwordRegex.test(password);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validatePassword(formData.password)) {
            setError(
                "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
            );
            return;
        }

        <p className="mt-2 text-xs text-slate-500">
            Password must be at least 8 characters and contain an
            uppercase letter, lowercase letter, number, and special
            character.
        </p>

        setMessage("");
        setError("");
        setLoading(true);

        try {
            const response = await api.post(
                "/auth/register",
                formData
            );

            setMessage(response.data.message);

            setFormData({
                name: "",
                email: "",
                password: "",
            });

            setTimeout(() => {
                navigate("/login");
            }, 1000);

        } catch (error) {
            setError(
                error.response?.data?.message ||
                "Registration failed"
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
                        Create smarter. Create faster.
                    </p>
                </div>

                {/* Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">

                    <div className="mb-6">
                        <h2 className="text-2xl font-semibold text-white">
                            Create your account
                        </h2>

                        <p className="text-slate-400 text-sm mt-2">
                            Start creating amazing content with AI.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">

                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Name
                            </label>

                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Enter your name"
                                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                required
                            />
                        </div>

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
                                placeholder="Create a password"
                                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                                required
                            />
                        </div>

                        {/* Success */}
                        {message && (
                            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
                                {message}
                            </div>
                        )}

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
                                ? "Creating Account..."
                                : "Create Account"}
                        </button>

                    </form>

                    {/* Login Link */}
                    <p className="text-center text-sm text-slate-400 mt-6">
                        Already have an account?{" "}
                        <Link
                            to="/login"
                            className="text-indigo-400 hover:text-indigo-300 font-medium transition"
                        >
                            Login
                        </Link>
                    </p>

                </div>

            </div>

        </div>
    );
}

export default Register;
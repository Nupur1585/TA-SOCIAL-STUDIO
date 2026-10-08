import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileText,
  Layers3,
  Sparkles,
  Users,
} from "lucide-react";
import api from "./services/api";

function App() {
  const [backendStatus, setBackendStatus] = useState("Connecting...");

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await api.get("/health");

        if (response.data.success) {
          setBackendStatus("Backend Connected");
        }
      } catch (error) {
        console.error("Backend connection failed:", error);
        setBackendStatus("Backend Offline");
      }
    };

    checkBackend();
  }, []);

  const stats = [
    {
      title: "Active Brands",
      value: "2",
      icon: Layers3,
    },
    {
      title: "Total Content",
      value: "128",
      icon: FileText,
    },
    {
      title: "Upcoming Posts",
      value: "24",
      icon: CalendarDays,
    },
    {
      title: "Pending Approval",
      value: "8",
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Navbar */}
      <header className="border-b border-zinc-800 bg-zinc-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-700 shadow-lg shadow-red-900/30">
              <Sparkles size={21} />
            </div>

            <div>
              <h1 className="text-lg font-bold tracking-tight">
                TA Social Studio
              </h1>
              <p className="text-xs text-zinc-500">
                Social Media Management Platform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  backendStatus === "Backend Connected"
                    ? "bg-green-500"
                    : backendStatus === "Backend Offline"
                      ? "bg-red-500"
                      : "bg-yellow-500"
                }`}
              />

              <span className="text-sm text-zinc-300">
                {backendStatus}
              </span>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-700 font-semibold">
              A
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Welcome */}
        <section className="mb-8">
          <p className="mb-2 text-sm font-medium text-red-500">
            TECH AMDAVAD LLP
          </p>

          <h2 className="text-4xl font-bold tracking-tight">
            Social Media Command Center
          </h2>

          <p className="mt-3 max-w-2xl text-zinc-400">
            Manage multiple brands, plan content, approve posts, monitor
            publishing and analyze your social media performance.
          </p>
        </section>

        {/* Stats */}
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.title}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 transition hover:-translate-y-1 hover:border-red-700/60"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-700/15 text-red-500">
                    <Icon size={21} />
                  </div>

                  <Activity size={18} className="text-zinc-700" />
                </div>

                <p className="text-sm text-zinc-500">{stat.title}</p>

                <p className="mt-1 text-3xl font-bold">{stat.value}</p>
              </div>
            );
          })}
        </section>

        {/* Main grid */}
        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* Activity */}
          <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Recent Activity</h3>
                <p className="text-sm text-zinc-500">
                  Latest activity across your brands
                </p>
              </div>

              <BarChart3 className="text-red-500" />
            </div>

            <div className="space-y-4">
              {[
                "New Instagram content created",
                "Tech Amdavad post approved",
                "NYA weekly calendar updated",
                "New media uploaded",
              ].map((item, index) => (
                <div
                  key={item}
                  className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-700/15 text-red-500">
                    {index + 1}
                  </div>

                  <div>
                    <p className="text-sm font-medium">{item}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {index + 1} hour{index !== 0 ? "s" : ""} ago
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Brands */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold">Your Brands</h3>
              <p className="text-sm text-zinc-500">
                Manage your connected brands
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-700 font-bold">
                    TA
                  </div>

                  <div>
                    <p className="font-semibold">Tech Amdavad</p>
                    <p className="text-xs text-zinc-500">
                      4 platforms connected
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-700 font-bold">
                    NY
                  </div>

                  <div>
                    <p className="font-semibold">Nirvikalp Yoga Academy</p>
                    <p className="text-xs text-zinc-500">
                      4 platforms connected
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button className="mt-5 w-full rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold transition hover:bg-red-600">
              Manage Brands
            </button>
          </div>
        </section>

        {/* Tailwind test */}
        <section className="mt-8 rounded-2xl border border-red-900/50 bg-gradient-to-r from-red-950/50 to-zinc-900 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Sparkles size={18} className="text-red-500" />
                <span className="text-sm font-semibold text-red-400">
                  TAILWIND CSS v4
                </span>
              </div>

              <h3 className="text-xl font-bold">
                Frontend foundation is ready
              </h3>

              <p className="mt-1 text-sm text-zinc-400">
                React + Vite + Tailwind + API connection
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-green-900 bg-green-950/40 px-4 py-3">
              <CheckCircle2 size={18} className="text-green-500" />
              <span className="text-sm font-medium text-green-400">
                System Ready
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
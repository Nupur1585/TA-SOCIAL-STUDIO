import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Sparkles,
  History,
  User,
  LogOut,
  Menu,
  X,
  Plus,
  LayoutDashboard,
} from "lucide-react";
import { useState } from "react";

function Navbar() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navLinkClass = (path) =>
    `flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${isActive(path)
      ? "bg-[#722F37]/20 text-[#B11226]"
      : "text-gray-400 hover:bg-white/5 hover:text-white"
    }`;

  const mobileNavLinkClass = (path) =>
    `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 ${isActive(path)
      ? "bg-[#722F37]/20 text-[#B11226]"
      : "text-gray-400 hover:bg-white/5 hover:text-white"
    }`;

  const closeMobileMenu = () => {
    setMobileMenu(false);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">

      {/* ================= NAVBAR ================= */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur-xl">

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="flex h-16 items-center justify-between">

            {/* ================= LOGO ================= */}
            <Link
              to="/"
              onClick={closeMobileMenu}
              className="group flex items-center gap-3"
            >
              {/* Logo */}
              <div
                className="
      flex h-10 w-10 items-center justify-center
      rounded-xl
      bg-[#B11226]
      shadow-lg shadow-[#B11226]/30
      transition-all duration-300
      group-hover:bg-[#722F37]
      group-hover:scale-105
    "
              >
                <Sparkles
                  size={21}
                  strokeWidth={2.2}
                  className="text-white"
                />
              </div>

              {/* Brand */}
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Lexora{" "}
                  <span className="text-[#B11226]">
                    AI
                  </span>
                </h1>

                <p className="hidden text-xs text-gray-500 sm:block">
                  AI Content Studio
                </p>
              </div>
            </Link>

            {/* ================= DESKTOP NAVIGATION ================= */}
            <div className="hidden items-center gap-1 md:flex">

              {/* Dashboard */}
              <Link
                to="/"
                className={navLinkClass("/")}
              >
                <LayoutDashboard size={17} />
                Home
              </Link>

              {/* Create */}
              <Link
                to="/create"
                className={navLinkClass("/create")}
              >
                <Plus size={17} />
                Create
              </Link>

              {/* History */}
              <Link
                to="/history"
                className={navLinkClass("/history")}
              >
                <History size={17} />
                History
              </Link>

            </div>

            {/* ================= RIGHT SIDE ================= */}
            <div className="hidden items-center gap-3 md:flex">

              {/* Profile */}
              <Link
                to="/profile"
                className={navLinkClass("/profile")}
              >
                <User size={18} />
                Profile
              </Link>

              {/* Logout */}
              <button
                type="button"
                className="
                  flex items-center gap-2 rounded-lg
                  bg-[#722F37] px-4 py-2
                  text-sm font-medium text-white
                  shadow-md shadow-[#722F37]/20
                  transition-all duration-200
                  hover:bg-[#5C1F2B]
                  hover:shadow-[#722F37]/40
                "
              >
                <LogOut size={17} />
                Logout
              </button>

            </div>

            {/* ================= MOBILE MENU BUTTON ================= */}
            <button
              type="button"
              onClick={() => setMobileMenu(!mobileMenu)}
              aria-label="Toggle navigation menu"
              className="
                rounded-lg p-2 text-gray-300
                transition hover:bg-white/5 hover:text-white
                md:hidden
              "
            >
              {mobileMenu ? (
                <X size={24} />
              ) : (
                <Menu size={24} />
              )}
            </button>

          </div>

          {/* ================= MOBILE MENU ================= */}
          {mobileMenu && (
            <div className="border-t border-white/10 py-4 md:hidden">

              <div className="space-y-1">

                {/* Dashboard */}
                <Link
                  to="/"
                  onClick={closeMobileMenu}
                  className={mobileNavLinkClass("/")}
                >
                  <LayoutDashboard size={18} />
                  Home
                </Link>

                {/* Create */}
                <Link
                  to="/create"
                  onClick={closeMobileMenu}
                  className={mobileNavLinkClass("/create")}
                >
                  <Plus size={18} />
                  Create 
                </Link>

                {/* History */}
                <Link
                  to="/history"
                  onClick={closeMobileMenu}
                  className={mobileNavLinkClass("/history")}
                >
                  <History size={18} />
                  History
                </Link>

                {/* Profile */}
                <Link
                  to="/profile"
                  onClick={closeMobileMenu}
                  className={mobileNavLinkClass("/profile")}
                >
                  <User size={18} />
                  Profile
                </Link>

                {/* Logout */}
                <button
                  type="button"
                  className="
                    flex w-full items-center gap-3
                    rounded-lg px-4 py-3
                    text-sm font-medium text-red-400
                    transition hover:bg-red-950/30
                  "
                >
                  <LogOut size={18} />
                  Logout
                </button>

              </div>

            </div>
          )}

        </div>
      </nav>

      {/* ================= PAGE CONTENT ================= */}
      <main>
        <Outlet />
      </main>

    </div>
  );
}

export default Navbar;
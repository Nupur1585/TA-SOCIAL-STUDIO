import { BrowserRouter, Routes, Route, } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Create from "./pages/Create";
import History from "./pages/History";
import Profile from "./pages/Profile";

import Register from "./pages/Register";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Authentication Routes */}
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />

        {/* Common Navbar Layout */}
        <Route element={<ProtectedRoute />}>

          <Route element={<Navbar />}>
           <Route path="/" element={<Home />} />
           <Route path="/create" element={<Create />} />
           <Route path="/history" element={<History />} />
           <Route path="/profile" element={<Profile />} />
          </Route>

        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
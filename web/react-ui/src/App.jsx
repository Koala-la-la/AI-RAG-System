import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Documents from "./pages/Documents";
import Evaluation from "./pages/Evaluation";
import Layout from "./pages/Layout";
import Login from "./pages/Login";
import { getAuth } from "./auth";

function RequireAuth({ children }) {
  const { token } = getAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/app/overview" replace />} />
        <Route path="overview" element={<Dashboard />} />
        <Route path="chat" element={<Chat />} />
        <Route path="documents" element={<Documents />} />
        <Route path="evaluation" element={<Evaluation />} />
      </Route>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

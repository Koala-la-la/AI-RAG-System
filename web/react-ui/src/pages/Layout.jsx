import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { logoutUser } from "../api";
import { clearAuth, getAuth, getLastKb, setLastKb } from "../auth";

export default function Layout() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [authUser, setAuthUser] = useState(auth.user);
  const [authToken, setAuthToken] = useState(auth.token);
  const [kbId, setKbId] = useState(getLastKb());

  useEffect(() => {
    if (!authToken) {
      navigate("/login", { replace: true });
    }
  }, [authToken, navigate]);

  useEffect(() => {
    setLastKb(kbId);
  }, [kbId]);

  const handleLogout = async () => {
    if (authToken) {
      try {
        await logoutUser(authToken);
      } catch (err) {
        // ignore logout error
      }
    }
    clearAuth();
    setAuthToken("");
    setAuthUser("");
    navigate("/login", { replace: true });
  };

  const contextValue = {
    authUser,
    authToken,
    kbId,
    setKbId
  };

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand">AI RAG Lab</div>
        <div className="brand-subtitle">多页面工作台</div>

        <nav className="nav-list">
          <NavLink
            to="/app/chat"
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            对话
          </NavLink>
          <NavLink
            to="/app/documents"
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            文档管理
          </NavLink>
          <NavLink
            to="/app/evaluation"
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            评测
          </NavLink>
        </nav>

        <div className="nav-footer">
          <div className="nav-user">当前账号：{authUser || "未登录"}</div>
          <button className="btn btn-secondary" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div>
            <div className="title">Enterprise RAG Workspace</div>
            <div className="subtitle">检索、管理、评测拆分为独立页面</div>
          </div>
          <div className="kb-control">
            <label>知识库 ID</label>
            <input value={kbId} onChange={(e) => setKbId(e.target.value)} />
          </div>
        </header>

        <main className="app-content">
          <Outlet context={contextValue} />
        </main>
      </div>
    </div>
  );
}

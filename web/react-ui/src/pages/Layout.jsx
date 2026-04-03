import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { logoutUser } from "../api";
import { clearAuth, getAuth, getLastKb, setLastKb } from "../auth";

export default function Layout() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [authUser, setAuthUser] = useState(auth.user);
  const [authToken, setAuthToken] = useState(auth.token);
  const [authTeam, setAuthTeam] = useState(auth.team);
  const [authRole, setAuthRole] = useState(auth.role);
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
    setAuthTeam("platform");
    setAuthRole("member");
    navigate("/login", { replace: true });
  };

  const contextValue = {
    authUser,
    authToken,
    authTeam,
    authRole,
    kbId,
    setKbId
  };

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand">Knowledge Copilot</div>
        <div className="brand-subtitle">企业内部知识库助手</div>

        <nav className="nav-list">
          <NavLink
            to="/app/overview"
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            工作台
          </NavLink>
          <NavLink
            to="/app/chat"
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            问题处理
          </NavLink>
          <NavLink
            to="/app/documents"
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            文档中心
          </NavLink>
          <NavLink
            to="/app/evaluation"
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            质量评测
          </NavLink>
        </nav>

        <div className="nav-footer">
          <div className="nav-user">当前账号：{authUser || "未登录"}</div>
          <div className="nav-user">团队：{authTeam || "platform"}</div>
          <div className="nav-user">角色：{authRole || "member"}</div>
          <button className="btn btn-secondary" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div>
            <div className="title">Enterprise Knowledge Workspace</div>
            <div className="subtitle">以企业内部问题处理为中心，把工作台、问题单、文档治理和质量评测拆分成独立页面</div>
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


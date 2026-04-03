import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { loginUser, registerUser } from "../api";
import { getAuth, setAuth } from "../auth";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [team, setTeam] = useState("platform");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const { token } = getAuth();
    if (token) {
      navigate("/app", { replace: true });
    }
  }, [navigate]);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("请输入用户名和密码。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await loginUser(username.trim(), password.trim());
      setAuth(data.username, data.token, data.team, data.role);
      navigate("/app", { replace: true });
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "登录失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username.trim() || !password.trim()) {
      setError("请输入用户名和密码。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await registerUser(username.trim(), password.trim(), team.trim(), role);
      const data = await loginUser(username.trim(), password.trim());
      setAuth(data.username, data.token, data.team, data.role);
      navigate("/app", { replace: true });
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "注册失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-title">Knowledge Copilot</div>
        <div className="login-subtitle">
          登录后进入企业知识库工作台，围绕内部技术文档、SOP 与 FAQ 进行问答和检索。
        </div>

        <label>用户名</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
        <label>密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label>团队</label>
        <input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="如：platform / payment / infra" />
        <label>角色</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="member">member</option>
          <option value="admin">admin</option>
        </select>

        {error && <div className="login-error">{error}</div>}

        <button className="btn" onClick={handleLogin} disabled={loading}>
          {loading ? "登录中..." : "登录工作台"}
        </button>
        <button className="btn btn-secondary" onClick={handleRegister} disabled={loading}>
          {loading ? "注册中..." : "注册新账号"}
        </button>

        <div className="status-line">
          用户名只允许字母、数字、_、-，长度 3-32；密码至少 6 位。注册时可设置团队与角色，便于演示企业权限隔离。
        </div>
      </div>
    </div>
  );
}

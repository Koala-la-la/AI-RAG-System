import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { loginUser, registerUser } from "../api";
import { getAuth, setAuth } from "../auth";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      setAuth(data.username, data.token);
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
      await registerUser(username.trim(), password.trim());
      const data = await loginUser(username.trim(), password.trim());
      setAuth(data.username, data.token);
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
        <div className="login-title">AI RAG Lab</div>
        <div className="login-subtitle">请登录后进入知识库管理与对话界面</div>

        <label>用户名</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
        <label>密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div className="login-error">{error}</div>}

        <button className="btn" onClick={handleLogin} disabled={loading}>
          {loading ? "登录中..." : "登录"}
        </button>
        <button className="btn btn-secondary" onClick={handleRegister} disabled={loading}>
          {loading ? "注册中..." : "注册新账号"}
        </button>

        <div className="status-line">
          用户名只允许字母、数字、_、-，长度 3-32；密码至少 6 位。
        </div>
      </div>
    </div>
  );
}

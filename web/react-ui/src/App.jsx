import React, { useMemo, useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api";

export default function App() {
  const [userId, setUserId] = useState("user001");
  const [kbId, setKbId] = useState("defaultkb");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "你好，我是企业级 RAG 助手。你可以先上传文档，再开始提问。"
    }
  ]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);

  const canSend = useMemo(() => {
    return question.trim() && userId.trim() && kbId.trim() && !loading;
  }, [question, userId, kbId, loading]);

  const sendQuestion = async () => {
    if (!canSend) return;

    const q = question.trim();

    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuestion("");
    setLoading(true);
    setSources([]);

    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        user_id: userId,
        kb_id: kbId,
        question: q
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.data.answer || "未返回答案"
        }
      ]);
      setSources(res.data.sources || []);
    } catch (err) {
      let msg = "请求失败";
      if (err.response?.data?.detail) {
        msg = err.response.data.detail;
      } else if (err.message) {
        msg = err.message;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `错误：${msg}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async () => {
    if (!file) {
      alert("请先选择文件");
      return;
    }
    if (!userId.trim() || !kbId.trim()) {
      alert("请先填写 user_id 和 kb_id");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", userId);
    formData.append("kb_id", kbId);

    setUploading(true);
    try {
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      alert(`上传成功：${res.data.filename}，切分块数 ${res.data.chunks}`);
    } catch (err) {
      let msg = "上传失败";
      if (err.response?.data?.detail) {
        msg = err.response.data.detail;
      } else if (err.message) {
        msg = err.message;
      }
      alert(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page">
      <div className="sidebar">
        <div className="brand">企业RAG系统</div>

        <div className="panel">
          <div className="panel-title">基础配置</div>
          <label>用户ID</label>
          <input value={userId} onChange={(e) => setUserId(e.target.value)} />
          <label>知识库ID</label>
          <input value={kbId} onChange={(e) => setKbId(e.target.value)} />
        </div>

        <div className="panel">
          <div className="panel-title">上传文档</div>
          <input
            type="file"
            accept=".pdf,.txt,.md"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button className="btn" onClick={uploadFile} disabled={uploading}>
            {uploading ? "上传中..." : "上传到知识库"}
          </button>
        </div>

        <div className="panel">
          <div className="panel-title">文档引用来源</div>
          {sources.length === 0 ? (
            <div className="empty">暂无引用来源</div>
          ) : (
            sources.map((s, idx) => (
              <div className="source-card" key={`${s.source}-${idx}`}>
                <div><b>文件：</b>{s.source}</div>
                <div><b>页码：</b>{s.page}</div>
                <div className="preview">{s.content_preview}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="main">
        <div className="chat-header">
          <div className="title">Enterprise RAG Assistant</div>
          <div className="subtitle">Milvus + Redis + LangGraph + Ollama</div>
        </div>

        <div className="chat-box">
          {messages.map((msg, idx) => (
            <div key={idx} className={`msg-row ${msg.role}`}>
              <div className="msg-bubble">
                <div className="msg-role">{msg.role === "user" ? "你" : "助手"}</div>
                <div className="msg-content">{msg.content}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="msg-row assistant">
              <div className="msg-bubble">
                <div className="msg-role">助手</div>
                <div className="msg-content">正在检索知识库并生成回答...</div>
              </div>
            </div>
          )}
        </div>

        <div className="input-bar">
          <textarea
            placeholder="请输入你的问题，比如：这份文档主要讲了什么？"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendQuestion();
              }
            }}
          />
          <button className="btn send-btn" onClick={sendQuestion} disabled={!canSend}>
            {loading ? "处理中..." : "发送"}
          </button>
        </div>
      </div>
    </div>
  );
}
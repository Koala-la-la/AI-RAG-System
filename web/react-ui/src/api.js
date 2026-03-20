import React, { useEffect, useState } from "react";
import { createKB, listKB, deleteKB, uploadFile, chat } from "./api";

export default function App() {
  const [ownerId, setOwnerId] = useState("user001");
  const [kbId, setKbId] = useState("kb_demo");
  const [kbName, setKbName] = useState("我的知识库");
  const [kbs, setKbs] = useState([]);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadKBs = async () => {
    try {
      const data = await listKB(ownerId);
      setKbs(data.items || []);
      if ((data.items || []).length > 0 && !kbId) {
        setKbId(data.items[0].kb_id);
      }
    } catch (e) {
      alert("加载知识库失败");
    }
  };

  useEffect(() => {
    loadKBs();
  }, []);

  const handleCreateKB = async () => {
    try {
      await createKB({
        kb_id: kbId,
        kb_name: kbName,
        owner_id: ownerId
      });
      alert("知识库创建成功");
      await loadKBs();
    } catch (e) {
      alert(e?.response?.data?.detail || "创建失败");
    }
  };

  const handleDeleteKB = async (targetKbId) => {
    if (!confirm(`确定删除知识库 ${targetKbId} 吗？`)) return;
    try {
      await deleteKB({
        kb_id: targetKbId,
        owner_id: ownerId
      });
      alert("删除成功");
      await loadKBs();
    } catch (e) {
      alert(e?.response?.data?.detail || "删除失败");
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadFile(file, kbId, ownerId);
      alert(`上传成功：${res.file_name}`);
      await loadKBs();
    } catch (e) {
      alert(e?.response?.data?.detail || "上传失败");
    }
  };

  const handleChat = async () => {
    if (!question.trim()) return;

    const currentQuestion = question;
    setMessages((prev) => [...prev, { role: "user", content: currentQuestion }]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await chat({
        user_id: ownerId,
        kb_id: kbId,
        question: currentQuestion
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.answer,
          sources: res.sources || [],
          cached: res.cached
        }
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "请求失败，请检查后端服务。" }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <aside className="sidebar">
        <h1>Enterprise RAG</h1>

        <div className="card">
          <div className="label">用户 ID</div>
          <input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} />
        </div>

        <div className="card">
          <div className="label">知识库 ID</div>
          <input value={kbId} onChange={(e) => setKbId(e.target.value)} />
          <div className="label">知识库名称</div>
          <input value={kbName} onChange={(e) => setKbName(e.target.value)} />
          <button onClick={handleCreateKB}>创建知识库</button>
        </div>

        <div className="card">
          <div className="label">上传 PDF</div>
          <input type="file" accept=".pdf" onChange={handleUpload} />
        </div>

        <div className="card">
          <div className="label">我的知识库</div>
          <div className="kb-list">
            {kbs.map((item) => (
              <div className="kb-item" key={item.kb_id}>
                <div className="kb-head">
                  <strong>{item.kb_name}</strong>
                  <button
                    className="danger"
                    onClick={() => handleDeleteKB(item.kb_id)}
                  >
                    删除
                  </button>
                </div>
                <div className="muted">kb_id: {item.kb_id}</div>
                <div className="muted">文件数: {item.files?.length || 0}</div>
                <button
                  className="secondary"
                  onClick={() => setKbId(item.kb_id)}
                >
                  切换到此知识库
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="chat-header">
          <div>
            <h2>智能问答</h2>
            <p>当前知识库：{kbId}</p>
          </div>
        </div>

        <div className="chat-body">
          {messages.length === 0 && (
            <div className="empty">
              上传 PDF，创建知识库，然后开始提问。
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={msg.role === "user" ? "msg user" : "msg assistant"}
            >
              <div className="role">{msg.role === "user" ? "你" : "AI"}</div>
              <div className="bubble">{msg.content}</div>

              {msg.role === "assistant" && msg.sources?.length > 0 && (
                <div className="sources">
                  <div className="sources-title">
                    参考来源 {msg.cached ? "（缓存命中）" : ""}
                  </div>
                  {msg.sources.map((s, i) => (
                    <div key={i} className="source-item">
                      <div><strong>文件：</strong>{s.file_name}</div>
                      <div><strong>来源：</strong>{s.source}</div>
                      <div><strong>相似度距离：</strong>{s.score}</div>
                      <div className="source-text">{s.text.slice(0, 220)}...</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="chat-input">
          <textarea
            placeholder="输入你的问题..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button onClick={handleChat} disabled={loading}>
            {loading ? "回答中..." : "发送"}
          </button>
        </div>
      </main>
    </div>
  );
}
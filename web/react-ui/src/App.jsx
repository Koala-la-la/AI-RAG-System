import React, { useMemo, useState } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api";
const DEFAULT_ASSISTANT = {
  role: "assistant",
  content: "你好，我是你的 RAG 助手。先上传文档，再用 3 类问题测试：直接问、追问、故意问无关问题。"
};

function formatNumber(value, digits = 4) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toFixed(digits);
}

export default function App() {
  const [userId, setUserId] = useState("user001");
  const [kbId, setKbId] = useState("defaultkb");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([DEFAULT_ASSISTANT]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [uploadSummary, setUploadSummary] = useState(null);

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

      const assistantMessage = {
        role: "assistant",
        content: res.data.answer || "后端没有返回答案。",
        rewrittenQuestion: res.data.rewritten_question || q,
        cached: Boolean(res.data.cached),
        sources: res.data.sources || []
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setSources(assistantMessage.sources);
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "请求失败";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `请求失败：${message}`,
          rewrittenQuestion: q,
          cached: false,
          sources: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async () => {
    if (!file) {
      alert("请先选择文件。");
      return;
    }
    if (!userId.trim() || !kbId.trim()) {
      alert("请先填写 user_id 和 kb_id。");
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

      setUploadSummary({
        filename: res.data.filename,
        documents: res.data.documents,
        sections: res.data.sections,
        chunks: res.data.chunks
      });
      alert(`上传成功：${res.data.filename}，共写入 ${res.data.chunks} 个 chunk。`);
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "上传失败";
      alert(`上传失败：${message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page">
      <aside className="sidebar">
        <div className="brand">AI RAG Lab</div>
        <div className="brand-subtitle">检索链路可观测版</div>

        <div className="panel">
          <div className="panel-title">基础配置</div>
          <label>用户 ID</label>
          <input value={userId} onChange={(e) => setUserId(e.target.value)} />
          <label>知识库 ID</label>
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

          {uploadSummary && (
            <div className="upload-summary">
              <div className="summary-title">最近一次入库</div>
              <div>文件：{uploadSummary.filename}</div>
              <div>文档数：{uploadSummary.documents}</div>
              <div>章节数：{uploadSummary.sections}</div>
              <div>Chunk 数：{uploadSummary.chunks}</div>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">本轮命中来源</div>
          {sources.length === 0 ? (
            <div className="empty">发送一个问题后，这里会显示本轮命中的 chunk 和得分。</div>
          ) : (
            sources.map((source, index) => (
              <div className="source-card" key={`${source.chunk_id || source.source}-${index}`}>
                <div className="source-head">
                  <strong>{source.source}</strong>
                  <span className={`tag ${source.grounded ? "tag-good" : "tag-muted"}`}>
                    {source.grounded ? "grounded" : "candidate"}
                  </span>
                </div>
                <div className="source-meta">页码：{source.page || "-"}</div>
                <div className="source-meta">章节：{source.section_title || "-"}</div>
                <div className="metric-grid">
                  <div>rerank: {formatNumber(source.rerank_score, 3)}</div>
                  <div>hybrid: {formatNumber(source.hybrid_score, 3)}</div>
                  <div>overlap: {source.query_overlap_count ?? 0}</div>
                  <div>semantic: {formatNumber(source.semantic_distance, 3)}</div>
                </div>
                <div className="preview">{source.content_preview}</div>
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="main">
        <div className="chat-header">
          <div>
            <div className="title">Enterprise RAG Assistant</div>
            <div className="subtitle">Hybrid Retrieval + Query Rewrite + Rerank + No-Answer Gating</div>
          </div>
        </div>

        <div className="chat-box">
          {messages.map((msg, idx) => (
            <div key={idx} className={`msg-row ${msg.role}`}>
              <div className="msg-bubble">
                <div className="msg-role">{msg.role === "user" ? "你" : "助手"}</div>
                <div className="msg-content">{msg.content}</div>

                {msg.role === "assistant" && (
                  <div className="assistant-debug">
                    <div className="debug-line">
                      检索查询：<code>{msg.rewrittenQuestion || "-"}</code>
                    </div>
                    <div className="debug-tags">
                      <span className={`tag ${msg.cached ? "tag-warm" : "tag-cool"}`}>
                        {msg.cached ? "cache hit" : "fresh retrieval"}
                      </span>
                      <span className="tag tag-muted">sources: {msg.sources?.length || 0}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="msg-row assistant">
              <div className="msg-bubble">
                <div className="msg-role">助手</div>
                <div className="msg-content">正在进行 query rewrite、检索和 rerank...</div>
              </div>
            </div>
          )}
        </div>

        <div className="input-bar">
          <textarea
            placeholder="试试三类问题：1）文档主题是什么 2）它的特点是什么 3）今天杭州天气怎么样"
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
            {loading ? "处理中..." : "发送问题"}
          </button>
        </div>
      </main>
    </div>
  );
}

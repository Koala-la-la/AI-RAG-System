import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  chat,
  deleteDocument,
  listDocuments,
  logoutUser,
  reindexDocument,
  runGeneratedSuite,
  uploadFile
} from "../api";
import { clearAuth, getAuth, getLastKb, setLastKb } from "../auth";

const DEFAULT_ASSISTANT = {
  role: "assistant",
  content: "你好，我是你的 RAG 助手。先上传文档，再测试直接问、追问和故意越界提问。"
};

const ACTION_LABELS = {
  indexed: "新入库",
  replaced: "替换重建",
  deduplicated: "重复复用",
  skipped: "按策略跳过"
};

function formatNumber(value, digits = 4) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toFixed(digits);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function actionTone(action) {
  if (action === "deduplicated" || action === "skipped") return "tag-warm";
  if (action === "replaced") return "tag-cool";
  return "tag-good";
}

function countFailedCases(benchmarks = []) {
  return benchmarks.reduce((sum, benchmark) => {
    const failed = (benchmark.cases || []).filter((item) => !item.passed).length;
    return sum + failed;
  }, 0);
}

function buildConversationKey(userId, kbId) {
  if (!userId || !kbId) return "";
  return `rag:messages:${userId}:${kbId}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [authUser, setAuthUser] = useState(auth.user);
  const [authToken, setAuthToken] = useState(auth.token);

  const [kbId, setKbId] = useState(getLastKb());
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([DEFAULT_ASSISTANT]);
  const [sources, setSources] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [workingSource, setWorkingSource] = useState("");
  const [file, setFile] = useState(null);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [docStatus, setDocStatus] = useState("");
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalLimit, setEvalLimit] = useState("");
  const [evalReport, setEvalReport] = useState(null);

  const userId = authUser;
  const conversationKey = buildConversationKey(userId, kbId);

  const canSend = useMemo(() => {
    return question.trim() && kbId.trim() && authToken && !loading;
  }, [question, kbId, authToken, loading]);

  const canManageDocuments = useMemo(() => {
    return kbId.trim() && authToken && !docLoading;
  }, [kbId, authToken, docLoading]);

  useEffect(() => {
    if (!authToken) {
      navigate("/login", { replace: true });
    }
  }, [authToken, navigate]);

  useEffect(() => {
    setLastKb(kbId);
  }, [kbId]);

  useEffect(() => {
    if (!conversationKey) {
      setMessages([DEFAULT_ASSISTANT]);
      return;
    }
    const saved = localStorage.getItem(conversationKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      } catch (err) {
        // ignore parse errors
      }
    }
    setMessages([DEFAULT_ASSISTANT]);
  }, [conversationKey]);

  useEffect(() => {
    if (!conversationKey) return;
    localStorage.setItem(conversationKey, JSON.stringify(messages));
  }, [messages, conversationKey]);

  const refreshDocuments = async (silent = false) => {
    if (!authToken || !kbId.trim()) {
      setDocuments([]);
      return;
    }

    if (!silent) {
      setDocLoading(true);
    }

    try {
      const data = await listDocuments(userId, kbId.trim(), authToken);
      setDocuments(data.items || []);
      if (!silent) {
        setDocStatus(`已加载 ${data.total || 0} 份文档`);
      }
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "文档列表加载失败";
      if (!silent) {
        setDocStatus(message);
      }
    } finally {
      if (!silent) {
        setDocLoading(false);
      }
    }
  };

  useEffect(() => {
    refreshDocuments(true);
  }, [authToken, kbId]);

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
    setMessages([DEFAULT_ASSISTANT]);
    setDocuments([]);
    setSources([]);
    setEvalReport(null);
    navigate("/login", { replace: true });
  };

  const handleClearConversation = () => {
    if (!conversationKey) {
      setMessages([DEFAULT_ASSISTANT]);
      return;
    }
    localStorage.removeItem(conversationKey);
    setMessages([DEFAULT_ASSISTANT]);
  };

  const sendQuestion = async () => {
    if (!canSend) return;

    const q = question.trim();
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuestion("");
    setLoading(true);
    setSources([]);

    try {
      const data = await chat(
        {
          user_id: userId,
          kb_id: kbId,
          question: q
        },
        authToken
      );

      const assistantMessage = {
        role: "assistant",
        content: data.answer || "后端没有返回答案。",
        rewrittenQuestion: data.rewritten_question || q,
        cached: Boolean(data.cached),
        sources: data.sources || []
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

  const handleUpload = async () => {
    if (!file) {
      alert("请先选择文件。");
      return;
    }
    if (!authToken || !kbId.trim()) {
      alert("请先登录并填写 kb_id。");
      return;
    }

    setUploading(true);
    try {
      const data = await uploadFile(file, userId, kbId.trim(), authToken);
      setUploadSummary(data);
      setDocStatus(data.message || "上传完成");
      await refreshDocuments(true);
      alert(`${data.message}\n文件：${data.filename}\nChunk：${data.chunks ?? 0}`);
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "上传失败";
      alert(`上传失败：${message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (source) => {
    if (!window.confirm(`确认删除文档《${source}》吗？这会同时删除向量索引和本地文件。`)) {
      return;
    }

    setWorkingSource(source);
    try {
      const data = await deleteDocument(userId, kbId.trim(), source, authToken);
      setDocStatus(data.message || `已删除 ${source}`);
      if (sources.some((item) => item.source === source)) {
        setSources([]);
      }
      await refreshDocuments(true);
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "删除失败";
      alert(`删除失败：${message}`);
    } finally {
      setWorkingSource("");
    }
  };

  const handleReindexDocument = async (source) => {
    setWorkingSource(source);
    try {
      const data = await reindexDocument(userId, kbId.trim(), source, authToken);
      setDocStatus(data.message || `已重建 ${source}`);
      setUploadSummary({
        filename: source,
        action: "replaced",
        documents: data.documents,
        sections: data.sections,
        chunks: data.chunks,
        pages: data.pages,
        message: data.message
      });
      await refreshDocuments(true);
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "重建索引失败";
      alert(`重建索引失败：${message}`);
    } finally {
      setWorkingSource("");
    }
  };

  const handleRunEvaluation = async () => {
    if (!authToken || !kbId.trim()) {
      alert("请先登录并填写 kb_id。");
      return;
    }

    if (evalLimit.trim() && (!/^\d+$/.test(evalLimit.trim()) || Number(evalLimit.trim()) <= 0)) {
      alert("评测 limit 需要是正整数，或留空表示跑完整套件。");
      return;
    }

    setEvalLoading(true);
    try {
      const data = await runGeneratedSuite(
        userId,
        kbId.trim(),
        evalLimit.trim() ? Number(evalLimit.trim()) : null,
        authToken
      );
      setEvalReport(data);
      setDocStatus(`评测完成：总通过率 ${formatNumber(data.summary?.pass_rate, 2)}`);
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "评测运行失败";
      alert(`评测运行失败：${message}`);
    } finally {
      setEvalLoading(false);
    }
  };

  const failedCases = countFailedCases(evalReport?.benchmarks || []);

  return (
    <div className="page">
      <aside className="sidebar">
        <div className="brand">AI RAG Lab</div>
        <div className="brand-subtitle">文档管理 + 检索链路可观测 + 一键评测</div>

        <div className="panel">
          <div className="panel-title">账号信息</div>
          <div className="auth-summary">
            <div className="summary-title">当前账号：{authUser}</div>
            <button className="btn btn-secondary" onClick={handleLogout}>
              退出登录
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">基础配置</div>
          <label>知识库 ID</label>
          <input value={kbId} onChange={(e) => setKbId(e.target.value)} />
          <button className="btn btn-secondary" onClick={() => refreshDocuments()} disabled={!canManageDocuments}>
            {docLoading ? "刷新中..." : "刷新文档列表"}
          </button>
          <div className="status-line">{docStatus || "切换 kb_id 后会自动读取该知识库文档。"}</div>
        </div>

        <div className="panel">
          <div className="panel-title">上传文档</div>
          <input
            type="file"
            accept=".pdf,.txt,.md"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button className="btn" onClick={handleUpload} disabled={uploading || !authToken}>
            {uploading ? "上传中..." : "上传到知识库"}
          </button>

          {uploadSummary && (
            <div className="upload-summary">
              <div className="summary-head">
                <div className="summary-title">最近一次上传结果</div>
                <span className={`tag ${actionTone(uploadSummary.action)}`}>
                  {ACTION_LABELS[uploadSummary.action] || uploadSummary.action || "已完成"}
                </span>
              </div>
              <div>文件：{uploadSummary.filename}</div>
              <div>文档数：{uploadSummary.documents ?? "-"}</div>
              <div>章节数：{uploadSummary.sections ?? "-"}</div>
              <div>页数：{uploadSummary.pages ?? "-"}</div>
              <div>Chunk 数：{uploadSummary.chunks ?? "-"}</div>
              <div className="summary-note">{uploadSummary.message}</div>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title no-margin">知识库文档</div>
            <span className="tag tag-muted">{documents.length} 份</span>
          </div>

          {documents.length === 0 ? (
            <div className="empty">当前知识库还没有被注册的文档。先上传一个文件，或者确认后端服务和向量库都已启动。</div>
          ) : (
            documents.map((doc) => {
              const busy = workingSource === doc.source;
              return (
                <div className="doc-card" key={doc.source}>
                  <div className="doc-head">
                    <div className="doc-title">{doc.source}</div>
                    <span className={`tag ${doc.exists_on_disk ? "tag-good" : "tag-warm"}`}>
                      {doc.exists_on_disk ? "可重建" : "缺少本地文件"}
                    </span>
                  </div>
                  <div className="doc-meta-grid">
                    <div>chunks：{doc.indexed_chunk_count ?? doc.chunks ?? 0}</div>
                    <div>pages：{doc.page_count ?? 0}</div>
                    <div>documents：{doc.document_count ?? doc.documents ?? 0}</div>
                    <div>status：{doc.status || "indexed"}</div>
                  </div>
                  <div className="doc-path">最后索引：{formatDate(doc.last_indexed_at)}</div>
                  <div className="doc-path">本地文件：{doc.stored_path || "-"}</div>
                  <div className="doc-actions">
                    <button
                      className="mini-btn mini-btn-secondary"
                      onClick={() => handleReindexDocument(doc.source)}
                      disabled={busy || !doc.can_reindex}
                    >
                      {busy ? "处理中..." : "重建索引"}
                    </button>
                    <button
                      className="mini-btn mini-btn-danger"
                      onClick={() => handleDeleteDocument(doc.source)}
                      disabled={busy}
                    >
                      {busy ? "处理中..." : "删除文档"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="panel">
          <div className="panel-title">当前知识库评测</div>
          <label>每个 benchmark 运行前 N 条</label>
          <input
            value={evalLimit}
            onChange={(e) => setEvalLimit(e.target.value)}
            placeholder="留空表示跑完整套件"
          />
          <button className="btn" onClick={handleRunEvaluation} disabled={evalLoading || !authToken}>
            {evalLoading ? "评测中..." : "生成并运行多文档评测"}
          </button>

          {!evalReport ? (
            <div className="empty">点击后会基于当前知识库自动生成多文档 benchmark，并返回 pass rate、平均分和失败用例摘要。</div>
          ) : (
            <div className="evaluation-summary">
              <div className="summary-grid">
                <div className="summary-stat">
                  <span className="summary-stat-label">benchmarks</span>
                  <strong>{evalReport.summary?.benchmark_count ?? 0}</strong>
                </div>
                <div className="summary-stat">
                  <span className="summary-stat-label">cases</span>
                  <strong>{evalReport.summary?.total_cases ?? 0}</strong>
                </div>
                <div className="summary-stat">
                  <span className="summary-stat-label">pass rate</span>
                  <strong>{formatNumber(evalReport.summary?.pass_rate, 2)}</strong>
                </div>
                <div className="summary-stat">
                  <span className="summary-stat-label">avg final</span>
                  <strong>{formatNumber(evalReport.summary?.avg_final_score, 2)}</strong>
                </div>
              </div>
              <div className="summary-note">失败用例数：{failedCases}</div>
              <div className="summary-note">自动发现文档：{evalReport.template?.source_count ?? 0}</div>
              <div className="summary-note">报告 JSON：{evalReport.artifacts?.latest_json || "-"}</div>
              <div className="summary-note">报告 Markdown：{evalReport.artifacts?.latest_markdown || "-"}</div>

              {(evalReport.benchmarks || []).map((benchmark) => {
                const failed = (benchmark.cases || []).filter((item) => !item.passed);
                return (
                  <div className="benchmark-card" key={benchmark.benchmark}>
                    <div className="doc-head">
                      <div className="doc-title">{benchmark.name}</div>
                      <span className={`tag ${failed.length === 0 ? "tag-good" : "tag-warm"}`}>
                        {failed.length === 0 ? "全部通过" : `${failed.length} 条失败`}
                      </span>
                    </div>
                    <div className="doc-meta-grid">
                      <div>cases：{benchmark.summary?.total ?? 0}</div>
                      <div>pass：{formatNumber(benchmark.summary?.pass_rate, 2)}</div>
                      <div>avg final：{formatNumber(benchmark.summary?.avg_final_score, 2)}</div>
                      <div>sources：{(benchmark.defaults?.source_filters || []).join("、") || "-"}</div>
                    </div>
                    {failed.slice(0, 3).map((item) => (
                      <div className="failed-case" key={`${benchmark.benchmark}-${item.name}`}>
                        <div className="failed-title">{item.name}</div>
                        <div className="failed-text">Q: {item.question}</div>
                        <div className="failed-text">final={formatNumber(item.final_score, 2)} / source={formatNumber(item.source_score, 2)}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">本轮命中来源</div>
          {sources.length === 0 ? (
            <div className="empty">发送一个问题后，这里会显示本轮命中的 chunk、分数和 grounded 标记。</div>
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
          <div className="chat-actions">
            <button className="btn btn-secondary" onClick={handleClearConversation}>
              新建会话
            </button>
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
            placeholder={authToken ? "试试三类问题：1）文档主题是什么 2）它的特点是什么 3）今天杭州天气怎么样" : "请先登录再提问"}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={!authToken}
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

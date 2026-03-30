import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import {
  chat,
  createConversation,
  deleteConversation,
  getConversationMessages,
  listConversations
} from "../api";

const DEFAULT_ASSISTANT = {
  role: "assistant",
  content: "你好，我是你的 RAG 助手。试试直接问、追问和故意问无关问题。"
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

export default function ChatPage() {
  const { authUser, authToken, kbId } = useOutletContext();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([DEFAULT_ASSISTANT]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [listError, setListError] = useState("");

  const activeConversation = conversations.find((item) => item.id === activeId);

  const canSend = useMemo(() => {
    return question.trim() && kbId.trim() && authToken && !loading;
  }, [question, kbId, authToken, loading]);

  const refreshConversations = async (selectFirst = true) => {
    if (!authToken || !kbId.trim()) {
      setConversations([]);
      setActiveId("");
      setMessages([DEFAULT_ASSISTANT]);
      setSources([]);
      return;
    }

    setLoadingList(true);
    setListError("");
    try {
      const data = await listConversations(authUser, kbId.trim(), authToken);
      const items = data.items || [];
      if (items.length === 0) {
        const created = await createConversation(authUser, kbId.trim(), null, authToken);
        setConversations([created]);
        setActiveId(created.id);
      } else {
        setConversations(items);
        if (selectFirst) {
          const exists = items.find((item) => item.id === activeId);
          setActiveId(exists ? activeId : items[0].id);
        }
      }
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "对话列表加载失败";
      setListError(message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    refreshConversations(true);
  }, [authToken, kbId]);

  useEffect(() => {
    if (!activeId || !authToken || !kbId.trim()) {
      setMessages([DEFAULT_ASSISTANT]);
      setSources([]);
      return;
    }

    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const data = await getConversationMessages(authUser, kbId.trim(), activeId, authToken);
        const items = data.messages || [];
        setMessages(items.length > 0 ? items : [DEFAULT_ASSISTANT]);
      } catch (err) {
        const message = err.response?.data?.detail || err.message || "加载对话失败";
        setMessages([
          {
            role: "assistant",
            content: `加载对话失败：${message}`
          }
        ]);
      } finally {
        setLoadingMessages(false);
        setSources([]);
      }
    };

    loadMessages();
  }, [activeId, authToken, kbId]);

  const handleNewConversation = async () => {
    if (!authToken || !kbId.trim()) {
      alert("请先登录并填写 kb_id。");
      return;
    }

    try {
      const created = await createConversation(authUser, kbId.trim(), null, authToken);
      setConversations((prev) => [created, ...prev]);
      setActiveId(created.id);
      setMessages([DEFAULT_ASSISTANT]);
      setSources([]);
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "创建对话失败";
      alert(`创建对话失败：${message}`);
    }
  };

  const handleSelectConversation = (id) => {
    if (id === activeId) return;
    setActiveId(id);
  };

  const handleDeleteConversation = async (id) => {
    if (!window.confirm("确认删除该对话记录吗？")) {
      return;
    }

    try {
      await deleteConversation(authUser, kbId.trim(), id, authToken);
      const nextList = conversations.filter((item) => item.id !== id);
      if (nextList.length === 0) {
        const created = await createConversation(authUser, kbId.trim(), null, authToken);
        setConversations([created]);
        setActiveId(created.id);
        setMessages([DEFAULT_ASSISTANT]);
      } else {
        setConversations(nextList);
        if (id === activeId) {
          setActiveId(nextList[0].id);
        }
      }
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "删除对话失败";
      alert(`删除对话失败：${message}`);
    }
  };

  const sendQuestion = async () => {
    if (!canSend) return;

    let conversationId = activeId;
    if (!conversationId) {
      const created = await createConversation(authUser, kbId.trim(), null, authToken);
      setConversations((prev) => [created, ...prev]);
      setActiveId(created.id);
      conversationId = created.id;
    }

    const q = question.trim();
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuestion("");
    setLoading(true);
    setSources([]);

    try {
      const data = await chat(
        {
          user_id: authUser,
          kb_id: kbId,
          question: q,
          conversation_id: conversationId
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

      if (data.conversation) {
        setConversations((prev) => {
          const rest = prev.filter((item) => item.id !== data.conversation.id);
          return [data.conversation, ...rest];
        });
      } else {
        refreshConversations(false);
      }
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

  return (
    <div className="chat-layout">
      <section className="card conversation-panel">
        <div className="card-head">
          <div>
            <div className="card-title">对话列表</div>
            <div className="card-subtitle">后端持久化保存</div>
          </div>
          <button className="btn btn-secondary" onClick={handleNewConversation}>
            新建对话
          </button>
        </div>

        {loadingList ? (
          <div className="empty">正在加载对话列表...</div>
        ) : listError ? (
          <div className="empty">{listError}</div>
        ) : conversations.length === 0 ? (
          <div className="empty">还没有任何对话记录，点击右上角新建。</div>
        ) : (
          <div className="conversation-list">
            {conversations.map((conv) => (
              <div className="conversation-row" key={conv.id}>
                <button
                  className={`conversation-item${conv.id === activeId ? " active" : ""}`}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <div className="conversation-title-row">
                    <div className="conversation-title">{conv.title || "新对话"}</div>
                    <div className="conversation-count">{conv.message_count ?? 0}</div>
                  </div>
                  <div className="conversation-snippet">
                    {conv.last_snippet || "暂无摘要"}
                  </div>
                  <div className="conversation-meta">{formatDate(conv.updated_at || conv.created_at)}</div>
                </button>
                <button className="tiny-btn" onClick={() => handleDeleteConversation(conv.id)}>
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">对话</div>
            <div className="card-subtitle">当前知识库：{kbId || "-"}</div>
          </div>
          <div className="conversation-meta">当前会话：{activeConversation?.title || "-"}</div>
        </div>

        <div className="chat-box">
          {loadingMessages && <div className="empty">正在加载对话内容...</div>}
          {!loadingMessages &&
            messages.map((msg, idx) => (
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
      </section>

      <section className="card">
        <div className="card-head">
          <div className="card-title">本轮命中来源</div>
          <div className="card-subtitle">命中 chunk、分数与 grounded 标记</div>
        </div>

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
      </section>
    </div>
  );
}

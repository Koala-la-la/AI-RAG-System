import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import {
  chat,
  createConversation,
  deleteConversation,
  getConversationMessages,
  getConversationTimeline,
  listConversations,
  transitionConversation,
  updateConversation
} from "../api";

const DEFAULT_ASSISTANT = {
  role: "assistant",
  content:
    "你好，我是企业问题处理助手。请先填写问题单，再把故障现象、用户反馈或接口异常发给我，我会基于知识库帮你整理处理方案和引用依据。"
};

const EMPTY_CASE = {
  title: "",
  status: "new",
  priority: "medium",
  system_name: "",
  environment: "",
  impact_scope: "",
  current_error: "",
  resolution_summary: ""
};

const STATUS_OPTIONS = [
  { value: "new", label: "待受理", tone: "tag-muted" },
  { value: "triaged", label: "已分诊", tone: "tag-cool" },
  { value: "investigating", label: "排查中", tone: "tag-cool" },
  { value: "pending_escalation", label: "待升级", tone: "tag-warm" },
  { value: "escalated", label: "已升级", tone: "tag-danger" },
  { value: "resolved", label: "已解决", tone: "tag-good" },
  { value: "archived", label: "已归档", tone: "tag-muted" }
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "低", tone: "tag-muted" },
  { value: "medium", label: "中", tone: "tag-cool" },
  { value: "high", label: "高", tone: "tag-warm" },
  { value: "critical", label: "紧急", tone: "tag-danger" }
];

const TRANSITION_LABELS = {
  new: "重新打开",
  triaged: "完成分诊",
  investigating: "开始排查",
  pending_escalation: "提交升级评估",
  escalated: "确认已升级",
  resolved: "标记已解决",
  archived: "归档问题单"
};

const EVENT_LABELS = {
  case_created: "创建问题单",
  case_updated: "更新问题单",
  status_transition: "状态流转",
  messages_appended: "处理记录写入",
  case_deleted: "删除问题单"
};

const DOC_TYPE_LABELS = {
  api: "API 文档",
  sop: "SOP",
  runbook: "运维手册",
  faq: "FAQ",
  architecture: "架构设计",
  policy: "规范制度",
  other: "其他"
};

const ACCESS_LABELS = {
  private: "个人",
  team: "团队",
  org: "全公司"
};

const CASE_EDIT_FIELDS = [
  "title",
  "priority",
  "system_name",
  "environment",
  "impact_scope",
  "current_error",
  "resolution_summary"
];

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

function findOption(options, value) {
  return options.find((item) => item.value === value) || options[0];
}

function buildCaseForm(item) {
  if (!item) return { ...EMPTY_CASE };
  return {
    title: item.title || "",
    status: item.status || "new",
    priority: item.priority || "medium",
    system_name: item.system_name || "",
    environment: item.environment || "",
    impact_scope: item.impact_scope || "",
    current_error: item.current_error || "",
    resolution_summary: item.resolution_summary || ""
  };
}

function getLastAssistantDetails(items = []) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const current = items[index];
    if (current?.role === "assistant") {
      return {
        sources: Array.isArray(current.sources) ? current.sources : [],
        routeLabel: current.routeLabel || "",
        routeSummary: current.routeSummary || "",
        sourceFilters: Array.isArray(current.sourceFilters) ? current.sourceFilters : []
      };
    }
  }
  return {
    sources: [],
    routeLabel: "",
    routeSummary: "",
    sourceFilters: []
  };
}

function normalizeTimeline(timeline) {
  return {
    events: Array.isArray(timeline?.events) ? timeline.events : [],
    milestones: Array.isArray(timeline?.milestones) ? timeline.milestones : [],
    allowedTransitions: Array.isArray(timeline?.allowed_transitions) ? timeline.allowed_transitions : [],
    sla: timeline?.sla || {}
  };
}

function formatEventSummary(event) {
  const changes = event?.details?.changes;
  if (!changes || typeof changes !== "object") {
    return "";
  }
  const fields = Object.keys(changes);
  if (fields.length === 0) return "";
  return `字段变更：${fields.join("、")}`;
}

function slaTone(breached) {
  return breached ? "tag-danger" : "tag-good";
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
  const [caseForm, setCaseForm] = useState({ ...EMPTY_CASE });
  const [savingCase, setSavingCase] = useState(false);
  const [caseFeedback, setCaseFeedback] = useState("");
  const [routeInfo, setRouteInfo] = useState({ routeLabel: "", routeSummary: "", sourceFilters: [] });
  const [timeline, setTimeline] = useState(normalizeTimeline(null));
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionNote, setTransitionNote] = useState("");

  const activeConversation = conversations.find((item) => item.id === activeId) || null;

  const canSend = useMemo(() => {
    return question.trim() && kbId.trim() && authToken && !loading;
  }, [question, kbId, authToken, loading]);

  const canSaveCase = useMemo(() => {
    if (!activeConversation) return false;
    return CASE_EDIT_FIELDS.some((field) => (activeConversation[field] || "") !== (caseForm[field] || ""));
  }, [activeConversation, caseForm]);

  const availableTransitions = useMemo(() => {
    if (timeline.allowedTransitions.length > 0) {
      return timeline.allowedTransitions;
    }
    return Array.isArray(activeConversation?.allowed_transitions) ? activeConversation.allowed_transitions : [];
  }, [timeline.allowedTransitions, activeConversation?.allowed_transitions]);

  const mergeConversation = (nextConversation) => {
    if (!nextConversation) return;
    setConversations((prev) => {
      const rest = prev.filter((item) => item.id !== nextConversation.id);
      return [nextConversation, ...rest];
    });
  };

  const refreshConversations = async (selectFirst = true) => {
    if (!authToken || !kbId.trim()) {
      setConversations([]);
      setActiveId("");
      setMessages([DEFAULT_ASSISTANT]);
      setSources([]);
      setCaseForm({ ...EMPTY_CASE });
      setRouteInfo({ routeLabel: "", routeSummary: "", sourceFilters: [] });
      setTimeline(normalizeTimeline(null));
      return;
    }

    setLoadingList(true);
    setListError("");
    try {
      const data = await listConversations(authUser, kbId.trim(), authToken);
      const items = data.items || [];
      if (items.length === 0) {
        const created = await createConversation(authUser, kbId.trim(), {}, authToken);
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
      const message = err.response?.data?.detail || err.message || "问题单列表加载失败";
      setListError(message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    refreshConversations(true);
  }, [authToken, kbId]);

  useEffect(() => {
    setCaseFeedback("");
    setCaseForm(buildCaseForm(activeConversation));
  }, [activeConversation?.id, activeConversation?.updated_at]);

  useEffect(() => {
    if (!activeId || !authToken || !kbId.trim()) {
      setMessages([DEFAULT_ASSISTANT]);
      setSources([]);
      setRouteInfo({ routeLabel: "", routeSummary: "", sourceFilters: [] });
      setTimeline(normalizeTimeline(null));
      return;
    }

    const loadMessages = async () => {
      setLoadingMessages(true);
      setTimelineLoading(true);
      try {
        const data = await getConversationMessages(authUser, kbId.trim(), activeId, authToken);
        const items = data.messages || [];
        const nextConversation = data.conversation || activeConversation;
        const details = getLastAssistantDetails(items);
        if (nextConversation) {
          mergeConversation(nextConversation);
          setCaseForm(buildCaseForm(nextConversation));
        }
        setMessages(items.length > 0 ? items : [DEFAULT_ASSISTANT]);
        setSources(details.sources);
        setRouteInfo({
          routeLabel: details.routeLabel,
          routeSummary: details.routeSummary,
          sourceFilters: details.sourceFilters
        });
        setTimeline(normalizeTimeline(data.timeline));
      } catch (err) {
        const message = err.response?.data?.detail || err.message || "加载问题单失败";
        setMessages([
          {
            role: "assistant",
            content: `加载问题单失败：${message}`
          }
        ]);
        setSources([]);
        setRouteInfo({ routeLabel: "", routeSummary: "", sourceFilters: [] });
        setTimeline(normalizeTimeline(null));
      } finally {
        setLoadingMessages(false);
        setTimelineLoading(false);
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
      const created = await createConversation(authUser, kbId.trim(), {}, authToken);
      setConversations((prev) => [created, ...prev]);
      setActiveId(created.id);
      setMessages([DEFAULT_ASSISTANT]);
      setSources([]);
      setRouteInfo({ routeLabel: "", routeSummary: "", sourceFilters: [] });
      setTimeline(normalizeTimeline(null));
      setCaseFeedback("");
      setTransitionNote("");
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "创建问题单失败";
      alert(`创建问题单失败：${message}`);
    }
  };

  const handleSelectConversation = (id) => {
    if (id === activeId) return;
    setActiveId(id);
    setTransitionNote("");
  };

  const handleDeleteConversation = async (id) => {
    if (!window.confirm("确认删除该问题单吗？")) {
      return;
    }

    try {
      await deleteConversation(authUser, kbId.trim(), id, authToken);
      const nextList = conversations.filter((item) => item.id !== id);
      if (nextList.length === 0) {
        const created = await createConversation(authUser, kbId.trim(), {}, authToken);
        setConversations([created]);
        setActiveId(created.id);
        setMessages([DEFAULT_ASSISTANT]);
      } else {
        setConversations(nextList);
        if (id === activeId) {
          setActiveId(nextList[0].id);
        }
      }
      setRouteInfo({ routeLabel: "", routeSummary: "", sourceFilters: [] });
      setTimeline(normalizeTimeline(null));
      setCaseFeedback("");
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "删除问题单失败";
      alert(`删除问题单失败：${message}`);
    }
  };

  const handleSaveCase = async () => {
    if (!activeConversation || !canSaveCase) return;
    setSavingCase(true);
    setCaseFeedback("");

    const updates = {};
    CASE_EDIT_FIELDS.forEach((field) => {
      updates[field] = caseForm[field];
    });

    try {
      const updated = await updateConversation(authUser, kbId.trim(), activeConversation.id, updates, authToken);
      mergeConversation(updated);
      setActiveId(updated.id);
      setCaseForm(buildCaseForm(updated));
      setCaseFeedback("问题单已保存");

      const timelineData = await getConversationTimeline(authUser, kbId.trim(), activeConversation.id, authToken);
      setTimeline(normalizeTimeline(timelineData));
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "保存问题单失败";
      setCaseFeedback(message);
    } finally {
      setSavingCase(false);
    }
  };

  const handleTransition = async (targetStatus) => {
    if (!activeConversation) return;
    setTransitioning(true);
    setCaseFeedback("");
    try {
      const result = await transitionConversation(
        authUser,
        kbId.trim(),
        activeConversation.id,
        targetStatus,
        transitionNote,
        authToken
      );
      const updated = result.conversation;
      mergeConversation(updated);
      setCaseForm(buildCaseForm(updated));
      setTimeline(normalizeTimeline(result.timeline));
      setTransitionNote("");
      setCaseFeedback(`流程已更新为：${findOption(STATUS_OPTIONS, targetStatus).label}`);
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "流程动作失败";
      setCaseFeedback(message);
    } finally {
      setTransitioning(false);
    }
  };

  const sendQuestion = async () => {
    if (!canSend) return;

    let conversationId = activeId;
    if (!conversationId) {
      const created = await createConversation(authUser, kbId.trim(), caseForm, authToken);
      setConversations((prev) => [created, ...prev]);
      setActiveId(created.id);
      conversationId = created.id;
    }

    const q = question.trim();
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setQuestion("");
    setLoading(true);
    setSources([]);
    setRouteInfo({ routeLabel: "", routeSummary: "", sourceFilters: [] });
    setCaseFeedback("");

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
        sources: data.sources || [],
        routeLabel: data.route_label || "",
        routeSummary: data.route_summary || "",
        sourceFilters: data.source_filters || []
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setSources(assistantMessage.sources);
      setRouteInfo({
        routeLabel: assistantMessage.routeLabel,
        routeSummary: assistantMessage.routeSummary,
        sourceFilters: assistantMessage.sourceFilters
      });

      if (data.conversation) {
        mergeConversation(data.conversation);
      } else {
        refreshConversations(false);
      }

      try {
        const timelineData = await getConversationTimeline(authUser, kbId.trim(), conversationId, authToken);
        setTimeline(normalizeTimeline(timelineData));
      } catch (timelineErr) {
        // keep current UI state when timeline fetch fails
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
          sources: [],
          routeLabel: "",
          routeSummary: "",
          sourceFilters: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const activeStatus = findOption(STATUS_OPTIONS, caseForm.status || activeConversation?.status || "new");
  const activePriority = findOption(PRIORITY_OPTIONS, caseForm.priority || activeConversation?.priority || "medium");
  const transitionTargets = availableTransitions.map((value) => findOption(STATUS_OPTIONS, value));

  return (
    <div className="chat-layout case-layout">
      <section className="card conversation-panel">
        <div className="card-head">
          <div>
            <div className="card-title">问题单列表</div>
            <div className="card-subtitle">围绕真实内部问题持续沉淀处理记录</div>
          </div>
          <button className="btn btn-secondary" onClick={handleNewConversation}>
            新建问题单
          </button>
        </div>

        {loadingList ? (
          <div className="empty">正在加载问题单列表...</div>
        ) : listError ? (
          <div className="empty">{listError}</div>
        ) : conversations.length === 0 ? (
          <div className="empty">还没有问题单，点击右上角创建第一条。</div>
        ) : (
          <div className="conversation-list">
            {conversations.map((conv) => {
              const status = findOption(STATUS_OPTIONS, conv.status);
              const priority = findOption(PRIORITY_OPTIONS, conv.priority);
              return (
                <div className="conversation-row" key={conv.id}>
                  <button
                    className={`conversation-item${conv.id === activeId ? " active" : ""}`}
                    onClick={() => handleSelectConversation(conv.id)}
                  >
                    <div className="conversation-title-row">
                      <div className="conversation-title">{conv.title || "新问题单"}</div>
                      <div className="conversation-count">{conv.message_count ?? 0}</div>
                    </div>
                    <div className="case-badge-row">
                      <span className={`tag ${status.tone}`}>{status.label}</span>
                      <span className={`tag ${priority.tone}`}>{priority.label}</span>
                      {conv.system_name && <span className="tag tag-muted">{conv.system_name}</span>}
                    </div>
                    <div className="conversation-snippet">{conv.last_snippet || conv.current_error || "暂无摘要"}</div>
                    <div className="conversation-meta">{formatDate(conv.updated_at || conv.created_at)}</div>
                  </button>
                  <button className="tiny-btn" onClick={() => handleDeleteConversation(conv.id)}>
                    删除
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="case-main-column">
        <section className="card case-detail-card">
          <div className="card-head">
            <div>
              <div className="card-title">问题单详情</div>
              <div className="card-subtitle">先补全上下文，再让 AI 基于知识库给处理建议</div>
            </div>
            <div className="case-meta-inline">
              <span className={`tag ${activeStatus.tone}`}>{activeStatus.label}</span>
              <span className={`tag ${activePriority.tone}`}>{activePriority.label}</span>
            </div>
          </div>

          <div className="form-grid case-form-grid">
            <div className="field-span-2">
              <label>问题标题</label>
              <input
                value={caseForm.title}
                onChange={(e) => setCaseForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="例如：支付回调超时导致订单状态未更新"
              />
            </div>
            <div>
              <label>当前流程状态</label>
              <div className="readonly-field">
                <span className={`tag ${activeStatus.tone}`}>{activeStatus.label}</span>
              </div>
            </div>
            <div>
              <label>优先级</label>
              <select
                value={caseForm.priority}
                onChange={(e) => setCaseForm((prev) => ({ ...prev, priority: e.target.value }))}
              >
                {PRIORITY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>所属系统</label>
              <input
                value={caseForm.system_name}
                onChange={(e) => setCaseForm((prev) => ({ ...prev, system_name: e.target.value }))}
                placeholder="如：支付服务 / 用户中心 / 发布平台"
              />
            </div>
            <div>
              <label>环境</label>
              <input
                value={caseForm.environment}
                onChange={(e) => setCaseForm((prev) => ({ ...prev, environment: e.target.value }))}
                placeholder="如：prod / staging / uat"
              />
            </div>
            <div className="field-span-2">
              <label>影响范围</label>
              <input
                value={caseForm.impact_scope}
                onChange={(e) => setCaseForm((prev) => ({ ...prev, impact_scope: e.target.value }))}
                placeholder="如：影响支付回调链路，10% 用户下单后状态延迟"
              />
            </div>
            <div className="field-span-2">
              <label>当前报错 / 现象</label>
              <textarea
                className="compact-textarea"
                value={caseForm.current_error}
                onChange={(e) => setCaseForm((prev) => ({ ...prev, current_error: e.target.value }))}
                placeholder="填写用户反馈、报错信息、日志关键字、接口返回码等"
              />
            </div>
            <div className="field-span-2">
              <label>当前处理结论</label>
              <textarea
                className="compact-textarea"
                value={caseForm.resolution_summary}
                onChange={(e) => setCaseForm((prev) => ({ ...prev, resolution_summary: e.target.value }))}
                placeholder="处理完成后，把最终结论、临时规避方案或升级去向记录在这里"
              />
            </div>
          </div>

          <div className="case-actions-row">
            <button className="btn case-save-btn" onClick={handleSaveCase} disabled={!activeConversation || !canSaveCase || savingCase}>
              {savingCase ? "保存中..." : "保存问题单"}
            </button>
            <div className="case-feedback">{caseFeedback || (activeConversation ? `问题单 ID：${activeConversation.id}` : "")}</div>
          </div>

          <div className="workflow-panel">
            <div className="triage-title">流程动作（合法流转）</div>
            <div className="card-subtitle">系统只允许按流程推进，避免状态跳变导致协作混乱。</div>
            <input
              value={transitionNote}
              onChange={(e) => setTransitionNote(e.target.value)}
              placeholder="可选：写入操作备注，例如“已确认回调链路异常，准备升级支付研发”"
            />
            <div className="workflow-actions-row">
              {transitionTargets.length === 0 ? (
                <div className="empty">当前状态暂无下一步动作。</div>
              ) : (
                transitionTargets.map((target) => (
                  <button
                    key={target.value}
                    className="mini-btn mini-btn-secondary workflow-btn"
                    onClick={() => handleTransition(target.value)}
                    disabled={!activeConversation || transitioning}
                  >
                    {TRANSITION_LABELS[target.value] || target.label}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="sla-panel">
            <div className="triage-title">SLA 监控</div>
            <div className="summary-grid">
              <div className="summary-stat">
                <span className="summary-stat-label">首次响应截止</span>
                <div>{formatDate(timeline.sla.response_due_at)}</div>
                <span className={`tag ${slaTone(Boolean(timeline.sla.response_breached))}`}>
                  {timeline.sla.response_breached ? "已超时" : "正常"}
                </span>
              </div>
              <div className="summary-stat">
                <span className="summary-stat-label">问题解决截止</span>
                <div>{formatDate(timeline.sla.resolution_due_at)}</div>
                <span className={`tag ${slaTone(Boolean(timeline.sla.resolution_breached))}`}>
                  {timeline.sla.resolution_breached ? "已超时" : "正常"}
                </span>
              </div>
            </div>
            <div className="source-meta">首次响应时间：{formatDate(timeline.sla.first_response_at)}</div>
            <div className="source-meta">最近流转时间：{formatDate(timeline.sla.last_transition_at)}</div>
          </div>

          <div className="triage-panel">
            <div className="triage-title">当前问题分诊</div>
            {routeInfo.routeLabel ? (
              <>
                <div className="source-tag-row compact-gap">
                  <span className="tag tag-cool">{routeInfo.routeLabel}</span>
                  <span className="tag tag-muted">{routeInfo.sourceFilters.length} 份限定文档</span>
                </div>
                <div className="triage-summary">{routeInfo.routeSummary}</div>
                {routeInfo.sourceFilters.length > 0 && (
                  <div className="source-tag-row compact-gap">
                    {routeInfo.sourceFilters.map((source) => (
                      <span className="tag tag-muted" key={source}>{source}</span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="empty">发送问题后，这里会显示当前分诊类型和限制检索的文档范围。</div>
            )}
          </div>
        </section>

        <section className="card workflow-timeline-card">
          <div className="card-head">
            <div>
              <div className="card-title">流程时间线 / 审计日志</div>
              <div className="card-subtitle">记录谁在什么时候做了什么，保证流程可追溯</div>
            </div>
            <span className="tag tag-muted">{timeline.events.length} 条记录</span>
          </div>

          {timelineLoading ? (
            <div className="empty">正在加载时间线...</div>
          ) : timeline.events.length === 0 ? (
            <div className="empty">当前问题单还没有操作日志。</div>
          ) : (
            <div className="timeline-list">
              {timeline.events.map((event) => (
                <div className="timeline-item" key={event.id}>
                  <div className="timeline-head">
                    <strong>{EVENT_LABELS[event.event_type] || event.event_type}</strong>
                    <span className="tag tag-muted">{formatDate(event.timestamp)}</span>
                  </div>
                  <div className="source-meta">操作人：{event.actor || "system"}</div>
                  {event.note && <div className="source-meta">备注：{event.note}</div>}
                  {formatEventSummary(event) && <div className="source-meta">{formatEventSummary(event)}</div>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card case-workflow-card">
          <div className="card-head">
            <div>
              <div className="card-title">处理过程</div>
              <div className="card-subtitle">围绕问题单持续追问、补充上下文并生成处理建议</div>
            </div>
            <div className="conversation-meta">当前知识库：{kbId || "-"}</div>
          </div>

          <div className="chat-box case-chat-box">
            {loadingMessages && <div className="empty">正在加载问题单内容...</div>}
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
                          {msg.routeLabel && <span className="tag tag-cool">{msg.routeLabel}</span>}
                          <span className="tag tag-muted">sources: {msg.sources?.length || 0}</span>
                        </div>
                        {msg.routeSummary && <div className="debug-line top-gap">{msg.routeSummary}</div>}
                      </div>
                    )}
                  </div>
                </div>
              ))}

            {loading && (
              <div className="msg-row assistant">
                <div className="msg-bubble">
                  <div className="msg-role">助手</div>
                  <div className="msg-content">正在结合问题单上下文，梳理结论、原因、步骤和依据...</div>
                </div>
              </div>
            )}
          </div>

          <div className="input-bar">
            <textarea
              placeholder="结合问题单继续追问，例如：1）这个报错最可能是哪个环节造成的？ 2）先看哪几个日志字段？ 3）如果需要升级给研发，建议补充哪些信息？"
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
              {loading ? "处理中..." : "生成处理建议"}
            </button>
          </div>
        </section>
      </section>

      <section className="card case-evidence-card">
        <div className="card-head">
          <div className="card-title">引用依据</div>
          <div className="card-subtitle">用于支撑处理结论的知识片段与文档属性</div>
        </div>

        {sources.length === 0 ? (
          <div className="empty">当问题单开始处理后，这里会显示命中的文档片段、章节和权限信息。</div>
        ) : (
          sources.map((source, index) => (
            <div className="source-card" key={`${source.owner_id || source.user_id}-${source.chunk_id || source.source}-${index}`}>
              <div className="source-head">
                <strong>{source.source}</strong>
                <span className={`tag ${source.grounded ? "tag-good" : "tag-muted"}`}>
                  {source.grounded ? "grounded" : "candidate"}
                </span>
              </div>
              <div className="source-tag-row">
                {source.source_label && <span className="tag tag-cool">{source.source_label}</span>}
                <span className="tag tag-cool">{DOC_TYPE_LABELS[source.document_type] || "其他"}</span>
                <span className="tag tag-warm">{ACCESS_LABELS[source.access_level] || "团队"}</span>
                <span className="tag tag-muted">团队：{source.owner_team || "platform"}</span>
                <span className="tag tag-muted">所有者：{source.owner_id || source.user_id || "-"}</span>
              </div>
              {Array.isArray(source.tags) && source.tags.length > 0 && (
                <div className="source-tag-row">
                  {source.tags.map((tag) => (
                    <span className="tag tag-muted" key={`${source.owner_id || source.user_id}-${source.source}-${tag}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
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

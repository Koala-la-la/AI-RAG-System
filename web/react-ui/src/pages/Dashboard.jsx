import React, { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";

import {
  getLatestEvaluationReport,
  listConversations,
  listDocuments
} from "../api";

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

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return `${Math.round(Number(value) * 100)}%`;
}

function sumBy(items, selector) {
  return items.reduce((sum, item) => sum + Number(selector(item) || 0), 0);
}

function topGroups(items, selector, labelMap = {}) {
  const counts = new Map();
  items.forEach((item) => {
    const raw = selector(item) || "other";
    counts.set(raw, (counts.get(raw) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([key, count]) => ({
      key,
      label: labelMap[key] || key,
      count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
}

export default function DashboardPage() {
  const { authUser, authToken, authTeam, authRole, kbId } = useOutletContext();
  const [loading, setLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [documents, setDocuments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [latestReport, setLatestReport] = useState(null);

  useEffect(() => {
    const loadDashboard = async () => {
      if (!authToken || !kbId.trim()) {
        setDocuments([]);
        setConversations([]);
        setLatestReport(null);
        return;
      }

      setLoading(true);
      setDashboardError("");

      const [docsResult, conversationsResult, reportResult] = await Promise.allSettled([
        listDocuments(authUser, kbId.trim(), authToken),
        listConversations(authUser, kbId.trim(), authToken),
        getLatestEvaluationReport(authUser, kbId.trim(), authToken)
      ]);

      if (docsResult.status === "fulfilled") {
        setDocuments(docsResult.value.items || []);
      } else {
        const message = docsResult.reason?.response?.data?.detail || docsResult.reason?.message || "文档概览加载失败";
        setDashboardError(message);
      }

      if (conversationsResult.status === "fulfilled") {
        setConversations(conversationsResult.value.items || []);
      }

      if (reportResult.status === "fulfilled") {
        setLatestReport(reportResult.value);
      } else {
        const status = reportResult.reason?.response?.status;
        if (status !== 404 && !dashboardError) {
          const message = reportResult.reason?.response?.data?.detail || reportResult.reason?.message || "最新评测加载失败";
          setDashboardError(message);
        }
        setLatestReport(null);
      }

      setLoading(false);
    };

    loadDashboard();
  }, [authToken, authUser, kbId]);

  const totalChunks = useMemo(() => sumBy(documents, (item) => item.indexed_chunk_count ?? item.chunks), [documents]);
  const totalPages = useMemo(() => sumBy(documents, (item) => item.page_count), [documents]);
  const privateCount = useMemo(() => documents.filter((item) => item.access_level === "private").length, [documents]);
  const teamCount = useMemo(() => documents.filter((item) => item.access_level === "team").length, [documents]);
  const orgCount = useMemo(() => documents.filter((item) => item.access_level === "org").length, [documents]);
  const docTypeStats = useMemo(() => topGroups(documents, (item) => item.document_type, DOC_TYPE_LABELS), [documents]);
  const accessStats = useMemo(() => topGroups(documents, (item) => item.access_level, ACCESS_LABELS), [documents]);
  const recentDocuments = useMemo(() => {
    return [...documents]
      .sort((a, b) => String(b.last_indexed_at || "").localeCompare(String(a.last_indexed_at || "")))
      .slice(0, 5);
  }, [documents]);
  const recentConversations = useMemo(() => conversations.slice(0, 5), [conversations]);

  const recommendations = useMemo(() => {
    const items = [];
    if (documents.length === 0) {
      items.push("先上传 1-2 份 API 文档、SOP 或 FAQ，工作台数据会更完整。");
    }
    if (documents.length > 0 && !latestReport) {
      items.push("建议跑一次企业问答评测，建立当前知识库的基线质量。 ");
    }
    if (conversations.length <= 1) {
      items.push("让团队多问几个真实问题，后续才能沉淀高频问题与知识缺口。");
    }
    if (privateCount > orgCount + teamCount) {
      items.push("当前个人文档偏多，可以整理出团队共享或全公司可见的知识资产。");
    }
    if (items.length === 0) {
      items.push("当前工作台状态不错，下一步适合做答案反馈与知识缺口分析。");
    }
    return items.slice(0, 3);
  }, [documents.length, latestReport, conversations.length, privateCount, orgCount, teamCount]);

  return (
    <div className="dashboard-shell">
      <section className="hero-card card">
        <div>
          <div className="eyebrow">Enterprise Knowledge Copilot</div>
          <h1 className="hero-title">企业知识工作台</h1>
          <p className="hero-text">
            把知识库建设、问答使用和质量评测放到同一个入口里，方便你从 ToB 产品视角观察系统状态。
          </p>
          <div className="source-tag-row compact-gap">
            <span className="tag tag-muted">账号：{authUser || "-"}</span>
            <span className="tag tag-cool">团队：{authTeam || "platform"}</span>
            <span className="tag tag-warm">角色：{authRole || "member"}</span>
            <span className="tag tag-good">知识库：{kbId || "-"}</span>
          </div>
        </div>
        <div className="hero-actions">
          <Link className="action-link primary" to="/app/chat">
            进入问题处理
          </Link>
          <Link className="action-link" to="/app/documents">
            管理文档中心
          </Link>
          <Link className="action-link" to="/app/evaluation">
            运行质量评测
          </Link>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card card">
          <div className="stat-label">可访问文档</div>
          <div className="stat-value">{documents.length}</div>
          <div className="stat-foot">private {privateCount} / team {teamCount} / org {orgCount}</div>
        </div>
        <div className="stat-card card">
          <div className="stat-label">知识块规模</div>
          <div className="stat-value">{totalChunks}</div>
          <div className="stat-foot">累计页数 {totalPages}</div>
        </div>
        <div className="stat-card card">
          <div className="stat-label">会话数量</div>
          <div className="stat-value">{conversations.length}</div>
          <div className="stat-foot">最近 5 条会话已在下方展示</div>
        </div>
        <div className="stat-card card accent-card">
          <div className="stat-label">最新评测通过率</div>
          <div className="stat-value">{latestReport ? formatPercent(latestReport.summary?.pass_rate) : "未运行"}</div>
          <div className="stat-foot">
            {latestReport ? `平均分 ${formatPercent(latestReport.summary?.avg_final_score)}` : "建议先建立基线评测"}
          </div>
        </div>
      </section>

      {dashboardError && <section className="card empty">{dashboardError}</section>}

      <section className="dashboard-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">最近文档</div>
              <div className="card-subtitle">优先关注最近入库和可共享的知识资产</div>
            </div>
            <Link className="inline-link" to="/app/documents">
              查看全部
            </Link>
          </div>

          {recentDocuments.length === 0 ? (
            <div className="empty">还没有可展示的文档，先去文档中心上传技术文档或 SOP。</div>
          ) : (
            recentDocuments.map((doc) => (
              <div className="dashboard-list-card" key={`${doc.user_id}-${doc.source}`}>
                <div className="doc-head">
                  <div className="doc-title">{doc.source}</div>
                  <span className="tag tag-good">{DOC_TYPE_LABELS[doc.document_type] || "其他"}</span>
                </div>
                <div className="source-tag-row compact-gap">
                  <span className="tag tag-warm">{ACCESS_LABELS[doc.access_level] || "团队"}</span>
                  <span className="tag tag-muted">团队：{doc.owner_team || "platform"}</span>
                  <span className="tag tag-muted">所有者：{doc.user_id}</span>
                </div>
                <div className="doc-meta-grid">
                  <div>chunks：{doc.indexed_chunk_count ?? doc.chunks ?? 0}</div>
                  <div>pages：{doc.page_count ?? 0}</div>
                </div>
                <div className="doc-path">最后索引：{formatDate(doc.last_indexed_at)}</div>
              </div>
            ))
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">最近问题单</div>
              <div className="card-subtitle">用于观察团队最近处理过的内部问题</div>
            </div>
            <Link className="inline-link" to="/app/chat">
              进入问答
            </Link>
          </div>

          {recentConversations.length === 0 ? (
            <div className="empty">还没有问答记录，先用真实业务问题跑几轮对话。</div>
          ) : (
            recentConversations.map((conv) => (
              <div className="dashboard-list-card" key={conv.id}>
                <div className="doc-head">
                  <div className="doc-title">{conv.title || "新会话"}</div>
                  <span className="conversation-count">{conv.message_count ?? 0}</span>
                </div>
                <div className="conversation-snippet">{conv.last_snippet || "暂无摘要"}</div>
                <div className="doc-path">更新时间：{formatDate(conv.updated_at || conv.created_at)}</div>
              </div>
            ))
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">知识资产分布</div>
              <div className="card-subtitle">帮助你从产品角度观察知识库结构</div>
            </div>
          </div>

          <div className="distribution-grid">
            <div className="distribution-panel">
              <div className="distribution-title">按文档类型</div>
              {docTypeStats.length === 0 ? (
                <div className="empty">暂无数据</div>
              ) : (
                docTypeStats.map((item) => (
                  <div className="distribution-row" key={item.key}>
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))
              )}
            </div>
            <div className="distribution-panel">
              <div className="distribution-title">按访问级别</div>
              {accessStats.length === 0 ? (
                <div className="empty">暂无数据</div>
              ) : (
                accessStats.map((item) => (
                  <div className="distribution-row" key={item.key}>
                    <span>{item.label}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">评测状态与建议动作</div>
              <div className="card-subtitle">把技术系统转成可运营的产品工作流</div>
            </div>
          </div>

          <div className="evaluation-summary compact-summary">
            {latestReport ? (
              <>
                <div className="summary-head">
                  <div className="summary-title">最近一次评测</div>
                  <span className="tag tag-good">{formatPercent(latestReport.summary?.pass_rate)}</span>
                </div>
                <div>评测时间：{formatDate(latestReport.generated_at)}</div>
                <div>评测文档数：{latestReport.template?.source_count ?? 0}</div>
                <div>总用例数：{latestReport.summary?.total_cases ?? 0}</div>
                <div>平均最终分：{formatPercent(latestReport.summary?.avg_final_score)}</div>
              </>
            ) : (
              <div className="empty">当前还没有最新评测报告，建议先跑一次质量评测建立基线。</div>
            )}
          </div>

          <div className="recommendation-list">
            {recommendations.map((item, index) => (
              <div className="recommendation-item" key={`${index}-${item}`}>
                {item}
              </div>
            ))}
          </div>
        </section>
      </section>

      {loading && <section className="card empty">工作台数据加载中...</section>}
    </div>
  );
}


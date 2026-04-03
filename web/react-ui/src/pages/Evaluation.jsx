import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";

import { runGeneratedSuite } from "../api";

function formatNumber(value, digits = 4) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toFixed(digits);
}

function countFailedCases(benchmarks = []) {
  return benchmarks.reduce((sum, benchmark) => {
    const failed = (benchmark.cases || []).filter((item) => !item.passed).length;
    return sum + failed;
  }, 0);
}

export default function EvaluationPage() {
  const { authUser, authToken, authTeam, authRole, kbId } = useOutletContext();
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalLimit, setEvalLimit] = useState("");
  const [evalReport, setEvalReport] = useState(null);

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
        authUser,
        kbId.trim(),
        evalLimit.trim() ? Number(evalLimit.trim()) : null,
        authToken
      );
      setEvalReport(data);
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "评测运行失败";
      alert(`评测运行失败：${message}`);
    } finally {
      setEvalLoading(false);
    }
  };

  const failedCases = countFailedCases(evalReport?.benchmarks || []);

  return (
    <div className="content-grid">
      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">企业问答评测</div>
            <div className="card-subtitle">按当前登录用户的团队与角色生成可访问文档评测集并输出报告</div>
          </div>
        </div>

        <div className="source-tag-row compact-gap">
          <span className="tag tag-muted">viewer: {authUser || "-"}</span>
          <span className="tag tag-cool">team: {authTeam || "platform"}</span>
          <span className="tag tag-warm">role: {authRole || "member"}</span>
        </div>

        <label>每个 benchmark 运行前 N 条</label>
        <input
          value={evalLimit}
          onChange={(e) => setEvalLimit(e.target.value)}
          placeholder="留空表示跑完整套件"
        />
        <button className="btn" onClick={handleRunEvaluation} disabled={evalLoading}>
          {evalLoading ? "评测中..." : "生成并运行企业问答评测"}
        </button>

        {!evalReport ? (
          <div className="empty">
            点击后会基于当前账号可访问的企业知识库文档自动生成评测集，并返回 pass rate、平均分和失败用例摘要。
          </div>
        ) : (
          <div className="evaluation-summary">
            <div className="source-tag-row compact-gap">
              <span className="tag tag-muted">viewer: {evalReport.viewer?.username || authUser}</span>
              <span className="tag tag-cool">team: {evalReport.viewer?.team || authTeam}</span>
              <span className="tag tag-warm">role: {evalReport.viewer?.role || authRole}</span>
            </div>
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
            <div className="summary-note">可访问文档数：{evalReport.template?.source_count ?? 0}</div>
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
                  <div className="source-tag-row compact-gap">
                    <span className="tag tag-muted">viewer: {benchmark.viewer?.username || "-"}</span>
                    <span className="tag tag-cool">team: {benchmark.viewer?.team || "platform"}</span>
                    <span className="tag tag-warm">role: {benchmark.viewer?.role || "member"}</span>
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
                      <div className="failed-text">
                        final={formatNumber(item.final_score, 2)} / source={formatNumber(item.source_score, 2)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

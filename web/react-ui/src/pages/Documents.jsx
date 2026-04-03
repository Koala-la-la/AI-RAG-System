import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { deleteDocument, listDocuments, reindexDocument, uploadFile } from "../api";

const ACTION_LABELS = {
  indexed: "新入库",
  replaced: "替换重建",
  deduplicated: "重复复用",
  skipped: "按策略跳过"
};

const DOC_TYPE_OPTIONS = [
  { value: "api", label: "API 文档" },
  { value: "sop", label: "SOP" },
  { value: "runbook", label: "运维手册" },
  { value: "faq", label: "FAQ" },
  { value: "architecture", label: "架构设计" },
  { value: "policy", label: "规范制度" },
  { value: "other", label: "其他" }
];

const ACCESS_OPTIONS = [
  { value: "private", label: "个人" },
  { value: "team", label: "团队" },
  { value: "org", label: "全公司" }
];

function actionTone(action) {
  if (action === "deduplicated" || action === "skipped") return "tag-warm";
  if (action === "replaced") return "tag-cool";
  return "tag-good";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function DocumentsPage() {
  const { authUser, authToken, authTeam, authRole, kbId } = useOutletContext();
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [workingSource, setWorkingSource] = useState("");
  const [file, setFile] = useState(null);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [docStatus, setDocStatus] = useState("");
  const [documentType, setDocumentType] = useState("api");
  const [accessLevel, setAccessLevel] = useState("team");
  const [ownerTeam, setOwnerTeam] = useState(authTeam || "platform");
  const [tags, setTags] = useState("");

  const refreshDocuments = async (silent = false) => {
    if (!authToken || !kbId.trim()) {
      setDocuments([]);
      return;
    }

    if (!silent) {
      setDocLoading(true);
    }

    try {
      const data = await listDocuments(authUser, kbId.trim(), authToken);
      setDocuments(data.items || []);
      if (!silent) {
        setDocStatus(`已加载 ${data.total || 0} 份可访问企业文档`);
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
    setOwnerTeam(authTeam || "platform");
  }, [authTeam]);

  useEffect(() => {
    refreshDocuments(true);
  }, [authToken, kbId]);

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
      const metadata = {
        documentType,
        accessLevel,
        ownerTeam,
        tags
      };
      const data = await uploadFile(file, authUser, kbId.trim(), metadata, authToken);
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

  const handleDeleteDocument = async (doc) => {
    if (!window.confirm(`确认删除文档《${doc.source}》吗？这会同时删除向量索引和本地文件。`)) {
      return;
    }

    setWorkingSource(`${doc.user_id}:${doc.source}`);
    try {
      const data = await deleteDocument(authUser, kbId.trim(), doc.source, doc.user_id, authToken);
      setDocStatus(data.message || `已删除 ${doc.source}`);
      await refreshDocuments(true);
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "删除失败";
      alert(`删除失败：${message}`);
    } finally {
      setWorkingSource("");
    }
  };

  const handleReindexDocument = async (doc) => {
    setWorkingSource(`${doc.user_id}:${doc.source}`);
    try {
      const data = await reindexDocument(authUser, kbId.trim(), doc.source, doc.user_id, authToken);
      setDocStatus(data.message || `已重建 ${doc.source}`);
      setUploadSummary({
        filename: doc.source,
        action: "replaced",
        documents: data.documents,
        sections: data.sections,
        chunks: data.chunks,
        pages: data.pages,
        message: data.message,
        registry: data.registry
      });
      await refreshDocuments(true);
    } catch (err) {
      const message = err.response?.data?.detail || err.message || "重建索引失败";
      alert(`重建索引失败：${message}`);
    } finally {
      setWorkingSource("");
    }
  };

  return (
    <div className="content-grid">
      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">导入企业文档</div>
            <div className="card-subtitle">当前团队：{authTeam || "platform"} / 当前角色：{authRole || "member"}</div>
          </div>
        </div>

        <input
          type="file"
          accept=".pdf,.txt,.md"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <div className="form-grid">
          <div>
            <label>文档类型</label>
            <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
              {DOC_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>访问级别</label>
            <select value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)}>
              {ACCESS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>归属团队</label>
            <input value={ownerTeam} onChange={(e) => setOwnerTeam(e.target.value)} placeholder="如：platform / payment / infra" />
          </div>
          <div>
            <label>标签</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="如：支付, 网关, 故障排查" />
          </div>
        </div>

        <button className="btn" onClick={handleUpload} disabled={uploading || !authToken}>
          {uploading ? "上传中..." : "上传到企业知识库"}
        </button>

        {uploadSummary && (
          <div className="upload-summary">
            <div className="summary-head">
              <div className="summary-title">最近一次入库结果</div>
              <span className={`tag ${actionTone(uploadSummary.action)}`}>
                {ACTION_LABELS[uploadSummary.action] || uploadSummary.action || "已完成"}
              </span>
            </div>
            <div>文件：{uploadSummary.filename}</div>
            <div>文档数：{uploadSummary.documents ?? "-"}</div>
            <div>章节数：{uploadSummary.sections ?? "-"}</div>
            <div>页数：{uploadSummary.pages ?? "-"}</div>
            <div>Chunk 数：{uploadSummary.chunks ?? "-"}</div>
            {uploadSummary.registry && (
              <div className="source-tag-row top-gap">
                <span className="tag tag-cool">{DOC_TYPE_OPTIONS.find((item) => item.value === uploadSummary.registry.document_type)?.label || "其他"}</span>
                <span className="tag tag-warm">{ACCESS_OPTIONS.find((item) => item.value === uploadSummary.registry.access_level)?.label || "团队"}</span>
                <span className="tag tag-muted">团队：{uploadSummary.registry.owner_team || "platform"}</span>
              </div>
            )}
            {Array.isArray(uploadSummary.registry?.tags) && uploadSummary.registry.tags.length > 0 && (
              <div className="source-tag-row top-gap">
                {uploadSummary.registry.tags.map((tag) => (
                  <span className="tag tag-muted" key={`upload-${tag}`}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="summary-note">{uploadSummary.message}</div>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">文档中心</div>
            <div className="card-subtitle">{docStatus || "按团队和角色显示可访问文档"}</div>
          </div>
          <button className="btn btn-secondary" onClick={() => refreshDocuments()} disabled={docLoading}>
            {docLoading ? "刷新中..." : "刷新列表"}
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="empty">当前知识库还没有你可访问的企业文档。先上传一份接口文档、SOP 或 FAQ。</div>
        ) : (
          documents.map((doc) => {
            const busy = workingSource === `${doc.user_id}:${doc.source}`;
            return (
              <div className="doc-card" key={`${doc.user_id}-${doc.source}`}>
                <div className="doc-head">
                  <div className="doc-title">{doc.source}</div>
                  <span className={`tag ${doc.exists_on_disk ? "tag-good" : "tag-warm"}`}>
                    {doc.exists_on_disk ? "可重建" : "缺少本地文件"}
                  </span>
                </div>
                <div className="source-tag-row compact-gap">
                  <span className="tag tag-cool">{DOC_TYPE_OPTIONS.find((item) => item.value === doc.document_type)?.label || "其他"}</span>
                  <span className="tag tag-warm">{ACCESS_OPTIONS.find((item) => item.value === doc.access_level)?.label || "团队"}</span>
                  <span className="tag tag-muted">团队：{doc.owner_team || "platform"}</span>
                  <span className="tag tag-muted">所有者：{doc.user_id}</span>
                </div>
                {Array.isArray(doc.tags) && doc.tags.length > 0 && (
                  <div className="source-tag-row compact-gap">
                    {doc.tags.map((tag) => (
                      <span className="tag tag-muted" key={`${doc.user_id}-${doc.source}-${tag}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
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
                    onClick={() => handleReindexDocument(doc)}
                    disabled={busy || !doc.can_reindex}
                  >
                    {busy ? "处理中..." : doc.can_manage ? "重建索引" : "无权限重建"}
                  </button>
                  <button
                    className="mini-btn mini-btn-danger"
                    onClick={() => handleDeleteDocument(doc)}
                    disabled={busy || !doc.can_manage}
                  >
                    {busy ? "处理中..." : doc.can_manage ? "删除文档" : "无权限删除"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { deleteDocument, listDocuments, reindexDocument, uploadFile } from "../api";

const ACTION_LABELS = {
  indexed: "新入库",
  replaced: "替换重建",
  deduplicated: "重复复用",
  skipped: "按策略跳过"
};

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
  const { authUser, authToken, kbId } = useOutletContext();
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [workingSource, setWorkingSource] = useState("");
  const [file, setFile] = useState(null);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [docStatus, setDocStatus] = useState("");

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
      const data = await uploadFile(file, authUser, kbId.trim(), authToken);
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
      const data = await deleteDocument(authUser, kbId.trim(), source, authToken);
      setDocStatus(data.message || `已删除 ${source}`);
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
      const data = await reindexDocument(authUser, kbId.trim(), source, authToken);
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

  return (
    <div className="content-grid">
      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">上传文档</div>
            <div className="card-subtitle">支持 PDF / TXT / MD</div>
          </div>
        </div>

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
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">知识库文档</div>
            <div className="card-subtitle">{docStatus || "可删除/重建索引"}</div>
          </div>
          <button className="btn btn-secondary" onClick={() => refreshDocuments()} disabled={docLoading}>
            {docLoading ? "刷新中..." : "刷新列表"}
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="empty">当前知识库还没有被注册的文档。先上传一个文件。</div>
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
      </section>
    </div>
  );
}

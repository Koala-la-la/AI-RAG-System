# AI-RAG-System

一个面向企业内部知识库场景的 RAG 项目，重点服务于技术团队、运维团队和内部支持团队。系统围绕 `Hybrid Retrieval + Query Rewrite + Rerank + No-Answer Gating + Evaluation` 做了完整实现，用于基于公司内部技术文档、API 文档、运维 SOP 和 FAQ 提供可追溯答案。

它不只是“上传文档后聊天”的 demo，而是一个更接近企业知识助手的系统：支持账号登录、知识库隔离、文档管理、多会话持久化，以及评测闭环。

## Features

- 企业知识问答：支持上传 `PDF / TXT / MD` 文件并建立企业知识库
- 多用户与会话：支持登录、会话持久化、按 `user_id + kb_id` 隔离历史记录
- 分层切块：按 `document -> section -> paragraph -> chunk` 组织文档结构
- Hybrid Retrieval：向量检索 + 词法检索 + RRF 融合
- Query Rewrite：针对追问场景自动改写检索查询
- Rerank + No-Answer：对候选片段重排，并在证据不足时拒答
- 来源可解释：前端展示命中来源、chunk 片段、rerank 分数、overlap 等调试信息
- 企业文档管理：支持文档注册表、同名文档去重策略、删除文档、重建索引
- Evaluation：支持批量 benchmark、多轮 case、Markdown / JSON 报告输出
- 本地模型优先：默认通过 Ollama 调用本地 LLM，并使用本地 Ollama Embedding

## Best-fit Scenario

推荐场景是“企业内部知识库助手 / Engineering Copilot”，优先覆盖以下资料：

- API 文档
- 运维手册
- 故障排查 SOP
- 项目说明文档
- 团队 FAQ

典型问题包括：

- 支付服务回调超时应该如何排查？
- 用户中心 API 的鉴权流程是什么？
- 新服务如何接入发布流水线？
- 某个内部错误码通常对应什么处理方案？

## Tech Stack

- Backend: FastAPI, LangGraph, Python
- Frontend: React, Vite, Axios
- Vector DB: Milvus
- Cache / Memory: Redis
- Local LLM / Embedding: Ollama
- Document Processing: PyPDF, LangChain text splitters
- Evaluation: custom benchmark runner + report generator

## Architecture

```mermaid
flowchart LR
    A["Employee / Web UI"] --> B["FastAPI API"]
    B --> C["Upload Pipeline"]
    C --> D["Structured Chunking"]
    D --> E["Embedding"]
    E --> F["Milvus"]

    B --> G["Conversation Store"]
    B --> H["Query Rewrite"]
    H --> I["Hybrid Retrieval"]
    I --> J["Rerank + Grounding Check"]
    J --> K["Prompt Assembly"]
    K --> L["Ollama LLM"]
    L --> A

    B --> M["Redis Cache / Retrieval History"]
    M --> H

    B --> N["Document Registry"]
    N --> C
    N --> F
```

## Current Capabilities

### Retrieval Pipeline

1. 用户问题进入 LangGraph 主流程
2. 根据最近对话历史执行 Query Rewrite
3. 在 Milvus 中执行向量检索
4. 对候选结果执行词法打分与 RRF 融合
5. 基于 overlap / semantic distance / hybrid score 做 rerank
6. 如果证据不足，直接返回 no-answer
7. 如果证据充分，拼接上下文并调用本地 LLM 生成答案

### Enterprise Knowledge Workflow

- 上传文件会写入本地文档注册表：`data/document_registry.json`
- 新上传文件默认保存到 `data/uploads/<user_id>/<kb_id>/`
- 支持列出知识库文档、删除文档、重建索引
- 支持按用户和知识库维度保存会话：`data/conversations/<user_id>/<kb_id>/`
- 删除和重建索引时会刷新知识库缓存版本，并清空当前知识库检索历史，避免命中旧答案

### Evaluation Pipeline

- 支持 direct QA / follow-up QA / abstention case
- 支持 case tags 统计，如 `summary`、`rewrite`、`safety`
- 支持多文档 suite，并按 `source_filters` 做文档级隔离评测
- 自动发现知识库中的已索引文档并生成 benchmark 模板
- 自动输出：
  - `data/eval/reports/*_latest.json`
  - `data/eval/reports/*_latest.md`
- 便于记录每次检索策略优化前后的结果变化

## Project Structure

```text
app/
  api/                FastAPI routes
  auth/               Auth, session, and request guards
  cache/              Redis cache and retrieval history
  conversation/       Persistent conversation storage
  evaluation/         Benchmark runner and report generation
  knowledge/          Document loading, chunking, embeddings, Milvus storage
  llm/                Ollama client
  rag/                Query rewrite, retrieval, ranking, graph workflow
web/react-ui/
  src/                Enterprise knowledge assistant UI
data/
  conversations/      Persistent chat sessions grouped by user_id/kb_id
  eval/               Benchmarks, suites, and generated reports
  uploads/            Uploaded files grouped by user_id/kb_id
```

## API Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/upload`
  - form-data: `file`, `user_id`, `kb_id`
- `GET /api/documents?user_id=...&kb_id=...`
- `DELETE /api/documents?user_id=...&kb_id=...&source=...`
- `POST /api/documents/reindex`
- `GET /api/conversations?user_id=...&kb_id=...`
- `POST /api/conversations`
- `GET /api/conversations/{conversation_id}/messages`
- `DELETE /api/conversations/{conversation_id}`
- `POST /api/chat`

## Evaluation Commands

列出当前知识库已索引文档：

```bash
python -m app.evaluation.benchmark --list-sources --user-id user001 --kb-id defaultkb
```

基于当前知识库自动生成多文档 benchmark 模板：

```bash
python -m app.evaluation.benchmark --generate-suite-template --user-id user001 --kb-id defaultkb --benchmarks-dir data/eval/benchmarks/generated --suite-output data/eval/generated_multi_doc_suite.json
```

运行多文档评测：

```bash
python -m app.evaluation.benchmark --suite data/eval/generated_multi_doc_suite.json
```

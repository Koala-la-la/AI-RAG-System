
````markdown
 Enterprise RAG System

一个基于 FastAPI + Milvus + Redis + LangGraph + React 构建的企业级 RAG（Retrieval-Augmented Generation，检索增强生成）知识库问答系统。

该项目支持多用户知识库隔离、文档上传解析、向量检索、会话上下文管理、缓存加速、Agent 编排，以及前后端分离部署。适用于企业知识问答、内部文档检索、智能客服、FAQ 系统、知识助手等场景。

---

 项目特性

- 企业级 RAG 架构
  - 基于检索增强生成（RAG）模式构建，支持“上传文档 -> 切分 -> 向量化 -> 检索 -> 生成答案”完整流程。

- 多用户知识库隔离
  - 支持按用户维度隔离知识库数据，避免不同用户之间的文档和检索结果互相干扰。

- Milvus 向量数据库
  - 使用 Milvus 作为向量存储引擎，支持高性能语义检索与可扩展数据管理。

- Redis 缓存与会话管理
  - 使用 Redis 存储对话历史、缓存常见问答结果，提升系统响应速度并降低重复推理成本。

- LangGraph Agent 编排
  - 通过 LangGraph 构建可扩展 Agent 工作流，将检索、上下文拼接、回答生成等节点流程化。

- 文档来源引用
  - 支持返回答案时附带文档来源、片段内容、页码等信息，增强可追溯性和可信度。

- React 前端 UI
  - 提供现代化 Web 界面，支持文件上传、在线问答、来源展示、用户切换等能力。

- 前后端分离**
  - 后端使用 FastAPI，前端使用 React + Vite，便于独立开发、部署与扩展。

- 支持公网访问
  - 可结合 ngrok 实现本地开发环境公网访问，便于测试、演示和外部访问。

---

 系统架构

用户 / 浏览器
      │
      ▼
 React Frontend (Vite)
      │
      ▼
 FastAPI Backend
      │
      ├── Upload API
      │      └── 文档解析 / 切分 / 向量化
      │
      ├── Chat API
      │      └── LangGraph Agent 工作流
      │               ├── Redis 读取会话历史 / 缓存
      │               ├── Milvus 检索相关文档
      │               └── LLM 生成答案
      │
      ├── Redis
      │      ├── 对话历史
      │      └── 缓存结果
      │
      └── Milvus
             └── 文档向量存储
````

---

## 技术栈

### 后端

* FastAPI
* Uvicorn
* LangChain
* LangGraph
* Milvus / pymilvus
* Redis
* Sentence Transformers / HuggingFace Embeddings
* Python 3.11+

### 前端

* React
* Vite
* JavaScript
* Fetch API / Axios（按项目实现）

### 部署与基础设施

* Docker
* Docker Compose
* ngrok（内网穿透）
* Git / GitHub

---

## 项目目录结构

```text
ai-rag-system/
├─ app/
│  ├─ api/
│  │  ├─ chat_api.py              # 问答接口
│  │  └─ upload_api.py            # 文档上传接口
│  │
│  ├─ cache/
│  │  └─ redis_client.py          # Redis 缓存/历史记录
│  │
│  ├─ core/
│  │  └─ config.py                # 配置管理
│  │
│  ├─ knowledge/
│  │  ├─ loader.py                # 文档加载
│  │  ├─ splitter.py              # 文档切分
│  │  ├─ embeddings.py            # 向量模型封装
│  │  └─ milvus_store.py          # Milvus 存储/检索
│  │
│  ├─ rag/
│  │  ├─ graph.py                 # LangGraph 工作流
│  │  ├─ retriever.py             # 检索逻辑
│  │  ├─ generator.py             # 答案生成
│  │  └─ prompt.py                # Prompt 模板
│  │
│  ├─ schemas/
│  │  └─ chat.py                  # 请求/响应数据模型
│  │
│  └─ main.py                     # FastAPI 入口
│
├─ web/
│  └─ react-ui/
│     ├─ src/
│     │  ├─ App.jsx
│     │  ├─ components/
│     │  └─ api/
│     ├─ package.json
│     └─ vite.config.js
│
├─ uploads/                       # 本地上传文件目录（开发环境）
├─ docker-compose.yml
├─ requirements.txt
├─ .env.example
├─ .gitignore
└─ README.md
```

---

## 核心功能说明

### 1. 文档上传与知识入库

系统支持上传企业文档（如 PDF、TXT、Markdown 等），后端会自动完成以下流程：

1. 加载文档内容
2. 按规则切分为多个文本块
3. 调用嵌入模型生成向量
4. 写入 Milvus 向量数据库
5. 绑定用户 ID、文档名、页码、来源等元数据

这样在后续问答时，系统可以按用户范围检索其专属知识库。

---

### 2. 检索增强生成（RAG）

用户提问后，系统会执行以下流程：

1. 读取当前用户问题
2. 检查 Redis 中是否存在可复用缓存
3. 从 Redis 获取历史上下文
4. 在 Milvus 中检索最相关的文档片段
5. 将“问题 + 历史 + 检索结果”交给大模型
6. 返回最终答案和引用来源

相比直接调用大模型，RAG 可以显著提升回答的准确性、上下文相关性与可解释性。

---

### 3. 多用户知识库

系统通过 `user_id` 对数据进行隔离：

* 上传文档时绑定用户
* 检索时只查询当前用户的数据
* 历史会话按用户维度保存
* 缓存结果按用户维度区分

这样可以支持多租户、多个员工、多个团队或多个客户同时使用同一个系统。

---

### 4. 来源引用

回答结果中可返回：

* 命中文档名称
* 文档片段内容
* 页码
* 来源标识

这对于企业内部知识问答尤其重要，因为用户不仅需要“答案”，还需要知道“答案来自哪里”。

---

## 环境要求

在开始之前，请确保你的环境中已安装：

* Python 3.11 或更高版本
* Node.js 18 或更高版本
* Docker Desktop
* Git
* 可选：ngrok

---

## 快速开始

### 1. 克隆项目

```bash
git clone git@github.com:Koala-la-la/AI-RAG-System.git
cd AI-RAG-System
```

如果你使用 HTTPS：

```bash
git clone https://github.com/Koala-la-la/AI-RAG-System.git
cd AI-RAG-System
```

---

### 2. 创建 Python 虚拟环境

```bash
python -m venv .venv
```

Windows PowerShell 激活：

```powershell
.venv\Scripts\Activate.ps1
```

Windows CMD 激活：

```cmd
.venv\Scripts\activate
```

安装依赖：

```bash
pip install -r requirements.txt
```

---

### 3. 启动基础服务（Milvus + Redis）

确保 Docker Desktop 已启动，然后执行：

```bash
docker compose up -d
```

查看服务状态：

```bash
docker compose ps
```

正常情况下你会看到：

* Redis
* Milvus
* etcd
* MinIO

都处于 `Up` 状态。

---

### 4. 配置环境变量

在项目根目录创建 `.env` 文件，可参考：

```env
APP_NAME=Enterprise RAG System
APP_ENV=dev
APP_HOST=0.0.0.0
APP_PORT=8000

MILVUS_HOST=127.0.0.1
MILVUS_PORT=19530
MILVUS_COLLECTION=enterprise_knowledge

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0

EMBED_MODEL=sentence-transformers/all-MiniLM-L6-v2

LLM_PROVIDER=ollama
LLM_MODEL=qwen2.5:7b

UPLOAD_DIR=uploads
TOP_K=4
CHUNK_SIZE=500
CHUNK_OVERLAP=50
```

如果你使用 HuggingFace 下载模型较慢，可以额外设置：

```env
HF_TOKEN=your_huggingface_token
```

---

### 5. 启动后端

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

启动成功后访问：

* Swagger 文档：`http://127.0.0.1:8000/docs`
* OpenAPI：`http://127.0.0.1:8000/openapi.json`

---

### 6. 启动前端

进入前端目录：

```bash
cd web/react-ui
npm install
npm run dev
```

默认访问地址：

```text
http://localhost:5173
```

---

## API 说明

### 1. 上传文档

**接口：**

```http
POST /api/upload
```

**功能：**
上传文档并写入当前用户知识库。

**示例参数：**

* `file`: 上传的文件
* `user_id`: 当前用户 ID

---

### 2. 问答接口

**接口：**

```http
POST /api/chat
```

**请求示例：**

```json
{
  "question": "RAG 是什么？",
  "user_id": "user_001"
}
```

**响应示例：**

```json
{
  "answer": "RAG（Retrieval-Augmented Generation）是一种将检索与生成结合的技术方案……",
  "sources": [
    {
      "document": "rag_intro.pdf",
      "page": 2,
      "content": "RAG combines retrieval and generation..."
    }
  ]
}
```

---

## 使用流程

### 第一步：上传文档

先将 PDF、TXT、Markdown 等文档上传到系统中。

### 第二步：文档切分与向量化

系统自动对文档进行切分并写入 Milvus。

### 第三步：开始提问

用户在前端输入问题，系统会基于当前用户知识库进行检索和生成。

### 第四步：查看答案与来源

系统返回答案，并展示引用片段与来源信息。

---

## ngrok 公网访问

如果你希望本地部署的系统被他人访问，可以使用 ngrok 暴露本地端口。

### 暴露后端

```bash
ngrok http 8000
```

### 暴露前端

```bash
ngrok http 5173
```

ngrok 会返回一个公网地址，例如：

```text
https://xxxx-xxxx.ngrok-free.app
```

你可以将该地址提供给其他人访问。

注意：
如果前端调用后端接口，前端中的 API Base URL 也要同步修改为对应的 ngrok 地址。

---

## 常见问题

### 1. `ModuleNotFoundError`

说明缺少依赖，请重新安装：

```bash
pip install -r requirements.txt
```

---

### 2. 无法连接 Milvus

请先确认 Docker 已启动，并执行：

```bash
docker compose ps
```

检查 `milvus`、`etcd`、`minio` 是否都正常运行。

---

### 3. 前端点击发送没有反应

通常有以下几种原因：

* 前端请求地址配置错误
* 后端接口路径不一致
* 浏览器控制台报错
* 跨域未配置
* `/api/chat` 返回 404 或 500

建议按以下顺序排查：

1. 打开浏览器开发者工具
2. 查看 Network 是否请求成功
3. 查看 Console 是否有报错
4. 查看后端终端是否收到请求日志
5. 确认前端 API 地址和后端路由一致

---

### 4. GitHub 推送失败

如果 HTTPS 推送不稳定，可改用 SSH：

```bash
ssh -T git@github.com
git remote set-url origin git@github.com:Koala-la-la/AI-RAG-System.git
git push -u origin main
```

---

## 开发建议

后续可以继续升级的方向包括：

* 用户登录与鉴权（JWT / OAuth2）
* 文档权限控制
* 混合检索（向量 + 关键词）
* 重排序模型（Reranker）
* 文档解析增强（OCR、表格提取）
* 对话记忆持久化
* 任务队列与异步入库
* Docker 一键部署
* Nginx 反向代理
* HTTPS 域名部署
* 管理后台与监控面板

---

## 适用场景

* 企业内部知识问答
* 员工助手 / 培训助手
* 文档检索与智能摘要
* 客服知识库机器人
* 多租户 SaaS 知识问答系统
* 行业垂直知识助手

---

## 安全与注意事项

* 不要将 `.env`、密钥、数据库凭证提交到 GitHub。
* 不要将 `volumes/`、`node_modules/`、运行时缓存等目录提交到仓库。
* 生产环境建议增加鉴权、限流、日志审计和异常监控。
* 若对公网开放，请务必配置安全策略与访问控制。

---

## Git 提交流程

```bash
git status
git add .
git commit -m "feat: update enterprise rag system"
git push
```

---

## License

本项目可根据你的需要选择开源协议，例如：

* MIT License
* Apache License 2.0
* 私有项目（不公开 License）

如果你准备开源，推荐使用 MIT License。

---

## 作者

**Koala-la-la**

如果这个项目对你有帮助，欢迎 Star、Fork 和交流。

联系方式：shenjiahang1024@163.com



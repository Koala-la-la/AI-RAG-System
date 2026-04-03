import axios from "axios";

const API_BASE = "http://127.0.0.1:8000/api";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 120000
});

function authHeaders(token) {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function registerUser(username, password, team, role) {
  const { data } = await client.post("/auth/register", {
    username,
    password,
    team,
    role
  });
  return data;
}

export async function loginUser(username, password) {
  const { data } = await client.post("/auth/login", {
    username,
    password
  });
  return data;
}

export async function logoutUser(token) {
  const { data } = await client.post(
    "/auth/logout",
    {},
    {
      headers: authHeaders(token)
    }
  );
  return data;
}

export async function chat(payload, token) {
  const { data } = await client.post("/chat", payload, {
    headers: authHeaders(token)
  });
  return data;
}

export async function listConversations(userId, kbId, token) {
  const { data } = await client.get("/conversations", {
    params: {
      user_id: userId,
      kb_id: kbId
    },
    headers: authHeaders(token)
  });
  return data;
}

export async function createConversation(userId, kbId, payload, token) {
  const { data } = await client.post(
    "/conversations",
    {
      user_id: userId,
      kb_id: kbId,
      ...(payload || {})
    },
    {
      headers: authHeaders(token)
    }
  );
  return data;
}

export async function deleteConversation(userId, kbId, conversationId, token) {
  const { data } = await client.delete(`/conversations/${conversationId}`, {
    params: {
      user_id: userId,
      kb_id: kbId
    },
    headers: authHeaders(token)
  });
  return data;
}

export async function getConversationMessages(userId, kbId, conversationId, token) {
  const { data } = await client.get(`/conversations/${conversationId}/messages`, {
    params: {
      user_id: userId,
      kb_id: kbId
    },
    headers: authHeaders(token)
  });
  return data;
}

export async function updateConversation(userId, kbId, conversationId, updates, token) {
  const { data } = await client.patch(
    `/conversations/${conversationId}`,
    {
      user_id: userId,
      kb_id: kbId,
      ...(updates || {})
    },
    {
      headers: authHeaders(token)
    }
  );
  return data;
}

export async function uploadFile(file, userId, kbId, metadata, token) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("user_id", userId);
  formData.append("kb_id", kbId);
  formData.append("document_type", metadata?.documentType || "other");
  formData.append("access_level", metadata?.accessLevel || "team");
  formData.append("owner_team", metadata?.ownerTeam || "platform");
  formData.append("tags", metadata?.tags || "");

  const { data } = await client.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
      ...authHeaders(token)
    }
  });
  return data;
}

export async function listDocuments(userId, kbId, token) {
  const { data } = await client.get("/documents", {
    params: {
      user_id: userId,
      kb_id: kbId
    },
    headers: authHeaders(token)
  });
  return data;
}

export async function deleteDocument(userId, kbId, source, ownerId, token) {
  const { data } = await client.delete("/documents", {
    params: {
      user_id: userId,
      kb_id: kbId,
      source,
      owner_id: ownerId || null
    },
    headers: authHeaders(token)
  });
  return data;
}

export async function reindexDocument(userId, kbId, source, ownerId, token) {
  const { data } = await client.post(
    "/documents/reindex",
    {
      user_id: userId,
      kb_id: kbId,
      source,
      owner_id: ownerId || null
    },
    {
      headers: authHeaders(token)
    }
  );
  return data;
}

export async function getLatestEvaluationReport(userId, kbId, token) {
  const { data } = await client.get("/evaluation/latest-report", {
    params: {
      user_id: userId,
      kb_id: kbId
    },
    headers: authHeaders(token)
  });
  return data;
}

export async function runGeneratedSuite(userId, kbId, limit, token) {
  const payload = {
    user_id: userId,
    kb_id: kbId,
    limit: limit ? Number(limit) : null
  };
  const { data } = await client.post("/evaluation/run-generated-suite", payload, {
    headers: authHeaders(token)
  });
  return data;
}

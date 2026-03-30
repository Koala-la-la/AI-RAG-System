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

export async function registerUser(username, password) {
  const { data } = await client.post("/auth/register", {
    username,
    password
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

export async function createConversation(userId, kbId, title, token) {
  const { data } = await client.post(
    "/conversations",
    {
      user_id: userId,
      kb_id: kbId,
      title: title || null
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

export async function updateConversationTitle(userId, kbId, conversationId, title, token) {
  const { data } = await client.patch(
    `/conversations/${conversationId}`,
    {
      user_id: userId,
      kb_id: kbId,
      title
    },
    {
      headers: authHeaders(token)
    }
  );
  return data;
}

export async function uploadFile(file, userId, kbId, token) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("user_id", userId);
  formData.append("kb_id", kbId);

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

export async function deleteDocument(userId, kbId, source, token) {
  const { data } = await client.delete("/documents", {
    params: {
      user_id: userId,
      kb_id: kbId,
      source
    },
    headers: authHeaders(token)
  });
  return data;
}

export async function reindexDocument(userId, kbId, source, token) {
  const { data } = await client.post(
    "/documents/reindex",
    {
      user_id: userId,
      kb_id: kbId,
      source
    },
    {
      headers: authHeaders(token)
    }
  );
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

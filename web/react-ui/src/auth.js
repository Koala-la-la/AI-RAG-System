const USER_KEY = "rag:auth_user";
const TOKEN_KEY = "rag:auth_token";
const LAST_KB_KEY = "rag:last_kb";

export function getAuth() {
  return {
    user: localStorage.getItem(USER_KEY) || "",
    token: localStorage.getItem(TOKEN_KEY) || ""
  };
}

export function setAuth(user, token) {
  if (user) {
    localStorage.setItem(USER_KEY, user);
  } else {
    localStorage.removeItem(USER_KEY);
  }
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearAuth() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function getLastKb(defaultValue = "defaultkb") {
  return localStorage.getItem(LAST_KB_KEY) || defaultValue;
}

export function setLastKb(value) {
  if (value) {
    localStorage.setItem(LAST_KB_KEY, value);
  }
}

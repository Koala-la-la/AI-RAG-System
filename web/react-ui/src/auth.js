const USER_KEY = "rag:auth_user";
const TOKEN_KEY = "rag:auth_token";
const TEAM_KEY = "rag:auth_team";
const ROLE_KEY = "rag:auth_role";
const LAST_KB_KEY = "rag:last_kb";

export function getAuth() {
  return {
    user: localStorage.getItem(USER_KEY) || "",
    token: localStorage.getItem(TOKEN_KEY) || "",
    team: localStorage.getItem(TEAM_KEY) || "platform",
    role: localStorage.getItem(ROLE_KEY) || "member"
  };
}

export function setAuth(user, token, team, role) {
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
  if (team) {
    localStorage.setItem(TEAM_KEY, team);
  } else {
    localStorage.removeItem(TEAM_KEY);
  }
  if (role) {
    localStorage.setItem(ROLE_KEY, role);
  } else {
    localStorage.removeItem(ROLE_KEY);
  }
}

export function clearAuth() {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TEAM_KEY);
  localStorage.removeItem(ROLE_KEY);
}

export function getLastKb(defaultValue = "defaultkb") {
  return localStorage.getItem(LAST_KB_KEY) || defaultValue;
}

export function setLastKb(value) {
  if (value) {
    localStorage.setItem(LAST_KB_KEY, value);
  }
}

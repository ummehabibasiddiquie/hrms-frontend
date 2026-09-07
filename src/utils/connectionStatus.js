let state = { visible: false, message: "", kind: "offline" };
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn(state));
}

export function getConnectionState() {
  return state;
}

export function subscribeConnection(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function showConnectionIssue(message, kind = "offline") {
  const text = (message || "No internet. Check your connection.").trim();
  state = { visible: true, message: text, kind: kind === "timeout" ? "timeout" : "offline" };
  emit();
}

export function hideConnectionIssue() {
  if (!state.visible) return;
  state = { visible: false, message: "", kind: "offline" };
  emit();
}

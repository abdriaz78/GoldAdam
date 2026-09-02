const $ = (id) => document.getElementById(id);
const send = (msg) => new Promise((res) => chrome.runtime.sendMessage(msg, res));

function setStatus(text, color = "#475569") {
  const s = $("status");
  s.textContent = text;
  s.style.color = color;
}

async function refresh() {
  const state = await send({ type: "GET_STATE" });
  if (state?.crmUrl) $("crmUrl").value = state.crmUrl;
  if (state?.hasToken) {
    // verify token still valid
    const me = await send({ type: "CRM_FETCH", path: "/api/auth/me" });
    if (me?.ok) {
      $("signin").style.display = "none";
      $("signedin").style.display = "block";
      $("who").textContent = `Signed in as ${me.data.user.email} (${me.data.user.role})`;
      setStatus("Ready. Open agent.goldadam.us and use the on-page panel to sync.", "#16a34a");
      return;
    }
  }
  $("signin").style.display = "block";
  $("signedin").style.display = "none";
}

$("login").onclick = async () => {
  const crmUrl = $("crmUrl").value.trim();
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!crmUrl || !email || !password) return setStatus("Fill in all fields", "#dc2626");
  setStatus("Signing in…");
  const res = await send({ type: "LOGIN", crmUrl, email, password });
  if (res?.ok) {
    setStatus("Signed in!", "#16a34a");
    refresh();
  } else {
    setStatus(res?.error || "Login failed", "#dc2626");
  }
};

$("logout").onclick = async () => {
  await send({ type: "LOGOUT" });
  refresh();
};

refresh();

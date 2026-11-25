const $ = (id) => document.getElementById(id);

const state = {
  connected: false,
  nick: "Guest_",
  network: "Libera.Chat",
  server: "irc.libera.chat",
  active: "status",
  channels: {},
  privateTabs: {},
};

const demoUsers = ["@Operator", "Moss", "pixel", "RoadRunner", "Skyline", "byte_bard"];

function clock() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}
function log(message, type = "system", target = state.active, nick = "") {
  if (target === "status") target = "status";
  const pane = $("messageLog");
  const line = document.createElement("div");
  line.className = `log-line ${type}`;
  const time = document.createElement("span");
  time.className = "timestamp";
  time.textContent = `[${clock()}]`;
  const content = document.createElement("span");
  content.className = "message";
  content.textContent = nick ? `<${nick}> ${message}` : message;
  line.append(time, content);
  pane.append(line);
  pane.scrollTop = pane.scrollHeight;
}
function activeLogTarget() { return state.active; }
function setStatus(connected, text) {
  state.connected = connected;
  $("bottomStatus").textContent = connected ? `Connected as ${state.nick}` : "Ready";
}
function renderTree() {
  const tree = $("channelTree");
  tree.replaceChildren();
  const network = document.createElement("div");
  network.className = "tree-network";
  network.innerHTML = `<span class="tree-arrow">▾</span><span class="tree-icon">◉</span>`;
  const label = document.createElement("span");
  label.textContent = state.connected ? state.network : state.network + " (offline)";
  network.append(label);
  tree.append(network);
  if (!state.connected) {
    const hint = document.createElement("div");
    hint.className = "tree-placeholder";
    hint.textContent = "Connect to a network to begin.";
    tree.append(hint);
    return;
  }
  const group = document.createElement("div");
  group.className = "tree-group";
  group.textContent = "Channels";
  tree.append(group);
  Object.keys(state.channels).forEach(channel => {
    const button = document.createElement("button");
    button.className = `tree-channel ${state.active === channel ? "selected" : ""}`;
    button.textContent = channel;
    button.onclick = () => activate(channel);
    tree.append(button);
  });
}
function renderTabs() {
  const tabs = $("tabs");
  tabs.replaceChildren();
  const names = ["status", ...Object.keys(state.channels), ...Object.keys(state.privateTabs)];
  names.forEach(name => {
    const tab = document.createElement("div");
    tab.className = `tab ${state.active === name ? "active" : ""}`;
    tab.textContent = name === "status" ? "Status" : name;
    tab.onclick = () => activate(name);
    tabs.append(tab);
  });
}
function renderUsers() {
  const list = $("userList");
  list.replaceChildren();
  const users = state.channels[state.active];
  if (!users) {
    const empty = document.createElement("div");
    empty.className = "empty-users";
    empty.textContent = "No channel selected";
    list.append(empty);
    $("userCount").textContent = "(0)";
    return;
  }
  $("userCount").textContent = `(${users.length})`;
  users.forEach(user => {
    const item = document.createElement("div");
    item.className = `user-item ${user.startsWith("@") ? "op" : ""}`;
    item.textContent = user;
    list.append(item);
  });
}
function activate(target) {
  state.active = target;
  $("messageLog").replaceChildren();
  $("topicBar").textContent = target === "status"
    ? "Network status and connection messages."
    : `${target} — Welcome. This is a local frontend preview.`;
  if (target === "status") {
    log("IIRC status window.", "system", target);
    log(state.connected ? `Connected to ${state.network} as ${state.nick}.` : "Not connected.", "notice", target);
  } else {
    log(`Now viewing ${target}.`, "system", target);
    if (state.channels[target]) log("Topic: Be respectful and enjoy the conversation.", "notice", target);
  }
  renderTabs(); renderTree(); renderUsers();
}
function connect(network, nick, server) {
  state.network = network;
  state.nick = nick.trim() || "Guest_";
  state.server = server.trim();
  setStatus(true, `Connected to ${network} (demo)`);
  renderTree(); renderTabs(); renderUsers();
  activate("status");
  log(`Connecting to ${state.server}…`, "system");
  log(`*** Simulated connection established to ${state.network}.`, "notice");
  log(`Your nickname is ${state.nick}.`, "notice");
  log("This is a frontend demo; no messages are being sent to a real IRC network.", "notice");
}
function joinChannel(raw) {
  if (!state.connected) { log("Connect to a network before joining a channel.", "error"); return; }
  let channel = raw.trim();
  if (!channel) return;
  if (!channel.startsWith("#") && !channel.startsWith("&")) channel = "#" + channel;
  if (!state.channels[channel]) state.channels[channel] = [...demoUsers];
  activate(channel);
  log(`${state.nick} has joined ${channel}`, "join");
  renderUsers();
}
function command(text) {
  const [cmd, ...rest] = text.trim().split(/\s+/);
  const arg = rest.join(" ");
  switch (cmd.toLowerCase()) {
    case "/help":
      log("Commands: /join #channel, /part, /nick name, /msg nick message, /who, /quit", "notice"); break;
    case "/join": joinChannel(arg); break;
    case "/part":
      if (state.channels[state.active]) {
        const old = state.active; delete state.channels[old]; activate("status");
        log(`You have left ${old}.`, "notice");
      } else log("You are not in a channel.", "error");
      break;
    case "/nick":
      if (!arg) { log("Usage: /nick newname", "error"); break; }
      state.nick = arg.split(/\s+/)[0];
      log(`You are now known as ${state.nick}.`, "notice");
      $("bottomStatus").textContent = `Connected as ${state.nick}`;
      break;
    case "/who":
      if (state.channels[state.active]) log(`Users: ${state.channels[state.active].join(", ")}`, "notice");
      else log("Select a channel first.", "error");
      break;
    case "/msg": {
      const [to, ...words] = rest;
      if (!to || !words.length) { log("Usage: /msg nickname message", "error"); break; }
      const target = to;
      state.privateTabs[target] = true;
      activate(target);
      log(words.join(" "), "chat", target, state.nick);
      break;
    }
    case "/quit":
      setStatus(false, "Disconnected");
      state.channels = {}; state.privateTabs = {};
      activate("status");
      log("Disconnected from the demo network.", "notice");
      break;
    default: log(`Unknown command: ${cmd}. Try /help.`, "error");
  }
}
$("messageForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("messageInput");
  const value = input.value.trim();
  if (!value) return;
  input.value = "";
  if (value.startsWith("/")) { command(value); return; }
  if (!state.connected) { log("Connect before sending messages.", "error"); return; }
  if (state.active === "status") { log("Join a channel or open a private message first.", "error"); return; }
  log(value, "chat", state.active, state.nick);
});
$("connectBtn").onclick = () => $("connectDialog").showModal();
$("joinBtn").onclick = () => $("joinDialog").showModal();
$("nickBtn").onclick = () => {
  const next = prompt("New nickname:", state.nick);
  if (next && next.trim()) command(`/nick ${next.trim()}`);
};
$("connectForm").addEventListener("submit", (event) => {
  if (event.submitter?.value !== "connect") return;
  event.preventDefault();
  connect($("dialogNetwork").value, $("nickInput").value, $("serverInput").value);
  $("connectDialog").close();
});
$("joinForm").addEventListener("submit", (event) => {
  if (event.submitter?.value !== "join") return;
  event.preventDefault();
  joinChannel($("channelInput").value);
  $("joinDialog").close();
});
$("networkSelect").addEventListener("change", () => {
  const network = $("networkSelect").value;
  const defaults = { "Libera.Chat": "irc.libera.chat", "OFTC": "irc.oftc.net", "IRCnet": "irc.ircnet.com", "EFnet": "irc.efnet.org", "Custom": "" };
  $("dialogNetwork").value = network;
  $("serverInput").value = defaults[network] ?? "";
  if (network === "Custom") $("connectDialog").showModal();
});
$("dialogNetwork").addEventListener("change", () => {
  const defaults = { "Libera.Chat": "irc.libera.chat", "OFTC": "irc.oftc.net", "IRCnet": "irc.ircnet.com", "EFnet": "irc.efnet.org", "Custom": "" };
  $("serverInput").value = defaults[$("dialogNetwork").value] ?? "";
});
renderTree(); renderTabs(); renderUsers();

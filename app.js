
const $ = (id) => document.getElementById(id);

const WS_URL = "ws://127.0.0.1:8000/ws";

const state = {
  connected: false,
  connecting: false,
  nick: "Guest_",
  network: "IIRC",
  active: "status",
  socket: null,
  channels: {},
  privateTabs: {},
  logs: { status: [] }
};

function clock() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function log(message, type = "system", target = state.active, nick = "") {
  if (!state.logs[target]) state.logs[target] = [];

  state.logs[target].push({
    time: clock(),
    message,
    type,
    nick
  });

  if (state.active === target) renderLog();
}

function renderLog() {
  const pane = $("messageLog");
  pane.replaceChildren();

  for (const entry of state.logs[state.active] || []) {
    const line = document.createElement("div");
    line.className = `log-line ${entry.type}`;

    const time = document.createElement("span");
    time.className = "timestamp";
    time.textContent = `[${entry.time}]`;

    const content = document.createElement("span");
    content.className = "message";
    content.textContent = entry.nick
      ? `<${entry.nick}> ${entry.message}`
      : entry.message;

    line.append(time, content);
    pane.append(line);
  }

  pane.scrollTop = pane.scrollHeight;
}

function setStatus(text) {
  $("bottomStatus").textContent = text;
}

function send(data) {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
    log("Not connected to the IIRC server.", "error");
    return false;
  }

  state.socket.send(JSON.stringify(data));
  return true;
}

function renderTree() {
  const tree = $("channelTree");
  tree.replaceChildren();

  const network = document.createElement("div");
  network.className = "tree-network";
  network.textContent = state.connected ? "◉ IIRC" : "◉ IIRC (offline)";
  tree.append(network);

  if (!state.connected) {
    const hint = document.createElement("div");
    hint.className = "tree-placeholder";
    hint.textContent = "Connect to IIRC to begin.";
    tree.append(hint);
    return;
  }

  const group = document.createElement("div");
  group.className = "tree-group";
  group.textContent = "Channels";
  tree.append(group);

  Object.keys(state.channels).forEach(channel => {
    const button = document.createElement("button");
    button.className =
      `tree-channel ${state.active === channel ? "selected" : ""}`;
    button.textContent = channel;
    button.onclick = () => activate(channel);
    tree.append(button);
  });
}

function renderTabs() {
  const tabs = $("tabs");
  tabs.replaceChildren();

  const names = [
    "status",
    ...Object.keys(state.channels),
    ...Object.keys(state.privateTabs)
  ];

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
    item.className = "user-item";
    item.textContent = user;
    list.append(item);
  });
}

function activate(target) {
  state.active = target;

  $("topicBar").textContent =
    target === "status"
      ? "IIRC server status and connection messages."
      : `${target} — International Internet Relay Chat`;

  renderLog();
  renderTabs();
  renderTree();
  renderUsers();
}

function updateUsers(channel, users) {
  state.channels[channel] = users || [];
  renderUsers();
}

function connect() {
  if (state.connected || state.connecting) return;

  state.connecting = true;
  setStatus("Connecting...");
  log("Connecting to the IIRC server...", "system", "status");

  const socket = new WebSocket(WS_URL);
  state.socket = socket;

  socket.onopen = () => {
    state.connecting = false;
    state.connected = true;

    setStatus("Connected to IIRC");
    renderTree();
    renderTabs();

    log("WebSocket connection established.", "notice", "status");
  };

  socket.onmessage = (event) => {
    let data;

    try {
      data = JSON.parse(event.data);
    } catch {
      log("Received an invalid server response.", "error");
      return;
    }

    switch (data.type) {
      case "welcome":
        state.nick = data.nickname;
        setStatus(`Connected as ${state.nick}`);
        log(data.message, "notice", "status");
        break;

      case "joined":
        updateUsers(data.channel, data.users);
        if (!state.logs[data.channel]) state.logs[data.channel] = [];
        activate(data.channel);
        log(`You joined ${data.channel}.`, "join");
        break;

      case "message":
        log(data.text, "chat", data.channel, data.nickname);
        break;

      case "user_joined":
        log(`${data.nickname} joined the channel.`, "join");
        if (state.channels[state.active] &&
            !state.channels[state.active].includes(data.nickname)) {
          state.channels[state.active].push(data.nickname);
          renderUsers();
        }
        break;

      case "user_left":
        log(`${data.nickname} left the channel.`, "notice");
        if (state.channels[state.active]) {
          state.channels[state.active] =
            state.channels[state.active].filter(
              name => name !== data.nickname
            );
          renderUsers();
        }
        break;

      case "nick_changed":
        log(
          `${data.old_nickname} is now known as ${data.nickname}.`,
          "notice"
        );

        for (const channel of Object.keys(state.channels)) {
          state.channels[channel] =
            state.channels[channel].map(name =>
              name === data.old_nickname ? data.nickname : name
            );
        }

        if (state.nick === data.old_nickname) {
          state.nick = data.nickname;
          setStatus(`Connected as ${state.nick}`);
        }

        renderUsers();
        break;

      case "error":
        log(data.message, "error");
        break;
    }
  };

  socket.onerror = () => {
    log("Could not connect to the IIRC server.", "error");
  };

  socket.onclose = () => {
    state.connected = false;
    state.connecting = false;
    state.socket = null;
    state.channels = {};

    setStatus("Disconnected");
    renderTree();
    renderTabs();
    renderUsers();

    log("Disconnected from IIRC.", "notice", "status");

    if (state.active !== "status") activate("status");
  };
}

function joinChannel(raw) {
  const channel = raw.trim();
  if (!channel) return;

  if (!state.connected) {
    log("Connect to IIRC first.", "error");
    return;
  }

  send({
    type: "join",
    channel: channel.startsWith("#") ? channel : `#${channel}`
  });
}

function command(text) {
  const [cmd, ...rest] = text.trim().split(/\s+/);
  const arg = rest.join(" ");

  switch (cmd.toLowerCase()) {
    case "/help":
      log("Commands: /join #channel, /nick name, /who, /quit", "notice");
      break;

    case "/join":
      joinChannel(arg);
      break;

    case "/nick":
      if (!arg) {
        log("Usage: /nick newname", "error");
        break;
      }
      send({ type: "nick", nickname: arg });
      break;

    case "/who":
      if (state.channels[state.active]) {
        log(`Users: ${state.channels[state.active].join(", ")}`, "notice");
      } else {
        log("Select a channel first.", "error");
      }
      break;

    case "/quit":
      if (state.socket) state.socket.close();
      break;

    case "/part":
    case "/msg":
      log(`${cmd} is not implemented on the server yet.`, "error");
      break;

    default:
      log(`Unknown command: ${cmd}. Try /help.`, "error");
  }
}

$("messageForm").addEventListener("submit", event => {
  event.preventDefault();

  const input = $("messageInput");
  const value = input.value.trim();

  if (!value) return;
  input.value = "";

  if (value.startsWith("/")) {
    command(value);
    return;
  }

  if (!state.connected) {
    log("Connect to IIRC first.", "error");
    return;
  }

  if (!state.channels[state.active]) {
    log("Join a channel before sending messages.", "error");
    return;
  }

  send({ type: "message", text: value });
});

$("connectBtn").onclick = () => connect();

$("joinBtn").onclick = () => {
  $("joinDialog").showModal();
};

$("nickBtn").onclick = () => {
  const next = prompt("New nickname:", state.nick);
  if (next && next.trim()) command(`/nick ${next.trim()}`);
};

$("joinForm").addEventListener("submit", event => {
  if (event.submitter?.value !== "join") return;

  event.preventDefault();
  joinChannel($("channelInput").value);
  $("joinDialog").close();
});

$("networkSelect").addEventListener("change", () => {
  if ($("networkSelect").value === "Custom") {
    log("IIRC currently connects to your own backend.", "notice");
  }
});

renderTree();
renderTabs();
renderUsers();
activate("status");
log("IIRC frontend loaded.", "notice", "status");
log("Waiting for connection to the IIRC server.", "system", "status");

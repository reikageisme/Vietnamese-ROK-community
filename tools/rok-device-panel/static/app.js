/* RokViet Device Panel — giao diện thuần, không cần bước build. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const TAP_THRESHOLD = 0.012; // dưới ngưỡng này coi là chạm, trên là vuốt

  const S = {
    token: "",
    devices: [],
    byserial: new Map(),
    selected: new Set(),
    focus: null,
    view: "grid",
    side: "control",
    pointer: "tap",
    lastPoint: null,
    lastRegion: null,
    frameAt: new Map(),
    broadcast: { armed: false, supported: true, secondsLeft: 0 },
    gamePackage: "com.rok.gp.vn",
    streaming: null,
    h264: false,        // server có bật luồng H.264 không
    player: null,       // bộ giải mã đang chạy
    source: "still",    // "h264" | "still"
  };

  /* ---------------- nền tảng ---------------- */

  function toast(message, kind = "") {
    const node = document.createElement("div");
    if (kind) node.className = kind;
    node.textContent = message;
    $("toast").appendChild(node);
    setTimeout(() => node.remove(), kind === "bad" ? 6000 : 3200);
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        "X-Panel-Token": S.token,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    if (response.status === 401) {
      openGate();
      throw new Error("Token không hợp lệ.");
    }
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
    if (!response.ok) throw new Error((payload && payload.detail) || `Lỗi ${response.status}`);
    return payload;
  }

  const post = (path, body) => api(path, { method: "POST", body: JSON.stringify(body || {}) });
  const withToken = (path) => path + (path.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(S.token);

  /* ---------------- cổng token ---------------- */

  function openGate() {
    $("app").hidden = true;
    $("gate").hidden = false;
  }

  function bootToken() {
    const fromUrl = new URLSearchParams(location.search).get("token");
    if (fromUrl) {
      sessionStorage.setItem("panelToken", fromUrl);
      history.replaceState(null, "", location.pathname);
    }
    S.token = sessionStorage.getItem("panelToken") || "";
  }

  $("gate-submit").addEventListener("click", () => {
    const value = $("gate-token").value.trim();
    if (!value) return;
    sessionStorage.setItem("panelToken", value);
    S.token = value;
    $("gate").hidden = true;
    $("app").hidden = false;
    tick();
  });
  $("gate-token").addEventListener("keydown", (event) => {
    if (event.key === "Enter") $("gate-submit").click();
  });

  /* ---------------- vòng cập nhật ---------------- */

  async function tick() {
    let state;
    try {
      state = await api("/api/state");
    } catch {
      return;
    }
    $("app").hidden = false;
    $("gate").hidden = true;

    S.devices = state.devices;
    S.byserial = new Map(state.devices.map((item) => [item.serial, item]));
    S.focus = state.focus;
    S.broadcast = state.broadcast;
    S.gamePackage = state.gamePackage;
    S.h264 = Boolean(state.h264);

    $("c-ready").textContent = state.devices.filter((d) => d.ready).length;
    $("c-unauth").textContent = state.devices.filter((d) => d.state === "unauthorized").length;
    $("c-offline").textContent = state.devices.filter((d) => d.state === "offline").length;
    $("pause-toggle").checked = state.paused;
    $("arm-toggle").checked = state.broadcast.armed;
    $("arm-toggle").disabled = !state.broadcast.supported;
    $("grid-note").textContent = state.mode === "focus"
      ? "Lưới đang tạm dừng — băng thông đang dồn cho máy bạn đang xem"
      : `Mỗi ô làm mới ~${state.gridInterval}s · chỉ chụp khi bạn ở tab Lưới`;

    renderGrid();
    renderPicker();
    renderFocusMeta();
    renderBroadcastBar();
  }

  /* ---------------- lưới ---------------- */

  function tileMarkup(device) {
    const badge = device.ready
      ? `<span class="badge ok">${device.stateLabel}</span>`
      : device.state === "unauthorized"
        ? `<span class="badge warn">${device.stateLabel}</span>`
        : `<span class="badge bad">${device.stateLabel}</span>`;
    const battery = device.battery == null ? "—" : `${device.battery}%`;
    return `
      <div class="tile-head">
        <input type="checkbox" data-serial="${device.serial}" ${S.selected.has(device.serial) ? "checked" : ""}>
        <span class="name">${device.alias}</span>${badge}
      </div>
      <div class="tile-screen" data-serial="${device.serial}">
        ${device.hasFrame
          ? `<img alt="${device.alias}">`
          : `<div class="placeholder">${device.ready ? "Đang chờ ảnh đầu tiên…" : device.stateLabel}</div>`}
      </div>
      <div class="tile-foot">
        <span>🔋 ${battery}</span>
        <span>${device.lastCaptureMs ? device.lastCaptureMs + "ms" : "—"}</span>
        <span class="err">${device.lastError || device.foreground || ""}</span>
      </div>`;
  }

  function renderGrid() {
    const grid = $("grid");
    for (const device of S.devices) {
      let tile = grid.querySelector(`[data-tile="${CSS.escape(device.serial)}"]`);
      if (!tile) {
        tile = document.createElement("div");
        tile.className = "tile";
        tile.dataset.tile = device.serial;
        grid.appendChild(tile);
      }
      const signature = `${device.state}|${device.battery}|${device.hasFrame}|${device.lastCaptureMs}|${device.lastError}|${device.foreground}|${S.selected.has(device.serial)}`;
      if (tile.dataset.signature !== signature) {
        tile.dataset.signature = signature;
        tile.innerHTML = tileMarkup(device);
      }
      tile.classList.toggle("selected", S.selected.has(device.serial));
      tile.classList.toggle("focused", S.focus === device.serial);

      const image = tile.querySelector("img");
      if (image && device.frameAt && S.frameAt.get(device.serial) !== device.frameAt) {
        S.frameAt.set(device.serial, device.frameAt);
        image.src = withToken(`/api/devices/${encodeURIComponent(device.serial)}/frame.jpg?kind=grid&v=${device.frameAt}`);
      }
    }
    for (const tile of [...grid.children]) {
      if (!S.byserial.has(tile.dataset.tile)) tile.remove();
    }
  }

  $("grid").addEventListener("click", (event) => {
    const screen = event.target.closest(".tile-screen");
    if (screen) { selectDevice(screen.dataset.serial); switchView("focus"); return; }
  });
  $("grid").addEventListener("change", (event) => {
    const box = event.target.closest("input[type=checkbox]");
    if (!box) return;
    if (box.checked) S.selected.add(box.dataset.serial);
    else S.selected.delete(box.dataset.serial);
    renderGrid();
    renderBroadcastBar();
  });
  $("select-all").addEventListener("click", () => {
    S.devices.filter((d) => d.ready).forEach((d) => S.selected.add(d.serial));
    renderGrid(); renderBroadcastBar();
  });
  $("select-none").addEventListener("click", () => {
    S.selected.clear(); renderGrid(); renderBroadcastBar();
  });

  /* ---------------- chuyển khung nhìn ---------------- */

  function switchView(view) {
    S.view = view;
    if (view === "grid" && S.player) { S.player.stop(); S.player = null; S.source = "still"; }
    // Server dùng thông tin này để ngừng chụp 15 máy còn lại khi đang xem một máy.
    const mode = view === "focus" && S.source === "h264" ? "video" : view;
    post("/api/focus", { serial: S.streaming, mode }).catch(() => {});
    $("view-grid").hidden = view !== "grid";
    $("view-focus").hidden = view !== "focus";
    document.querySelectorAll(".tabs button").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === view);
    });
  }
  document.querySelectorAll(".tabs button").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  document.querySelectorAll(".mode-switch [data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      S.side = button.dataset.mode;
      document.querySelectorAll(".mode-switch [data-mode]").forEach((other) =>
        other.classList.toggle("active", other === button));
      $("pane-control").hidden = S.side !== "control";
      $("pane-calibrate").hidden = S.side !== "calibrate";
      if (S.side === "calibrate") { refreshMatches(); refreshProfile(); }
    });
  });

  document.querySelectorAll("[data-pointer]").forEach((button) => {
    button.addEventListener("click", () => {
      S.pointer = button.dataset.pointer;
      document.querySelectorAll("[data-pointer]").forEach((other) =>
        other.classList.toggle("active", other === button));
      $("screen-box").classList.toggle("selecting", S.pointer === "select");
      if (S.streaming) { if (S.pointer === "select") useStill("đang chọn vùng"); else useVideo(); }
    });
  });

  /* ---------------- máy đang xem ---------------- */

  /** Dừng luồng H.264 và trả màn hình về ảnh tĩnh screencap. */
  function useStill(reason) {
    if (S.player) { S.player.stop(); S.player = null; }
    S.source = "still";
    $("video").hidden = true;
    $("live").hidden = false;
    if (S.streaming) {
      $("live").src = withToken(`/api/devices/${encodeURIComponent(S.streaming)}/stream.mjpg`);
      post("/api/focus", { serial: S.streaming, mode: "focus" }).catch(() => {});
    }
    renderSource(reason);
  }

  /** Bật luồng H.264 lấy từ bộ mã hoá phần cứng của máy. */
  function useVideo() {
    if (!S.streaming || !S.h264 || !window.RokH264 || !RokH264.supported()) {
      return useStill(RokH264 && !RokH264.supported() ? "trình duyệt không hỗ trợ WebCodecs" : "");
    }
    if (S.player) { S.player.stop(); S.player = null; }
    $("live").hidden = true;
    $("live").src = "";           // ngắt luồng MJPEG để khỏi tốn băng thông USB
    $("video").hidden = false;
    S.source = "h264";
    // screencap nghỉ hẳn; hiệu chỉnh vẫn có ảnh vì các endpoint đó tự chụp.
    post("/api/focus", { serial: S.streaming, mode: "video" }).catch(() => {});

    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const url = `${scheme}://${location.host}/api/devices/${encodeURIComponent(S.streaming)}/video`
      + `?token=${encodeURIComponent(S.token)}`;
    S.player = RokH264.create({
      canvas: $("video"),
      url,
      onStatus: (status) => {
        if (status.state === "error") {
          toast(`Luồng H.264 lỗi: ${status.message}. Chuyển về ảnh tĩnh.`, "bad");
          useStill("H.264 lỗi");
        } else {
          renderSource();
        }
      },
    });
    S.player.start();
    renderSource();
  }

  function renderSource(note) {
    const node = $("ro-source");
    if (S.source === "h264") {
      node.innerHTML = `<span class="src-pill h264">H.264 phần cứng</span>`;
    } else {
      node.innerHTML = `<span class="src-pill still">ảnh tĩnh${note ? " · " + note : ""}</span>`;
    }
  }

  function selectDevice(serial) {
    if (S.streaming === serial) return;
    S.streaming = serial;
    $("btn-download").href = withToken(`/api/devices/${encodeURIComponent(serial)}/screenshot.png`);
    $("empty-stage").hidden = true;
    $("screen-box").style.display = "";
    $("device-picker").value = serial;
    // Chế độ chọn vùng luôn dùng ảnh tĩnh: dhash phải băm đúng ảnh PNG mà agent
    // chụp lúc chạy thật, không phải khung H.264 đã nén mất dữ liệu.
    if (S.pointer === "select") useStill("đang chọn vùng"); else useVideo();
    S.lastPoint = null; S.lastRegion = null;
    $("point-coords").textContent = "Bấm lên ảnh để lấy toạ độ";
    $("region-coords").textContent = "Chưa chọn vùng";
    $("region-preview").hidden = true;
    $("region-dhash").textContent = "";
    $("btn-save-point").disabled = true;
    $("btn-save-region").disabled = true;
    $("btn-save-fp").disabled = true;
    if (S.side === "calibrate") refreshMatches();
  }

  function renderPicker() {
    const picker = $("device-picker");
    const signature = S.devices.map((d) => `${d.serial}:${d.state}`).join(",");
    if (picker.dataset.signature !== signature) {
      picker.dataset.signature = signature;
      picker.innerHTML = `<option value="">— chọn máy —</option>` + S.devices
        .map((d) => `<option value="${d.serial}">${d.alias} · ${d.stateLabel}</option>`).join("");
    }
    if (S.streaming) picker.value = S.streaming;
    if (!S.streaming) { $("empty-stage").hidden = false; $("screen-box").style.display = "none"; }
    $("package-input").value = $("package-input").value || S.gamePackage;
  }

  $("device-picker").addEventListener("change", (event) => {
    if (event.target.value) selectDevice(event.target.value);
  });

  function renderFocusMeta() {
    const device = S.byserial.get(S.streaming);
    if (!device) { $("focus-meta").textContent = ""; return; }
    $("focus-meta").textContent = `${device.serial}${device.model ? " · " + device.model : ""}`;
    $("ro-size").textContent = device.width ? `${device.width}×${device.height}` : "—";
    $("ro-ms").textContent = device.lastCaptureMs ? `${device.lastCaptureMs}ms` : "—";
    const fps = S.source === "h264" && S.player ? S.player.fps : device.fps;
    $("ro-fps").textContent = fps ? `${fps.toFixed(1)}/giây` : "—";
  }

  $("btn-refresh").addEventListener("click", async () => {
    if (!S.streaming) return;
    try { await post(`/api/devices/${encodeURIComponent(S.streaming)}/refresh`); }
    catch (error) { toast(error.message, "bad"); }
  });

  /* ---------------- tương tác trên ảnh ---------------- */

  const stage = $("screen-box");
  let drag = null;

  /** Bề mặt đang hiển thị: canvas H.264 hoặc ảnh tĩnh. */
  function surface() { return $("video").hidden ? $("live") : $("video"); }

  function normalized(event) {
    const rect = surface().getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  function showReadout(point) {
    const device = S.byserial.get(S.streaming);
    $("ro-norm").textContent = `${point.x.toFixed(4)}, ${point.y.toFixed(4)}`;
    $("ro-px").textContent = device && device.width
      ? `${Math.round(point.x * device.width)}, ${Math.round(point.y * device.height)}`
      : "—";
  }

  stage.addEventListener("pointermove", (event) => { if (!drag) showReadout(normalized(event)); });

  stage.addEventListener("pointerdown", (event) => {
    if (!S.streaming) return;
    event.preventDefault();
    stage.setPointerCapture(event.pointerId);
    drag = { start: normalized(event), current: normalized(event) };
  });

  stage.addEventListener("pointermove", (event) => {
    if (!drag) return;
    drag.current = normalized(event);
    showReadout(drag.current);
    const rect = surface().getBoundingClientRect();
    const box = $("screen-box").getBoundingClientRect();
    const offsetX = rect.left - box.left;
    const offsetY = rect.top - box.top;
    if (S.pointer === "select") {
      const node = $("selection");
      node.style.display = "block";
      node.style.left = offsetX + Math.min(drag.start.x, drag.current.x) * rect.width + "px";
      node.style.top = offsetY + Math.min(drag.start.y, drag.current.y) * rect.height + "px";
      node.style.width = Math.abs(drag.current.x - drag.start.x) * rect.width + "px";
      node.style.height = Math.abs(drag.current.y - drag.start.y) * rect.height + "px";
    } else {
      const dx = (drag.current.x - drag.start.x) * rect.width;
      const dy = (drag.current.y - drag.start.y) * rect.height;
      const node = $("swipe-line");
      node.style.display = "block";
      node.style.left = offsetX + drag.start.x * rect.width + "px";
      node.style.top = offsetY + drag.start.y * rect.height + "px";
      node.style.width = Math.hypot(dx, dy) + "px";
      node.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    }
  });

  stage.addEventListener("pointerup", async (event) => {
    if (!drag) return;
    const { start } = drag;
    const end = normalized(event);
    drag = null;
    $("selection").style.display = "none";
    $("swipe-line").style.display = "none";
    const distance = Math.hypot(end.x - start.x, end.y - start.y);

    if (S.pointer === "select") {
      if (distance < 0.01) return;
      S.lastRegion = {
        x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
        w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y),
      };
      $("region-coords").textContent =
        `[${S.lastRegion.x.toFixed(4)}, ${S.lastRegion.y.toFixed(4)}, ${S.lastRegion.w.toFixed(4)}, ${S.lastRegion.h.toFixed(4)}]`;
      $("btn-save-region").disabled = false;
      $("btn-save-fp").disabled = false;
      const query = new URLSearchParams({
        serial: S.streaming, x: S.lastRegion.x, y: S.lastRegion.y,
        w: S.lastRegion.w, h: S.lastRegion.h,
      }).toString();
      $("region-img").src = withToken(`/api/profile/preview.png?${query}`);
      $("region-preview").hidden = false;
      try {
        const result = await api(withToken(`/api/profile/dhash?${query}`));
        $("region-dhash").textContent = `dhash = ${result.dhash}`;
      } catch (error) { toast(error.message, "bad"); }
      return;
    }

    if (distance < TAP_THRESHOLD) {
      showRipple(start);
      S.lastPoint = start;
      $("point-coords").textContent = `[${start.x.toFixed(4)}, ${start.y.toFixed(4)}]`;
      $("btn-save-point").disabled = false;
      await send({ type: "tap", x: start.x, y: start.y });
    } else {
      const duration = Number($("swipe-duration").value) || 400;
      await send({ type: "swipe", x1: start.x, y1: start.y, x2: end.x, y2: end.y, durationMs: duration });
    }
  });

  stage.addEventListener("pointercancel", () => {
    drag = null;
    $("selection").style.display = "none";
    $("swipe-line").style.display = "none";
  });

  /** Phản hồi thị giác tức thì. Máy vẫn mất ~300ms để đáp, nhưng cảm giác nhanh
   *  hơn hẳn khi biết ngay cú chạm đã được ghi nhận. */
  function showRipple(point) {
    const rect = surface().getBoundingClientRect();
    const box = stage.getBoundingClientRect();
    const node = $("ripple");
    node.style.left = (rect.left - box.left + point.x * rect.width) + "px";
    node.style.top = (rect.top - box.top + point.y * rect.height) + "px";
    node.classList.remove("on");
    void node.offsetWidth;   // ép trình duyệt chạy lại animation
    node.classList.add("on");
  }

  async function send(action) {
    if (!S.streaming) return;
    try {
      await post(`/api/devices/${encodeURIComponent(S.streaming)}/action`, action);
    } catch (error) { toast(error.message, "bad"); }
  }

  document.querySelectorAll("[data-key]").forEach((button) => {
    button.addEventListener("click", () => send({ type: "key", key: button.dataset.key }));
  });
  $("btn-text").addEventListener("click", () => {
    const value = $("text-input").value;
    if (value) send({ type: "text", text: value });
  });
  $("btn-launch").addEventListener("click", () =>
    send({ type: "launch", package: $("package-input").value.trim() || S.gamePackage }));
  $("btn-stop").addEventListener("click", () => {
    const pkg = $("package-input").value.trim() || S.gamePackage;
    if (confirm(`Tắt hẳn ${pkg} trên máy này?`)) send({ type: "stop", package: pkg });
  });

  /* ---------------- hiệu chỉnh ---------------- */

  $("btn-save-point").addEventListener("click", async () => {
    const name = $("point-name").value.trim();
    if (!name || !S.lastPoint) return toast("Cần tên điểm và một vị trí đã bấm.", "bad");
    try {
      await post("/api/profile/point", { name, x: S.lastPoint.x, y: S.lastPoint.y });
      toast(`Đã lưu điểm ${name}`, "ok");
      $("point-name").value = "";
      refreshProfile();
    } catch (error) { toast(error.message, "bad"); }
  });

  $("btn-save-region").addEventListener("click", async () => {
    const name = $("region-name").value.trim();
    if (!name || !S.lastRegion) return toast("Cần tên vùng và một vùng đã chọn.", "bad");
    try {
      await post("/api/profile/region", { name, ...S.lastRegion });
      toast(`Đã lưu vùng ${name}`, "ok");
      $("region-name").value = "";
      refreshProfile();
    } catch (error) { toast(error.message, "bad"); }
  });

  $("btn-save-fp").addEventListener("click", async () => {
    const screen = $("screen-name").value.trim();
    if (!screen || !S.lastRegion) return toast("Cần tên màn hình và một vùng đã chọn.", "bad");
    try {
      const result = await post("/api/profile/fingerprint", {
        screen, serial: S.streaming, ...S.lastRegion,
        maxDistance: Number($("max-distance").value) || 8,
        replace: $("replace-fp").checked,
      });
      toast(`Màn hình ${screen}: ${result.fingerprints.length} dấu vân`, "ok");
      refreshProfile(); refreshMatches();
    } catch (error) { toast(error.message, "bad"); }
  });

  async function refreshMatches() {
    const list = $("match-list");
    if (!S.streaming) { list.innerHTML = `<p class="hint">Chưa chọn máy.</p>`; return; }
    try {
      const result = await api(`/api/profile/match?serial=${encodeURIComponent(S.streaming)}`);
      if (!result.screens.length) { list.innerHTML = `<p class="hint">Profile chưa có màn hình nào.</p>`; return; }
      list.innerHTML = result.screens.map((item) => `
        <div class="match-row ${item.matched ? "hit" : ""}">
          <span class="name">${item.matched ? "✓" : "·"} ${item.screen}</span>
          <span class="dist">d=${item.worstDistance}</span>
        </div>`).join("");
    } catch (error) {
      list.innerHTML = `<p class="hint">${error.message}</p>`;
    }
  }
  $("btn-match").addEventListener("click", refreshMatches);

  async function refreshProfile() {
    try {
      const result = await api("/api/profile");
      const { taps, regions, screens } = result.counts;
      $("profile-counts").textContent = `${taps} điểm chạm · ${regions} vùng · ${screens} màn hình`;
      const profile = result.profile;
      const rows = [];
      for (const [name, point] of Object.entries(profile.taps || {})) {
        rows.push({ kind: "tap", name, value: `[${point.join(", ")}]` });
      }
      for (const [name, region] of Object.entries(profile.regions || {})) {
        rows.push({ kind: "region", name, value: `${region.length} số` });
      }
      for (const [name, entry] of Object.entries(profile.screens || {})) {
        rows.push({ kind: "screen", name, value: `${(entry.fingerprints || []).length} vân` });
      }
      $("entry-list").innerHTML = rows.map((row) => `
        <div class="entry">
          <span class="k">${row.name}</span>
          <span class="v">${row.value}</span>
          <button data-del-kind="${row.kind}" data-del-name="${row.name}" title="Xoá">✕</button>
        </div>`).join("");
    } catch (error) { toast(error.message, "bad"); }
  }

  $("entry-list").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-del-kind]");
    if (!button) return;
    if (!confirm(`Xoá "${button.dataset.delName}" khỏi bản làm việc?`)) return;
    try {
      await post("/api/profile/delete", { kind: button.dataset.delKind, name: button.dataset.delName });
      refreshProfile();
    } catch (error) { toast(error.message, "bad"); }
  });

  $("btn-export").addEventListener("click", (event) => {
    event.preventDefault();
    window.location.href = withToken("/api/profile/export");
  });
  $("btn-apply").addEventListener("click", async () => {
    if (!confirm("Ghi đè profile gốc bằng bản làm việc? Bản cũ sẽ được lưu thành .bak")) return;
    try {
      const result = await post("/api/profile/apply");
      toast(`Đã ghi ${result.path}`, "ok");
    } catch (error) { toast(error.message, "bad"); }
  });
  $("btn-reset").addEventListener("click", async () => {
    if (!confirm("Bỏ toàn bộ thay đổi và nạp lại từ profile gốc?")) return;
    try { await post("/api/profile/reset"); toast("Đã khôi phục.", "ok"); refreshProfile(); }
    catch (error) { toast(error.message, "bad"); }
  });

  /* ---------------- công tắc ---------------- */

  $("pause-toggle").addEventListener("change", async (event) => {
    try { await post("/api/pause", { paused: event.target.checked }); }
    catch (error) { toast(error.message, "bad"); }
  });

  $("arm-toggle").addEventListener("change", async (event) => {
    if (event.target.checked) {
      const ok = confirm(
        "Bật chế độ đồng bộ?\n\n" +
        "Mọi lệnh sẽ phát tới tất cả máy đã chọn cùng lúc. Nhiều tài khoản nhận thao tác " +
        "giống hệt nhau trong cùng một giây là dấu hiệu mà hệ thống chống gian lận tìm kiếm.\n\n" +
        "Chỉ nên dùng cho cài đặt, đăng nhập và hiệu chỉnh — không dùng khi đang có sự kiện.\n\n" +
        "Chế độ này tự tắt sau 10 phút."
      );
      if (!ok) { event.target.checked = false; return; }
    }
    try {
      const result = await post("/api/broadcast/arm", { armed: event.target.checked });
      S.broadcast = { ...S.broadcast, ...result };
      renderBroadcastBar();
    } catch (error) { toast(error.message, "bad"); event.target.checked = false; }
  });

  function renderBroadcastBar() {
    const bar = $("broadcast-bar");
    bar.hidden = !S.broadcast.armed;
    $("bc-count").textContent = S.selected.size;
    if (S.broadcast.armed) {
      const left = S.broadcast.secondsLeft || 0;
      $("bc-countdown").textContent = `tự tắt sau ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    }
  }

  async function broadcast(action) {
    if (!S.selected.size) return toast("Chưa chọn máy nào ở tab Lưới.", "bad");
    if (!confirm(`Phát lệnh "${action.type}" tới ${S.selected.size} máy?`)) return;
    try {
      const result = await post("/api/broadcast", { serials: [...S.selected], action });
      const failed = result.results.filter((item) => !item.ok);
      toast(`${result.succeeded}/${result.sent} máy nhận lệnh.`, failed.length ? "bad" : "ok");
      failed.slice(0, 3).forEach((item) => toast(`${item.alias}: ${item.error}`, "bad"));
    } catch (error) { toast(error.message, "bad"); }
  }

  document.querySelectorAll("[data-bc-key]").forEach((button) => {
    button.addEventListener("click", () => broadcast({ type: "key", key: button.dataset.bcKey }));
  });
  $("bc-launch").addEventListener("click", () =>
    broadcast({ type: "launch", package: $("package-input").value.trim() || S.gamePackage }));
  $("bc-tap").addEventListener("click", () => {
    if (!S.lastPoint) return toast("Bấm một điểm trên ảnh ở tab Máy trước.", "bad");
    broadcast({ type: "tap", x: S.lastPoint.x, y: S.lastPoint.y });
  });
  $("bc-text").addEventListener("click", () => {
    const value = $("text-input").value;
    if (!value) return toast("Nhập nội dung ở ô Nhập chữ trước.", "bad");
    broadcast({ type: "text", text: value });
  });

  /* ---------------- khởi động ---------------- */

  bootToken();
  if (!S.token) openGate(); else $("app").hidden = false;
  tick();
  setInterval(tick, 2000);
})();

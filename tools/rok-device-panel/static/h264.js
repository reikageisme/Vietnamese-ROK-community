/* Giải mã luồng H.264 Annex-B từ screenrecord bằng WebCodecs.
 *
 * Điện thoại gửi về một luồng byte thô, không đóng khung sẵn. Module này phải tự:
 *   1. tách các NAL unit theo start code (00 00 01 hoặc 00 00 00 01);
 *   2. gộp NAL thành access unit — WebCodecs cần trọn một khung mỗi lần nạp;
 *   3. đọc SPS để lấy đúng chuỗi codec thay vì đoán bừa;
 *   4. chỉ bắt đầu nạp từ khung khoá đầu tiên, nếu không bộ giải mã sẽ lỗi.
 */
(() => {
  "use strict";

  const START = 0x000001;

  function concat(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }

  /** Tìm start code kế tiếp từ vị trí `from`. Trả về -1 nếu chưa có. */
  function findStart(data, from) {
    for (let i = from; i + 2 < data.length; i++) {
      if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) return i;
    }
    return -1;
  }

  /** Độ dài start code tại vị trí `at`: 4 byte nếu có 00 00 00 01, ngược lại 3. */
  function startLength(data, at) {
    return at > 0 && data[at - 1] === 0 ? 4 : 3;
  }

  /**
   * Tách luồng byte thành từng NAL (giữ nguyên start code — WebCodecs ở chế độ
   * Annex-B cần chúng).
   */
  class Splitter {
    constructor(onNal) {
      this.onNal = onNal;
      this.tail = new Uint8Array(0);
    }
    reset() {
      this.tail = new Uint8Array(0);
    }
    push(chunk) {
      let data = this.tail.length ? concat(this.tail, chunk) : chunk;
      let cursor = findStart(data, 0);
      if (cursor < 0) {
        this.tail = data;
        return;
      }
      // Lùi về đầu start code 4 byte nếu có.
      if (cursor > 0 && data[cursor - 1] === 0) cursor -= 1;
      while (true) {
        const scan = cursor + (data[cursor + 2] === 1 ? 3 : 4);
        const next = findStart(data, scan);
        if (next < 0) break;
        const cut = next > 0 && data[next - 1] === 0 ? next - 1 : next;
        this.onNal(data.subarray(cursor, cut));
        cursor = cut;
      }
      this.tail = data.subarray(cursor);
    }
  }

  function nalType(nal) {
    const offset = nal[2] === 1 ? 3 : 4;
    return { type: nal[offset] & 0x1f, offset };
  }

  /** Chuỗi codec đọc thẳng từ SPS — chính xác hơn đoán 'avc1.42E01E'. */
  function codecFromSps(nal, offset) {
    const hex = (value) => value.toString(16).padStart(2, "0");
    return `avc1.${hex(nal[offset + 1])}${hex(nal[offset + 2])}${hex(nal[offset + 3])}`;
  }

  class Player {
    constructor({ canvas, url, onStatus }) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d");
      this.url = url;
      this.onStatus = onStatus || (() => {});
      this.socket = null;
      this.decoder = null;
      this.codec = null;
      this.timestamp = 0;
      this.frames = 0;
      this.lastFrameAt = 0;
      this.fps = 0;
      this.stopped = false;
      this.pending = [];   // NAL của access unit đang gom
      this.hasVcl = false;
      this.isKey = false;
      this.started = false; // đã gặp khung khoá đầu tiên chưa
      this.splitter = new Splitter((nal) => this.onNal(nal));
    }

    start() {
      this.socket = new WebSocket(this.url);
      this.socket.binaryType = "arraybuffer";
      this.socket.onmessage = (event) => {
        if (typeof event.data === "string") {
          const message = JSON.parse(event.data);
          if (message.type === "reset") this.resetDecoder();
          else if (message.type === "error") this.fail(message.message);
          else if (message.type === "start") this.onStatus({ state: "connecting" });
          return;
        }
        this.splitter.push(new Uint8Array(event.data));
      };
      this.socket.onerror = () => this.fail("Mất kết nối luồng hình.");
      this.socket.onclose = () => {
        if (!this.stopped) this.fail("Luồng hình đã đóng.");
      };
      // Ping định kỳ để server phát hiện được khi tab bị đóng.
      this.ping = setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.send("ping");
      }, 4000);
    }

    stop() {
      this.stopped = true;
      clearInterval(this.ping);
      if (this.socket) {
        try { this.socket.close(); } catch { /* đã đóng */ }
        this.socket = null;
      }
      this.closeDecoder();
    }

    fail(message) {
      if (this.stopped) return;
      this.stopped = true;
      clearInterval(this.ping);
      this.onStatus({ state: "error", message });
    }

    closeDecoder() {
      if (this.decoder && this.decoder.state !== "closed") {
        try { this.decoder.close(); } catch { /* đã đóng */ }
      }
      this.decoder = null;
    }

    /** Đoạn screenrecord mới: SPS/PPS/IDR mới, phải dựng lại bộ giải mã. */
    resetDecoder() {
      this.closeDecoder();
      this.splitter.reset();
      this.pending = [];
      this.hasVcl = false;
      this.isKey = false;
      this.started = false;
      this.codec = null;
    }

    ensureDecoder(codec) {
      if (this.decoder) return;
      this.decoder = new VideoDecoder({
        output: (frame) => this.draw(frame),
        error: (error) => this.fail(String(error && error.message ? error.message : error)),
      });
      this.decoder.configure({
        codec,
        optimizeForLatency: true,
        hardwareAcceleration: "prefer-hardware",
      });
      this.onStatus({ state: "playing", codec });
    }

    draw(frame) {
      const width = frame.displayWidth || frame.codedWidth;
      const height = frame.displayHeight || frame.codedHeight;
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      this.context.drawImage(frame, 0, 0);
      frame.close();

      this.frames += 1;
      const now = performance.now();
      if (this.lastFrameAt) {
        const gap = now - this.lastFrameAt;
        // Trung bình trượt cho số đỡ nhảy loạn.
        if (gap > 0) this.fps = this.fps ? this.fps * 0.85 + (1000 / gap) * 0.15 : 1000 / gap;
      }
      this.lastFrameAt = now;
    }

    onNal(nal) {
      if (this.stopped || nal.length < 5) return;
      const { type, offset } = nalType(nal);
      const isVcl = type >= 1 && type <= 5;

      if (type === 7 && !this.codec) this.codec = codecFromSps(nal, offset);
      // Một access unit kết thúc khi gặp NAL ảnh tiếp theo, hoặc khi SPS mới bắt đầu.
      if ((isVcl && this.hasVcl) || (type === 7 && this.pending.length)) this.flush();
      if (type === 5 || type === 7 || type === 8) this.isKey = true;
      this.pending.push(nal);
      if (isVcl) this.hasVcl = true;
    }

    flush() {
      if (!this.pending.length) return;
      const key = this.isKey;
      const nals = this.pending;
      this.pending = [];
      this.hasVcl = false;
      this.isKey = false;

      // Chưa gặp khung khoá thì bỏ qua: nạp khung P mà thiếu tham chiếu sẽ làm
      // bộ giải mã báo lỗi và rơi về chế độ ảnh tĩnh không cần thiết.
      if (!this.started && !key) return;
      if (!this.codec) return;
      this.ensureDecoder(this.codec);
      if (!this.decoder || this.decoder.state !== "configured") return;

      let total = 0;
      for (const nal of nals) total += nal.length;
      const payload = new Uint8Array(total);
      let position = 0;
      for (const nal of nals) { payload.set(nal, position); position += nal.length; }

      this.timestamp += 16666; // ~60 khung/giây; chỉ dùng để đánh thứ tự
      try {
        this.decoder.decode(new EncodedVideoChunk({
          type: key ? "key" : "delta",
          timestamp: this.timestamp,
          data: payload,
        }));
        this.started = true;
      } catch (error) {
        this.fail(String(error && error.message ? error.message : error));
      }
    }
  }

  window.RokH264 = {
    supported() {
      return typeof window.VideoDecoder === "function"
        && typeof window.EncodedVideoChunk === "function";
    },
    create(options) {
      return new Player(options);
    },
  };
})();

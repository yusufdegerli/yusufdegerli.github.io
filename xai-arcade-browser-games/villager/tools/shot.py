#!/usr/bin/env python3
import base64, json, os, socket, subprocess, time, urllib.request

PORT = 9224
OUT = "/tmp/villager-shots/play.png"
URL = "http://127.0.0.1:8766/?autostart=1"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
USER = "/tmp/villager-chrome-cdp"

def ws_handshake(host, port, path):
    s = socket.create_connection((host, port), 5)
    key = base64.b64encode(os.urandom(16)).decode()
    req = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    )
    s.sendall(req.encode())
    data = b""
    while b"\r\n\r\n" not in data:
        data += s.recv(4096)
    return s

def mask_send(s, payload):
    raw = payload.encode()
    header = bytearray([0x81])
    n = len(raw)
    mask = os.urandom(4)
    if n < 126:
        header.append(0x80 | n)
    elif n < 65536:
        header.append(0x80 | 126)
        header.extend(n.to_bytes(2, "big"))
    else:
        header.append(0x80 | 127)
        header.extend(n.to_bytes(8, "big"))
    header.extend(mask)
    body = bytes(b ^ mask[i % 4] for i, b in enumerate(raw))
    s.sendall(header + body)

def recv_msg(s):
    def recvn(n):
        buf = b""
        while len(buf) < n:
            chunk = s.recv(n - len(buf))
            if not chunk:
                raise ConnectionError("closed")
            buf += chunk
        return buf
    b0, b1 = recvn(2)
    ln = b1 & 0x7F
    if ln == 126:
        ln = int.from_bytes(recvn(2), "big")
    elif ln == 127:
        ln = int.from_bytes(recvn(8), "big")
    if b1 & 0x80:
        recvn(4)
    return recvn(ln).decode("utf-8", "replace")

proc = subprocess.Popen(
    [
        CHROME, "--headless=new", "--disable-gpu", "--no-first-run",
        f"--remote-debugging-port={PORT}", f"--user-data-dir={USER}",
        "--window-size=1400,900", URL,
    ],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
try:
    page = None
    for _ in range(40):
        time.sleep(0.2)
        try:
            tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json", timeout=1))
            page = next((t for t in tabs if t.get("type") == "page" and "webSocketDebuggerUrl" in t), None)
            if page:
                break
        except Exception:
            pass
    if not page:
        raise SystemExit("no page")
    ws = page["webSocketDebuggerUrl"]
    # ws://127.0.0.1:9224/devtools/page/ID
    path = "/" + ws.split("/", 3)[-1]
    sock = ws_handshake("127.0.0.1", PORT, path)
    mid = 1
    def call(method, params=None):
        global mid
        msg = {"id": mid, "method": method}
        if params:
            msg["params"] = params
        mid += 1
        mask_send(sock, json.dumps(msg))
        while True:
            data = json.loads(recv_msg(sock))
            if data.get("id") == msg["id"]:
                return data
    call("Page.enable")
    time.sleep(3.8)
    res = call("Page.captureScreenshot", {"format": "png"})
    b64 = res["result"]["data"]
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "wb") as f:
        f.write(base64.b64decode(b64))
    print("wrote", OUT, os.path.getsize(OUT))
finally:
    proc.terminate()
    try:
        proc.wait(timeout=2)
    except Exception:
        proc.kill()

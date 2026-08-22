# RokViet MCP server — cho Claude làm việc thẳng với server

Sau khi cài xong, Claude gọi được server và dàn 16 điện thoại trực tiếp: chạy lệnh,
xem trạng thái máy, **nhìn được ảnh màn hình game**, chẩn đoán hiệu chỉnh, deploy.

Không còn vòng "tôi commit → bạn push → bạn pull".

## Nó chạy ở đâu

Trên **máy Windows của bạn**, không phải trên server. Đó là điểm mấu chốt: máy Windows
có Tailscale nên với tới `100.113.111.64` được. Claude Desktop khởi động script này và
chuyển tiếp nó tới Claude.

```
Claude  ──►  Claude Desktop  ──►  rok_mcp.py (Windows)  ──┬─► SSH ──► server
                                                          └─► HTTP ─► panel :5100
```

Không cần cài gì thêm: chỉ dùng thư viện chuẩn của Python.

## 1. Tạo khoá SSH

Mật khẩu không dùng được — `ssh.exe` của Windows không nhập mật khẩu tự động. Đây vừa
là ràng buộc kỹ thuật vừa là điều nên làm.

```powershell
ssh-keygen -t ed25519 -C "claude-mcp" -f "$env:USERPROFILE\.ssh\rok_mcp"
Get-Content "$env:USERPROFILE\.ssh\rok_mcp.pub"
```

Copy dòng vừa in ra, rồi trên **host pve**:

```bash
pct exec 104 -- sh -c 'mkdir -p /root/.ssh && chmod 700 /root/.ssh'
pct exec 104 -- sh -c 'echo "ssh-ed25519 AAAA...dán-vào-đây... claude-mcp" >> /root/.ssh/authorized_keys'
pct exec 104 -- chmod 600 /root/.ssh/authorized_keys
```

Thử từ Windows — phải vào được mà **không hỏi mật khẩu**:

```powershell
ssh -i "$env:USERPROFILE\.ssh\rok_mcp" root@100.113.111.64 "hostname && uptime"
```

Chưa chạy thì chưa làm bước tiếp theo. Nếu bị từ chối, kiểm tra `sshd_config`:
`PermitRootLogin prohibit-password` cho phép khoá nhưng chặn mật khẩu — đúng cái ta cần.

## 2. Khai báo trong Claude Desktop

Mở `%APPDATA%\Claude\claude_desktop_config.json` (chưa có thì tạo mới):

```json
{
  "mcpServers": {
    "rokviet": {
      "command": "py",
      "args": ["-3", "D:\\ROK Forum\\tools\\rok_mcp.py"],
      "env": {
        "ROK_SSH_HOST": "100.113.111.64",
        "ROK_SSH_USER": "root",
        "ROK_SSH_KEY": "C:\\Users\\TEN_CUA_BAN\\.ssh\\rok_mcp",
        "ROK_REPO": "/root/Vietnamese-ROK-community",
        "ROK_PANEL_URL": "http://100.113.111.64:5100",
        "ROK_PANEL_TOKEN": "dán PANEL_TOKEN trong .env vào đây"
      }
    }
  }
}
```

Chú ý: đường dẫn Windows phải dùng `\\` (hai dấu gạch) trong JSON. Thay `TEN_CUA_BAN`
bằng tên user thật — xem bằng `echo $env:USERPROFILE`.

Rồi **thoát hẳn Claude Desktop** (chuột phải biểu tượng khay hệ thống → Quit, không
phải chỉ đóng cửa sổ) và mở lại.

## 3. Bảy công cụ Claude sẽ có

| Công cụ | Làm gì |
|---|---|
| `rok_run` | Chạy lệnh shell bất kỳ trên server qua SSH |
| `rok_devices` | Danh sách 16 máy: trạng thái ADB, pin, thời gian chụp, app đang chạy |
| `rok_screen` | **Ảnh màn hình thật** của một máy — Claude nhìn được game đang hiện gì |
| `rok_match` | Đối chiếu màn hình với profile, ra đúng khoảng cách Hamming |
| `rok_logs` | Log container panel |
| `rok_deploy` | `git pull` + dựng lại container |
| `rok_panel_api` | Gọi thẳng endpoint bất kỳ của panel |

`rok_screen` là cái đáng giá nhất: Claude nhìn được màn hình thật nên giúp hiệu chỉnh
route KvK được — chỉ ra nên chọn vùng nào làm dấu vân, vùng nào có số liệu động phải tránh.

## Kiểm tra hoạt động

Hỏi Claude: *"liệt kê điện thoại"* hoặc *"cho tôi xem màn hình phone16"*.

Không thấy công cụ nào thì kiểm tra theo thứ tự:

```powershell
# Python có chạy được script không (Ctrl+C để thoát)
py -3 "D:\ROK Forum\tools\rok_mcp.py"

# JSON có hợp lệ không
Get-Content "$env:APPDATA\Claude\claude_desktop_config.json" | ConvertFrom-Json

# Log của Claude Desktop
Get-Content "$env:APPDATA\Claude\logs\mcp*.log" -Tail 40
```

## Về bảo mật

Công cụ này cho Claude chạy lệnh tuỳ ý dưới quyền `root` trên máy đang giữ 16 tài khoản
game đăng nhập sẵn. Đó là điều bạn chủ động chọn, nhưng nên biết rõ mình đang trao gì.

Hai điều nên làm:

- **Đổi mật khẩu root ngay** nếu vẫn còn để `12345`. Có khoá SSH rồi thì mật khẩu chỉ
  còn là lối vào cho người khác.
- Cân nhắc tạo user riêng thay vì `root`, chỉ cấp `sudo` cho `docker` và `git`. Chặt chẽ
  hơn, nhưng đổi lại phải sửa vài đường dẫn.

Khoá SSH nằm trên đĩa máy bạn và **không bao giờ đi qua khung chat** — khác hẳn mật khẩu
dán vào tin nhắn.

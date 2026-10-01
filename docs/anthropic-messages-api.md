# POST `/anthropic/v1/messages` — Tài liệu input

Endpoint tương thích Anthropic Messages API.

```
POST {BASE_URL}/anthropic/v1/messages
```

---

## 1. Headers

| Header | Bắt buộc | Ghi chú |
|---|---|---|
| `Content-Type: application/json` | Có | |
| `x-api-key: <API_KEY>` | Có (1 trong 3) | Hoặc `Authorization: Bearer <API_KEY>`, hoặc `x-proxy-key: <API_KEY>` |
| `anthropic-version: 2023-06-01` | Không | Nếu gửi thì phải đúng dạng `YYYY-MM-DD`, sai → 400 |

---

## 2. Body — các field chính

| Field | Kiểu | Ghi chú |
|---|---|---|
| `model` | string | **Bắt buộc**, phải nằm trong danh sách ở mục 3 |
| `messages` | array | **Bắt buộc**. Mỗi phần tử `{ role: "user" \| "assistant", content: string \| block[] }` |
| `system` | string \| block[] | System prompt (tuỳ chọn) |
| `max_tokens` | number | Theo chuẩn Anthropic |
| `stream` | boolean | `true` → trả SSE; mặc định `false` |
| `tools`, `tool_choice` | | Theo chuẩn Anthropic (tool use) |
| `reasoning_effort` | string | Chế độ suy luận — xem mục 4 |
| `thinking_mode` | string | Ghi đè trực tiếp: `Fast` \| `Auto` \| `Thinking` |
| `strict_images` | boolean | `true` → ảnh upload lỗi thì trả lỗi thay vì bỏ qua ảnh — xem mục 5 |

---

## 3. Model

Chỉ dùng các model Claude sau (không phân biệt hoa thường). Model khác → `400 invalid_request_error`.

| Model | Mô tả ngắn |
|---|---|
| `claude-opus-5` | Opus mạnh nhất |
| `claude-opus-4-8` | Opus |
| `claude-opus-4-7` | Opus |
| `claude-sonnet-4-6` | Sonnet cân bằng |
| `claude-haiku-4-5` | Haiku nhanh / nhẹ |

Response trả lại đúng tên `model` client đã gửi.

---

## 4. Reasoning (suy luận)

Truyền qua `reasoning_effort` (hoặc `reasoning: { "effort": "..." }`):

| Giá trị | Hành vi |
|---|---|
| *(không gửi)*, `low`, `fast`, `none` | Nhanh, ít suy luận (**mặc định**) |
| `auto` | Model tự quyết định có suy luận sâu hay không |
| `thinking`, `medium`, `high`, `xhigh`, `max` | Luôn bật suy luận sâu |

Muốn chỉ định thẳng chế độ thì dùng `"thinking_mode": "Thinking"` (ưu tiên hơn `reasoning_effort`).

> Lưu ý:
> - Field chuẩn Anthropic `thinking: { "type": "enabled", "budget_tokens": N }` **không** bật được suy luận trên endpoint này — hãy dùng `reasoning_effort` hoặc `thinking_mode`.
> - Response **không** trả về block `thinking`, chỉ trả phần trả lời cuối cùng.

```json
{
  "model": "claude-opus-5",
  "max_tokens": 4096,
  "reasoning_effort": "high",
  "messages": [{ "role": "user", "content": "Chứng minh căn 2 là số vô tỉ" }]
}
```

---

## 5. Gửi ảnh

Dùng block `image` trong `content` của message `user`. Server sẽ xử lý ảnh để model nhìn được nội dung thật.

### 5.1 Base64 (khuyến nghị)

```json
{
  "type": "image",
  "source": {
    "type": "base64",
    "media_type": "image/png",
    "data": "iVBORw0KGgoAAAANSUhEUgAA..."
  }
}
```

- `data` là base64 **thuần**, không có tiền tố `data:image/png;base64,`.
- `media_type`: `image/png`, `image/jpeg`, `image/webp`, `image/gif`... (mặc định `image/png`).

### 5.2 URL

```json
{
  "type": "image",
  "source": { "type": "url", "url": "https://example.com/cat.jpg" }
}
```

### 5.3 `strict_images`

- Mặc định (`false`): ảnh decode/upload lỗi sẽ bị **bỏ qua**, model vẫn trả lời (nhưng không thấy ảnh).
- `"strict_images": true`: ảnh lỗi → trả lỗi `502 api_error` ("Image upload failed: ...") để client biết.

### Ví dụ đầy đủ

```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 2048,
  "strict_images": true,
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "image",
          "source": { "type": "base64", "media_type": "image/jpeg", "data": "/9j/4AAQSkZJRg..." }
        },
        { "type": "text", "text": "Mô tả bức ảnh này" }
      ]
    }
  ]
}
```

---

## 6. Gửi file PDF / tài liệu

Dùng block `document` (hoặc `file`). Server upload và parse file trước khi gửi câu hỏi cho model.

```json
{
  "type": "document",
  "name": "bao-cao.pdf",
  "source": {
    "type": "base64",
    "media_type": "application/pdf",
    "data": "JVBERi0xLjQKJ..."
  }
}
```

- `data`: base64 thuần, hoặc data URI `data:application/pdf;base64,...` cũng được.
- `name` (tuỳ chọn, hoặc `filename` / `title`): tên file. Không gửi thì tự sinh `document_<timestamp>_<n>.pdf`.
- Chỉ hỗ trợ `source.type = "base64"` — **không** hỗ trợ URL hay `file_id`.

### Định dạng hỗ trợ

| `media_type` | Đuôi |
|---|---|
| `application/pdf` | pdf |
| `application/msword` | doc |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | docx |
| `application/vnd.ms-excel` | xls |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | xlsx |
| `text/csv` | csv |
| `text/plain` | txt |

### Giới hạn và lỗi

- Tối đa **20 MB / file**, tối đa **10 file / request** (tính trên toàn bộ `messages`).
- PDF phải bắt đầu bằng `%PDF-`, nếu không → 400 `"is not a valid PDF"`.
- Khác với ảnh, lỗi tài liệu **luôn** làm request thất bại (không bị bỏ qua):
  - Lỗi input (base64 sai, quá dung lượng, quá số lượng, PDF hỏng) → `400 invalid_request_error`
  - Lỗi xử lý / upload tài liệu → `502 api_error`

### Ví dụ đầy đủ (PDF + ảnh + reasoning)

```json
{
  "model": "claude-opus-5",
  "max_tokens": 4096,
  "reasoning_effort": "thinking",
  "stream": false,
  "system": "Bạn là trợ lý phân tích tài liệu.",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "document",
          "name": "hop-dong.pdf",
          "source": { "type": "base64", "media_type": "application/pdf", "data": "JVBERi0xLjQK..." }
        },
        {
          "type": "image",
          "source": { "type": "base64", "media_type": "image/png", "data": "iVBORw0KGgo..." }
        },
        { "type": "text", "text": "Tóm tắt hợp đồng và đối chiếu với chữ ký trong ảnh." }
      ]
    }
  ]
}
```

---

## 7. Ví dụ gọi

### curl (bash)

```bash
PDF_B64=$(base64 -w0 hop-dong.pdf)

curl -X POST "$BASE_URL/anthropic/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d @- <<EOF
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 2048,
  "messages": [{
    "role": "user",
    "content": [
      { "type": "document", "name": "hop-dong.pdf",
        "source": { "type": "base64", "media_type": "application/pdf", "data": "$PDF_B64" } },
      { "type": "text", "text": "Tóm tắt file này" }
    ]
  }]
}
EOF
```

### PowerShell

```powershell
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("hop-dong.pdf"))
$body = @{
  model      = "claude-sonnet-4-6"
  max_tokens = 2048
  messages   = @(@{
    role    = "user"
    content = @(
      @{ type = "document"; name = "hop-dong.pdf"
         source = @{ type = "base64"; media_type = "application/pdf"; data = $b64 } },
      @{ type = "text"; text = "Tóm tắt file này" }
    )
  })
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post -Uri "$env:BASE_URL/anthropic/v1/messages" `
  -Headers @{ "x-api-key" = $env:API_KEY; "anthropic-version" = "2023-06-01" } `
  -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))
```

### Python (Anthropic SDK)

```python
import base64, anthropic

client = anthropic.Anthropic(api_key=API_KEY, base_url=f"{BASE_URL}/anthropic")

with open("hop-dong.pdf", "rb") as f:
    pdf_b64 = base64.b64encode(f.read()).decode()

resp = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=2048,
    extra_body={"reasoning_effort": "thinking"},
    messages=[{
        "role": "user",
        "content": [
            {"type": "document",
             "source": {"type": "base64", "media_type": "application/pdf", "data": pdf_b64}},
            {"type": "text", "text": "Tóm tắt file này"},
        ],
    }],
)
print(resp.content[0].text)
```

> Các field không chuẩn Anthropic (`reasoning_effort`, `thinking_mode`, `strict_images`) phải truyền qua `extra_body` khi dùng SDK.

---

## 8. Lỗi thường gặp

| Status | `error.type` | Nguyên nhân |
|---|---|---|
| 400 | `invalid_request_error` | `model` không nằm trong danh sách; thiếu body; `anthropic-version` sai định dạng; tài liệu không hợp lệ; vượt giới hạn token input |
| 401 | `authentication_error` | Sai / thiếu API key |
| 429 | — | Vượt hạn mức của key |
| 502 | `api_error` | Upload ảnh (khi `strict_images: true`) hoặc tài liệu thất bại |
| 500 | `api_error` | Lỗi nội bộ |

Mẫu body lỗi:

```json
{ "type": "error", "error": { "type": "invalid_request_error", "message": "..." } }
```

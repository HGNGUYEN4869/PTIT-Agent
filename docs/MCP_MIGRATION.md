# Migration Guide: Chuyển sang MCP Architecture

## Thay đổi chính

### 1. XÓA Code không cần thiết

- `lib/terminalManager.ts` - Đã xóa
- `AgentActionHandler` - Đơn giản hóa (chỉ giữ để tương thích)

### 2. THÊM MCP Server mới

```
mcp-server/
  src/index.ts       - MCP server implementation
  package.json
  tsconfig.json
  README.md
```

## Luồng mới

### Trước (Custom Actions)

```
User -> Frontend -> Backend RAG
                     |
                     v
                  Trả về actions
                     |
                     v
       Frontend execute actions
                     |
                     v
               Hiển thị kết quả
```

### Sau (MCP)

```
User -> Frontend -> Backend RAG
                     |
                     v
                  MCP Client
                     |
                     v
                  MCP Server
                     |
           +---------+---------+
           v         v         v
        Files    Compile    Serial
           |         |         |
           v         v         v
    Backend Compile Service
           |
           v
    Trả kết quả cho Agent
           |
           v
    Frontend hiển thị
```

## Setup Backend RAG với MCP

### Install MCP SDK

```bash
pip install mcp
```

### Python Agent Code

```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

class ArduinoAgent:
    async def connect_mcp(self):
        server_params = StdioServerParameters(
            command="node",
            args=["../mcp-server/dist/index.js"],
            env={"WORKSPACE_ROOT": "/workspace/path"}
        )

        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                self.mcp_session = session
                await session.initialize()

    async def create_and_compile(self, user_message):
        # 1. Generate code
        code = self.generate_code(user_message)

        # 2. Write file qua MCP
        await self.mcp_session.call_tool(
            "write_file",
            arguments={
                "path": "esp32_projects/blink.ino",
                "content": code
            }
        )

        # 3. Compile qua MCP
        result = await self.mcp_session.call_tool(
            "compile_arduino",
            arguments={
                "file": "esp32_projects/blink.ino",
                "board": "esp32:esp32:esp32"
            }
        )

        # 4. Agent nhận kết quả luôn!
        return {
            "answer": "Đã tạo và compile thành công!",
            "details": result
        }
```

## Frontend Changes

### Đơn giản hóa ChatPage

Không cần `AgentActionHandler` phức tạp nữa:

```typescript
const handleSend = async (message: string) => {
  // Gửi message cho RAG Agent
  const response = await ragQuery(message);

  // Agent đã xử lý HẾT qua MCP rồi
  // Chỉ cần hiển thị kết quả
  addMessage({
    role: "assistant",
    content: response.answer,
  });
};
```

## Lợi ích

1. Agent TỰ execute (không cần Frontend)
2. Agent NHẬN kết quả ngay (không cần multi-turn)
3. Frontend đơn giản (chỉ chat UI)
4. MCP Server tái sử dụng được
5. Chuẩn hóa theo MCP protocol

## Next Steps

1. Cài đặt dependencies cho MCP server:

   ```bash
   cd mcp-server
   npm install
   npm run build
   ```

2. Cài MCP SDK cho Python backend:

   ```bash
   pip install mcp
   ```

3. Update Backend RAG để dùng MCP Client

4. Test workflow:
   - Agent tạo file
   - Agent compile
   - Agent nhận logs
   - Frontend hiển thị kết quả

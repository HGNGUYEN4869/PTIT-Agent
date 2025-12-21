# Setup MCP (Model Context Protocol) for RAG Backend

> **Mục đích:** Hướng dẫn tích hợp MCP Server vào Backend RAG để Agent có thể tự động thực hiện file operations và Arduino compilation thông qua MCP protocol.

---

## 📋 Table of Contents

1. [Kiến trúc tổng quan](#kiến-trúc-tổng-quan)
2. [Prerequisites](#prerequisites)
3. [Setup MCP Server (Node.js)](#setup-mcp-server-nodejs)
4. [Setup Backend RAG (Python)](#setup-backend-rag-python)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Kiến trúc tổng quan

```
┌─────────────────┐
│  Frontend       │  POST /rag/query { query: "tạo file blink LED" }
│  (Next.js)      │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│  Backend RAG (Python FastAPI)                │
│  1. Classify Intent (Agent Auto vs Manual)   │
│  2. Analyze Task → Generate Plan             │
│  3. Execute via MCP Client:                  │
│     - mcp_client.call_tool("write_file")     │ ◄──┐
│     - mcp_client.call_tool("compile_arduino")│    │
│  4. Format logs → Return answer              │    │
└────────┬─────────────────────────────────────┘    │
         │                                           │
         │ stdio (JSON-RPC)                          │
         ▼                                           │
┌──────────────────────────────────────────────┐    │
│  MCP Server (Node.js)                        │    │
│  Tools:                                      │    │
│  • read_file, write_file, delete_file        │    │
│  • list_files, select_board                  │    │
│  • compile_arduino (with WebSocket logs)     │ ───┘
│  • read_terminal_logs, list_serial_ports     │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│  Spring Boot Compile Service (Port 2005)     │
│  • arduino-cli wrapper                       │
│  • WebSocket log streaming                   │
└──────────────────────────────────────────────┘
```

---

## Prerequisites

### 1. Node.js & NPM

```bash
node --version  # v18+ required
npm --version
```

### 2. Python 3.10+

```bash
python --version  # 3.10+
pip --version
```

### 3. Spring Boot Compile Service

- Phải chạy trên **port 2005**
- Endpoints:
  - `POST http://localhost:2005/compile` (HTTP)
  - `ws://localhost:2005/ws/compile/{sessionId}` (WebSocket)

---

## Setup MCP Server (Node.js)

### 1️⃣ Install Dependencies

```bash
cd d:/Code/chatbot-rag/mcp-server
npm install
```

**Dependencies được cài:**

- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `ws` - WebSocket client để nhận compile logs
- `axios` - HTTP client cho compile API
- `form-data` - Upload file cho compile endpoint

### 2️⃣ Build TypeScript

```bash
npm run build
```

**Output:** `build/index.js` (MCP Server executable)

### 3️⃣ Test MCP Server (Optional)

```bash
node build/index.js
```

**Expected Output:**

```
MCP Server running on stdio
Registered tools: read_file, write_file, delete_file, list_files,
                  compile_arduino, select_board, read_terminal_logs,
                  list_serial_ports, read_serial_monitor
```

Press `Ctrl+C` để thoát.

### 4️⃣ Verify MCP Tools

File `mcp-server/src/index.ts` có các tools:

| Tool Name             | Description                                    | Parameters                         |
| --------------------- | ---------------------------------------------- | ---------------------------------- |
| `read_file`           | Đọc nội dung file                              | `path: string`                     |
| `write_file`          | Tạo/ghi file                                   | `path: string`, `content: string`  |
| `delete_file`         | Xóa file                                       | `path: string`                     |
| `list_files`          | List tất cả files                              | -                                  |
| `compile_arduino`     | Compile Arduino code + nhận logs qua WebSocket | `file: string`, `board: string`    |
| `select_board`        | Chọn board Arduino                             | `board: string`                    |
| `read_terminal_logs`  | Đọc logs compile cũ                            | `sessionId: string`                |
| `list_serial_ports`   | List COM ports                                 | -                                  |
| `read_serial_monitor` | Đọc Serial Monitor                             | `port: string`, `baudRate: number` |

---

## Setup Backend RAG (Python)

### 1️⃣ Install MCP Python SDK

```bash
cd your-backend-rag-folder
pip install mcp
```

### 2️⃣ Create MCP Client Manager

Tạo file `backend/mcp_client.py`:

```python
"""
MCP Client Manager cho Backend RAG
Kết nối tới MCP Server (Node.js) qua stdio protocol
"""

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
import asyncio
import json
from typing import Dict, Any, List

class MCPClientManager:
    """
    Singleton MCP Client quản lý kết nối tới MCP Server
    """

    def __init__(self, mcp_server_path: str = "d:/Code/chatbot-rag/mcp-server/build/index.js"):
        self.server_params = StdioServerParameters(
            command="node",
            args=[mcp_server_path],
            env=None
        )
        self.session = None
        self.read_stream = None
        self.write_stream = None
        self._connected = False

    async def connect(self):
        """Kết nối tới MCP Server"""
        if self._connected:
            return

        try:
            # Khởi tạo stdio client
            self.read_stream, self.write_stream = await stdio_client(self.server_params).__aenter__()

            # Tạo session
            self.session = await ClientSession(self.read_stream, self.write_stream).__aenter__()

            # Initialize session
            await self.session.initialize()

            # List available tools
            tools_response = await self.session.list_tools()
            tool_names = [tool.name for tool in tools_response.tools]

            print(f"✅ MCP Server connected successfully!")
            print(f"📦 Available tools: {', '.join(tool_names)}")

            self._connected = True

        except Exception as e:
            print(f"❌ Failed to connect to MCP Server: {e}")
            raise

    async def disconnect(self):
        """Ngắt kết nối MCP Server"""
        if self.session:
            await self.session.__aexit__(None, None, None)
        if self.read_stream and self.write_stream:
            # Close streams properly
            pass
        self._connected = False
        print("🔌 MCP Server disconnected")

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """
        Gọi MCP tool

        Args:
            tool_name: Tên tool (vd: "write_file", "compile_arduino")
            arguments: Dict parameters

        Returns:
            Tool execution result (parsed JSON nếu có)
        """
        if not self._connected:
            await self.connect()

        try:
            result = await self.session.call_tool(tool_name, arguments)

            # Parse result
            if result.content and len(result.content) > 0:
                content = result.content[0]

                # Try parse JSON
                try:
                    return json.loads(content.text)
                except json.JSONDecodeError:
                    return {"text": content.text}

            return {"success": True}

        except Exception as e:
            print(f"❌ MCP tool call failed: {tool_name}({arguments}) - {e}")
            raise

    async def write_file(self, path: str, content: str) -> Dict:
        """Tạo/ghi file"""
        return await self.call_tool("write_file", {"path": path, "content": content})

    async def read_file(self, path: str) -> Dict:
        """Đọc file"""
        return await self.call_tool("read_file", {"path": path})

    async def delete_file(self, path: str) -> Dict:
        """Xóa file"""
        return await self.call_tool("delete_file", {"path": path})

    async def list_files(self) -> Dict:
        """List tất cả files"""
        return await self.call_tool("list_files", {})

    async def compile_arduino(self, file_path: str, board: str = "esp32:esp32:esp32") -> Dict:
        """
        Compile Arduino code

        Returns:
            {
                "success": bool,
                "sessionId": str,
                "logs": str,  # Full compile logs from WebSocket
                "firmware": str | None
            }
        """
        return await self.call_tool("compile_arduino", {"file": file_path, "board": board})


# Global singleton instance
mcp_client = MCPClientManager()
```

### 3️⃣ Update RAG Endpoint

Sửa file endpoint `/rag/query` (ví dụ: `backend/api/rag_endpoint.py`):

````python
"""
RAG Query Endpoint với MCP Integration
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .mcp_client import mcp_client
import asyncio
from typing import List, Dict

router = APIRouter()

class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    answer: str
    isAgentMode: bool


@router.post("/rag/query")
async def rag_query(request: QueryRequest):
    """
    Main RAG endpoint
    1. Classify intent (Agent Auto vs User Manual)
    2. If Agent Mode → Execute task via MCP
    3. Return formatted answer
    """
    query = request.query

    # 1. Phân loại Intent
    is_agent_mode = classify_intent(query)

    if not is_agent_mode:
        # Manual Mode: Chỉ trả lời text hướng dẫn
        answer = await generate_answer_only(query)
        return QueryResponse(answer=answer, isAgentMode=False)

    # 2. Agent Mode: Tự động execute
    try:
        # Ensure MCP connection
        await mcp_client.connect()

        # Phân tích task plan
        task_plan = analyze_task(query)

        # Execute từng step
        execution_logs = []

        for step in task_plan["steps"]:
            action = step["action"]

            if action == "create_file":
                result = await mcp_client.write_file(
                    path=step["file_path"],
                    content=step["content"]
                )
                execution_logs.append(f"✅ Đã tạo file: `{step['file_path']}`")

            elif action == "compile":
                result = await mcp_client.compile_arduino(
                    file_path=step["file_path"],
                    board=step.get("board", "esp32:esp32:esp32")
                )

                if result.get("success"):
                    execution_logs.append(f"✅ **Compile thành công!**")
                    execution_logs.append(f"📋 **Logs:**\n```\n{result['logs']}\n```")

                    if result.get("firmware"):
                        execution_logs.append(f"📦 Firmware: `{result['firmware']}`")
                else:
                    execution_logs.append(f"❌ **Compile thất bại**")
                    execution_logs.append(f"📋 **Logs:**\n```\n{result['logs']}\n```")

            elif action == "delete_file":
                result = await mcp_client.delete_file(path=step["file_path"])
                execution_logs.append(f"🗑️ Đã xóa file: `{step['file_path']}`")

        # 3. Format answer
        answer = f"""
Đã thực hiện tự động các bước sau:

{chr(10).join(execution_logs)}

Bạn có thể kiểm tra kết quả trong **IDE Panel** bên trái.
"""

        return QueryResponse(answer=answer, isAgentMode=True)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"MCP execution failed: {str(e)}"
        )


def classify_intent(query: str) -> bool:
    """
    Phân loại query: Agent tự động hay User manual

    Agent Mode triggers:
    - "tạo file", "compile", "flash", "upload"
    - "giúp tôi làm", "tự động"

    Manual Mode triggers:
    - "giải thích", "hướng dẫn", "tài liệu", "là gì"
    """
    query_lower = query.lower()

    agent_keywords = [
        "tạo file", "compile", "flash", "upload", "debug",
        "giúp tôi làm", "tự động", "thực hiện", "chạy code"
    ]

    manual_keywords = [
        "giải thích", "hướng dẫn", "tài liệu", "là gì",
        "có thể", "như thế nào", "cách nào"
    ]

    # Check manual first (higher priority)
    if any(kw in query_lower for kw in manual_keywords):
        return False

    # Check agent triggers
    if any(kw in query_lower for kw in agent_keywords):
        return True

    # Default: manual mode
    return False


def analyze_task(query: str) -> Dict:
    """
    Phân tích query thành task plan

    TODO: Sử dụng LLM (GPT-4, Claude, Gemini) để generate plan

    Example output:
    {
        "steps": [
            {
                "action": "create_file",
                "file_path": "/src/blink.cpp",
                "content": "#include <Arduino.h>..."
            },
            {
                "action": "compile",
                "file_path": "/src/blink.cpp",
                "board": "esp32:esp32:esp32"
            }
        ]
    }
    """

    # TODO: Replace với LLM-based task planning
    # For now, simple keyword matching

    if "blink" in query.lower() or "led" in query.lower():
        return {
            "steps": [
                {
                    "action": "create_file",
                    "file_path": "/src/blink.cpp",
                    "content": """#include <Arduino.h>

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}
"""
                },
                {
                    "action": "compile",
                    "file_path": "/src/blink.cpp",
                    "board": "esp32:esp32:esp32"
                }
            ]
        }

    # Default: create empty file
    return {
        "steps": [
            {
                "action": "create_file",
                "file_path": "/src/main.cpp",
                "content": "#include <Arduino.h>\n\nvoid setup() {\n}\n\nvoid loop() {\n}\n"
            }
        ]
    }


async def generate_answer_only(query: str) -> str:
    """
    Manual mode: Generate text answer only (no actions)
    """
    # TODO: Use RAG/LLM to generate helpful text response
    return f"Đây là câu trả lời cho: {query}\n\n(TODO: Integrate RAG/LLM here)"
````

### 4️⃣ Lifecycle Management (Optional)

Thêm vào `backend/main.py` (FastAPI app):

```python
from fastapi import FastAPI
from contextlib import asynccontextmanager
from .mcp_client import mcp_client

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to MCP
    await mcp_client.connect()
    yield
    # Shutdown: Disconnect
    await mcp_client.disconnect()

app = FastAPI(lifespan=lifespan)

# ... your routes
```

---

## Testing

### 1️⃣ Test MCP Server Standalone

```bash
cd d:/Code/chatbot-rag/mcp-server
node build/index.js
```

Gõ JSON-RPC request (stdin):

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": { "name": "list_files", "arguments": {} },
  "id": 1
}
```

Expected: Response với list files.

### 2️⃣ Test Backend RAG Integration

#### Start Backend:

```bash
cd your-backend-folder
uvicorn main:app --reload --port 8000
```

#### Test với cURL:

```bash
# Test Manual Mode
curl -X POST http://localhost:8000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Arduino là gì?"}'

# Expected: { "answer": "...", "isAgentMode": false }
```

```bash
# Test Agent Mode
curl -X POST http://localhost:8000/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Tạo file blink LED cho tôi"}'

# Expected:
# {
#   "answer": "✅ Đã tạo file: /src/blink.cpp\n✅ Compile thành công!...",
#   "isAgentMode": true
# }
```

### 3️⃣ Test End-to-End (Frontend → RAG → MCP)

1. Start **Spring Boot Compile Service** (Port 2005)
2. Start **MCP Server**: `node mcp-server/build/index.js`
3. Start **Backend RAG**: `uvicorn main:app`
4. Start **Frontend**: `npm run dev`
5. Mở browser: http://localhost:3000
6. Chat: "Tạo file blink LED và compile giúp tôi"
7. Verify:
   - File được tạo (check IDE Panel)
   - Compile logs hiển thị trong chat
   - Backend logs show MCP tool calls

---

## Troubleshooting

### ❌ "MCP Server not found"

```bash
# Verify path
ls d:/Code/chatbot-rag/mcp-server/build/index.js

# Rebuild if missing
cd mcp-server
npm run build
```

### ❌ "WebSocket connection failed"

```bash
# Check Spring Boot running
curl http://localhost:2005/health

# Check WebSocket endpoint
wscat -c ws://localhost:2005/ws/compile/test-123
```

### ❌ "stdio protocol error"

- Ensure `node` và `npm` trong PATH
- Verify MCP Server chạy được standalone: `node build/index.js`
- Check Python `mcp` library version: `pip show mcp`

### ❌ "Compile timeout"

- Increase timeout trong `mcp-server/src/index.ts`:
  ```typescript
  const COMPILE_TIMEOUT = 60000; // 60 seconds → tăng lên 120000
  ```
- Rebuild: `npm run build`

### ❌ "Logs không hiển thị"

- Verify WebSocket JSON format từ Spring Boot
- Check `compile_arduino` tool parse logs correctly
- Enable debug logs: `console.log()` trong MCP Server

---

## Environment Variables (Optional)

Tạo `.env` trong backend folder:

```bash
# MCP Server
MCP_SERVER_PATH=d:/Code/chatbot-rag/mcp-server/build/index.js

# Compile Service
COMPILE_API_URL=http://localhost:2005/compile
COMPILE_WS_URL=ws://localhost:2005/ws/compile

# Timeouts
MCP_TIMEOUT=60000
COMPILE_TIMEOUT=120000
```

Load trong Python:

```python
import os
from dotenv import load_dotenv

load_dotenv()

MCP_SERVER_PATH = os.getenv("MCP_SERVER_PATH", "d:/Code/chatbot-rag/mcp-server/build/index.js")
```

---

## Next Steps

1. ✅ **Integrate LLM cho `analyze_task()`** - Dùng GPT-4/Claude để generate task plan từ query
2. ✅ **Add RAG knowledge base** - Tích hợp vector DB (Pinecone, ChromaDB) cho `generate_answer_only()`
3. ✅ **Add authentication** - Protect `/rag/query` endpoint với JWT
4. ✅ **Monitor MCP calls** - Add logging/metrics cho tool calls
5. ✅ **Error recovery** - Handle MCP Server crashes, auto-restart

---

## References

- [MCP Protocol Specification](https://modelcontextprotocol.io/docs)
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [WebSocket Protocol](https://datatracker.ietf.org/doc/html/rfc6455)

---

**Created:** November 12, 2025  
**Last Updated:** November 12, 2025  
**Version:** 1.0.0

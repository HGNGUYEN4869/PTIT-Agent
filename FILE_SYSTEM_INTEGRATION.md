# 🚀 File System Integration Guide

## 📋 Tổng quan

Hướng dẫn tích hợp **File System Access API** để cho phép web app **tạo, đọc, sửa file trực tiếp trên máy local** khi backend sinh code.

---

## 🎯 Giải pháp

### **File System Access API** (Chrome/Edge 86+)

- User chọn folder → Cấp quyền read/write
- Web app tạo/sửa/xóa file trong folder đó
- File thực sự tồn tại trên máy, có thể dùng với Git, IDE khác
- Hoạt động giống GitHub Copilot

---

## 🏗️ Kiến trúc đã implement

### **1. File System API Layer** (`lib/fileSystemAPI.ts`)

Các function cơ bản:

- `selectDirectory()` - User chọn folder
- `createFile()` - Tạo file mới
- `readFile()` - Đọc file
- `updateFile()` - Sửa file
- `deleteFile()` - Xóa file
- `listFiles()` - List tất cả files
- `createNestedFile()` - Tạo file với nested path (src/components/Button.tsx)

### **2. React Hook** (`hooks/use-file-system.ts`)

Custom hook `useFileSystem()` cung cấp:

```typescript
const {
  isSupported, // Browser có hỗ trợ không
  directoryHandle, // Handle của folder đã chọn
  currentDirectory, // Tên folder
  files, // Danh sách files

  // Actions
  selectWorkingDirectory, // Chọn folder
  createFileFromCode, // Tạo file từ code
  readFileContent, // Đọc file
  updateFileContent, // Sửa file
  processBackendCode, // Auto process từ backend
} = useFileSystem();
```

### **3. IDE Code Panel** (`components/component/IDECodePanel.tsx`)

IDE panel với:

- File explorer sidebar
- Monaco Editor để xem/sửa code
- Button chọn folder, refresh, save
- Auto detect language từ file extension
- Syntax highlighting

### **4. Code Parser** (`lib/codeParser.ts`)

Parse code từ AI response với format:

**Format 1: Markdown code block**

````markdown
```typescript:src/components/Button.tsx
export function Button() {
  return <button>Click me</button>
}
```
````

**Format 2: JSON**

```json
{
  "operations": [
    {
      "type": "create",
      "path": "src/App.tsx",
      "content": "...",
      "language": "typescript"
    }
  ]
}
```

---

## Workflow hoàn chỉnh

### **Bước 1: User chọn folder**

```typescript
// Trong IDECodePanel
<Button onClick={selectWorkingDirectory}>Chọn thư mục làm việc</Button>
```

User sẽ thấy dialog chọn folder → Cấp quyền

### **Bước 2: User chat với AI**

```
User: "Tạo cho tôi component Button trong React"
```

### **Bước 3: Backend trả về code**

Backend response:

````json
{
  "answer": "Tôi đã tạo component Button cho bạn:\n\n```typescript:src/components/Button.tsx\nexport function Button({ children, onClick }: Props) {\n  return <button onClick={onClick}>{children}</button>\n}\n```",
  "isAgentMode": true
}
````

### **Bước 4: Frontend tự động tạo file**

```typescript
// Trong ChatPage, sau khi nhận response
import { extractFileOperations } from "@/lib/codeParser";
import { useFileSystem } from "@/hooks/use-file-system";

const { processBackendCode } = useFileSystem();

// Parse operations từ AI response
const operations = extractFileOperations(queryRes.data.answer);

// Auto create/update files
if (operations.length > 0) {
  await processBackendCode(operations);
  alert(` Đã tạo ${operations.length} file(s)!`);
}
```

### **Bước 5: File xuất hiện trên máy**

File `src/components/Button.tsx` thực sự được tạo trong folder user chọn!

---

## 💻 Code Integration trong ChatPage

Thêm vào `app/(protected)/[idChat]/page.tsx`:

```typescript
import { extractFileOperations } from "@/lib/codeParser";
import { useFileSystem } from "@/hooks/use-file-system";

export default function ChatPage() {
  const { processBackendCode, directoryHandle } = useFileSystem();

  const handleSend = async (text: string, file?: File) => {
    // ... existing code ...

    const queryRes = await ragQuery(fullQueryText);

    //  Check Agent Mode
    if (queryRes.data.isAgentMode !== undefined) {
      dispatch(setAgentMode(queryRes.data.isAgentMode));
    }

    //  Auto create/update files từ AI response
    if (queryRes.data.isAgentMode && directoryHandle) {
      const operations = extractFileOperations(queryRes.data.answer);

      if (operations.length > 0) {
        await processBackendCode(operations);

        // Notify user
        const botNotification: Message = {
          role: MessageRole.ASSISTANT,
          content: ` Đã tạo/cập nhật ${operations.length} file(s):\n${operations
            .map((op) => `- ${op.path}`)
            .join("\n")}`,
        };
        setMessages((prev) => [...prev, botNotification]);
      }
    }

    // ... rest of code ...
  };
}
```

---

## 🔧 Backend Requirements

Backend cần trả về format phù hợp. **2 options:**

### **Option 1: Markdown với filepath** (Recommended)

````json
{
  "answer": "Tôi đã tạo component:\n\n```typescript:src/App.tsx\nfunction App() {\n  return <div>Hello</div>\n}\n```",
  "isAgentMode": true
}
````

### **Option 2: JSON operations**

```json
{
  "answer": "Đã tạo file!",
  "isAgentMode": true,
  "operations": [
    {
      "type": "create",
      "path": "src/App.tsx",
      "content": "function App() {\n  return <div>Hello</div>\n}",
      "language": "typescript"
    }
  ]
}
```

---

## 🎨 UI/UX Flow

1. User vào Agent Mode → Click "Chọn thư mục làm việc"
2. Chọn folder project → Cấp quyền
3. File explorer hiện danh sách files
4. Chat với AI: "Tạo component Login"
5. AI trả về code → File tự động được tạo
6. File explorer update → User click vào file để xem
7. Monaco Editor hiện code → User có thể sửa
8. Click "Lưu" → File được update

---

## 🔒 Security & Permissions

- User **PHẢI** chọn folder manually (không thể auto access)
- Chỉ access được folder đã chọn, không thể access toàn bộ máy
- User có thể revoke permission bất cứ lúc nào
- Permission chỉ tồn tại trong session (refresh page = mất quyền)

---

## 🐛 Browser Support

| Browser | Support | Version |
| ------- | ------- | ------- |
| Chrome  | Yes     | 86+     |
| Edge    | Yes     | 86+     |
| Firefox | No      | -       |
| Safari  | No      | -       |

**Fallback:** Hiện warning nếu browser không hỗ trợ

---

## 🧪 Testing

### Test manual:

1. **Chọn folder:**

   ```
   Click "Chọn thư mục làm việc" → Chọn folder test
   ```

2. **Chat tạo file:**

   ```
   User: "Tạo file index.ts với nội dung console.log('Hello')"
   ```

3. **Verify:**

   - File xuất hiện trong file explorer
   - Click file → Monaco Editor hiển thị code
   - Mở folder bằng VS Code → File thực sự tồn tại

4. **Test edit:**
   - Sửa code trong Monaco Editor
   - Click "Lưu"
   - Mở file bằng VS Code → Thấy thay đổi

### Test với mock backend:

````typescript
// Mock backend response
const mockResponse = {
  answer: "```typescript:test.ts\nconsole.log('Hello World');\n```",
  isAgentMode: true,
};

const operations = extractFileOperations(mockResponse.answer);
await processBackendCode(operations);
````

---

## Checklist Implementation

- [x] `lib/fileSystemAPI.ts` - Core API functions
- [x] `hooks/use-file-system.ts` - React hook
- [x] `lib/codeParser.ts` - Parse code từ AI
- [x] `components/component/IDECodePanel.tsx` - IDE UI với Monaco Editor
- [ ] Integrate vào `ChatPage` - Auto process backend code
- [ ] Backend update format response
- [ ] Testing end-to-end
- [ ] Error handling & edge cases

---

## 🚀 Next Steps

1.  Integrate `processBackendCode()` vào ChatPage
2.  Backend update response format
3.  Add file tree view (nested folders)
4.  Add Git integration (commit, push)
5.  Add terminal integration
6.  Add multi-file edit support

---

## 📚 Reference

- [File System Access API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [Chrome Developers - File System Access](https://web.dev/file-system-access/)
- [Monaco Editor React](https://github.com/suren-atoyan/monaco-react)

---

🎉 **File System integration is ready!**

Giờ web app có thể tạo/đọc/sửa file trên máy local giống GitHub Copilot!

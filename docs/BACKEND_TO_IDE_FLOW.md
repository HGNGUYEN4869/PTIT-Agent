# 🔄 Complete Flow: Backend → IDE

## 📋 Tổng quan

Tài liệu này giải thích **flow hoàn chỉnh** từ khi user chat, backend trả về code, đến khi file xuất hiện trong IDE trên máy local.

---

## 🎯 Flow từ đầu đến cuối

### **Step 1: User chat với AI**

```
User: "Tạo chương trình C++ Hello World"
```

### **Step 2: Frontend gửi request**

```typescript
// ChatPage.tsx
const queryRes = await ragQuery(fullQueryText);
```

API call:

```
POST http://172.16.5.10:2004/rag/query
Body: {
  "query": "Tạo chương trình C++ Hello World"
}
```

### **Step 3: Backend xử lý và trả về**

Backend response:

````json
{
  "answer": "Tôi đã tạo chương trình Hello World cho bạn:\n\n```cpp:main.cpp\n#include <iostream>\n\nint main() {\n    std::cout << \"Hello World!\" << std::endl;\n    return 0;\n}\n```",
  "isAgentMode": true
}
````

**Quan trọng:** Backend phải trả về:

- ✅ `isAgentMode: true` - Để trigger Agent Mode
- ✅ Code trong format markdown: `language:filepath`

### **Step 4: Frontend nhận response**

```typescript
// ChatPage.tsx

// 1. Set Agent Mode
if (queryRes.data.isAgentMode !== undefined) {
  dispatch(setAgentMode(queryRes.data.isAgentMode));
}
```

Layout tự động thay đổi:

- Sidebar ẩn
- IDE panel xuất hiện (75% trái)
- Chat thu nhỏ (25% phải)

### **Step 5: Parse code từ response**

```typescript
// 2. Extract file operations
const operations = extractFileOperations(queryRes.data.answer);
```

`extractFileOperations()` sẽ parse markdown và trả về:

```typescript
[
  {
    type: "create",
    path: "main.cpp",
    content:
      '#include <iostream>\n\nint main() {\n    std::cout << "Hello World!" << std::endl;\n    return 0;\n}',
    language: "cpp",
  },
];
```

### **Step 6: Kiểm tra folder đã được chọn**

```typescript
// 3. Check if directory is selected
if (!directoryHandle) {
  // ⚠️ Warning: User chưa chọn folder
  const warningNotification: Message = {
    role: MessageRole.ASSISTANT,
    content: `⚠️ Cần chọn thư mục làm việc!`,
  };

  setMessages((prev) => [...prev, warningNotification]);
}
```

### **Step 7a: Nếu chưa chọn folder**

Chat hiển thị warning:

```
⚠️ Cần chọn thư mục làm việc!

Tôi đã tìm thấy 1 file(s) cần tạo:
- main.cpp

Vui lòng click nút "Chọn thư mục làm việc" ở IDE panel bên trái.
```

User phải:

1. Click button "Chọn thư mục làm việc"
2. Browser hiện dialog chọn folder
3. Chọn folder project
4. Cấp quyền read/write

### **Step 7b: Nếu đã chọn folder**

```typescript
// 4. Process operations và tạo files
await processBackendCode(operations);
```

### **Step 8: Tạo file trên máy**

```typescript
// hooks/use-file-system.ts
export function useFileSystem() {
  const processBackendCode = async (operations) => {
    for (const op of operations) {
      switch (op.type) {
        case "create":
          await createNestedFileFromCode(op.path, op.content);
          break;

        case "update":
          await updateFileContent(op.path, op.content);
          break;

        case "delete":
          await deleteFileByName(op.path);
          break;
      }
    }
  };
}
```

File System Access API tạo file thực sự:

```typescript
// lib/fileSystemAPI.ts
export async function createFile(
  dirHandle: FileSystemDirectoryHandle,
  fileName: string,
  content: string
) {
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}
```

### **Step 9: File xuất hiện trong folder**

File `main.cpp` thực sự được tạo trong folder user chọn!

Verify:

```bash
# Mở terminal trong folder
ls -la
# Output: main.cpp

cat main.cpp
# Output:
# #include <iostream>
#
# int main() {
#     std::cout << "Hello World!" << std::endl;
#     return 0;
# }
```

### **Step 10: IDE panel update**

```typescript
// IDECodePanel.tsx
useEffect(() => {
  loadFileList(); // Auto refresh file list
}, [directoryHandle]);
```

File explorer sidebar hiển thị:

```
Files (1)
├─ main.cpp
```

### **Step 11: Chat notification**

```typescript
// 5. Show success notification
const fileNotification: Message = {
  role: MessageRole.ASSISTANT,
  content: `✅ Đã tạo/cập nhật 1 file(s):
- main.cpp (cpp)`,
};

setMessages((prev) => [...prev, fileNotification]);
```

Chat hiển thị:

```
✅ Đã tạo/cập nhật 1 file(s):
- main.cpp (cpp)
```

### **Step 12: User xem file**

User click vào `main.cpp` trong file explorer:

```typescript
const handleFileClick = async (fileName: string) => {
  // 1. Detect language
  setLanguage("cpp");

  // 2. Read file content
  const content = await readFileContent(fileName);

  // 3. Show in Monaco Editor
  setCode(content);
};
```

Monaco Editor hiển thị với C++ syntax highlighting!

---

## 🎨 Visual Flow Diagram

````
User Chat
    ↓
"Tạo C++ Hello World"
    ↓
ragQuery() → Backend
    ↓
Backend returns:
{
  answer: "```cpp:main.cpp\n...\n```",
  isAgentMode: true
}
    ↓
Frontend receives
    ↓
┌─────────────────────────────────────┐
│ 1. Set Agent Mode                   │
│    → Layout changes                 │
│    → Sidebar hide                   │
│    → IDE panel show                 │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 2. Extract operations               │
│    parseCodeBlocksFromMarkdown()    │
│    → [{ path: 'main.cpp', ... }]    │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 3. Check directory                  │
└─────────────────────────────────────┘
    ↓
    ├─ NO → Show warning
    │         "Chọn thư mục làm việc"
    │
    └─ YES ↓
         ┌──────────────────────────┐
         │ 4. Process operations    │
         │    processBackendCode()  │
         └──────────────────────────┘
              ↓
         ┌──────────────────────────┐
         │ 5. Create file           │
         │    File System API       │
         │    main.cpp created!     │
         └──────────────────────────┘
              ↓
         ┌──────────────────────────┐
         │ 6. File explorer update  │
         │    Show: main.cpp        │
         └──────────────────────────┘
              ↓
         ┌──────────────────────────┐
         │ 7. Chat notification     │
         │    ✅ Đã tạo 1 file      │
         └──────────────────────────┘
````

---

## 🔧 Backend Response Formats

### **Format 1: Markdown Code Block (Recommended)**

Đơn giản nhất, backend chỉ cần embed code trong markdown:

````json
{
  "answer": "Tôi đã tạo file cho bạn:\n\n```typescript:src/App.tsx\nfunction App() {\n  return <div>Hello</div>\n}\n```",
  "isAgentMode": true
}
````

Frontend tự động parse và tạo file `src/App.tsx`.

### **Format 2: Multiple Files**

Tạo nhiều files cùng lúc:

````json
{
  "answer": "Tôi đã tạo 3 files:\n\n```cpp:main.cpp\n#include \"Calculator.hpp\"\nint main() { return 0; }\n```\n\n```cpp:include/Calculator.hpp\nclass Calculator {};\n```\n\n```cpp:src/Calculator.cpp\n#include \"Calculator.hpp\"\n// implementation\n```",
  "isAgentMode": true
}
````

Frontend tạo 3 files:

- `main.cpp`
- `include/Calculator.hpp`
- `src/Calculator.cpp`

### **Format 3: JSON Operations (Advanced)**

Nếu cần control nhiều hơn:

```json
{
  "answer": "Đã tạo project!",
  "isAgentMode": true,
  "operations": [
    {
      "type": "create",
      "path": "src/main.cpp",
      "content": "...",
      "language": "cpp"
    },
    {
      "type": "update",
      "path": "README.md",
      "content": "...",
      "language": "markdown"
    }
  ]
}
```

---

## ✅ Implementation Checklist

- [x] `ChatPage.tsx` - Import useFileSystem hook
- [x] `ChatPage.tsx` - Extract operations from response
- [x] `ChatPage.tsx` - Check directory handle
- [x] `ChatPage.tsx` - Process operations
- [x] `ChatPage.tsx` - Show notifications
- [x] `IDECodePanel.tsx` - Auto refresh file list
- [x] `hooks/use-file-system.ts` - processBackendCode()
- [x] `lib/codeParser.ts` - extractFileOperations()
- [x] `lib/fileSystemAPI.ts` - Core file operations

---

## 🧪 Testing End-to-End

### Test 1: Simple file creation

1. User: "Tạo file test.txt với nội dung Hello"
2. Backend returns:
   ````json
   {
     "answer": "```plaintext:test.txt\nHello\n```",
     "isAgentMode": true
   }
   ````
3. File `test.txt` xuất hiện với nội dung "Hello"

### Test 2: C++ project

1. User: "Tạo C++ calculator"
2. Backend returns multiple files
3. Files xuất hiện: `main.cpp`, `Calculator.hpp`, `Calculator.cpp`
4. Click `main.cpp` → Monaco Editor hiển thị với syntax highlighting

### Test 3: Update existing file

1. File `test.txt` đã tồn tại
2. User: "Sửa test.txt thành Hello World"
3. Backend returns:
   ````json
   {
     "answer": "```plaintext:test.txt\nHello World\n```",
     "isAgentMode": true
   }
   ````
4. File content update từ "Hello" → "Hello World"

---

## 🎉 Summary

**Flow hoàn chỉnh:**

1. User chat → Backend
2. Backend trả code trong markdown
3. Frontend parse operations
4. Check folder đã chọn
5. Tạo file thực sự trên máy
6. IDE panel update
7. Notification trong chat

**Tất cả tự động, user chỉ cần:**

- Click "Chọn thư mục làm việc" (1 lần)
- Chat với AI
- File tự động xuất hiện! 🚀

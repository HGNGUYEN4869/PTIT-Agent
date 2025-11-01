# 🔧 C++ và Ngôn Ngữ Khác Support

## Các ngôn ngữ được hỗ trợ

### **Compiled Languages:**

- **C** (.c, .h)
- **C++** (.cpp, .cc, .cxx, .hpp, .hh, .hxx)
- **Java** (.java)
- **C#** (.cs)
- **Go** (.go)
- **Rust** (.rs)

### **Interpreted Languages:**

- **Python** (.py, .pyw)
- **JavaScript** (.js, .mjs, .cjs)
- **TypeScript** (.ts)
- **PHP** (.php)
- **Ruby** (.rb)

### **Web Technologies:**

- **HTML** (.html, .htm)
- **CSS** (.css, .scss, .sass, .less)
- **React/JSX** (.jsx, .tsx)

### **Mobile:**

- **Swift** (.swift)
- **Kotlin** (.kt)
- **Dart** (.dart)
- **Objective-C** (.m)

### **Data & Config:**

- **JSON** (.json)
- **XML** (.xml)
- **YAML** (.yaml, .yml)
- **SQL** (.sql)

### **Scripting:**

- **Shell** (.sh, .bash, .zsh)
- **R** (.r)

### **Markup:**

- **Markdown** (.md, .markdown)

---

## 📝 Format Backend Response cho C++

### **Ví dụ 1: Tạo file C++ đơn giản**

````json
{
  "answer": "Tôi đã tạo chương trình Hello World cho bạn:\n\n```cpp:src/main.cpp\n#include <iostream>\n\nint main() {\n    std::cout << \"Hello World!\" << std::endl;\n    return 0;\n}\n```",
  "isAgentMode": true
}
````

### **Ví dụ 2: Tạo header file C++**

````json
{
  "answer": "Header file cho class Calculator:\n\n```cpp:include/Calculator.hpp\n#ifndef CALCULATOR_HPP\n#define CALCULATOR_HPP\n\nclass Calculator {\nprivate:\n    double result;\n\npublic:\n    Calculator();\n    double add(double a, double b);\n    double subtract(double a, double b);\n    double multiply(double a, double b);\n    double divide(double a, double b);\n};\n\n#endif\n```",
  "isAgentMode": true
}
````

### **Ví dụ 3: Tạo implementation file**

````json
{
  "answer": "Implementation của Calculator:\n\n```cpp:src/Calculator.cpp\n#include \"Calculator.hpp\"\n\nCalculator::Calculator() : result(0) {}\n\ndouble Calculator::add(double a, double b) {\n    result = a + b;\n    return result;\n}\n\ndouble Calculator::subtract(double a, double b) {\n    result = a - b;\n    return result;\n}\n\ndouble Calculator::multiply(double a, double b) {\n    result = a * b;\n    return result;\n}\n\ndouble Calculator::divide(double a, double b) {\n    if (b != 0) {\n        result = a / b;\n        return result;\n    }\n    return 0;\n}\n```",
  "isAgentMode": true
}
````

### **Ví dụ 4: Tạo nhiều file cùng lúc (JSON format)**

```json
{
  "answer": "Tôi đã tạo project C++ hoàn chỉnh cho bạn!",
  "isAgentMode": true,
  "operations": [
    {
      "type": "create",
      "path": "src/main.cpp",
      "content": "#include <iostream>\n#include \"Calculator.hpp\"\n\nint main() {\n    Calculator calc;\n    std::cout << \"5 + 3 = \" << calc.add(5, 3) << std::endl;\n    return 0;\n}",
      "language": "cpp"
    },
    {
      "type": "create",
      "path": "include/Calculator.hpp",
      "content": "#ifndef CALCULATOR_HPP\n#define CALCULATOR_HPP\n\nclass Calculator {\npublic:\n    double add(double a, double b);\n};\n\n#endif",
      "language": "cpp"
    },
    {
      "type": "create",
      "path": "src/Calculator.cpp",
      "content": "#include \"Calculator.hpp\"\n\ndouble Calculator::add(double a, double b) {\n    return a + b;\n}",
      "language": "cpp"
    }
  ]
}
```

---

## 🎯 Use Cases

### **C++ Console Application**

**User:** "Tạo chương trình C++ nhập 2 số và tính tổng"

**Backend response:**

````json
{
  "answer": "```cpp:main.cpp\n#include <iostream>\n\nint main() {\n    int a, b;\n    std::cout << \"Nhap so thu nhat: \";\n    std::cin >> a;\n    std::cout << \"Nhap so thu hai: \";\n    std::cin >> b;\n    std::cout << \"Tong: \" << (a + b) << std::endl;\n    return 0;\n}\n```",
  "isAgentMode": true
}
````

### **Java Spring Boot**

**User:** "Tạo REST API endpoint trong Spring Boot"

**Backend response:**

````json
{
  "answer": "```java:src/main/java/com/example/UserController.java\npackage com.example;\n\nimport org.springframework.web.bind.annotation.*;\n\n@RestController\n@RequestMapping(\"/api/users\")\npublic class UserController {\n    \n    @GetMapping(\"/{id}\")\n    public User getUser(@PathVariable Long id) {\n        return new User(id, \"John Doe\");\n    }\n}\n```",
  "isAgentMode": true
}
````

### **Python Data Science**

**User:** "Tạo script Python để đọc CSV và vẽ biểu đồ"

**Backend response:**

````json
{
  "answer": "```python:analyze.py\nimport pandas as pd\nimport matplotlib.pyplot as plt\n\ndf = pd.read_csv('data.csv')\ndf.plot(x='date', y='value')\nplt.savefig('chart.png')\nprint('Chart saved!')\n```",
  "isAgentMode": true
}
````

---

## 🔧 Language Detection

IDE tự động detect language dựa vào **file extension**:

| Extension | Language   | Monaco Editor Mode |
| --------- | ---------- | ------------------ |
| .cpp, .cc | C++        | `cpp`              |
| .c, .h    | C          | `c`                |
| .java     | Java       | `java`             |
| .py       | Python     | `python`           |
| .js, .jsx | JavaScript | `javascript`       |
| .ts, .tsx | TypeScript | `typescript`       |
| .cs       | C#         | `csharp`           |
| .go       | Go         | `go`               |
| .rs       | Rust       | `rust`             |
| .php      | PHP        | `php`              |
| .rb       | Ruby       | `ruby`             |

---

## Syntax Highlighting

Monaco Editor hỗ trợ syntax highlighting cho tất cả ngôn ngữ trên:

- Keywords highlighting
- String highlighting
- Comment highlighting
- Function/Class highlighting
- Bracket matching
- Auto-indentation
- Code folding

---

## 🚀 Testing C++ Support

### **Bước 1:** Vào Agent Mode

### **Bước 2:** Chọn folder project C++

### **Bước 3:** Chat

```
User: "Tạo chương trình Hello World trong C++"
```

### **Bước 4:** Backend trả về

````json
{
  "answer": "```cpp:main.cpp\n#include <iostream>\n\nint main() {\n    std::cout << \"Hello World!\" << std::endl;\n    return 0;\n}\n```",
  "isAgentMode": true
}
````

### **Bước 5:** File `main.cpp` được tạo tự động!

### **Bước 6:** Click file → Monaco Editor hiển thị với C++ syntax highlighting

### **Bước 7:** Compile và chạy

```bash
g++ main.cpp -o main
./main
```

---

## 📋 Backend Development Guide

### **Language Detection Logic:**

```python
def detect_language_from_request(user_message: str) -> str:
    """Detect programming language từ user message"""

    keywords = {
        'cpp': ['c++', 'cpp', 'iostream', 'std::', 'class'],
        'c': ['c language', 'printf', 'scanf', 'malloc'],
        'java': ['java', 'spring boot', 'class', 'public static void'],
        'python': ['python', 'pandas', 'numpy', 'def ', 'import'],
        'javascript': ['javascript', 'react', 'node.js', 'const ', 'let '],
        'typescript': ['typescript', 'interface', 'type '],
    }

    message_lower = user_message.lower()

    for lang, words in keywords.items():
        if any(word in message_lower for word in words):
            return lang

    return 'plaintext'
```

### **Format Response:**

````python
def format_code_response(code: str, language: str, filepath: str) -> dict:
    """Format response với code block"""

    answer = f"Tôi đã tạo file cho bạn:\n\n```{language}:{filepath}\n{code}\n```"

    return {
        "answer": answer,
        "isAgentMode": True
    }
````

---

🎉 **Tất cả ngôn ngữ lập trình phổ biến đều được hỗ trợ!**

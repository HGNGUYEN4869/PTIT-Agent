export function formatMarkdown(content: string | undefined): string {
    if (!content) return "";
    return (
      content
        // Chuyển [IMAGE: ...] thành thẻ <img>
        .replace(
          /\[IMAGE:\s*(.*?)\s*\]/g,
          '<img src="$1" alt="image" style="max-width:100%;border-radius:8px;margin:8px 0;" />'
        )
        .replace(/\|[^\n]+\|\s*\n\s*\n(?=\|)/g, (m) => m.replace(/\n+/g, " "))
        //  Chuẩn hóa các dòng xuống dòng
        .replace(/\\n/g, "\n")
        .replace(/\n{3,}/g, "\n")
        .trim()
    );
  }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ApiResponse<T = any> {
  success: boolean;
  code: number;
  message: string;
  data?: T;
  timestamp: string;
  status: number;
}

export interface PaginationData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export interface ragResponse {
  query: string;
  answer: string | undefined;
  context_source: string;
}

export const FIELD_LABELS: Record<string, string> = {
  Loai_the_dk: "Loại thẻ đăng ký",
  Ho_ten: "Họ tên",
  Ngay_sinh: "Ngày sinh",
  Ma_so_cccd: "Mã số CCCD",
  Ma_sinh_vien: "Mã sinh viên",
  Gioi_tinh: "Giới tính",
  Quoc_tich: "Quốc tịch",
  Que_quan: "Quê quán",
  Que: "Quê",
  Noi_thuong_tru: "Nơi thường trú",
  Lop: "Lớp",
  Nganh: "Ngành",
  Nien_khoa: "Niên khóa",
};

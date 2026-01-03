export interface CardStudentResponse {
  success: boolean,
  error?: string,
  card_type?: string,
  extracted_info?: {
    Loai_the_dk?: string,
    Ho_ten?: string,
    Ngay_sinh?: string,
    Ma_so_cccd?: string,
    Ma_sinh_vien?: string,
    Gioi_tinh?: string,
    Quoc_tich?: string,
    Que_quan?: string,
    Noi_thuong_tru?: string,
    Lop?: string,
    Nganh?: string,
    Nien_khoa?: string
  },
  crop_image_base64?: string,
  xoay_image_base64?: string
}
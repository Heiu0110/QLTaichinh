export const currency = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
export function today(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export const currentMonth = () => today().slice(0, 7);
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(`${value}T12:00:00`),
  );
export const monthLabel = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(
    new Date(`${value}-01T12:00:00`),
  );
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(y, m - 1, d);
  date.setUTCHours(0, 0, 0, 0);
  return (
    y >= 1900 &&
    y <= 9999 &&
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}
export function parseMoney(value: string, signed = false): number {
  const raw = value.trim();
  if (!(signed ? /^-?\d+$/ : /^\d+$/).test(raw))
    throw new Error('Nhập số tiền nguyên VND, không dùng dấu chấm hoặc dấu phẩy.');
  const amount = Number(raw);
  if (!Number.isSafeInteger(amount) || Math.abs(amount) > 1_000_000_000_000)
    throw new Error('Số tiền tối đa là 1.000.000.000.000 ₫.');
  return amount;
}
export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'QuotaExceededError')
      return 'Thiết bị hết dung lượng. Hãy xuất backup và giải phóng bộ nhớ.';
    if (error.name === 'ZodError')
      return 'Dữ liệu không hợp lệ. Kiểm tra số tiền, tên và ngày nhập.';
    return error.message;
  }
  return 'Không thể lưu dữ liệu. Vui lòng thử lại.';
}

export function formatMonthYearVi(dateString: string): string {
  const date = new Date(dateString);
  const month = date.getMonth() + 1; // getMonth() trả 0–11
  const year = date.getFullYear();
  return `Tháng ${month} năm ${year}`;
}

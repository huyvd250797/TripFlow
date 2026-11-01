export const parseMoneyInput = (value: unknown) =>
  Number(String(value ?? "").replace(/\D/g, "")) || 0;
export const formatMoneyInput = (value: unknown) =>
  String(value ?? "").replace(/\D/g, "")
    ? new Intl.NumberFormat("vi-VN").format(parseMoneyInput(value))
    : "";

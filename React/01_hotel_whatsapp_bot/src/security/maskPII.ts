export function maskPhone(phone: string): string {
  if (phone.length === 0) return "***";
  if (phone.length <= 6) {
    const prefix = phone.slice(0, 3);
    return `${prefix}${"*".repeat(phone.length - 3)}`;
  }
  const prefix = phone.slice(0, 4);
  const suffix = phone.slice(-2);
  const maskedLen = phone.length - prefix.length - suffix.length;
  return `${prefix}${"*".repeat(maskedLen)}${suffix}`;
}

export function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return "***";
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  if(local.length === 1) return `*${domain}`;
  return `${local[0]}${"*".repeat(3)}${domain}`
}

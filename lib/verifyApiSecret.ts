export function verifyApiSecret(headers: Headers) {
  const secret = headers.get("x-api-secret");
  return secret === "ProboMobile2025";
}

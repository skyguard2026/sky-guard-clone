/** Bound memory before parsing a public request, including chunked bodies. */
export class PayloadTooLarge extends Error {}
export async function readLimitedText(
  request: Request,
  maxBytes = 32_768,
): Promise<string> {
  const length = request.headers.get("content-length");
  if (length && Number(length) > maxBytes) throw new PayloadTooLarge();
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0,
    text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new PayloadTooLarge();
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

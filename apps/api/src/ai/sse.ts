export type SseEvent = { event: string; data: string };

/**
 * Consume a Server-Sent Events response body without assuming network chunk
 * boundaries align with event boundaries. Supports LF, CRLF, CR, multiple
 * data lines, and a final event that is not terminated by a blank line.
 */
export async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal | undefined,
  onEvent: (event: SseEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const cancel = () => { void reader.cancel().catch(() => undefined); };

  if (signal?.aborted) {
    await reader.cancel().catch(() => undefined);
    throw new DOMException("The operation was aborted.", "AbortError");
  }
  signal?.addEventListener("abort", cancel, { once: true });

  const dispatch = (block: string) => {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split(/\r\n|\r|\n/)) {
      if (!line || line.startsWith(":")) continue;
      const separator = line.indexOf(":");
      const field = separator < 0 ? line : line.slice(0, separator);
      let value = separator < 0 ? "" : line.slice(separator + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") event = value;
      if (field === "data") data.push(value);
    }
    if (data.length) onEvent({ event, data: data.join("\n") });
  };

  const drain = () => {
    const delimiter = /(?:\r\n|\r|\n){2}/;
    let match: RegExpExecArray | null;
    while ((match = delimiter.exec(buffer))) {
      const block = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      dispatch(block);
    }
  };

  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      drain();
    }
    if (signal?.aborted) throw new DOMException("The operation was aborted.", "AbortError");
    buffer += decoder.decode();
    drain();
    if (buffer.length) dispatch(buffer);
  } finally {
    signal?.removeEventListener("abort", cancel);
    if (signal?.aborted) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function redact(text: string) {
  let safe = text.replace(/AIza[\w-]+/g, "[REDACTED]").replace(/([?&]key=)[^&\s]+/gi, "$1[REDACTED]");
  for (const key of [process.env.KIE_API_KEY, process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY]) {
    if (key) safe = safe.split(key).join("[REDACTED]");
  }
  return safe;
}

export function logEvent(event: string, data: Record<string, unknown> = {}) {
  const record = { time: new Date().toISOString(), event, ...data };
  console.log(redact(JSON.stringify(record, (_key, value) => value instanceof Error
    ? { name: value.name, message: value.message, stack: value.stack, cause: value.cause }
    : value)));
}

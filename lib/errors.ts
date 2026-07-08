export function getErrorMessage(err: unknown): string {
  if (err == null) return "Unknown error (null/undefined thrown)";

  if (typeof err === "string") return err;

  if (err instanceof AggregateError) {
    const sub = err.errors?.map((e) => getErrorMessage(e)).join("; ");
    return `${err.message || "AggregateError"}${sub ? ` [${sub}]` : ""}`;
  }

  if (err instanceof Error) {
    const cause = (err as any).cause ? ` (cause: ${getErrorMessage((err as any).cause)})` : "";
    return `${err.message || err.name || "Error"}${cause}`;
  }

  if (typeof err === "object") {
    try {
      const json = JSON.stringify(err);
      return json === "{}" ? `Non-Error object thrown: ${String(err)}` : json;
    } catch {
      return "Unserializable error object";
    }
  }

  return String(err);
}

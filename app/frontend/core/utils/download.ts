/** The server answers JSON `{ error }`, but a proxy or crash page might not. */
export async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await response.json()) as { error?: string };
    if (body.error) return body.error;
  }
  return (await response.text()) || `HTTP ${response.status}`;
}

/** `attachment; filename="estimari-neexecutate_1201-1206.pdf"` → the name. */
export function readFileName(contentDisposition: string | null): string | null {
  const match = /filename="?([^";]+)"?/i.exec(contentDisposition ?? "");
  return match?.[1] ?? null;
}

export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // give the browser time to start the download before freeing it
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

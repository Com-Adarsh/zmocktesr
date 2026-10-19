export type JsonApiResult = {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
};

export async function requestJson(url: string, init?: RequestInit): Promise<JsonApiResult> {
  try {
    const response = await fetch(url, init);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { ok: false, status: response.status, data: { error: "The server returned an invalid response." } };
    }
    return { ok: response.ok, status: response.status, data: payload as Record<string, unknown> };
  } catch {
    return { ok: false, status: 0, data: { error: "The request failed because the network or server response was unavailable." } };
  }
}

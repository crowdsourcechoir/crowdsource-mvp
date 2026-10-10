/** Delete one interview contribution (user turn). Agent prompts are left in place. */
export async function deleteInterviewContribution(
  conversationId: string,
  turnId: string
): Promise<void> {
  const res = await fetch(
    `/api/agent/conversations/${encodeURIComponent(conversationId)}/turns/${encodeURIComponent(turnId)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Could not delete contribution.");
  }
}

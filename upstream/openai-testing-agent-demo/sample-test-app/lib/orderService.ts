export async function checkoutOrder(payload: unknown) {
  const res = await fetch("/api/services/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("Checkout failed");
  }
  const data: { orderId: string; status?: string; arrivalDate?: string } = await res.json();
  return data;
}

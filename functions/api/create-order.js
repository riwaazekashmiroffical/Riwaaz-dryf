export async function onRequestPost({ request, env }) {
  const headers = { "Content-Type": "application/json" };
  try {
    const { amount, name, phone, address, items } = await request.json();
    const rupees = Number(amount);
    if (!rupees || rupees < 1) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), { status: 400, headers });
    }

    const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
    const cut = (v) => String(v || "").slice(0, 250);

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: Math.round(rupees * 100),
        currency: "INR",
        receipt: "rcpt_" + Date.now(),
        notes: { name: cut(name), phone: cut(phone), address: cut(address), items: cut(items) },
      }),
    });

    return new Response(await res.text(), { status: res.status, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers });
  }
}

export function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length <= 4) return "***";
  return `+${digits.slice(0, 3)} *** ** ${digits.slice(-2)}`;
}

export async function sendManagerEmail(env, { subject, text }) {
  if (!env.RESEND_API_KEY) {
    return { attempted: false, sent: false, reason: "email_not_configured" };
  }

  const to = String(env.ORDER_EMAIL_TO || "orders@globalmarket.kg").trim();
  const from = String(env.ORDER_EMAIL_FROM || "Global Market KG <orders@globalmarket.kg>").trim();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Email send failed: ${res.status} ${detail}`);
  }
  return { attempted: true, sent: true };
}

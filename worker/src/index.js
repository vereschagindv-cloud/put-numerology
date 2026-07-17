import { md5 } from "./md5.js";

const PRICE = "99.00";
const ALLOWED_ORIGIN = "https://waynumber.ru";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

async function handlePay(request, env) {
  const url = new URL(request.url);
  // One invoice ID per second is plenty for this traffic and stays well
  // under Robokassa's 32-bit InvId ceiling.
  const invId = Math.floor(Date.now() / 1000);

  const signature = md5(
    `${env.ROBOKASSA_LOGIN}:${PRICE}:${invId}:${env.ROBOKASSA_PASSWORD1}`
  );

  const successUrl = `${ALLOWED_ORIGIN}/?invId=${invId}&status=success`;
  const failUrl = `${ALLOWED_ORIGIN}/?invId=${invId}&status=fail`;

  const params = new URLSearchParams({
    MerchantLogin: env.ROBOKASSA_LOGIN,
    OutSum: PRICE,
    InvId: String(invId),
    Description: "Нумерологический разбор — Путь",
    SignatureValue: signature,
    SuccessURL: successUrl,
    FailURL: failUrl,
    IsTest: "1",
    Culture: "ru",
  });

  const payUrl = `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`;
  return json({ invId, payUrl });
}

async function handleResult(request, env) {
  const url = new URL(request.url);
  let params;
  if (request.method === "POST") {
    const body = await request.text();
    params = new URLSearchParams(body);
  } else {
    params = url.searchParams;
  }

  const outSum = params.get("OutSum");
  const invId = params.get("InvId");
  const signature = params.get("SignatureValue");

  if (!outSum || !invId || !signature) {
    return new Response("bad request", { status: 400 });
  }

  const expected = md5(`${outSum}:${invId}:${env.ROBOKASSA_PASSWORD2}`);
  if (expected.toLowerCase() !== signature.toLowerCase()) {
    return new Response("bad signature", { status: 400 });
  }

  await env.PAYMENTS.put(`paid:${invId}`, "1", { expirationTtl: 86400 });
  return new Response(`OK${invId}`);
}

async function handleCheck(request, env) {
  const url = new URL(request.url);
  const invId = url.searchParams.get("invId");
  if (!invId) return json({ paid: false }, 400);
  const value = await env.PAYMENTS.get(`paid:${invId}`);
  return json({ paid: value === "1" });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === "/pay") return handlePay(request, env);
    if (url.pathname === "/result") return handleResult(request, env);
    if (url.pathname === "/check") return handleCheck(request, env);

    return new Response("not found", { status: 404 });
  },
};

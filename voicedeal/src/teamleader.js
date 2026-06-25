// Teamleader Focus integratie: OAuth2 + API-aanroepen.
//
// OAuth2 endpoints en API-basis zoals gedocumenteerd voor Teamleader Focus.
// Alle API-calls zijn POST naar https://api.focus.teamleader.eu/<actie> met een
// JSON-body en een "Authorization: Bearer <access_token>" header.

const TOKEN_KEY = "teamleader"; // sleutel in de KV-namespace
const AUTH_URL = "https://focus.teamleader.eu/oauth2/authorize";
const TOKEN_URL = "https://focus.teamleader.eu/oauth2/access_token";
const API_BASE = "https://api.focus.teamleader.eu";

// ---- OAuth2 -----------------------------------------------------------------

export function authorizeUrl(env, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: env.TL_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function storeTokens(env, data) {
  const tokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
  };
  await env.TOKENS.put(TOKEN_KEY, JSON.stringify(tokens));
  return tokens;
}

export async function exchangeCode(env, code, redirectUri) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.TL_CLIENT_ID,
      client_secret: env.TL_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    throw new Error(`Teamleader token-uitwisseling mislukt: ${res.status} ${await res.text()}`);
  }
  return storeTokens(env, await res.json());
}

export async function getTokens(env) {
  const raw = await env.TOKENS.get(TOKEN_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function isConnected(env) {
  return (await getTokens(env)) !== null;
}

export async function disconnect(env) {
  await env.TOKENS.delete(TOKEN_KEY);
}

async function refreshTokens(env, tokens) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.TL_CLIENT_ID,
      client_secret: env.TL_CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Teamleader token-vernieuwing mislukt: ${res.status} ${await res.text()}`);
  }
  return storeTokens(env, await res.json());
}

async function validAccessToken(env) {
  let tokens = await getTokens(env);
  if (!tokens) throw new Error("NOT_CONNECTED");
  // Ververs preventief 60s voor het verlopen.
  if (tokens.expires_at - 60 <= Math.floor(Date.now() / 1000)) {
    tokens = await refreshTokens(env, tokens);
  }
  return tokens.access_token;
}

// ---- API --------------------------------------------------------------------

async function apiCall(env, action, body) {
  const token = await validAccessToken(env);
  const res = await fetch(`${API_BASE}/${action}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Teamleader ${action} mislukt: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

// Zoekt een bestaande klant (bedrijf of contact) op naam.
async function findCustomer(env, type, name) {
  const action = type === "company" ? "companies.list" : "contacts.list";
  const res = await apiCall(env, action, {
    filter: { term: name },
    page: { size: 1, number: 1 },
  });
  const first = res?.data?.[0];
  return first?.id || null;
}

// Maakt een nieuwe klant aan als die nog niet bestaat.
async function createCustomer(env, type, name) {
  if (type === "company") {
    const res = await apiCall(env, "companies.add", { name });
    return res?.data?.id;
  }
  // Een contact heeft een voor- en achternaam nodig; splits de naam eenvoudig.
  const parts = name.trim().split(/\s+/);
  const first_name = parts.length > 1 ? parts[0] : "";
  const last_name = parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
  const res = await apiCall(env, "contacts.add", { first_name, last_name });
  return res?.data?.id;
}

// Maakt op basis van de door Claude gestructureerde gegevens een deal aan,
// koppelt die aan een klant en hangt er een notitie aan.
export async function createDealFromExtraction(env, ex) {
  const type = ex.customer_type === "contact" ? "contact" : "company";

  let customerId = await findCustomer(env, type, ex.customer_name);
  let customerCreated = false;
  if (!customerId) {
    customerId = await createCustomer(env, type, ex.customer_name);
    customerCreated = true;
  }

  // deals.create vereist minimaal lead.customer + title.
  const dealBody = {
    lead: { customer: { type, id: customerId } },
    title: ex.deal_title,
  };
  if (typeof ex.estimated_value === "number" && ex.estimated_value > 0) {
    dealBody.estimated_value = {
      amount: ex.estimated_value,
      currency: ex.currency || "EUR",
    };
  }
  const dealRes = await apiCall(env, "deals.create", dealBody);
  const dealId = dealRes?.data?.id;

  // De ingesproken samenvatting bewaren we als notitie op de deal.
  if (ex.note && dealId) {
    try {
      await apiCall(env, "notes.create", {
        subject: { type: "deal", id: dealId },
        content: ex.note,
      });
    } catch (e) {
      // Notitie is best-effort; de deal bestaat al, dus laat dit niet falen.
      console.error("notes.create mislukt:", e.message);
    }
  }

  return { dealId, customerId, customerType: type, customerCreated };
}

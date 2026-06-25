// VoiceDeal — Cloudflare Worker.
// Routes:
//   GET  /              -> loginpagina of app-pagina
//   POST /login         -> wachtwoord controleren, sessiecookie zetten
//   POST /logout        -> sessiecookie wissen
//   GET  /oauth/start   -> redirect naar Teamleader voor toestemming
//   GET  /oauth/callback-> autorisatiecode inwisselen voor tokens
//   POST /api/process   -> transcript -> Claude -> Teamleader-deal

import {
  isLoggedIn,
  passwordMatches,
  createSession,
  sessionCookie,
  clearSessionCookie,
  parseCookies,
} from "./auth.js";
import { loginPage, appPage } from "./ui.js";
import {
  authorizeUrl,
  exchangeCode,
  isConnected,
  createDealFromExtraction,
} from "./teamleader.js";
import { extractDeal } from "./claude.js";

const OAUTH_STATE_COOKIE = "vd_oauth_state";

function html(body, extraHeaders = {}) {
  return new Response(body, {
    headers: { "Content-Type": "text/html; charset=utf-8", ...extraHeaders },
  });
}

function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

function redirect(location, extraHeaders = {}) {
  return new Response(null, { status: 302, headers: { Location: location, ...extraHeaders } });
}

function callbackUri(url) {
  return `${url.origin}/oauth/callback`;
}

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // Vroege configuratiecheck voor duidelijke foutmeldingen.
    if (!env.APP_PASSWORD) {
      return html(
        "<p>Configuratie onvolledig: secret <code>APP_PASSWORD</code> ontbreekt. " +
          "Zet deze met <code>wrangler secret put APP_PASSWORD</code>.</p>",
        {}
      );
    }

    // ---- Login / logout ----------------------------------------------------
    if (pathname === "/login" && request.method === "POST") {
      const form = await request.formData();
      const ok = await passwordMatches(env.APP_PASSWORD, form.get("password") || "");
      if (!ok) return html(loginPage("Onjuiste toegangscode."), {});
      const token = await createSession(env.APP_PASSWORD);
      return redirect("/", { "Set-Cookie": sessionCookie(token) });
    }

    if (pathname === "/logout" && request.method === "POST") {
      return redirect("/", { "Set-Cookie": clearSessionCookie() });
    }

    // Alles hieronder vereist dat je bent ingelogd in de app.
    const loggedIn = await isLoggedIn(request, env);
    if (!loggedIn) {
      if (pathname === "/") return html(loginPage(""), {});
      // Niet ingelogd op een beschermde route.
      if (pathname.startsWith("/api/")) return json({ error: "Niet ingelogd." }, 401);
      return redirect("/");
    }

    // ---- Teamleader OAuth ---------------------------------------------------
    if (pathname === "/oauth/start") {
      if (!env.TL_CLIENT_ID || env.TL_CLIENT_ID.startsWith("VUL_HIER")) {
        return html("<p>Configuratie onvolledig: <code>TL_CLIENT_ID</code> staat nog niet in wrangler.toml.</p>");
      }
      const state = randomState();
      const target = authorizeUrl(env, callbackUri(url), state);
      return redirect(target, {
        "Set-Cookie": `${OAUTH_STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
      });
    }

    if (pathname === "/oauth/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const cookieState = parseCookies(request)[OAUTH_STATE_COOKIE];
      if (!code) return html("<p>Teamleader gaf geen autorisatiecode terug. <a href='/'>Terug</a></p>");
      if (!state || state !== cookieState) {
        return html("<p>Ongeldige state bij OAuth-callback (mogelijk verlopen). <a href='/oauth/start'>Opnieuw proberen</a></p>");
      }
      try {
        await exchangeCode(env, code, callbackUri(url));
      } catch (e) {
        return html(`<p>Verbinden met Teamleader mislukt:</p><pre>${e.message}</pre><p><a href='/'>Terug</a></p>`);
      }
      return redirect("/", {
        "Set-Cookie": `${OAUTH_STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
      });
    }

    // ---- App ----------------------------------------------------------------
    if (pathname === "/" && request.method === "GET") {
      const connected = await isConnected(env);
      return html(appPage({ connected, redirectUri: callbackUri(url) }));
    }

    // ---- Verwerken: transcript -> Claude -> Teamleader ----------------------
    if (pathname === "/api/process" && request.method === "POST") {
      if (!env.ANTHROPIC_API_KEY) {
        return json({ error: "ANTHROPIC_API_KEY ontbreekt op de server." }, 500);
      }
      if (!(await isConnected(env))) {
        return json({ error: "Nog niet verbonden met Teamleader." }, 400);
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Ongeldige JSON." }, 400);
      }
      const transcript = (body && body.transcript ? String(body.transcript) : "").trim();
      if (!transcript) return json({ error: "Leeg transcript." }, 400);

      try {
        const deal = await extractDeal(env, transcript);
        const result = await createDealFromExtraction(env, deal);
        return json({
          deal,
          dealId: result.dealId,
          customerCreated: result.customerCreated,
          customerType: result.customerType,
        });
      } catch (e) {
        const msg = e.message === "NOT_CONNECTED" ? "Teamleader-verbinding verlopen. Verbind opnieuw." : e.message;
        return json({ error: msg }, 500);
      }
    }

    return new Response("Niet gevonden", { status: 404 });
  },
};

// Zet een ingesproken (Nederlandse) verkoopnotitie om naar gestructureerde
// dealgegevens met de Anthropic API. We forceren één tool-call zodat we
// gegarandeerd geldige, gestructureerde output terugkrijgen.

const MODEL = "claude-opus-4-8";

const TOOL = {
  name: "register_deal",
  description: "Structureer een ingesproken verkoopnotitie tot een Teamleader-deal.",
  input_schema: {
    type: "object",
    properties: {
      customer_name: {
        type: "string",
        description: "Naam van de klant: bedrijfsnaam of de naam van de persoon.",
      },
      customer_type: {
        type: "string",
        enum: ["company", "contact"],
        description:
          "'company' voor een bedrijf, 'contact' voor een particulier/persoon. Kies 'company' tenzij het duidelijk om een individu gaat.",
      },
      deal_title: {
        type: "string",
        description: "Korte, duidelijke titel van de deal (bv. 'Nieuwe keuken' of 'Onderhoudscontract').",
      },
      estimated_value: {
        type: ["number", "null"],
        description: "Geschatte waarde van de deal in hele valuta-eenheden, of null als niet genoemd.",
      },
      currency: {
        type: "string",
        description: "Valutacode, standaard 'EUR'.",
      },
      note: {
        type: "string",
        description:
          "Een nette, volledige samenvatting in het Nederlands van wat er is ingesproken, om als notitie bij de deal te bewaren.",
      },
    },
    required: ["customer_name", "customer_type", "deal_title", "note"],
  },
};

const SYSTEM =
  "Je bent een assistent die ingesproken Nederlandse verkoopnotities omzet naar " +
  "gestructureerde Teamleader-deals. Kies customer_type 'company' tenzij het duidelijk " +
  "om een particulier/persoon gaat. Houd de deal_title kort en concreet. Zet in 'note' een " +
  "nette, volledige samenvatting van wat er is ingesproken. Verzin geen gegevens die niet " +
  "zijn genoemd; laat estimated_value op null als er geen bedrag is genoemd.";

export async function extractDeal(env, transcript) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "register_deal" },
      messages: [{ role: "user", content: transcript }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API mislukt: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const toolUse = (data.content || []).find((b) => b.type === "tool_use");
  if (!toolUse) {
    throw new Error("Geen gestructureerde output ontvangen van Claude.");
  }
  return toolUse.input;
}

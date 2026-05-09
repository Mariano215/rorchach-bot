/* Provider catalog — the data behind the design. */

const PROVIDERS = [
  {
    id: "openai", name: "OpenAI", host: "api.openai.com",
    models: ["gpt-4o", "gpt-4o-mini", "o1-preview", "o3-mini"],
    status: "live", latency: 412, cost: "$$",
    note: "Generalist. Strong tools.",
  },
  {
    id: "anthropic", name: "Anthropic", host: "api.anthropic.com",
    models: ["claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-1"],
    status: "live", latency: 386, cost: "$$",
    note: "Long context. Careful reasoning.",
  },
  {
    id: "gemini", name: "Gemini", host: "generativelanguage.googleapis.com",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
    status: "live", latency: 298, cost: "$",
    note: "Multimodal. Cheapest at scale.",
  },
  {
    id: "grok", name: "Grok", host: "api.x.ai",
    models: ["grok-4", "grok-4-mini", "grok-3"],
    status: "warm", latency: 512, cost: "$$$",
    note: "Real-time web. Spicy.",
  },
  {
    id: "mistral", name: "Mistral", host: "api.mistral.ai",
    models: ["mistral-large-2", "codestral-latest", "ministral-8b"],
    status: "live", latency: 344, cost: "$",
    note: "European. Strong coding.",
  },
  {
    id: "deepseek", name: "DeepSeek", host: "api.deepseek.com",
    models: ["deepseek-v3.2", "deepseek-r1"],
    status: "live", latency: 624, cost: "$",
    note: "Open weights. Cheapest reasoning.",
  },
  {
    id: "llama", name: "Llama (Together)", host: "api.together.xyz",
    models: ["llama-3.3-70b", "llama-3.1-405b"],
    status: "off", latency: null, cost: "$",
    note: "Open. Hosted on Together.",
  },
  {
    id: "ollama", name: "Ollama", host: "localhost:11434",
    models: ["llama3.3:70b", "qwen2.5:32b", "mixtral:8x7b"],
    status: "live", latency: 84, cost: "free",
    note: "Local. Air-gapped.", local: true,
  },
  {
    id: "lmstudio", name: "LM Studio", host: "localhost:1234",
    models: ["llama-3.3-70b-instruct", "qwen2.5-coder-32b"],
    status: "warm", latency: 102, cost: "free",
    note: "Local. GUI-first.", local: true,
  },
  {
    id: "custom", name: "Custom Endpoint", host: "—",
    models: ["+ add"],
    status: "off", latency: null, cost: "—",
    note: "Any OpenAI-compatible URL.", local: true,
  },
];

const ROUTES = [
  {
    name: "Default",
    cond: "all requests · no specific routing",
    chain: ["anthropic", "openai", "gemini"],
  },
  {
    name: "Cheap & Fast",
    cond: "tokens.estimate < 4k · latency.p50 < 600ms",
    chain: ["gemini", "deepseek", "mistral"],
  },
  {
    name: "Hard Reasoning",
    cond: "prompt.contains(\"why\" | \"prove\" | \"analyze\")",
    chain: ["anthropic", "openai", "deepseek"],
  },
  {
    name: "Code",
    cond: "language.is_code · OR · prompt.contains(\"```\")",
    chain: ["anthropic", "mistral", "ollama"],
  },
  {
    name: "Air-Gapped",
    cond: "data.classification == \"sensitive\"",
    chain: ["ollama", "lmstudio"],
  },
];

const CONVERSATION = [
  { role: "user", text: "Look at plate III. What do you see?" },
  { role: "assistant", provider: "anthropic", model: "claude-sonnet-4-5",
    text: "Two figures bent over a shared object — hands meeting at the center. The red flecks read as decorative rather than violent. Posture suggests collaboration, perhaps preparation of a meal." },
  { role: "user", text: "Now route to whoever is cheapest and ask the same." },
  { role: "assistant", provider: "gemini", model: "gemini-2.5-flash",
    text: "I observe symmetrical anthropomorphic forms. Bilateral mirror around the vertical axis. The chromatic break in the center could be interpreted as conflict, or simply as visual rhythm." },
];

window.PROVIDERS = PROVIDERS;
window.ROUTES = ROUTES;
window.CONVERSATION = CONVERSATION;

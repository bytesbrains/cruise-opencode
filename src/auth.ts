import type { AuthHook } from "@opencode-ai/plugin";
import { PROVIDER_ID } from "./constants.js";

/**
 * `/connect` entry for Cruise — stores a `cru_` key in OpenCode's auth store.
 * Recipes should still prefer `CRUISE_API_KEY` in the environment.
 */
export const cruiseAuthHook: AuthHook = {
  provider: PROVIDER_ID,
  methods: [
    {
      type: "api",
      label: "Cruise API Key",
      prompts: [
        {
          type: "text",
          key: "apiKey",
          message: "Enter your BytesBrains Cruise API key",
          placeholder: "cru_demo_… or cru_live_…",
          validate: (value) => {
            const trimmed = value.trim();
            if (!trimmed.startsWith("cru_")) {
              return "Expected a Cruise key starting with cru_";
            }
            return undefined;
          },
        },
      ],
      async authorize(inputs) {
        const key = inputs?.apiKey?.trim();
        if (!key?.startsWith("cru_")) {
          return { type: "failed" };
        }
        return { type: "success", key, provider: PROVIDER_ID };
      },
    },
  ],
  async loader(getAuth) {
    const auth = await getAuth();
    if (auth.type === "api" && typeof auth.key === "string" && auth.key) {
      return { apiKey: auth.key };
    }
    return {};
  },
};

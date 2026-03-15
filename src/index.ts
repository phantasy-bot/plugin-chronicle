import { BasePlugin, type PluginTool } from "@phantasy/agent/plugins";

export class ChroniclePlugin extends BasePlugin {
  name = "chronicle";
  version = "2.0.0";
  description = "Chronicle publishing plugin for Phantasy sites and media surfaces.";

  protected displayName = "Chronicle";
  protected category = "publishing";
  protected tags = ["chronicle","publishing","content","site"];
  protected permissions = [];
  protected workspace = "site" as const;
  protected extensionKind = "capability" as const;
  protected adminSurface =   {
    "tabId": "chronicle",
    "label": "Chronicle",
    "section": "site",
    "workspace": "site",
    "kind": "generic",
    "keywords": [
      "chronicle",
      "publishing",
      "content",
      "site"
    ]
  } as const;
  protected configSchema =   {
    "type": "object",
    "properties": {
      "enabled": {
        "type": "boolean",
        "default": true
      }
    }
  };

  getTools(): PluginTool[] {
    return [];
  }
}

export default ChroniclePlugin;

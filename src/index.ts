import { BasePlugin, PluginManifest, PluginTool } from "@phantasy/core";

export class UchroniclePlugin extends BasePlugin {
  readonly name = "chronicle";
  readonly version = "1.0.0";

  getManifest(): PluginManifest {
    return {
      name: this.name,
      version: this.version,
      description: "chronicle plugin for Phantasy",
      author: "Phantasy",
      license: "BUSL-1.1",
      repository: "https://github.com/phantasy-bot/plugin-chronicle",
    };
  }

  getTools(): PluginTool[] {
    return [];
  }

  async initialize(): Promise<void> {
    console.log("[UchroniclePlugin] Initialized");
  }
}

export default UchroniclePlugin;

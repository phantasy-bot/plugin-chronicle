import {
  BasePlugin,
  type PluginContext,
  type PluginResponse,
} from "@phantasy/agent/plugins";
import type { AgentConfig } from "@phantasy/agent/types";
import { kvService } from "@phantasy/agent/plugin-runtime";
import { ContentService } from "@phantasy/agent/plugin-runtime";
import { AgentService } from "@phantasy/agent/plugin-runtime";
import {
  getContentEntryService,
  type ContentEntry,
} from "@phantasy/agent/plugin-runtime";
import {
  hasDeleteAccessRole,
  hasReadAccessRole,
  hasWriteAccessRole,
} from "@phantasy/agent/plugin-runtime";
import {
  createPluginModuleLogger,
  getPluginAuthContext,
  type PluginAuthContext,
} from "@phantasy/agent/plugin-runtime";

export type { ContentEntry } from "@phantasy/agent/plugin-runtime";

const logger = createPluginModuleLogger("ContentPlugin");

type Visibility = "private" | "public" | "unlisted";
type ContentAuthContext = PluginAuthContext;

const listPrefix = "content:entry:";

/**
 * Content Plugin - AI-first headless journal/blog
 *
 * @description
 * An AI-first, headless journal/blog for the agent to record thoughts
 * and reference as a long-term memory source. Supports autonomous posting
 * with human-in-the-loop approval workflow.
 *
 * @features
 * - Autonomous journal entry generation with templates
 * - Daily journals, weekly summaries, thought dumps, etc.
 * - Human-in-the-loop approval notifications
 * - Configurable posting schedule and limits
 * - Rich tagging and categorization
 */
export class ContentPlugin extends BasePlugin {
  name = "content";
  version = "1.0.0";
  description =
    "AI-first content publishing system for posts, pages, and long-term editorial memory";

  // Manifest metadata
  protected author = "Phantasy";
  protected displayName = "Content";
  protected category = "memory";
  protected tags = ["journal", "blog", "memory", "headless", "autonomous"];
  protected icon = "/public/phantasy.png";
  protected permissions = ["storage", "llm"];
  protected workspace = "site" as const;
  protected extensionKind = "capability" as const;
  protected adminSurface = {
    tabId: "content",
    label: "Content",
    section: "site",
    workspace: "site",
    keywords: ["content", "publishing", "posts", "timeline", "records"],
    aliases: ["writing", "content", "posts"],
    dashboardIcon: "contentTile",
    dashboardPromoted: true,
  } as const;
  private contentService: ContentService | null = null;
  private agentService: AgentService | null = null;
  private authContextPromise: Promise<ContentAuthContext> | null = null;

  protected configSchema = {
    type: "object",
    properties: {
      enabled: { type: "boolean", default: true },
      storageProvider: {
        type: "string",
        enum: ["kv", "external"],
        default: "kv",
        title: "Storage Provider",
        description: "Choose where content entries will be stored",
      },
      webhookUrl: {
        type: "string",
        title: "Webhook URL",
        description: "Optional webhook to notify your frontends of new entries",
      },
      autonomousPosting: {
        type: "object",
        title: "Autonomous Posting",
        properties: {
          enabled: {
            type: "boolean",
            default: false,
            title: "Enable Autonomous Posting",
            description: "Automatically generate journal entries on a schedule",
          },
          intervalMinutes: {
            type: "number",
            default: 1440,
            minimum: 15,
            title: "Posting Interval (minutes)",
            description:
              "How often to generate entries (default: 1440 = 24 hours)",
          },
          requireApproval: {
            type: "boolean",
            default: true,
            title: "Require Human Approval",
            description:
              "Create notifications for approval before posting entries",
          },
          templates: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "daily_journal",
                "weekly_summary",
                "thought_dump",
                "milestone_reflection",
                "learning_notes",
              ],
            },
            default: ["daily_journal", "thought_dump"],
            title: "Active Templates",
            description: "Which entry templates to use for generation",
          },
          postingHours: {
            type: "string",
            default: "0-23",
            pattern: "^[0-9]{1,2}-[0-9]{1,2}$",
            title: "Posting Hours",
            description:
              'Time range for posting (24-hour format, e.g., "9-21" for 9am-9pm)',
          },
          maxPostsPerDay: {
            type: "number",
            default: 3,
            minimum: 1,
            maximum: 50,
            title: "Max Posts Per Day",
            description: "Maximum number of entries to generate per day",
          },
        },
      },
    },
  };

  constructor() {
    super();
    this.config = { ...this.config, enabled: true };
    this.enabled = true;
  }

  getDashboardWidgets() {
    return [
      {
        id: "summary",
        title: "Content Summary",
        icon: "book",
        dataPath: "/widgets/summary",
      },
    ];
  }

  async onInit(agentConfig: AgentConfig, config?: Record<string, unknown>): Promise<void> {
    await super.onInit(agentConfig, {
      enabled: true,
      ...(config || {}),
    });

    try {
      // Initialize AgentService for content generation
      this.agentService = new AgentService(agentConfig);

      // Initialize the content service with autonomous posting config.
      const contentConfig = {
        enabled: (this.config as Record<string, unknown>).enabled as boolean,
        autonomousPosting: (this.config as Record<string, unknown>).autonomousPosting as Record<string, unknown> || {},
      };

      this.contentService = new ContentService(
        this.agentService,
        agentConfig,
        contentConfig,
      );

      // Start autonomous posting if enabled
      if (contentConfig.autonomousPosting?.enabled) {
        this.contentService.startAutonomousPosting();
        logger.info("Content autonomous posting started");
      }

      logger.info("Content plugin initialized", {
        enabled: contentConfig.enabled,
        autonomousEnabled: contentConfig.autonomousPosting?.enabled,
        interval: contentConfig.autonomousPosting?.intervalMinutes,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error("Failed to initialize content plugin", {
        error: errMsg,
      });
      throw error;
    }
  }

  async onShutdown(): Promise<void> {
    if (this.contentService) {
      this.contentService.stopAutonomousPosting();
      logger.info("Content autonomous posting stopped");
    }
  }

  private async getAuthContext(): Promise<ContentAuthContext> {
    if (!this.authContextPromise) {
      this.authContextPromise = getPluginAuthContext();
    }

    return this.authContextPromise;
  }

  async beforeChat(_context: PluginContext): Promise<PluginResponse> {
    // No-op while coming soon
    return { shouldContinue: true };
  }

  async afterChat(
    _context: PluginContext,
    _reply: string,
  ): Promise<PluginResponse> {
    // No-op while coming soon
    return { shouldContinue: true };
  }

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    message?: string;
    details?: Record<string, unknown>;
  }> {
    if (!this.contentService) {
      return { status: "unhealthy", message: "Service not initialized" };
    }

    try {
      const status = this.contentService.getStatus();
      const isHealthy = this.config.enabled;

      return {
        status: isHealthy ? "healthy" : "unhealthy",
        message: isHealthy ? "Content is active" : "Content is disabled",
        details: {
          autonomousPosting: status.autonomousPosting,
        },
      };
    } catch (error: unknown) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : "Health check failed",
      };
    }
  }

  /**
   * Content REST endpoints (admin-only via /admin/api/plugins passthrough)
   *
   * Routes:
   * - GET    /api/content/entries
   * - GET    /api/content/entries/:id
   * - POST   /api/content/entries
   * - PUT    /api/content/entries/:id
   * - DELETE /api/content/entries/:id
   */
  async handleCustomEndpoint(
    request: Request,
    path: string,
  ): Promise<Response | null> {
    if (path === "/widgets/summary") {
      try {
        const keys = await kvService.list(listPrefix);
        // Load last 5 entries
        const recent: ContentEntry[] = [];
        for (let i = keys.length - 1; i >= 0 && recent.length < 5; i--) {
          const e = await kvService.get<ContentEntry>(keys[i]);
          if (e) recent.push(e);
        }
        const summary = {
          total: keys.length,
          recent: recent.map((e) => ({
            id: e.id,
            title: e.title,
            updatedAt: e.updatedAt,
            tags: e.tags || [],
          })),
        };
        return new Response(JSON.stringify(summary), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Handle content notification approvals
    if (path.startsWith("/api/content/approve/")) {
      if (!this.contentService) {
        return new Response(
          JSON.stringify({ error: "Service not initialized" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const notificationId = path.split("/").pop();
      if (!notificationId) {
        return new Response(
          JSON.stringify({ error: "Missing notification ID" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      try {
        const entry = await this.contentService.approveEntry(notificationId);
        return new Response(JSON.stringify({ success: true, entry }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error: unknown) {
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : "Approval failed" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    // Handle content notification rejections
    if (path.startsWith("/api/content/reject/")) {
      if (!this.contentService) {
        return new Response(
          JSON.stringify({ error: "Service not initialized" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      const notificationId = path.split("/").pop();
      if (!notificationId) {
        return new Response(
          JSON.stringify({ error: "Missing notification ID" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      try {
        const body = await request.json().catch(() => ({}));
        const reason = body.reason || "Rejected by user";
        await this.contentService.rejectEntry(notificationId, reason);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error: unknown) {
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : "Rejection failed" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    const isContentApiPath = path.startsWith("/api/content");
    if (!isContentApiPath) return null;

    try {
      const url = new URL("http://local" + path); // dummy origin for parsing
      const method = request.method.toUpperCase();
      const entryService = getContentEntryService();
      const pathname = url.pathname;

      // Decode user roles from Authorization header or cookie
      const getUserRoles = async () => {
        try {
          const authContext = await this.getAuthContext();
          const auth =
            request.headers.get("authorization") ||
            request.headers.get("Authorization");
          const bearer =
            auth && auth.startsWith("Bearer ")
              ? auth.slice("Bearer ".length)
              : null;
          let token = bearer;
          if (!token) {
            const cookie =
              request.headers.get("cookie") || request.headers.get("Cookie");
            if (cookie) {
              const parts = cookie.split(";").map((s) => s.trim());
              const sess = parts.find((p) =>
                p.startsWith(`${authContext.sessionCookieName}=`),
              );
              if (sess) token = decodeURIComponent(sess.split("=")[1] || "");
            }
          }
          if (!token) return [] as string[];
          const decoded = await authContext.verifyToken(token);
          return decoded?.roles || [];
        } catch {
          return [] as string[];
        }
      };

      const roles = await getUserRoles();
      const canRead = hasReadAccessRole(roles);
      const canWrite = hasWriteAccessRole(roles);
      const canDelete = hasDeleteAccessRole(roles);

      if (method === "GET" && pathname === "/api/content/entries") {
        if (!canRead)
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        const limit = Math.max(
          1,
          Math.min(
            200,
            Number(
              url.searchParams.get("pageSize") ||
                url.searchParams.get("limit") ||
                "20",
            ),
          ),
        );
        const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
        const q = url.searchParams.get("q")?.trim().toLowerCase();
        const visibility = (url.searchParams.get("visibility") || "all") as
          | Visibility
          | "all";
        const tagsParam = url.searchParams.get("tags") || "";
        const tags = tagsParam
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        const sort = (url.searchParams.get("sort") || "newest") as
          | "newest"
          | "oldest"
          | "title";

        const result = await entryService.listEntries({
          page,
          pageSize: limit,
          q,
          visibility,
          tags,
          sort,
        });
        return Response.json({
          entries: result.entries,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          hasMore: result.hasMore,
        });
      }

      if (
        method === "GET" &&
        pathname.startsWith("/api/content/entries/")
      ) {
        if (!canRead)
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        const id = url.pathname.split("/").pop()!;
        const entry = await entryService.getEntry(id);
        if (!entry)
          return new Response(JSON.stringify({ error: "Not Found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        return Response.json(entry);
      }

      if (method === "POST" && pathname === "/api/content/entries") {
        if (!canWrite)
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        const body = await request.json().catch(() => ({}));
        const title = (body.title || "").toString().slice(0, 200);
        const content = (body.content || "").toString();
        const tags: string[] = Array.isArray(body.tags)
          ? body.tags.map((t: unknown) => String(t)).slice(0, 20)
          : [];
        const visibility: Visibility = [
          "private",
          "public",
          "unlisted",
        ].includes(body.visibility)
          ? body.visibility
          : "private";
        if (!content || content.trim().length === 0) {
          return new Response(JSON.stringify({ error: "Content required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const status = ['draft', 'published', 'archived'].includes(body.status)
          ? body.status
          : 'draft';
        const entry = await entryService.createEntry(
          {
            title: title || undefined,
            content,
            tags,
            visibility,
            slug: body.slug ? String(body.slug) : undefined,
            excerpt: body.excerpt ? String(body.excerpt) : undefined,
            status,
            featuredImage: body.featuredImage ? String(body.featuredImage) : undefined,
            mood: body.mood ? String(body.mood) : undefined,
            template: body.template ? String(body.template) : undefined,
            metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
          },
          (request.headers.get("x-user") || "admin").toString(),
        );
        return new Response(JSON.stringify({ success: true, entry }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (
        method === "PUT" &&
        pathname.startsWith("/api/content/entries/")
      ) {
        if (!canWrite)
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        const id = url.pathname.split("/").pop()!;
        const existing = await entryService.getEntry(id);
        if (!existing)
          return new Response(JSON.stringify({ error: "Not Found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        const body = await request.json().catch(() => ({}));
        const updated = await entryService.updateEntry(id, {
          ...(typeof body.title !== "undefined"
            ? { title: String(body.title).slice(0, 200) }
            : {}),
          ...(typeof body.content !== "undefined"
            ? { content: String(body.content) }
            : {}),
          ...(Array.isArray(body.tags)
            ? { tags: body.tags.map((t: unknown) => String(t)).slice(0, 20) }
            : {}),
          ...(typeof body.visibility !== "undefined" &&
          ["private", "public", "unlisted"].includes(body.visibility)
            ? { visibility: body.visibility }
            : {}),
          ...(typeof body.slug !== "undefined" ? { slug: String(body.slug) } : {}),
          ...(typeof body.excerpt !== "undefined"
            ? { excerpt: String(body.excerpt).slice(0, 300) }
            : {}),
          ...(typeof body.status !== "undefined" &&
          ['draft', 'published', 'archived'].includes(body.status)
            ? { status: body.status }
            : {}),
          ...(typeof body.featuredImage !== "undefined"
            ? { featuredImage: body.featuredImage || undefined }
            : {}),
          ...(typeof body.mood !== "undefined"
            ? { mood: body.mood || undefined }
            : {}),
          ...(typeof body.metadata !== "undefined" && typeof body.metadata === 'object'
            ? { metadata: body.metadata }
            : {}),
          ...(Array.isArray(body.publishedPlatforms)
            ? { publishedPlatforms: body.publishedPlatforms }
            : {}),
        });
        return Response.json({ success: true, entry: updated });
      }

      if (
        method === "DELETE" &&
        pathname.startsWith("/api/content/entries/")
      ) {
        if (!canDelete)
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        const id = url.pathname.split("/").pop()!;
        const existing = await entryService.getEntry(id);
        if (!existing)
          return new Response(JSON.stringify({ error: "Not Found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        await entryService.deleteEntry(id);
        return Response.json({ success: true, id });
      }

      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: unknown) {
      return new Response(
        JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }
}

export default ContentPlugin;

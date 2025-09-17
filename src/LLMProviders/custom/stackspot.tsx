import React from "react";
import debug from "debug";
import ProviderBase from "../base";
import LLMProviderInterface, { LLMConfig } from "../interface";
import { Input, Message, SettingItem, useGlobal } from "../refs";

const logger = debug("textgenerator:llmProvider:stackspot");

const default_values = {
  baseUrl: "https://genai-code-buddy-api.stackspot.com",
  tokenUrl: "",
  client_id: "",
  client_secret: "",
  commandSlug: "obsidian",
  conversationId: "",
  scope: "",
  audience: "",
  pollIntervalMs: 2000,
  maxWaitMs: 180000,
  sendMessages: true,
  CORSBypass: true,
};

function normalizeContent(content: Message["content"]): string {
  if (typeof content === "string") return content;
  if (content === null || typeof content === "undefined") return "";
  if (typeof content === "number" || typeof content === "boolean")
    return String(content);
  if (Array.isArray(content))
    return content.map((item) => normalizeContent(item as any)).join("\n");
  try {
    return JSON.stringify(content);
  } catch (err) {
    return String(content);
  }
}

function extractFinalText(result: any): string {
  if (!result && result !== 0) return "";
  if (typeof result === "string") return result;
  if (typeof result === "number" || typeof result === "boolean")
    return String(result);
  if (Array.isArray(result)) {
    return result
      .map((entry) => extractFinalText(entry))
      .filter((value) => value.length)
      .join("\n");
  }
  if (typeof result === "object") {
    if (typeof result.text === "string") return result.text;
    if (typeof result.content === "string") return result.content;
    if (Array.isArray(result.content))
      return result.content.map((entry) => extractFinalText(entry)).join("\n");
    if (typeof result.result === "string") return result.result;
    if (typeof result.message === "string") return result.message;
    if (Array.isArray(result.messages))
      return result.messages.map((entry) => extractFinalText(entry)).join("\n");
  }

  try {
    return JSON.stringify(result);
  } catch (err) {
    return String(result ?? "");
  }
}

async function delay(ms: number, signal?: AbortSignal) {
  if (!ms) return;

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    }
  });
}

async function parseJsonResponse(response: Response, errorContext: string) {
  const payload = await response.text();

  if (!response.ok) {
    const detail = payload || response.statusText;
    throw new Error(`${errorContext}: ${response.status} ${detail}`);
  }

  if (!payload) return {};

  try {
    return JSON.parse(payload);
  } catch (err) {
    logger("Failed to parse JSON", { payload, error: err });
    throw new Error(`${errorContext}: Invalid JSON payload`);
  }
}

function normalizeBaseUrl(url: string) {
  if (!url) return "";
  return url.replace(/\/$/, "");
}

export default class StackspotQuickCommandProvider
  extends ProviderBase
  implements LLMProviderInterface {
  static provider = "Stackspot";
  static id = "Stackspot Quick Command" as const;
  static slug = "stackspotQuickCommand" as const;
  static displayName = "Stackspot Quick Command";

  streamable = false;
  mobileSupport = true;

  provider = StackspotQuickCommandProvider.provider;
  id = StackspotQuickCommandProvider.id;
  originalId = StackspotQuickCommandProvider.id;

  async load() {
    this.streamable = false;
  }

  RenderSettings(props: Parameters<LLMProviderInterface["RenderSettings"]>[0]) {
    const global = useGlobal();
    const id = props.self.id || StackspotQuickCommandProvider.id;

    const config = (global.plugin.settings.LLMProviderOptions[id] ??= {
      ...default_values,
    });

    return (
      <React.Fragment key={id}>
        <SettingItem
          name="Base URL"
          description="Stackspot Quick Commands API base URL"
          register={props.register}
          sectionId={props.sectionId}
        >
          <Input
            value={config.baseUrl || ""}
            placeholder="https://your-domain"
            setValue={async (value) => {
              config.baseUrl = normalizeBaseUrl(value);
              global.triggerReload();
              await global.plugin.saveSettings();
            }}
          />
        </SettingItem>

        <SettingItem
          name="Token URL"
          description="OAuth client credentials endpoint"
          register={props.register}
          sectionId={props.sectionId}
        >
          <Input
            value={config.tokenUrl || ""}
            placeholder="https://identity-domain/realms/.../token"
            setValue={async (value) => {
              config.tokenUrl = value.trim();
              global.triggerReload();
              await global.plugin.saveSettings();
            }}
          />
        </SettingItem>

        <SettingItem
          name="Client ID"
          register={props.register}
          sectionId={props.sectionId}
        >
          <Input
            value={config.client_id || ""}
            placeholder="Enter your client id"
            setValue={async (value) => {
              config.client_id = value.trim();
              global.triggerReload();
              await global.plugin.saveSettings();
            }}
          />
        </SettingItem>

        <SettingItem
          name="Client Secret"
          register={props.register}
          sectionId={props.sectionId}
        >
          <Input
            type="password"
            value={config.client_secret || ""}
            placeholder="Enter your client secret"
            setValue={async (value) => {
              config.client_secret = value;
              global.plugin.encryptAllKeys();
              global.triggerReload();
              await global.plugin.saveSettings();
            }}
          />
        </SettingItem>

        <SettingItem
          name="Audience"
          description="Optional audience parameter for token requests"
          register={props.register}
          sectionId={props.sectionId}
        >
          <Input
            value={config.audience || ""}
            placeholder="Enter audience (optional)"
            setValue={async (value) => {
              config.audience = value.trim();
              global.triggerReload();
              await global.plugin.saveSettings();
            }}
          />
        </SettingItem>

        <SettingItem
          name="Scope"
          description="Optional scope parameter for token requests"
          register={props.register}
          sectionId={props.sectionId}
        >
          <Input
            value={config.scope || ""}
            placeholder="scope1 scope2"
            setValue={async (value) => {
              config.scope = value.trim();
              global.triggerReload();
              await global.plugin.saveSettings();
            }}
          />
        </SettingItem>

        <SettingItem
          name="Command slug"
          description="Quick command identifier"
          register={props.register}
          sectionId={props.sectionId}
        >
          <Input
            value={config.commandSlug || ""}
            placeholder="obsidian"
            setValue={async (value) => {
              config.commandSlug = value.trim();
              global.triggerReload();
              await global.plugin.saveSettings();
            }}
          />
        </SettingItem>

        <SettingItem
          name="Conversation ID"
          description="Optional conversation identifier"
          register={props.register}
          sectionId={props.sectionId}
        >
          <Input
            value={config.conversationId || ""}
            placeholder="Leave blank to start new executions"
            setValue={async (value) => {
              config.conversationId = value.trim();
              global.triggerReload();
              await global.plugin.saveSettings();
            }}
          />
        </SettingItem>

        <SettingItem
          name="Send chat history"
          description="Include role/content messages in input_data.json"
          register={props.register}
          sectionId={props.sectionId}
        >
          <Input
            type="checkbox"
            value={config.sendMessages ? "true" : "false"}
            setValue={async (value) => {
              config.sendMessages = value == "true";
              global.triggerReload();
              await global.plugin.saveSettings();
            }}
          />
        </SettingItem>

        <SettingItem
          name="Polling interval (ms)"
          register={props.register}
          sectionId={props.sectionId}
        >
          <Input
            type="number"
            value={"" + (config.pollIntervalMs ?? default_values.pollIntervalMs)}
            setValue={async (value) => {
              const parsed = Number(value);
              config.pollIntervalMs = Number.isFinite(parsed) && parsed > 0 ? parsed : default_values.pollIntervalMs;
              global.triggerReload();
              await global.plugin.saveSettings();
            }}
          />
        </SettingItem>

        <SettingItem
          name="Max wait (ms)"
          register={props.register}
          sectionId={props.sectionId}
        >
          <Input
            type="number"
            value={"" + (config.maxWaitMs ?? default_values.maxWaitMs)}
            setValue={async (value) => {
              const parsed = Number(value);
              config.maxWaitMs = Number.isFinite(parsed) && parsed > 0 ? parsed : default_values.maxWaitMs;
              global.triggerReload();
              await global.plugin.saveSettings();
            }}
          />
        </SettingItem>

        <SettingItem
          name="Use CORS bypass"
          description="Enable when the Stackspot API blocks browser requests"
          register={props.register}
          sectionId={props.sectionId}
        >
          <Input
            type="checkbox"
            value={config.CORSBypass ? "true" : "false"}
            setValue={async (value) => {
              config.CORSBypass = value == "true";
              global.triggerReload();
              await global.plugin.saveSettings();
            }}
          />
        </SettingItem>
      </React.Fragment>
    );
  }

  private getProviderConfig() {
    return (this.plugin.settings.LLMProviderOptions[this.id] ??= {
      ...default_values,
    });
  }

  async generate(
    messages: Message[],
    reqParams: Partial<Omit<LLMConfig, "n">>,
    onToken?: (token: string, first: boolean) => Promise<string | void | null | undefined>,
    customConfig?: any
  ): Promise<string> {
    const config = this.getProviderConfig();
    const signal = reqParams.requestParams?.signal;
    const fetcher = this.plugin.textGenerator.proxyService.getFetch(!!config.CORSBypass);

    if (!config.tokenUrl) {
      throw new Error("Stackspot token URL is not configured.");
    }

    if (!config.client_id || !config.client_secret) {
      throw new Error("Stackspot client credentials are not configured.");
    }

    const baseUrl = normalizeBaseUrl(config.baseUrl || "");
    if (!baseUrl) {
      throw new Error("Stackspot base URL is not configured.");
    }

    const slug = (config.commandSlug || "obsidian").trim();
    const createUrl = `${baseUrl}/v1/quick-commands/create-execution/${slug}`;

    const prompt = messages
      .map((message) => `${message.role}: ${normalizeContent(message.content)}`)
      .join("\n\n");

    const body: any = {
      input_data: {
        json: {
          prompt,
        },
      },
    };

    if (config.sendMessages) {
      body.input_data.json.messages = messages.map((message) => ({
        role: message.role,
        content: normalizeContent(message.content),
      }));
    }

    if (config.conversationId) {
      body.conversation_id = config.conversationId;
    }

    if (typeof reqParams.max_tokens === "number" && !Number.isNaN(reqParams.max_tokens)) {
      body.input_data.json.max_tokens = reqParams.max_tokens;
    }

    if (typeof reqParams.temperature === "number" && !Number.isNaN(reqParams.temperature)) {
      body.input_data.json.temperature = reqParams.temperature;
    }

    if (Array.isArray(reqParams.stop) && reqParams.stop.length) {
      body.input_data.json.stop = reqParams.stop;
    }

    const tokenRequest = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.client_id,
      client_secret: config.client_secret,
    });

    if (config.scope) tokenRequest.set("scope", config.scope);
    if (config.audience) tokenRequest.set("audience", config.audience);

    logger("Requesting Stackspot token");
    const tokenResponse = await fetcher(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenRequest.toString(),
      signal,
    });

    const tokenPayload = await parseJsonResponse(tokenResponse, "Stackspot token request failed");
    const accessToken = tokenPayload.access_token;

    if (!accessToken) {
      throw new Error("Stackspot token response did not include access_token");
    }

    logger("Creating Stackspot quick command execution", { createUrl });
    const createResponse = await fetcher(createUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    const createPayload = await parseJsonResponse(
      createResponse,
      "Stackspot create-execution request failed"
    );

    const executionId =
      createPayload.execution_id ||
      createPayload.executionId ||
      createPayload.id ||
      createPayload?.data?.execution_id;

    if (!executionId || typeof executionId !== "string") {
      logger("Unexpected create payload", createPayload);
      throw new Error("Stackspot create-execution response did not include execution_id");
    }

    const callbackUrl = `${baseUrl}/v1/quick-commands/callback/${executionId}`;
    const pollInterval = Number.isFinite(config.pollIntervalMs)
      ? config.pollIntervalMs
      : default_values.pollIntervalMs;
    const maxWait = Number.isFinite(config.maxWaitMs)
      ? config.maxWaitMs
      : default_values.maxWaitMs;

    const startedAt = Date.now();
    let lastStatus = "";

    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      logger("Polling Stackspot execution", { callbackUrl, executionId });
      const callbackResponse = await fetcher(callbackUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal,
      });

      const callbackPayload = await parseJsonResponse(
        callbackResponse,
        "Stackspot callback request failed"
      );

      const status = String(
        callbackPayload.status ||
          callbackPayload.state ||
          callbackPayload.execution_status ||
          callbackPayload.executionStatus ||
          ""
      ).toUpperCase();

      if (!status && callbackPayload.final_result) {
        logger("No status field, assuming completion", callbackPayload);
      }

      lastStatus = status || lastStatus;

      if (status === "DONE" || status === "COMPLETED" || callbackPayload.final_result) {
        const resultText = extractFinalText(
          callbackPayload.final_result ?? callbackPayload.result ?? callbackPayload.data
        );

        if (resultText && onToken) {
          await onToken(resultText, true);
        }

        logger("Stackspot execution completed", { executionId, status });
        return resultText;
      }

      if (status === "ERROR" || status === "FAILED") {
        const detail =
          callbackPayload.error ||
          callbackPayload.detail ||
          callbackPayload.message ||
          callbackPayload;
        throw new Error(
          `Stackspot execution failed: ${
            typeof detail === "string" ? detail : JSON.stringify(detail)
          }`
        );
      }

      if (Date.now() - startedAt > maxWait) {
        throw new Error(
          `Stackspot execution timed out after ${Math.round(maxWait / 1000)}s (last status: ${
            lastStatus || "unknown"
          })`
        );
      }

      await delay(pollInterval, signal);
    }
  }

  async calcTokens(
    messages: Message[],
    reqParams: Partial<LLMConfig>
  ): Promise<{ tokens: number; maxTokens: number }> {
    const totalCharacters = messages
      .map((message) => normalizeContent(message.content))
      .join("\n")
      .length;

    const tokens = Math.ceil(totalCharacters / 4) || 0;
    const maxTokens = Number(reqParams.max_tokens || this.plugin.settings.max_tokens || 0);

    return { tokens, maxTokens };
  }

  async calcPrice(): Promise<number> {
    return 0;
  }
}

export { default_values as stackspotDefaultValues };

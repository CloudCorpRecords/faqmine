/**
 * faqmine MCP server. Tools: mine_faq.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schema as an explicit literal, and every
 * tools/call is validated by the core, which names the
 * offending path on invalid input.
 *
 * The computation is pure and local: no network, no
 * filesystem, and no configuration — the caller supplies
 * every closed issue the FAQ is mined from, and no answer
 * text is ever generated.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { formatPayload, mineFaq, VERSION } from "./faqmine.js";

const TOOLS = [
  {
    name: "mine_faq",
    description:
      "Mine caller-supplied closed issues for repeated questions and draft FAQ entries: the question (a supplied issue title, verbatim), its count, and the issue links. No answers are invented.",
    inputSchema: {
      type: "object" as const,
      properties: {
        issues: {
          type: "array",
          description: "Closed issues to mine, in the caller's order",
          items: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "Issue title",
              },
              url: {
                type: "string",
                description: "Issue link",
              },
              labels: {
                type: "array",
                description: "Issue labels (optional)",
                items: {
                  type: "string",
                },
              },
            },
            required: ["title", "url"],
          },
        },
        min_count: {
          type: "integer",
          description:
            "Minimum cluster size for an FAQ entry (optional, default 2)",
        },
      },
      required: ["issues"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "faqmine", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "mine_faq") {
      out = mineFaq(args ?? {});
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();

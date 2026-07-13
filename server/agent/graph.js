// server/agent/graph.js — 스케줄러 에이전트 그래프 (도구 + HITL 리뷰)
import { StateGraph, START, END, MessagesAnnotation, interrupt } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ToolMessage } from "@langchain/core/messages";
import { makeTools, SENSITIVE } from "./tools.js";

// model 은 tools 바인딩 가능한 LLM (ChatAnthropic) 또는 테스트용 스텁.
export function buildGraph({ userId, now = new Date(), model, checkpointer }) {
  const tk = makeTools(userId, now);
  const readOnly = tk.all.filter((t) => !SENSITIVE.has(t.name));
  const bound = model.bindTools ? model.bindTools(tk.all) : model;

  // LLM 노드
  const agent = async (state) => ({ messages: [await bound.invoke(state.messages)] });

  // 읽기 전용 도구 실행
  const toolsNode = new ToolNode(readOnly);

  // HITL: 쓰기(create/move) 전에 사용자 확인까지 멈춤 → 승인 시에만 실제 실행
  const review = async (state) => {
    const last = state.messages.at(-1);
    const calls = (last.tool_calls ?? []).filter((c) => SENSITIVE.has(c.name));
    const decision = interrupt({
      type: "confirm",
      actions: calls.map((c) => ({ id: c.id, name: c.name, args: c.args })),
    });
    const msgs = [];
    for (const c of calls) {
      if (decision?.approve) {
        const args = decision?.edits?.[c.id] ?? c.args;   // 사용자가 수정했으면 반영
        const out = await tk.byName[c.name].invoke(args);
        msgs.push(new ToolMessage({ content: out, tool_call_id: c.id, name: c.name }));
      } else {
        msgs.push(new ToolMessage({
          content: JSON.stringify({ cancelled: true, reason: decision?.reason ?? "사용자가 취소함" }),
          tool_call_id: c.id, name: c.name,
        }));
      }
    }
    return { messages: msgs };
  };

  const route = (state) => {
    const calls = state.messages.at(-1).tool_calls ?? [];
    if (!calls.length) return END;
    return calls.some((c) => SENSITIVE.has(c.name)) ? "review" : "tools";
  };

  return new StateGraph(MessagesAnnotation)
    .addNode("agent", agent)
    .addNode("tools", toolsNode)
    .addNode("review", review)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", route, ["tools", "review", END])
    .addEdge("tools", "agent")
    .addEdge("review", "agent")
    .compile({ checkpointer });
}

// 실제 LLM (키 있을 때만). 없으면 null → 라우트에서 스텁/안내로 폴백.
export async function makeChatModel() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const { ChatAnthropic } = await import("@langchain/anthropic");
  return new ChatAnthropic({ model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8", maxTokens: 1024 });
}

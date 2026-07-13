// server/ai/agent.js — Claude 래퍼. ANTHROPIC_API_KEY 없으면 규칙 기반으로 폴백.
import { missingFromPatterns } from "./analyze.js";

// const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
// export const aiAvailable = !!process.env.ANTHROPIC_API_KEY;
// let client = null;

// async function getClient() {
//   if (!aiAvailable) return null;
//   if (!client) {
//     const { default: Anthropic } = await import("@anthropic-ai/sdk");
//     client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수 자동 사용
//   }
//   return client;
// }

// // 구조화 출력(JSON 스키마) → 첫 text 블록을 JSON.parse
// async function askJSON({ prompt, schema, maxTokens = 1500 }) {
//   const c = await getClient();
//   const res = await c.messages.create({
//     model: MODEL,
//     max_tokens: maxTokens,
//     output_config: { format: { type: "json_schema", schema } },
//     messages: [{ role: "user", content: prompt }],
//   });
//   const text = res.content.find((b) => b.type === "text")?.text ?? "{}";
//   return JSON.parse(text);
// }


export const AI_PROVIDER = process.env.AI_PROVIDER || 
  (process.env.GEMINI_API_KEY ? "gemini" : 
   process.env.OPENAI_API_KEY ? "openai" : 
   process.env.ANTHROPIC_API_KEY ? "claude" : null);

export const aiAvailable = !!AI_PROVIDER;

// 구조화 출력(JSON 스키마) → 각 모델 사양에 맞게 분기 처리
async function askJSON({ prompt, schema, maxTokens = 1500 }) {
  if (!aiAvailable) throw new Error("사용 가능한 AI API Key가 없습니다.");

  switch (AI_PROVIDER.toLowerCase()) {
    
    // ==========================================
    // 🟢 CASE 1: GPT
    // ==========================================
    case "openai": {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI(); // OPENAI_API_KEY 환경변수 자동 할당
      const model = process.env.OPENAI_MODEL || "gpt-4o";

      const res = await openai.chat.completions.create({
        model: model,
        max_tokens: maxTokens,
        response_format: {
          type: "json_schema",
          json_schema: { name: "scheduler_response", strict: false, schema: schema }
        },
        messages: [{ role: "user", content: prompt }],
      });
      
      const text = res.choices[0].message.content ?? "{}";
      return JSON.parse(text);
    }

    // ==========================================
    // 🔵 CASE 2:제미나이
    // ==========================================
    case "gemini": {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({}); // GEMINI_API_KEY 환경변수 자동 할당
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

      const res = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          maxOutputTokens: maxTokens,
        }
      });

      const text = res.text ?? "{}";
      return JSON.parse(text);
    }

    // ==========================================
    // 🟠 CASE 3: 클로드
    // ==========================================
    case "claude":
    default: {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수 자동 할당
      const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";

      const res = await client.messages.create({
        model: model,
        max_tokens: maxTokens,
        output_config: { format: { type: "json_schema", schema } },
        messages: [{ role: "user", content: prompt }],
      });

      const text = res.content.find((b) => b.type === "text")?.text ?? "{}";
      return JSON.parse(text);
    }
  }
}

// ── 1) 주간 패턴 → 이번 주 자동채움 제안 ─────────────
export async function suggestEvents({ patterns, events, weekStart }) {
  const candidates = missingFromPatterns(patterns, events, weekStart);
  if (candidates.length === 0) return { mode: "none", suggestions: [] };
  if (!aiAvailable) {
    return { mode: "rules", suggestions: candidates.map((c) => ({ ...c, confirm: `${c.reason} 이번 주에도 추가할까요?` })) };
  }
  const schema = {
    type: "object", additionalProperties: false,
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object", additionalProperties: false,
          properties: {
            title: { type: "string" }, calKey: { type: "string" },
            startsAt: { type: "string" }, endsAt: { type: "string" },
            location: { type: "string" }, confirm: { type: "string" },
          },
          required: ["title", "calKey", "startsAt", "endsAt", "location", "confirm"],
        },
      },
    },
    required: ["suggestions"],
  };
  const prompt = `당신은 캘린더 비서입니다. 아래는 사용자의 반복 일정 패턴에서 도출된 "이번 주 자동 채움 후보"입니다.
제안할 가치가 있는 것만 골라 자연스러운 확인 문구(confirm)를 붙여 JSON으로만 답하세요.
startsAt/endsAt/calKey/location 은 후보 값을 유지하세요. 애매하거나 불필요하면 제외하세요.

후보:
${JSON.stringify(candidates, null, 2)}`;
  try {
    const out = await askJSON({ prompt, schema });
    return { mode: "ai", suggestions: out.suggestions ?? [] };
  } catch (e) {
    return { mode: "rules-fallback", error: e.message,
      suggestions: candidates.map((c) => ({ ...c, confirm: `${c.reason} 추가할까요?` })) };
  }
}

// ── 2) 다음 일정까지 이동시간 조언 ─────────────────
export async function travelAdvice({ from, to, gapMinutes }) {
  const fromLoc = from?.location || null;
  const toLoc = to?.location || null;
  if (!aiAvailable || !fromLoc || !toLoc) {
    let message;
    if (!toLoc) message = "다음 일정의 장소가 없어 이동시간을 계산할 수 없어요.";
    else if (!fromLoc) message = `다음 일정은 "${toLoc}" 입니다. 직전 위치가 없어 이동시간 추정은 생략합니다.`;
    else message = `"${fromLoc}" → "${toLoc}" 이동. 여유 시간 ${gapMinutes}분.`;
    return { mode: aiAvailable ? "ai-skipped" : "rules", estimateMinutes: null, transport: null, message };
  }
  const schema = {
    type: "object", additionalProperties: false,
    properties: {
      estimateMinutes: { type: "integer" },
      transport: { type: "string" },   // 도보 | 대중교통 | 자동차
      message: { type: "string" },
      leaveBy: { type: "string" },     // 출발 권장 시각(HH:MM) 또는 ""
      confidence: { type: "string" },  // 높음 | 보통 | 낮음
    },
    required: ["estimateMinutes", "transport", "message", "leaveBy", "confidence"],
  };
  const prompt = `사용자가 "${fromLoc}"에서 일정을 마치고 "${toLoc}"의 다음 일정으로 이동합니다.
다음 일정 시작: ${to.startsAt}, 직전 일정 종료: ${from.endsAt} (여유 ${gapMinutes}분).
한국 기준으로 두 장소 사이 이동시간을 대략 추정하고, 여유시간과 비교해 지금 준비/출발해야 하는지 조언하세요.
실시간 교통은 알 수 없으니 confidence를 솔직히 표기하세요. JSON으로만 답하세요.`;
  try {
    const out = await askJSON({ prompt, schema, maxTokens: 700 });
    return { mode: "ai", ...out };   // top-level mode="ai", 세부는 transport 로
  } catch (e) {
    return { mode: "rules-fallback", error: e.message, estimateMinutes: null, transport: null,
      message: `"${fromLoc}" → "${toLoc}" 이동, 여유 ${gapMinutes}분. (AI 추정 실패)` };
  }
}

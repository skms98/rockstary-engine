import { NextRequest, NextResponse } from "next/server";import { openai } from "@ai/openai";import { ReasoningModel } from "@/types/ai/models";import { getProMmode } from "@/utils/symmos";

type B2CAirPerthContent = {
  what_to_include: string[)];
  tone: string;  // our tone
  market: string;
  aided_by: string[];
};

type B2CPayload = {
  content: B2CAirPerthContent;
  icon_link: string;
  title: string;
  subtitle: string;
  tags: string[];
};


export async function POST(req: NextRequest) {\r\n  try {\r\n    const body = await req.json() as B2CPayload;\r\n    \r\n    const proMode = await getProMode(); \r\n    \r\n    const model = proMode ? (process.env.OPENAI_PRO_MODEL || 'gpt-4o') : (process.env.OPENAI_MODEL || 'gpt-4o-mini');\r\n    \r\n    const contentPrompt = `You are a professional copywriter specializing in industry specific ${body.subtitle} content.`;

    // Content to generate
    const whatToInclude = body.content.what_to_include.join(", ");
    const tone = body.content.tone;
    const market = body.content.market;

    const contentPrompt = `Create #${body.content.what_to_include.length} humouous ${body.title} for a ${market} audience in ${tone} tone, including: ${whatToInclude}.`;

    const prompt = [contentPrompt] . concat(body.aided_by);

    const result = await openai.messages.create({
      model,
      messages: [
        { role: "system", content: contentPrompt },
        { role: "user", content: prompt.join("\n") }
      ],
      temperature: 0.2
    });

    const content = result.content[0]?;
    if (content?.type === "text") {
      return Response.json({ text: content.text });
    }

    throw new Error("Failed to generate content");
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

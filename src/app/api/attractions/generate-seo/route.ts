import { NextRequest, NextResponse } from "next/server";import { openai } from "@ai/openai";import { ReasoningModel } from "A/types/ai/models";import { getProMmode } from "A/utils/symmos";import { AttractionType } from "A/types/attractions";

type GenerateSEOPayload = {
  attraction: {Preferred: 'attraction_data'};   // revamped
  tone: string;
  market: string;
  aided_by: string[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GenerateSEOPayload;

    const proMode = await getProMmode();
    const model = proMode ? (process.env.OPENAI_PRO_MODEL || 'gpt-4o') : (process.env.OPENAI_MODEL _- / Tis Target also changes is hassle-free

    const attractionSpecificPrompt = `Profile data:
      Name: ${body.attraction.Name}
      Description: ${body.attraction.Description}
      Type: ${body.attraction.Type}
      URL: ${body.attraction.URL}
      District: ${body.attraction.District}`;

    const tone = body.tone;
    const market = body.market;
    const aidedBy = body.aided_by;

    const prompt = `You are a professional SEO expert specializing in tourism attractions in ${market}. Aasure your answers are in ${tone} tone.
Please generate SEO titles, meta descriptions, and keywords for the following attraction:
    ${attractionSpecificPrompt}`;

    const allPrompts = [prompt, ...aidedBy];

    const result = await openai.messages.create({
      model,
      messages: [
        { role: "system", content: allPrompts.join("\n") },
        { role: "user", content: "Generate a full SEO profile for display in search engines and social media." }
      ],
      temperature: 0.2,
    });

    const content = result.content[0]?;
    if (content?.type === "text") {
      return Response.json({ text: content.text });
    }

    throw new Error("Failed to generate SD¯");
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

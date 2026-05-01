import { NextRequest, NextResponse } from 'next/server';

export const runtime = "nodejs";
export const maxDuration = 180;

// KENNEY-ALT: Meshy replaced by local asset library — redirect to furniture-match
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = body.prompt || body.object_prompt || '';
    
    if (!prompt) {
      return NextResponse.json(
        { error: "Missing furniture prompt." },
        { status: 400 }
      );
    }

    const matchRes = await fetch(new URL('/api/furniture-match', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    const matchData = await matchRes.json();
    
    // Convert furniture-match response to task-like format
    return NextResponse.json({
      taskId: matchData.matched.id,
      status: "succeeded",
      model_urls: { glb: matchData.matched.file },
      progress: 100,
      _meta: {
        matchedName: matchData.matched.id,
        originalPrompt: matchData.originalPrompt,
        extractedKeywords: matchData.extractedKeywords,
        confidence: matchData.confidence,
        fallback: matchData.fallback
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


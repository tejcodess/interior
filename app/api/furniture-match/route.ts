import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Load manifest at runtime (not import-time) to avoid Next.js static analysis issues
function loadManifest() {
  const manifestPath = path.join(process.cwd(), 'public', 'assets', 'furniture', 'manifest.json');
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  return JSON.parse(raw);
}

function scoreMatch(prompt: string, tags: string[]): number {
  const promptLower = prompt.toLowerCase();
  const promptWords = promptLower.split(/\s+/);
  let score = 0;
  for (const tag of tags) {
    const tagLower = tag.toLowerCase();
    if (promptLower.includes(tagLower)) score += tagLower.split(' ').length * 3;
    for (const word of promptWords) {
      if (tagLower.includes(word) && word.length > 2) score += 1;
    }
  }
  return score;
}

async function extractKeywords(prompt: string): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return prompt;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `Extract the core furniture type from this prompt. Return ONLY a short phrase (2-4 words max), no explanation, no punctuation.\n\nPrompt: "${prompt}"\n\nExamples:\n"round walnut coffee table" → coffee table\n"modern grey sectional sofa" → sofa\n"tall oak bookcase" → bookshelf\n"standing arc floor light" → floor lamp\n"ergonomic mesh task chair" → office chair`
        }],
        max_tokens: 20,
        temperature: 0.1
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || prompt;
  } catch {
    return prompt;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 });

    const manifest = loadManifest();
    const keywords = await extractKeywords(prompt);

    const scored = manifest.map((item: any) => ({
      ...item,
      score: scoreMatch(keywords, item.tags) + scoreMatch(prompt, item.tags)
    }));

    scored.sort((a: any, b: any) => b.score - a.score);
    const best = scored[0];

    const result = {
      matched: best,
      originalPrompt: prompt,
      extractedKeywords: keywords,
      confidence: best.score >= 6 ? 'high' : best.score >= 3 ? 'medium' : 'low',
      fallback: best.score === 0
    };

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

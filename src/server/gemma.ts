import "server-only";

const DEFAULT_POLYCOUNT = 30000;
const DEFAULT_LENGTH_METERS = 2.0;
const GROQ_TIMEOUT_MS = 30000;

// Meshy preview models are generated at a larger-than-real internal scale.
// Multiplying the real-world dimension by this factor keeps s = length/longest > 1
// so furniture appears at an appropriate size in the scene rather than shrinking.
const LENGTH_SCALE = 3;

// --- Groq API helper --------------------------------------------------------

// FREE-ALT: Replaced Gemma/SSH with Groq's free llama-3.3-70b-versatile model
async function callGroqAPI(prompt: string): Promise<string | null> {
    const apiKey = process.env.GROQ_API_KEY;
    
    // FREE-ALT: Graceful degradation - if no Groq key, return null to use defaults
    if (!apiKey) {
        console.warn("GROQ_API_KEY not set — using default estimates for furniture polycount and size");
        return null;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: "You are a 3D modeling expert. Provide only the requested information without explanation."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 256,
                temperature: 0.3
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`Groq API error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        return typeof content === "string" ? content.trim() : null;
    } catch (error) {
        console.warn("Groq API call failed:", error instanceof Error ? error.message : error);
        return null;
    }
}

// --- polycount estimation ---------------------------------------------------

function buildPolycountPrompt(furniture: string): string {
    return (
        `Given this furniture description, reply with ONLY a single integer for the target polygon count.\n` +
        `Guidelines:\n` +
        `- Simple shapes (cube, box, cylinder): 5000-10000\n` +
        `- Basic furniture (stool, side table): 10000-20000\n` +
        `- Standard furniture (chair, sofa, table): 20000-40000\n` +
        `- Complex/ornate pieces (carved cabinet, detailed bookshelf): 40000-80000\n\n` +
        `Furniture: ${furniture}\n` +
        `Reply with only the integer, nothing else.`
    );
}

export async function estimateMeshPolycount(
    furniturePrompt: string,
): Promise<number> {
    const response = await callGroqAPI(buildPolycountPrompt(furniturePrompt));
    if (!response) return DEFAULT_POLYCOUNT;
    
    const match = response.match(/\d+/);
    if (!match) return DEFAULT_POLYCOUNT;
    
    const value = parseInt(match[0], 10);
    return Math.min(Math.max(value, 1000), 100000);
}

// --- real-world dimension estimation -----------------------------------------

function buildLengthPrompt(furniture: string): string {
    return (
        `Estimate the typical real-world LONGEST dimension in meters of this furniture piece as it would appear in a normal home.\n` +
        `Reply with ONLY a single decimal number — no units, no explanation, no text.\n\n` +
        `Item: ${furniture}`
    );
}

export async function estimateRealWorldLength(
    furniturePrompt: string,
): Promise<number> {
    const response = await callGroqAPI(buildLengthPrompt(furniturePrompt));
    if (!response) return DEFAULT_LENGTH_METERS;
    
    const match = response.match(/\d+(\.\d+)?/);
    if (!match) return DEFAULT_LENGTH_METERS;
    
    const value = parseFloat(match[0]);
    if (!Number.isFinite(value) || value <= 0) return DEFAULT_LENGTH_METERS;
    return value * LENGTH_SCALE;
}

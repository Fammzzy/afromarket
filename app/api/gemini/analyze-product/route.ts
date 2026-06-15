import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { image_url } = await request.json();

    if (!image_url) {
      return NextResponse.json({ error: "image_url is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY environment variable is not configured");
      return NextResponse.json({ error: "Gemini API key is not configured on the server" }, { status: 500 });
    }

    // Fetch image from URL
    const imageResponse = await fetch(image_url);
    if (!imageResponse.ok) {
      console.error(`Failed to fetch image from URL: ${image_url}. Status: ${imageResponse.status}`);
      return NextResponse.json({ error: "Failed to retrieve the uploaded image" }, { status: 500 });
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";

    const prompt = `You are an expert agricultural product analyst specializing in West African, and specifically Nigerian, open markets (e.g., Mile 12, Bodija, etc.). 
Analyze this farm produce image and return a JSON object with these exact fields:
- name: string (specific product name, e.g. "Fresh Red Tomatoes")
- description: string (2-3 sentences about quality, freshness, and size/quantity visible in the image)
- category: string (one of: "Fruits & Vegetables", "Grains & Cereals", "Dairy & Eggs", "Meat & Poultry", "Fish & Seafood", "Herbs & Spices", "Nuts & Seeds", "Honey & Sweeteners", "Oils & Fats", "Beverages", "Processed Foods", "Other")
- tags: array of 3-5 relevant strings (e.g. ["fresh", "organic", "locally-grown"])
- unit: string (The most appropriate standard selling unit for this product. MUST be one of: "piece", "bunch", "crate", "bag", "tray", "cup", "kg", "litre", "basket")
- price_range: object with min and max numbers in Nigerian Naira (₦) for the ENTIRE selected unit (not per kg, but for the whole tray, bag, piece, bunch, etc.).
- confidence: number 0-100 representing how confident you are in the identification

When determining the unit and estimating the price_range, you must strictly follow these rules based on the detected product category and size/quantity shown in the image:

1. Fresh Produce (Tomatoes, Pepper, Fresh Okra, Habanero/Rodo, etc.):
   - These are rarely sold by kg. Use "tray" (for smaller quantities/retail) or "basket" (for wholesale/large containers). 
   - A "tray" should have a price range of approximately ₦300 - ₦1,000 depending on freshness and size.
   - A "basket" (if wholesale/large quantity is shown) should have a price range of approximately ₦12,000 - ₦18,000.

2. Grains & Cereals (Rice, Beans, Corn, Millet, Garri, etc.):
   - Use "cup" (for retail cups) or "bag" (for wholesale/sacks).
   - A "cup" should have a price range of approximately ₦150 - ₦500 depending on the grain.
   - A "bag" (if a large sack is shown) should have a price range of approximately ₦78,000 - ₦95,000.

3. Leafy Vegetables (Ugu/Pumpkin Leaves, Scent Leaf, Bitter Leaf, Waterleaf, etc.):
   - Use "bunch".
   - A "bunch" should have a price range of approximately ₦200 - ₦500 per bunch.

4. Eggs:
   - Use "piece" (for individual eggs) or "crate" (for egg crates).
   - A "piece" (single egg) should be approximately ₦230 - ₦270 (default ₦250).
   - A "crate" should be approximately ₦11,000 - ₦12,500 (default ₦11,500).

5. Tubers (Yam, Sweet Potato, Cassava, Irish Potato, etc.):
   - Use "piece".
   - You must estimate the tuber size from the image:
     * Small size: price range ~₦800 - ₦1,200 (around ₦1,000)
     * Medium size: price range ~₦1,800 - ₦2,200 (around ₦2,000)
     * Large size: price range ~₦3,800 - ₦4,500 (around ₦4,000+)

Return ONLY valid JSON with no markdown or extra text.`;

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", errText);
      return NextResponse.json({ error: `Gemini API returned error: ${geminiResponse.statusText}` }, { status: 500 });
    }

    const geminiData = await geminiResponse.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Parse the JSON from Gemini's response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse JSON from Gemini response:", text);
      return NextResponse.json({ error: "Gemini did not return structured data" }, { status: 500 });
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return NextResponse.json(analysis);
  } catch (err: any) {
    console.error("Error analyzing product image:", err);
    return NextResponse.json({ error: err?.message || "Internal server error during analysis" }, { status: 500 });
  }
}

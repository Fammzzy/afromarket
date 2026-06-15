import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Initialize Supabase client with client's Authorization header to respect RLS for user writes
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Global client to read sales across all sellers for database-wide market analysis
    const supabaseAll = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error fetching user:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sellerId = user.id;

    // Fetch database-wide market data for AI analysis
    const [analyticsRes, ordersRes, productsRes] = await Promise.all([
      supabaseAll
        .from("sales_analytics")
        .select("*")
        .order("month", { ascending: true })
        .limit(100),
      supabaseAll
        .from("orders")
        .select("*, order_items(*, product:products(name, category))")
        .neq("order_status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAll
        .from("products")
        .select("name, category, price, stock_quantity, status")
        .eq("status", "active")
        .limit(100),
    ]);

    if (analyticsRes.error) {
      console.error("Analytics fetch error:", analyticsRes.error);
    }
    if (ordersRes.error) {
      console.error("Orders fetch error:", ordersRes.error);
    }
    if (productsRes.error) {
      console.error("Products fetch error:", productsRes.error);
    }

    const analytics = analyticsRes.data ?? [];
    const orders = ordersRes.data ?? [];
    const products = productsRes.data ?? [];

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY environment variable is not configured");
      return NextResponse.json({ error: "Gemini API key is not configured on the server" }, { status: 500 });
    }

    const prompt = `You are an agricultural market analyst AI specializing in West African/Nigerian local markets.
Analyze the following database-wide market data to generate a product-centric sales forecast.

GLOBAL PRODUCTS ACTIVE IN THE MARKET:
${JSON.stringify(products.slice(0, 40), null, 2)}

GLOBAL ORDERS PLACED (ALL SELLERS):
${JSON.stringify(orders.slice(0, 30).map((o: any) => ({
  total: o.total_amount,
  date: o.created_at?.slice(0, 10),
  items: o.order_items?.map((item: any) => ({
    product_name: item.product?.name,
    category: item.product?.category,
    quantity: item.quantity,
    price: item.unit_price
  }))
})), null, 2)}

GLOBAL MONTHLY ANALYTICS:
${JSON.stringify(analytics, null, 2)}

Current month: ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}

Perform a product-centric demand forecasting and analyze the likelihood of sales for various agricultural products (tomatoes, pepper, onions, rice, beans, yam, etc.).
Classify products into these exact sales likelihood categories based on historical order data, seasonal trends, and Nigerian market conditions:
- "high": High likelihood of having more sales (in-demand, fast-selling items)
- "low": Low likelihood of sales (slow-moving items, off-season, or high-priced relative to demand)
- "none": Not making sales at all (dead stock, completely off-season, or saturated market items)

Return a JSON object with these exact fields:
{
  "demand_predictions": [
    {
      "product": "string (e.g. Tomatoes, Yam, Rice, etc.)",
      "trend": "up|down|stable",
      "sales_likelihood": "high|low|none",
      "confidence": number,
      "demand_score": number, // 0 to 100 representing market demand index for next season
      "predicted_volume": number, // estimated quantity expected to be sold in the market
      "unit": "string", // e.g. baskets, bags, trays, bunches
      "reason": "string (1-2 sentences explaining why, referencing seasonal trends, current month, or pricing)"
    }
  ],
  "seasonal_opportunities": [
    { "title": "string", "description": "string", "potential_revenue": number, "action": "string" }
  ],
  "revenue_forecast": {
    "next_month": number,
    "next_quarter": number,
    "growth_rate": number,
    "currency": "NGN"
  },
  "recommendations": [
    { "title": "string", "description": "string", "priority": "high|medium|low" }
  ],
  "key_explanations": [
    {
      "point": "string (e.g. Rainfall delays harvest)",
      "impact": "string (e.g. Higher fresh pepper prices due to supply squeeze)",
      "recommendation": "string (e.g. Source early or store in aerated trays)"
    }
  ],
  "seasonal_insight": "string (2-3 sentences about the current month's agricultural season opportunities in Nigeria, e.g. rainy season harvesting, dry season irrigation demands, etc.)"
}

Return ONLY valid JSON. Base predictions on the data provided and agricultural market knowledge of Nigeria. Use Nigerian Naira (NGN) amounts.`;

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            topP: 0.8,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error during forecast:", errText);
      return NextResponse.json({ error: `Gemini API returned error: ${geminiResponse.statusText}` }, { status: 500 });
    }

    const geminiData = await geminiResponse.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    
    // Parse the JSON from Gemini's response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse JSON from Gemini response:", text);
      return NextResponse.json({ error: "Gemini did not return structured forecast data" }, { status: 500 });
    }

    const forecast = JSON.parse(jsonMatch[0]);

    // Store prediction in DB
    const { error: insertError } = await supabase.from("ai_predictions").insert({
      seller_id: sellerId,
      prediction_type: "seasonal_forecast",
      prediction_data: forecast,
    });

    if (insertError) {
      console.error("Error storing AI prediction in database:", insertError);
    }

    return NextResponse.json(forecast);
  } catch (err: any) {
    console.error("Error generating forecast:", err);
    return NextResponse.json({ error: err?.message || "Internal server error during forecasting" }, { status: 500 });
  }
}

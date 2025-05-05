// Supabase Edge Function: fetchPrices
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();
  const isoNow = now.toISOString();
  const isFirstDay = now.getDate() === 1;

  const prices = [];

  // 🔶 1. Crypto via CoinGecko
  const coingecko = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=eur");
  const crypto = await coingecko.json();
  prices.push({ asset: "BTC", category: "crypto", price: crypto.bitcoin.eur, currency: "EUR", timestamp: isoNow });
  prices.push({ asset: "ETH", category: "crypto", price: crypto.ethereum.eur, currency: "EUR", timestamp: isoNow });

  // 🔷 2. ETF/aandelen via Yahoo Finance (RapidAPI)
  const yahooRes = await fetch("https://yh-finance.p.rapidapi.com/market/v2/get-quotes?region=US&symbols=VOO,AAPL", {
    headers: {
      "X-RapidAPI-Key": Deno.env.get("RAPIDAPI_KEY")!,
      "X-RapidAPI-Host": "yh-finance.p.rapidapi.com"
    }
  });
  const yahooData = await yahooRes.json();
  for (const quote of yahooData.quoteResponse.result) {
    prices.push({
      asset: quote.symbol,
      category: "etf",
      price: quote.regularMarketPrice,
      currency: "USD",
      timestamp: isoNow,
    });
  }

  // 🟡 3. Goud via GoldAPI
  const goldRes = await fetch("https://www.goldapi.io/api/XAU/EUR", {
    headers: {
      "x-access-token": Deno.env.get("GOLDAPI_KEY")!
    }
  });
  const gold = await goldRes.json();
  prices.push({
    asset: "GOLD",
    category: "metal",
    price: gold.price,
    currency: "EUR",
    timestamp: isoNow,
  });

  // 🔁 Sla de data op in Supabase met daily en optioneel monthly interval
  for (const item of prices) {
    await supabase.from("prices").insert({ ...item, interval_type: "daily" });
    if (isFirstDay) {
      await supabase.from("prices").insert({ ...item, interval_type: "monthly" });
    }
  }

  return new Response("Koersen opgeslagen", { status: 200 });
});

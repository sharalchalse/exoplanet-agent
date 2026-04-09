import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import csv from "csv-parser";

interface ExoplanetData {
  [key: string]: any;
}

let cachedData: ExoplanetData[] | null = null;

async function loadCSV() {
  if (cachedData) return cachedData;

  const filePath = path.join(process.cwd(), "public", "exoplanet_scores_Final.csv");

  const results: ExoplanetData[] = await new Promise((resolve, reject) => {
    const data: ExoplanetData[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row: Record<string, string>) => {
        const formattedRow: Record<string, string | number> = {};

        for (const key in row) {
          const value = row[key].trim();
          formattedRow[key] = isNaN(Number(value)) ? value : parseFloat(value);
        }

        data.push(formattedRow);
      })
      .on("end", () => resolve(data))
      .on("error", reject);
  });

  cachedData = results;
  return results;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const toolName = body.function;
    const parameters = body.parameters || {};

    const planets = await loadCSV();

    // 🔥 searchPlanets
    if (toolName === "searchPlanets") {
      const { minHabitability, maxDistance } = parameters;

      const results = planets
        .filter(p => !minHabitability || p.habitability_score >= minHabitability)
        .filter(p => !maxDistance || p.sy_dist <= maxDistance)
        .slice(0, 10);

      return NextResponse.json({
        result: JSON.stringify(results),
      });
    }

    // 🔥 getPlanetDetail
    if (toolName === "getPlanetDetail") {
      const { planetName } = parameters;

      const planet = planets.find(
        p => p.pl_name?.toLowerCase() === planetName?.toLowerCase()
      );

      return NextResponse.json({
        result: JSON.stringify(planet || "not found"),
      });
    }

    return NextResponse.json({
      result: "Unknown tool",
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Tool execution failed" }, { status: 500 });
  }
}
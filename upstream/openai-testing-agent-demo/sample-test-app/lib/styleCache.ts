import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

/**
 * A single record coming from styles.csv
 * (keep the fields aligned with the CSV header):
 */
export interface StyleItem {
  id: number;
  gender: string;
  masterCategory: string;
  subCategory: string;
  articleType: string;
  baseColour: string;
  season: string;
  year: number;
  usage: string;
  productDisplayName: string;
  imageURL: string;
  priceUSD: number;
}

/** Internal in-memory cache (populated on first access) */
let cache: StyleItem[] | null = null;

/**
 * Parse _public/data/styles.csv_ on first call and
 * keep the result in memory for the lifetime of the process.
 */
export function getStylesCache(): StyleItem[] {
  if (cache) return cache;

  const csvPath = path.join(process.cwd(), "public", "data", "styles.csv");
  const raw = fs.readFileSync(csvPath, "utf-8");

  const records: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  cache = records.map((r) => ({
    id: Number(r.id),
    gender: r.gender,
    masterCategory: r.masterCategory,
    subCategory: r.subCategory,
    articleType: r.articleType,
    baseColour: r.baseColour,
    season: r.season,
    year: Number(r.year),
    usage: r.usage,
    productDisplayName: r.productDisplayName,
    imageURL: r.imageURL,
    priceUSD: Number(r.priceUSD),
  }));

  return cache;
}
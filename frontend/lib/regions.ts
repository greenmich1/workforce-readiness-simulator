/**
 * The front screen's regions (2026-10-03): the sites of lib/sites.ts grouped into the cards that sit
 * beside the globe. Manufacturing groups by New Zealand region, north to south; offices group by part
 * of the world. The headline numbers are sums of each site's inferred profile, so they are as
 * illustrative as the profiles themselves.
 */
import { SITES, presetFor, type Site } from "./sites";

export type Mode = "manufacturing" | "office";

export interface Region {
  id: string;
  name: string;
  mode: Mode;
  sites: Site[];
  /** Centre of its sites, for the camera and the leader line. */
  lat: number;
  lon: number;
  /** Largest distance from the centre to a site, in degrees. */
  span: number;
  people: number;
  courses: number;
}

/** The two Manawatū spellings in the site data are one region on screen. */
const nzRegion = (s: Site) => (s.region.startsWith("Manawatū") ? "Manawatū" : s.region);

const OFFICE_AREA: Record<string, string> = {
  shanghai: "North Asia", tokyo: "North Asia", seoul: "North Asia",
  singapore: "Southeast Asia", jakarta: "Southeast Asia", "shah-alam": "Southeast Asia",
  manila: "Southeast Asia", bangkok: "Southeast Asia", "ho-chi-minh": "Southeast Asia",
  colombo: "South Asia and the Middle East", dubai: "South Asia and the Middle East",
  melbourne: "Australia", amsterdam: "Europe", chicago: "The Americas",
};
const OFFICE_ORDER = ["Australia", "Southeast Asia", "North Asia", "South Asia and the Middle East", "Europe", "The Americas"];

function build(mode: Mode, name: string, sites: Site[]): Region {
  const lat = sites.reduce((a, s) => a + s.lat, 0) / sites.length;
  const lon = sites.reduce((a, s) => a + s.lon, 0) / sites.length;
  const span = Math.max(0, ...sites.map((s) => Math.hypot(s.lat - lat, (s.lon - lon) * Math.cos((lat * Math.PI) / 180))));
  const presets = sites.map(presetFor);
  return {
    id: `${mode}:${name}`, name, mode, sites, lat, lon, span,
    people: presets.reduce((a, p) => a + p.employees, 0),
    courses: Math.max(...presets.map((p) => p.courses)),
  };
}

function group(mode: Mode): Region[] {
  const list = SITES.filter((s) => (mode === "office" ? s.kind === "office" : s.kind !== "office"));
  const key = mode === "office" ? (s: Site) => OFFICE_AREA[s.id] ?? s.region : nzRegion;
  const names: string[] = [];
  const by = new Map<string, Site[]>();
  for (const s of list) {
    const k = key(s);
    if (!by.has(k)) { by.set(k, []); names.push(k); }
    by.get(k)!.push(s);
  }
  if (mode === "office") names.sort((a, b) => OFFICE_ORDER.indexOf(a) - OFFICE_ORDER.indexOf(b));
  return names.map((n) => build(mode, n, by.get(n)!));
}

export const REGIONS: Record<Mode, Region[]> = { manufacturing: group("manufacturing"), office: group("office") };

/** The plants the export arcs leave from: the major sites. */
export const EXPORT_PLANTS = SITES.filter((s) => s.scale === "large");

/** Where each view rests when nothing is chosen: [lon, lat, camera range in metres]. */
export const HOME: Record<Mode, [number, number, number]> = {
  manufacturing: [172.8, -41.0, 2_500_000],
  office: [132, -6, 10_000_000],
};

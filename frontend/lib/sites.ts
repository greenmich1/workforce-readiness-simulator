/**
 * The sites the scheduler opens on (2026-10-02): a New Zealand dairy co-operative's manufacturing sites
 * and in-market offices, from the co-operative's own public contact pages (checked 2026-10-02). The
 * company is deliberately not named anywhere in this app. Products are stated only where a public
 * source states them; otherwise a site is "dairy manufacturing".
 *
 * The workforce behind each site is ILLUSTRATIVE: a preset sized to the kind of site, within the
 * solver's limits (20–500 people, 5–50 roles, 10–60 courses). It is not the site's real headcount.
 */

export type SiteKind = "manufacturing" | "research" | "office";

export interface Site {
  id: string;
  name: string;
  /** Town or city, and region or country. */
  place: string;
  region: string;
  kind: SiteKind;
  /** What it makes, where a public source says so. */
  makes?: string;
  /** Large sites get the large preset. */
  scale?: "large";
  lat: number;
  lon: number;
}

export const SITES: Site[] = [
  // North Island
  { id: "kauri", name: "Kauri", place: "Whangārei", region: "Northland", kind: "manufacturing", lat: -35.65, lon: 174.29 },
  { id: "maungaturoto", name: "Maungatūroto", place: "Maungatūroto", region: "Northland", kind: "manufacturing", lat: -36.11, lon: 174.36 },
  { id: "te-rapa", name: "Te Rapa", place: "Hamilton", region: "Waikato", kind: "manufacturing", scale: "large", makes: "Milk powders, cream cheese, butter and AMF", lat: -37.73, lon: 175.23 },
  { id: "hautapu", name: "Hautapu", place: "Tamahere", region: "Waikato", kind: "manufacturing", lat: -37.86, lon: 175.47 },
  { id: "te-awamutu", name: "Te Awamutu", place: "Te Awamutu", region: "Waikato", kind: "manufacturing", lat: -38.01, lon: 175.32 },
  { id: "morrinsville", name: "Morrinsville", place: "Morrinsville", region: "Waikato", kind: "manufacturing", lat: -37.66, lon: 175.53 },
  { id: "waitoa", name: "Waitoa", place: "Waitoa", region: "Waikato", kind: "manufacturing", lat: -37.60, lon: 175.63 },
  { id: "waharoa", name: "Waharoa", place: "Waharoa", region: "Waikato", kind: "manufacturing", lat: -37.76, lon: 175.76 },
  { id: "tirau", name: "Tīrau", place: "Tīrau", region: "Waikato", kind: "manufacturing", lat: -37.98, lon: 175.76 },
  { id: "lichfield", name: "Lichfield", place: "Lichfield", region: "Waikato", kind: "manufacturing", lat: -38.13, lon: 175.82 },
  { id: "reporoa", name: "Reporoa", place: "Reporoa", region: "Bay of Plenty", kind: "manufacturing", lat: -38.44, lon: 176.34 },
  { id: "edgecumbe", name: "Edgecumbe", place: "Edgecumbe", region: "Bay of Plenty", kind: "manufacturing", lat: -37.97, lon: 176.83 },
  { id: "kapuni", name: "Kapuni", place: "Kapuni", region: "Taranaki", kind: "manufacturing", lat: -39.47, lon: 174.18 },
  { id: "eltham", name: "Collingwood Street", place: "Eltham", region: "Taranaki", kind: "manufacturing", lat: -39.43, lon: 174.30 },
  { id: "whareroa", name: "Whareroa", place: "Hāwera", region: "Taranaki", kind: "manufacturing", scale: "large", makes: "Milk powders, cheese, cream, AMF, whey protein and casein", lat: -39.61, lon: 174.27 },
  { id: "longburn", name: "Longburn", place: "Longburn", region: "Manawatū", kind: "manufacturing", lat: -40.39, lon: 175.56 },
  { id: "pahiatua", name: "Pahiatua", place: "Pahiatua", region: "Manawatū-Whanganui", kind: "manufacturing", lat: -40.45, lon: 175.84 },
  { id: "rnd", name: "Research and Development Centre", place: "Palmerston North", region: "Manawatū", kind: "research", lat: -40.36, lon: 175.61 },
  // South Island
  { id: "takaka", name: "Tākaka", place: "Tākaka", region: "Tasman", kind: "manufacturing", lat: -40.85, lon: 172.81 },
  { id: "darfield", name: "Darfield", place: "Darfield", region: "Canterbury", kind: "manufacturing", lat: -43.48, lon: 172.11 },
  { id: "clandeboye", name: "Clandeboye", place: "Clandeboye", region: "Canterbury", kind: "manufacturing", scale: "large", makes: "Cheese, milk powders and proteins", lat: -44.18, lon: 171.38 },
  { id: "studholme", name: "Studholme", place: "Waimate", region: "Canterbury", kind: "manufacturing", lat: -44.73, lon: 171.14 },
  { id: "stirling", name: "Stirling", place: "Stirling", region: "Otago", kind: "manufacturing", lat: -46.25, lon: 169.78 },
  { id: "edendale", name: "Edendale", place: "Edendale", region: "Southland", kind: "manufacturing", scale: "large", makes: "Milk powders and cheese — up to 15 million litres of milk a day", lat: -46.31, lon: 168.78 },

  // In-market offices
  { id: "singapore", name: "Singapore", place: "Singapore", region: "Singapore", kind: "office", lat: 1.28, lon: 103.85 },
  { id: "shanghai", name: "Shanghai", place: "Shanghai", region: "China", kind: "office", lat: 31.23, lon: 121.47 },
  { id: "tokyo", name: "Tokyo", place: "Tokyo", region: "Japan", kind: "office", lat: 35.68, lon: 139.69 },
  { id: "seoul", name: "Seoul", place: "Seoul", region: "South Korea", kind: "office", lat: 37.57, lon: 126.98 },
  { id: "jakarta", name: "Jakarta", place: "Jakarta", region: "Indonesia", kind: "office", lat: -6.21, lon: 106.85 },
  { id: "shah-alam", name: "Shah Alam", place: "Shah Alam, Selangor", region: "Malaysia", kind: "office", lat: 3.07, lon: 101.52 },
  { id: "manila", name: "Manila", place: "Taguig, Metro Manila", region: "Philippines", kind: "office", lat: 14.52, lon: 121.05 },
  { id: "bangkok", name: "Bangkok", place: "Bangkok", region: "Thailand", kind: "office", lat: 13.76, lon: 100.50 },
  { id: "ho-chi-minh", name: "Ho Chi Minh City", place: "Ho Chi Minh City", region: "Vietnam", kind: "office", lat: 10.82, lon: 106.63 },
  { id: "colombo", name: "Colombo", place: "Colombo", region: "Sri Lanka", kind: "office", lat: 6.93, lon: 79.86 },
  { id: "dubai", name: "Dubai", place: "Dubai", region: "United Arab Emirates", kind: "office", lat: 25.20, lon: 55.27 },
  { id: "amsterdam", name: "Amsterdam", place: "Amsterdam", region: "Netherlands", kind: "office", lat: 52.37, lon: 4.90 },
  { id: "chicago", name: "Chicago", place: "Chicago, Illinois", region: "United States", kind: "office", lat: 41.88, lon: -87.63 },
  { id: "melbourne", name: "Richmond", place: "Richmond, Victoria", region: "Australia", kind: "office", lat: -37.82, lon: 145.00 },
];

export const siteById = (id: string | null | undefined) => SITES.find((s) => s.id === id);

/** What the site's kind means in a line, for its card. */
export function kindLabel(s: Site): string {
  if (s.kind === "office") return "In-market sales office";
  if (s.kind === "research") return "Research and development";
  return s.makes ?? "Dairy manufacturing";
}

export type ShiftId = "core4on4off" | "panama223" | "standard52";

export interface Preset {
  employees: number;
  roles: number;
  courses: number;
  relationship_density: number;
  day_start_hour: number;
  day_end_hour: number;
  allow_saturday: boolean;
  allow_sunday: boolean;
  max_classroom: number;
  shifts: Record<ShiftId, boolean>;
  split: Record<ShiftId, number>;
  /** One line describing the illustrative workforce. */
  summary: string;
}

/** The illustrative workforce for a site, by its kind and scale. */
export function presetFor(s: Site): Preset {
  if (s.kind === "office") return {
    employees: 40, roles: 8, courses: 15, relationship_density: 0.4,
    day_start_hour: 8, day_end_hour: 18, allow_saturday: false, allow_sunday: false, max_classroom: 15,
    shifts: { core4on4off: false, panama223: false, standard52: true },
    split: { core4on4off: 0, panama223: 0, standard52: 100 },
    summary: "About 40 people in sales, customer service and finance, on weekday hours; compliance and SAP S/4HANA order-to-cash courses.",
  };
  if (s.kind === "research") return {
    employees: 120, roles: 15, courses: 25, relationship_density: 0.5,
    day_start_hour: 8, day_end_hour: 18, allow_saturday: false, allow_sunday: false, max_classroom: 20,
    shifts: { core4on4off: false, panama223: false, standard52: true },
    split: { core4on4off: 0, panama223: 0, standard52: 100 },
    summary: "About 120 scientists, technologists and pilot-plant staff on weekday hours; laboratory safety and quality courses.",
  };
  if (s.scale === "large") return {
    employees: 450, roles: 30, courses: 40, relationship_density: 0.6,
    day_start_hour: 6, day_end_hour: 20, allow_saturday: true, allow_sunday: true, max_classroom: 20,
    shifts: { core4on4off: true, panama223: true, standard52: true },
    split: { core4on4off: 70, panama223: 20, standard52: 10 },
    summary: "About 450 operators, technicians and engineers on continuous 12-hour rosters; food safety, plant and SAP maintenance courses.",
  };
  return {
    employees: 180, roles: 18, courses: 28, relationship_density: 0.5,
    day_start_hour: 6, day_end_hour: 20, allow_saturday: true, allow_sunday: false, max_classroom: 18,
    shifts: { core4on4off: true, panama223: false, standard52: true },
    split: { core4on4off: 80, panama223: 0, standard52: 20 },
    summary: "About 180 operators and technicians on 12-hour rosters through the season; food safety and plant courses.",
  };
}

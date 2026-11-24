import { createHash } from "node:crypto";
import { makeNiUri as rawNiUri } from "@red-cup-engineering/uri-engineering-services-section/ni-uri";
import { deflateSync } from "node:zlib";
import { RECORD_KIND, identify } from "./semantic-content.mjs";

const CLASSIFICATIONS = Object.freeze([
  "added",
  "materially-changed",
  "no-change",
  "explicitly-retracted",
  "unknown-unreported",
  "refused",
  "disagreed",
]);

const LABELS = Object.freeze({
  "added": "ADDED",
  "materially-changed": "CHANGED",
  "no-change": "NO CHANGE",
  "explicitly-retracted": "RETRACTED",
  "unknown-unreported": "UNKNOWN",
  "refused": "REFUSED",
  "disagreed": "DISAGREED",
});

const GLYPHS = Object.freeze({
  " ": ["00000","00000","00000","00000","00000","00000","00000"],
  "-": ["00000","00000","00000","11111","00000","00000","00000"],
  ".": ["00000","00000","00000","00000","00000","00100","00100"],
  "+": ["00000","00100","00100","11111","00100","00100","00000"],
  ":": ["00000","00100","00100","00000","00100","00100","00000"],
  "/": ["00001","00010","00100","01000","10000","00000","00000"],
  "0": ["01110","10001","10011","10101","11001","10001","01110"],
  "1": ["00100","01100","00100","00100","00100","00100","01110"],
  "2": ["01110","10001","00001","00010","00100","01000","11111"],
  "3": ["11110","00001","00001","01110","00001","00001","11110"],
  "4": ["00010","00110","01010","10010","11111","00010","00010"],
  "5": ["11111","10000","10000","11110","00001","00001","11110"],
  "6": ["01110","10000","10000","11110","10001","10001","01110"],
  "7": ["11111","00001","00010","00100","01000","01000","01000"],
  "8": ["01110","10001","10001","01110","10001","10001","01110"],
  "9": ["01110","10001","10001","01111","00001","00001","01110"],
  A:["01110","10001","10001","11111","10001","10001","10001"], B:["11110","10001","10001","11110","10001","10001","11110"],
  C:["01111","10000","10000","10000","10000","10000","01111"], D:["11110","10001","10001","10001","10001","10001","11110"],
  E:["11111","10000","10000","11110","10000","10000","11111"], F:["11111","10000","10000","11110","10000","10000","10000"],
  G:["01111","10000","10000","10111","10001","10001","01111"], H:["10001","10001","10001","11111","10001","10001","10001"],
  I:["01110","00100","00100","00100","00100","00100","01110"], J:["00001","00001","00001","00001","10001","10001","01110"],
  K:["10001","10010","10100","11000","10100","10010","10001"], L:["10000","10000","10000","10000","10000","10000","11111"],
  M:["10001","11011","10101","10101","10001","10001","10001"], N:["10001","11001","10101","10011","10001","10001","10001"],
  O:["01110","10001","10001","10001","10001","10001","01110"], P:["11110","10001","10001","11110","10000","10000","10000"],
  Q:["01110","10001","10001","10001","10101","10010","01101"], R:["11110","10001","10001","11110","10100","10010","10001"],
  S:["01111","10000","10000","01110","00001","00001","11110"], T:["11111","00100","00100","00100","00100","00100","00100"],
  U:["10001","10001","10001","10001","10001","10001","01110"], V:["10001","10001","10001","10001","10001","01010","00100"],
  W:["10001","10001","10001","10101","10101","10101","01010"], X:["10001","10001","01010","00100","01010","10001","10001"],
  Y:["10001","10001","01010","00100","00100","00100","00100"], Z:["11111","00001","00010","00100","01000","10000","11111"],
});

export const sha256 = rawNiUri;

// The Discord publication boundary (discord-publication.mjs) verifies attachment
// bytes against `sha256:<hex>` digests -- the house convention used everywhere
// else in this reporting pipeline (state-reporting.mjs's digest(), the NotebookLM
// contract's rawDigest()). pngDigest crosses that boundary, so it must be in that
// format rather than this module's own ni:///sha-256;<base64url> convention.
function sha256Hex(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function finiteText(value, maximum = 512) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum && !value.includes("\0");
}
function safeXmlText(value, maximum = 512) { return finiteText(value, maximum) && !/[&<>]/u.test(value); }
function four(value) {
  if (typeof value?.positiveEvidence !== "boolean" || typeof value?.negativeEvidence !== "boolean" || Object.keys(value).some((key) => !["positiveEvidence", "negativeEvidence"].includes(key))) throw new TypeError("FOUR evidence must be exactly two explicit evidence bits");
  return { positiveEvidence: value.positiveEvidence, negativeEvidence: value.negativeEvidence };
}
const evidenceCode = ({ positiveEvidence, negativeEvidence }) => `${Number(positiveEvidence)}${Number(negativeEvidence)}`;

export function normalizeDeltaPacket(packet) {
  if (packet?.type !== "HarmoniousUnionDeltaPacket") throw new TypeError("packet must be HarmoniousUnionDeltaPacket");
  for (const field of ["period", "subscriptionDigest", "currentManifestDigest"]) if (!finiteText(packet[field])) throw new TypeError(`${field} is required`);
  if (!(packet.previousSuccessfulPublicationDigest === null || finiteText(packet.previousSuccessfulPublicationDigest))) throw new TypeError("previousSuccessfulPublicationDigest must be null or a digest");
  if (!Array.isArray(packet.claims)) throw new TypeError("claims must be an array");
  const claims = packet.claims.map((claim) => {
    if (!finiteText(claim?.settlement) || !finiteText(claim?.claimId) || !CLASSIFICATIONS.includes(claim?.classification)) throw new TypeError("each claim needs settlement, claimId, and a mechanical classification");
    return { settlement: claim.settlement, claimId: claim.claimId, classification: claim.classification, evidence: four(claim.evidence) };
  }).sort((left, right) => identify(left, RECORD_KIND).id.localeCompare(identify(right, RECORD_KIND).id));
  const keys = claims.map((claim) => `${claim.settlement}\0${claim.claimId}`);
  if (new Set(keys).size !== keys.length) throw new TypeError("settlement plus claimId must be unique");
  const metrics = (packet.metrics ?? []).map((metric) => {
    for (const field of ["settlement", "claimId", "label", "amount", "unit", "domain"]) if (!finiteText(metric?.[field])) throw new TypeError(`metric ${field} is required`);
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(metric.amount) || !(metric.deltaAmount === null || /^[-+]?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(metric.deltaAmount))) throw new TypeError("metric amounts must be exact decimals");
    if (!Number.isInteger(metric.displayOrder)) throw new TypeError("metric display order must be an integer");
    return { settlement: metric.settlement, claimId: metric.claimId, label: metric.label, amount: metric.amount, unit: metric.unit, domain: metric.domain,
      displayOrder: metric.displayOrder, classification: metric.classification, evidence: four(metric.evidence), previousAmount: metric.previousAmount ?? null, deltaAmount: metric.deltaAmount };
  }).sort((left, right) => left.displayOrder - right.displayOrder || left.claimId.localeCompare(right.claimId));
  const coverage = packet.coverage && ["admitted", "accepted", "refused", "unknownUnreported"].every((key) => Number.isInteger(packet.coverage[key]) && packet.coverage[key] >= 0)
    ? { admitted: packet.coverage.admitted, accepted: packet.coverage.accepted, refused: packet.coverage.refused, unknownUnreported: packet.coverage.unknownUnreported } : null;
  const reportingWindow = packet.reportingWindow && ["fromExclusive", "toInclusive"].every((key) => finiteText(packet.reportingWindow[key]) && !Number.isNaN(Date.parse(packet.reportingWindow[key]))) && Date.parse(packet.reportingWindow.fromExclusive) < Date.parse(packet.reportingWindow.toInclusive)
    ? { fromExclusive: packet.reportingWindow.fromExclusive, toInclusive: packet.reportingWindow.toInclusive, baseline: Boolean(packet.reportingWindow.baseline) } : null;
  const presentation = packet.presentation === undefined || packet.presentation === null ? null : {
    graphicTitle: safeXmlText(packet.presentation?.graphicTitle, 54) ? packet.presentation.graphicTitle : (() => { throw new TypeError("presentation graphicTitle is invalid"); })(),
    graphicDescription: safeXmlText(packet.presentation?.graphicDescription, 512) ? packet.presentation.graphicDescription : (() => { throw new TypeError("presentation graphicDescription is invalid"); })(),
  };
  return { type: packet.type, period: packet.period, subscriptionDigest: packet.subscriptionDigest,
    previousSuccessfulPublicationDigest: packet.previousSuccessfulPublicationDigest, currentManifestDigest: packet.currentManifestDigest, reportingWindow, claims, metrics, coverage, presentation };
}

function displayedMetrics(metrics) {
  const nonzero = (value) => value !== "0" && value !== "-0" && !/^0\.0+$/u.test(value);
  const rank = (metric) => {
    if (nonzero(metric.amount) && metric.deltaAmount && nonzero(metric.deltaAmount)) return 0;
    if (nonzero(metric.amount) && ["disagreed", "refused", "explicitly-retracted", "materially-changed"].includes(metric.classification)) return 1;
    if (nonzero(metric.amount)) return 2;
    if (["disagreed", "refused", "explicitly-retracted", "materially-changed"].includes(metric.classification)) return 3;
    return 4;
  };
  const specificity = (metric) => metric.claimId.startsWith("flow/quantity/") || metric.claimId.startsWith("stock/") ? 0 : metric.claimId.startsWith("flow/domain/") ? 2 : 1;
  const ranked = [...metrics].sort((left, right) => rank(left) - rank(right) || specificity(left) - specificity(right) || left.displayOrder - right.displayOrder || left.claimId.localeCompare(right.claimId));
  const selected = []; const selectedIds = new Set();
  for (const domain of [...new Set(ranked.map((metric) => metric.domain))].sort()) {
    const candidate = ranked.find((metric) => metric.domain === domain && nonzero(metric.amount));
    if (candidate) { selected.push(candidate); selectedIds.add(candidate.claimId); }
  }
  for (const metric of ranked) if (selected.length < 20 && !selectedIds.has(metric.claimId)) { selected.push(metric); selectedIds.add(metric.claimId); }
  return selected.slice(0, 20);
}

function rect(x, y, width, height, fill = "#000000") {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"/>`;
}

function bitmapText(value, x, y, scale = 3) {
  let output = ""; let cursor = x;
  for (const character of value.toUpperCase()) {
    const glyph = GLYPHS[character] ?? GLYPHS[" "];
    glyph.forEach((row, rowIndex) => [...row].forEach((pixel, columnIndex) => {
      if (pixel === "1") output += rect(cursor + columnIndex * scale, y + rowIndex * scale, scale, scale);
    }));
    cursor += 6 * scale;
  }
  return output;
}

export function renderSvgBytes(packet) {
  const normalized = normalizeDeltaPacket(packet);
  const counts = Object.fromEntries(CLASSIFICATIONS.map((classification) => [classification, normalized.claims.filter((claim) => claim.classification === classification).length]));
  const evidenceCounts = Object.fromEntries(["00", "10", "01", "11"].map((code) => [code, normalized.claims.filter((claim) => evidenceCode(claim.evidence) === code).length]));
  const maximum = Math.max(1, ...Object.values(counts));
  let visual = rect(0, 0, 1200, 1240, "#ffffff");
  const graphicTitle = packet.presentation?.graphicTitle ?? "STATE OF THE HARMONIOUS UNION";
  const titleElement = packet.presentation?.graphicTitle ?? "State of the Harmonious Union civic delta";
  const graphicDescription = packet.presentation?.graphicDescription ?? "Current economic and political measurements plus mechanical delta counts. Unknowns, refusals, proposals, executions, and disagreements remain distinct.";
  visual += bitmapText(graphicTitle.slice(0, 45), 50, 38, 4);
  const interval = normalized.reportingWindow ? `${normalized.reportingWindow.fromExclusive.slice(0, 19)} TO ${normalized.reportingWindow.toInclusive.slice(0, 19)}` : normalized.period.slice(0, 28);
  visual += bitmapText(`DELTA ${interval}`, 50, 92, 2);
  if (normalized.coverage) visual += bitmapText(`REPORTING ${normalized.coverage.accepted}/${normalized.coverage.admitted}  REFUSED ${normalized.coverage.refused}  UNKNOWN ${normalized.coverage.unknownUnreported}`, 720, 92, 2);
  displayedMetrics(normalized.metrics).forEach((metric, index) => {
    const column = index % 4; const row = Math.floor(index / 4); const x = 50 + column * 285; const y = 145 + row * 112;
    visual += rect(x, y, 260, 92); visual += rect(x + 3, y + 3, 254, 86, "#ffffff");
    visual += bitmapText(metric.label.slice(0, 20), x + 12, y + 12, 2);
    visual += bitmapText(`${metric.amount} ${metric.unit}`.slice(0, 22), x + 12, y + 48, 3);
    if (metric.deltaAmount && metric.deltaAmount !== "0") visual += bitmapText(`DELTA ${metric.deltaAmount}`.slice(0, 20), x + 150, y + 70, 1);
  });
  CLASSIFICATIONS.forEach((classification, index) => {
    const y = 735 + index * 58; const count = counts[classification]; const barWidth = Math.round((count / maximum) * 600);
    visual += bitmapText(LABELS[classification], 50, y + 5, 2);
    visual += rect(310, y, 604, 30);
    visual += rect(312, y + 2, 600, 26, "#ffffff");
    if (barWidth > 0) visual += rect(312, y + 2, barWidth, 26);
    visual += bitmapText(String(count), 950, y + 5, 2);
  });
  visual += bitmapText(`FOUR 00 ${evidenceCounts["00"]}  10 ${evidenceCounts["10"]}  01 ${evidenceCounts["01"]}  11 ${evidenceCounts["11"]}`, 50, 1140, 2);
  visual += bitmapText(`${normalized.claims.length} CLAIMS  ${normalized.metrics.length} MEASUREMENTS`, 50, 1190, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny" width="1200" height="1240" viewBox="0 0 1200 1240"><title>${titleElement}</title><desc>${graphicDescription}</desc>${visual}</svg>`;
  return Buffer.from(svg, "utf8");
}

export function assertSafeSvg(svgBytes) {
  const svg = Buffer.from(svgBytes).toString("utf8");
  if (!svg.startsWith("<svg xmlns=\"http://www.w3.org/2000/svg\" version=\"1.2\" baseProfile=\"tiny\"")) throw new Error("SVG is not the admitted SVG Tiny 1.2 profile");
  if (/<(?:script|style|foreignObject|iframe|image|use|animate|set|filter)\b|\bhref=|url\(|data:|<!DOCTYPE|<\?xml/iu.test(svg)) throw new Error("SVG contains a forbidden construct");
  const tags = [...svg.matchAll(/<\/?([A-Za-z][A-Za-z0-9]*)/gu)].map((match) => match[1]);
  if (tags.some((tag) => !["svg", "title", "desc", "rect"].includes(tag))) throw new Error("SVG contains an unrendered element");
  const colors = [...svg.matchAll(/fill="([^"]+)"/gu)].map((match) => match[1]);
  if (colors.some((color) => !["#000000", "#ffffff"].includes(color))) throw new Error("SVG exceeds the monochrome profile");
  return true;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii"); const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

export function rasterizeExactSvg(svgBytes) {
  assertSafeSvg(svgBytes);
  const svg = Buffer.from(svgBytes).toString("utf8");
  const root = svg.match(/width="(\d+)" height="(\d+)" viewBox="0 0 (\d+) (\d+)"/u);
  if (!root || root[1] !== root[3] || root[2] !== root[4]) throw new Error("SVG dimensions are not exact pixel coordinates");
  const width = Number(root[1]); const height = Number(root[2]);
  const pixels = Buffer.alloc((width * 4 + 1) * height, 255);
  for (let y = 0; y < height; y += 1) pixels[y * (width * 4 + 1)] = 0;
  const rectangles = [...svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="(#000000|#ffffff)"\/>/gu)];
  if (rectangles.length === 0) throw new Error("SVG has no visual primitives");
  for (const match of rectangles) {
    const [, xValue, yValue, widthValue, heightValue, fill] = match; const rgb = fill === "#000000" ? 0 : 255;
    const x0 = Number(xValue); const y0 = Number(yValue); const x1 = Math.min(width, x0 + Number(widthValue)); const y1 = Math.min(height, y0 + Number(heightValue));
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) {
      const offset = y * (width * 4 + 1) + 1 + x * 4; pixels[offset] = rgb; pixels[offset + 1] = rgb; pixels[offset + 2] = rgb; pixels[offset + 3] = 255;
    }
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const svgDigest = sha256(svgBytes);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk("IHDR", header),
    pngChunk("tEXt", Buffer.from(`rasterized-from-svg-sha256\0${svgDigest}`, "utf8")),
    pngChunk("IDAT", deflateSync(pixels, { level: 9 })), pngChunk("IEND", Buffer.alloc(0))]);
}

export function renderDeterministicReportGraphic(packet) {
  try {
    const normalized = normalizeDeltaPacket(packet); const svgBytes = renderSvgBytes(normalized); const pngBytes = rasterizeExactSvg(svgBytes);
    const packetIdentity = identify(normalized, RECORD_KIND);
    return { type: "DeterministicReportGraphicArtifact", packetDigest: packetIdentity.id, packetBytes: sha256(packetIdentity.bytes),
      svgProfile: "RFC7996-safe SVG Tiny 1.2 subset", svgDigest: sha256(svgBytes), svgBase64: svgBytes.toString("base64"),
      pngDigest: sha256Hex(pngBytes), pngBase64: pngBytes.toString("base64"), rasterizedFromExactSvgDigest: sha256(svgBytes) };
  } catch (error) {
    return { type: "DeterministicReportGraphicRefusal", reason: error instanceof Error ? error.message : String(error), effects: [] };
  }
}

export const MECHANICAL_CLASSIFICATIONS = CLASSIFICATIONS;

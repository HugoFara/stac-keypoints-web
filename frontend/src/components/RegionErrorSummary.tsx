import React from "react";
import { useStore } from "../store";
import { errorToColor } from "../errorColor";

// Rat anatomical regions, used when the loaded keypoint set contains rat
// names. For other species we auto-derive groups from L/R name suffixes
// (see autoRegions). Per-species region tables could go in a config later;
// rat is hard-coded because that's still by far the most common dataset.
const RODENT_REGIONS: { name: string; keypoints: string[] }[] = [
  { name: "Head", keypoints: ["Snout", "EarL", "EarR"] },
  { name: "Back", keypoints: ["SpineF", "SpineM", "SpineL", "TailBase"] },
  {
    name: "Forelimbs",
    keypoints: [
      "ShoulderL", "ElbowL", "WristL", "HandL",
      "ShoulderR", "ElbowR", "WristR", "HandR",
    ],
  },
  {
    name: "Hindlimbs",
    keypoints: [
      "HipL", "KneeL", "AnkleL", "FootL",
      "HipR", "KneeR", "AnkleR", "FootR",
    ],
  },
];

type Region = { name: string; keypoints: string[] };
type Row = { name: string; count: number; total: number; mean: number; max: number };

// Group keypoints by trailing L/R suffix (rat convention) or leading l/r
// (fly convention). Anything without a side suffix lands in "Center".
function autoRegions(kpNames: string[]): Region[] {
  const left: string[] = [];
  const right: string[] = [];
  const center: string[] = [];
  for (const name of kpNames) {
    if (/L$/.test(name) || /^l\d/.test(name)) left.push(name);
    else if (/R$/.test(name) || /^r\d/.test(name)) right.push(name);
    else center.push(name);
  }
  const regions: Region[] = [];
  if (left.length) regions.push({ name: "Left side", keypoints: left });
  if (right.length) regions.push({ name: "Right side", keypoints: right });
  if (center.length) regions.push({ name: "Center / unsided", keypoints: center });
  return regions;
}

function summarize(regions: Region[], errorMap: Record<string, number>): Row[] {
  return regions.map((r) => {
    const present = r.keypoints.filter((kp) => kp in errorMap);
    if (present.length === 0) return null;
    const vals = present.map((kp) => errorMap[kp]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { name: r.name, count: present.length, total: r.keypoints.length, mean, max: Math.max(...vals) };
  }).filter(Boolean) as Row[];
}

export default function RegionErrorSummary() {
  const errors = useStore((s) => s.perKeypointErrors);
  if (errors.length === 0) return null;

  const errorMap: Record<string, number> = {};
  for (const e of errors) errorMap[e.keypointName] = e.errorMm;

  // Try rat regions first; fall back to L/R auto-grouping for other species.
  let rows = summarize(RODENT_REGIONS, errorMap);
  if (rows.length === 0) {
    rows = summarize(autoRegions(Object.keys(errorMap)), errorMap);
  }
  if (rows.length === 0) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <h4 style={{ margin: "0 0 4px", fontSize: 12, color: "#aaa" }}>
        Error by region
      </h4>
      <table style={{ width: "100%", fontSize: 11, fontFamily: "monospace", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ color: "#888" }}>
            <th style={thStyle}>Region</th>
            <th style={thStyleNum}>n</th>
            <th style={thStyleNum}>mean</th>
            <th style={thStyleNum}>max</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td style={{ ...tdStyle, color: errorToColor(r.mean) }}>{r.name}</td>
              <td style={tdStyleNum}>{r.count}/{r.total}</td>
              <td style={{ ...tdStyleNum, color: errorToColor(r.mean) }}>{r.mean.toFixed(1)}</td>
              <td style={{ ...tdStyleNum, color: errorToColor(r.max) }}>{r.max.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: "left", padding: "2px 4px", fontWeight: 400 };
const thStyleNum: React.CSSProperties = { ...thStyle, textAlign: "right" };
const tdStyle: React.CSSProperties = { padding: "1px 4px" };
const tdStyleNum: React.CSSProperties = { ...tdStyle, textAlign: "right" };

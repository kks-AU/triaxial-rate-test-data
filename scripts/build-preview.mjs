// MIT License. Build compact plotting data; original CSVs remain untouched.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2] || project);
const output = path.join(project, 'data', 'preview');
await fs.mkdir(output, { recursive: true });
export function parseCSV(text) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(value); value = ''; }
    else if (c === '\n' && !quoted) { row.push(value.replace(/\r$/, '')); if (row.some(Boolean)) rows.push(row); row = []; value = ''; }
    else value += c;
  }
  if (value || row.length) { row.push(value.replace(/\r$/, '')); rows.push(row); }
  const header = rows.shift();
  return rows.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}
const read = async file => parseCSV(await fs.readFile(path.join(source, 'data', file), 'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(source, 'data/manifest.json'), 'utf8'));
const fields = ['ShearStrain_pct','q_kPa','p_eff_kPa','PorePressure_kPa','ExcessPorePressure_kPa','VoidRatioCorrected','StageNumber','AxialStrainRate_pct_min','SourceRow'];
const number = value => value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
for (const test of manifest.tests) {
  const rows = await read(test.ShearFile);
  if (rows.length !== test.ShearRows) throw Error(`Row mismatch: ${test.LabID}`);
  // Segment before thinning, so invalid intervals cannot be bridged.
  const segments = []; let segment = [];
  for (const row of rows) {
    if (row.PlotValid !== '1') { if (segment.length) segments.push(segment); segment = []; }
    else { if (segment.length && segment.at(-1).StageNumber !== row.StageNumber) { segments.push(segment); segment = []; } segment.push(row); }
  }
  if (segment.length) segments.push(segment);
  const sampled = [], stageInfo = new Map();
  const bucketSize = Math.max(1, Math.ceil(rows.length / 900));
  for (const seg of segments) {
    const stage = Number(seg[0].StageNumber);
    if (!stageInfo.has(stage)) stageInfo.set(stage, { stage, strain: number(seg[0].ShearStrain_pct) });
    const indices = new Set([0, seg.length - 1]);
    for (let start = 0; start < seg.length; start += bucketSize) {
      const end = Math.min(seg.length, start + bucketSize);
      indices.add(start); indices.add(end - 1);
      for (const field of fields.slice(0, 6)) {
        let low = start, high = start;
        for (let i = start + 1; i < end; i++) {
          if (Number(seg[i][field]) < Number(seg[low][field])) low = i;
          if (Number(seg[i][field]) > Number(seg[high][field])) high = i;
        }
        indices.add(low); indices.add(high);
      }
    }
    if (sampled.length) sampled.push(null);
    for (const i of [...indices].sort((a,b) => a-b)) sampled.push(fields.map(f => number(seg[i][f])));
  }
  const compression = (await read(test.CompressionFile)).map(r => ({ p: number(r.p_eff_kPa), e: number(r.VoidRatioCorrected), stage: number(r.StageNumber), type: r.PointType }));
  if (compression.length !== test.CompressionPoints) throw Error(`Compression count mismatch: ${test.LabID}`);
  const data = { fields, sourceRows: rows.length, displayedRows: sampled.filter(Boolean).length, stages: [...stageInfo.values()], shear: sampled, compression };
  await fs.writeFile(path.join(output, `${test.LabID}.json`), JSON.stringify(data));
  console.log(`${test.LabID}: ${rows.length} → ${data.displayedRows} plotting points`);
}
const catalogue = { ...manifest, materials: await read('materials.csv'), parameters: await read('parameters/Paper_specimen_rate_effect_parameters.csv') };
await fs.writeFile(path.join(output, 'catalogue.json'), JSON.stringify(catalogue));

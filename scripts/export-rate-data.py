#!/usr/bin/env python3
"""Export saved full-resolution analysis summaries (never preview curves)."""
import bisect
import csv
import hashlib
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]).resolve() / 'Processed data and results'
OUT = ROOT / 'data/rate'
OUT.mkdir(exist_ok=True)
manifest = json.loads((ROOT / 'data/manifest.json').read_text())
provenance = []

def read(name):
    file = SOURCE / name
    provenance.append({'file': name, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
    def value(v):
        try:
            n = float(v)
            return n if math.isfinite(n) else None
        except ValueError:
            return v or None
    with file.open() as stream:
        return [{k: value(v) for k, v in row.items()} for row in csv.DictReader(stream)]

plastic = read('K1_plastic_strain_R_step_data.csv')
stiffness = read('K1_plastic_strain_initial_stiffness.csv')
curves = read('K1_plastic_strain_R_curves.csv')
curve_index = {}
for row in curves:
    curve_index.setdefault((row['LabID'], row['Stage']), []).append(row)

def plastic_coordinate(lab, stage, strain):
    samples = curve_index.get((lab, stage), [])
    xs = [s['TotalStrain_pct'] for s in samples]
    i = bisect.bisect_left(xs, strain)
    if i < len(xs) and abs(xs[i] - strain) < 1e-9:
        return samples[i]['PlasticStrain_pct']
    if i == 0 or i == len(xs):
        return None
    a, b = samples[i-1], samples[i]
    return a['PlasticStrain_pct'] + (b['PlasticStrain_pct'] - a['PlasticStrain_pct']) * (strain-xs[i-1])/(xs[i]-xs[i-1])

catalogue = []
for test in manifest['tests']:
    lab = test['LabID']
    name = f'{lab}_auto_reference_rate_results.csv'
    total = read(name) if (SOURCE / name).exists() else []
    k1 = [r for r in plastic if r['LabID'] == lab]
    for r in total:
        if k1 and r['Domain'] == 'q' and r['epsStageStart'] is not None and r['DeltaRateEpsMax'] is not None:
            r['EstimatedPlasticStrainAtStepMax_pct'] = plastic_coordinate(lab, r['Stage'], r['epsStageStart'] + r['DeltaRateEpsMax'])
    payload = {'LabID': lab, 'total': total, 'plastic': k1,
               'stiffness': [r for r in stiffness if r['LabID'] == lab]}
    (OUT / f'{lab}.json').write_text(json.dumps(payload, allow_nan=False, separators=(',', ':')) + '\n')
    catalogue.append({'LabID': lab, 'totalRows': len(total), 'plasticRows': len(k1)})
(OUT / 'manifest.json').write_text(json.dumps({'schemaVersion': 1, 'tests': catalogue, 'sources': provenance}, indent=2) + '\n')
print(f'Exported {sum(t["totalRows"] for t in catalogue)} domain-stage results for {sum(bool(t["totalRows"]) for t in catalogue)} tests.')

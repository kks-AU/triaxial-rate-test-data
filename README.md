# Triaxial rate-test data

Processed compression and shear data for kaolin, bentonite and Speswhite
mixtures, with material properties and an interactive viewer.

[Open the interactive viewer](https://kks-au.github.io/triaxial-rate-test-data/).

## Data

| Files | Contents |
| --- | --- |
| `data/shear/<LabID>.csv` | Full-resolution processed shear measurements, in source order. |
| `data/compression/<LabID>.csv` | Initial and saved consolidation-stage compression points. |
| `data/materials.csv` | Material composition and index properties. |
| `data/README.md` | Column definitions, equations, assumptions and units. |
| `data/manifest.json` | Specimen metadata, file paths and source provenance. |
| `data/reference/` | Saved reference curves and measured stage-rate sequences. |
| `data/preview/` | Reduced plotting copies generated for the viewer. |
| `data/rate/` | Saved rate-analysis summaries, K1 plastic coordinates and source provenance. |

There are 13 tests, 984,500 shear measurement rows and 74 compression points.
The rate-analysis page includes fitted beta and gamma coefficients with R²
for 12 tests; A9 has no saved rate-reference analysis. Measured strain rate
remains part of the shear measurements. A9's missing material metadata is left missing.

## Void ratio

Two columns distinguish the reference bases explicitly:

- **`VoidRatioInitialWaterContent` (unshifted):** calculated from initial
  water content, initial wet mass and specimen volume, assumed particle
  specific gravity, and subsequent measured volume change.
- **`VoidRatioFinalWaterContentShifted` (shifted):** the same curve plus a
  constant offset to match the final-water-content reference e_f = w_f G_s,
  assuming full saturation and using water content as a mass fraction.

These replace the former names `VoidRatioUnshifted` and `VoidRatioCorrected`.
Numerical measurement values are unchanged. The shifted curve retains the
same volume-change increments and compression slope; the saved rounded
reference values can leave a small rounding residual.

See [the data definitions](data/README.md) for equations and assumptions.

## Viewer and updates

The viewer includes test selection, five plots, material properties,
full-resolution CSV downloads and SVG plot export, plus optional reference
curves on q and q/p′ versus strain and stage-rate sequences in the test table. The additional
[rate-analysis page](https://kks-au.github.io/triaxial-rate-test-data/rate-analysis.html)
provides 13 plots, pre-/post-peak selection, and beta/gamma fit-table downloads
including R², standard errors and sample counts.
See [VIEWER.md](VIEWER.md) for local preview and GitHub Pages deployment.
After changing data, run `node scripts/build-preview.mjs` to refresh the
plotting copies. GitHub Actions also performs this automatically on deployment.

To regenerate the data from the separate MATLAB analysis project, add this
repository to the MATLAB path and call:

```matlab
export_data('C:/path/to/Triaxial-test---rate-quantification/RateEffects')
```

This reads the canonical `Processed data and results` directory and writes
the public data beside the exporter. The original source results are not modified.
The exporter checks written row counts and core plotting values. Raw acquisition
files are absent from this checkout and are not part of this dataset.

## Licence

Data and research documentation are licensed under **CC BY 4.0**; see
[LICENSE-DATA](LICENSE-DATA). Credit the dataset creators, link to the source
and licence, and indicate changes when sharing or adapting the materials.

Original exporter and viewer code is licensed under **MIT**; see
[LICENSE-CODE](LICENSE-CODE). Third-party materials retain their own licences.

The Aarhus University department logo in `assets/au-logo.png` was supplied as
`alt-logo-t-1a171b-en.pdf`, with surrounding blank space removed for display.
The logo is excluded from the MIT and CC BY 4.0 licences; rights remain with
its respective owner.

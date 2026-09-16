# Triaxial rate-test data for GitHub

This repository contains processed, full-resolution data and an interactive test viewer.

## Files

All paths below are relative to `data/`.

| File | Purpose |
| --- | --- |
| `manifest.json` | Test catalogue, CSV paths, plot-column mappings and export time. |
| `tests.csv` | Test identifiers, material links, stress/void-ratio states, correction status and row counts. |
| `materials.csv` | Available composition, liquid limit, specific gravity and clay fraction. |
| `shear/<LabID>.csv` | Every saved shear measurement row, in acquisition order; no downsampling. |
| `compression/<LabID>.csv` | Initial point and valid t100 consolidation-stage points, in stage order. |
| `parameters/master_rate_effects_table.csv` | Existing cross-test material/state metadata and rate-effect fits. |
| `parameters/Paper_specimen_rate_effect_parameters.csv` | Existing specimen-level paper parameters and fit diagnostics. |
| `parameters/Paper_gamma_excluded_stages.csv` | Recorded exclusions from rate-parameter interpretation. |
| `provenance.csv` | Input result filenames, local modification times, sizes and SHA-256 checksums. |

Join tests and parameter tables by `LabID`. Join `tests.MaterialID` to
`materials.SoilComposition`. The manifest uses paths relative to itself.
Missing numerical values are blank or `NaN` in CSV and `null` in JSON: never
interpret them as zero. Boolean CSV fields are 0/1.

## Standard plots

Select tests from the manifest and load only their corresponding CSV files.
Use a consistent colour per test in all panels.

| Plot | x column | y column | Source |
| --- | --- | --- | --- |
| Deviator stress versus shear strain | `ShearStrain_pct` | `q_kPa` | shear |
| Effective stress path | `p_eff_kPa` | `q_kPa` | shear |
| Excess pore-water pressure versus shear strain | `ShearStrain_pct` | `ExcessPorePressure_kPa` | shear |
| Compression path | `p_eff_kPa` | `VoidRatioCorrected` | compression |

Absolute pore-water pressure is also available as `PorePressure_kPa`.
For the shear plots use `PlotValid == 1`; keep invalid rows as gaps rather
than connecting across them. Downloads retain all rows. `StageNumber`
identifies rate stages, and the measured `AxialStrainRate_pct_min` can be
shown in hover labels. It is not the commanded rate.

Compression points are **stage points, not a continuous consolidation
measurement history**. A logarithmic pressure axis can be offered; all
exported compression pressures are positive.

## Definitions and corrections

- Stress and pressure: kPa. Time: seconds. Strain: percent, not a fraction.
- Shear strain is the project's `(2/3)*(axial strain - radial strain)`,
  referenced to the start of shearing. See `Subscripts/script_data_processing.m`.
- The exporter uses the same compliance-status check and stress/strain
  selection as `Subscripts/plot_common_series_paper.m`. Corrected columns
  are selected only when `is_compliance_correction_applied` returns true.
  For these tests, mean effective stress is recomputed as radial pressure
  plus corrected q/3 minus pore-water pressure.
- `*BeforeCompliance*` columns retain the source stress-corrected quantities
  before any machine-compliance adjustment; these are not raw instrument data.
- `ExcessPorePressure_kPa` is absolute pore-water pressure minus its value at
  the first row satisfying `PlotValid`, matching the common paper plots.
- `VoidRatioUnshifted = SpecificVolume - 1`. The corrected void ratio adds
  `e_f_eq51 - e_f_volumeChange`, matching `Plot_compression_curves_paper.m`.
  The initial compression point is shifted by that same amount. The saved
  void-ratio results have already been rounded by the original processing.
- `AxialStrainRate_pct_min` is the saved measured rate, calculated from
  smoothed axial strain and time in minutes by the processing script.
- `PlotValid` requires finite plotted shear quantities and positive p'.
  `SourceRow` is the 1-based row in the saved MATLAB `shear_data` table.
- `HasRadialDrainage` describes the configured consolidation drainage setup,
  not whether shearing was drained. `ComplianceCorrectionApplied` reflects
  the saved data's actual status, not merely a requested configuration flag.

## Material properties and interpreted parameters

`materials.csv` is extracted from the saved master results table without
filling gaps. K, B and SW denote kaolin K1, bentonite and Speswhite;
`K_pct`, `B_pct`, `SW_pct`, `wL_pct` and `CF_pct` are percentages.
`Gs` is dimensionless. `tests.Gs_Input` is the separate specimen-processing
input, retained explicitly rather than used to fill missing material Gs.
`OCR` is dimensionless. The nominal consolidation pressure from metadata is
kept separate from the measured end-consolidation pressure.

Parameter CSVs are copies of existing results, with their original headers
and precision. Consult `Analysis_rate_effect_comparison_v1_11.m` and the
paper analysis scripts for fit definitions. Retain `FitOK`, sample-count,
R-squared, uncertainty and model/basis fields when displaying fits. The two
parameter tables contain different interpretations and must not be merged
as if their similarly named parameters were identical. Parameter exclusion
records do not remove measurement rows from the exported shear data.

## Coverage and limitations

- Only the 13 tests in `triax_test_config.m` are exported. Legacy SP1 and
  duplicate results under the nested `RateEffects/` directory are excluded.
- A9 has measurement and compression data but no row in the saved master
  material/parameter table. Its metadata remains missing and is flagged in
  both `tests.csv` and the manifest.
- Raw acquisition and specimen-input files are absent from this checkout.
  These exports are processed data, not a replacement for a raw-data archive.
- This is a snapshot of existing saved results. Exporting does not rerun or
  certify the currency of the underlying parameter fits. Provenance preserves
  which source results were used.
- No publication DOI has been assigned by this export.

## Licence

The data in `data/` and the accompanying research documentation, including
this README, are licensed under the Creative Commons Attribution 4.0
International licence (CC BY 4.0). See [LICENSE-DATA](LICENSE-DATA) and the
[official licence](https://creativecommons.org/licenses/by/4.0/).
When sharing or adapting these materials, credit the dataset creators,
link to the source and licence, and indicate any changes.

Original software in this folder, including `export_data.m` and any website
code, is licensed under the MIT License; see [LICENSE-CODE](LICENSE-CODE).
These scopes are separate: the data are not offered under MIT, and the code
is not offered under CC BY 4.0. Third-party material retains any separately
stated licence. These licences apply to this public-data folder, not to
other files in the parent analysis repository.

## Regenerate

From the `RateEffects` directory in MATLAB:

```matlab
addpath('github');
export_data
```

The exporter reads only the canonical `Processed data and results` folder,
overwrites the generated files in `github/data`, and verifies the exported
shear row counts and core plot values against the loaded source tables.
It does not modify the input results, commit, push or publish the files.

## Interactive viewer

See [VIEWER.md](VIEWER.md) for features, local preview, data refresh and GitHub Pages deployment instructions.

The viewer provides four interactive plots, multiple-test comparisons, material properties, parameter tables, full-resolution CSV downloads and SVG figure export.

### University logo

The Aarhus University department logo in `assets/au-logo.png` was supplied as
`alt-logo-t-1a171b-en.pdf`. It is reproduced as supplied, with surrounding blank
space removed for display. The university logo is excluded from this repository's
MIT and CC BY 4.0 licences; rights remain with its respective owner.

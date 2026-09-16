# Data files and void-ratio definitions

The scientific data distributed here are `materials.csv`, `shear/<LabID>.csv`
and `compression/<LabID>.csv`. Fitted rate-effect parameters are not included.
`manifest.json` stores specimen metadata, source provenance, units/bases and
file paths for the viewer. `preview/` contains reduced plotting copies.

## Two void-ratio bases

Void ratio is e = V_v / V_s and is dimensionless. Both exported series retain
the same measured increments in specimen volume. They differ by a constant
offset for each specimen, not by smoothing or a strain-dependent correction.

### `VoidRatioInitialWaterContent` — unshifted

Previously named `VoidRatioUnshifted`. The initial water content is used with
initial wet specimen mass to estimate dry mass. Initial specimen volume and
assumed particle specific gravity then define the initial void ratio:

```
m_d = m_i / (1 + w_i)
V_s = m_d / (G_s * rho_w)
e_i = V_i / V_s - 1
e_unshifted(t) = e_i + DeltaV(t) / V_s
```

- `w_i`: initial gravimetric water content, expressed as a mass fraction
  (divide percent water content by 100).
- `m_i`: initial wet specimen mass; `m_d`: estimated dry mass.
- `V_i`: initial specimen volume from measured dimensions.
- `G_s`: assumed particle specific gravity used in specimen processing,
  stored as `Gs_Input` in the manifest's test metadata.
- `rho_w`: water density; units must be consistent with mass and volume.
- `DeltaV(t)`: measured specimen volume change relative to the initial
  reference, positive for volume increase and negative for compression.

This is a volume/dry-mass calculation; it does not set the initial void ratio
equal to w_i * G_s or require that equality. In the processing code it is
`SpecificVolume - 1`. Specimen volume is held constant during undrained
shearing at its end-of-consolidation value.

### `VoidRatioFinalWaterContentShifted` — shifted

Previously named `VoidRatioCorrected`. Final measured water content and the
assumed particle specific gravity define a final void-ratio reference under
the assumption of full saturation (S_r = 1):

```
e_f,water = w_f * G_s
delta_e = e_f,water - e_unshifted,end
e_shifted(t) = e_unshifted(t) + delta_e
```

Here `w_f` is final gravimetric water content as a mass fraction. The physical
relation is S_r * e = w * G_s, so e = w * G_s requires full saturation.
`e_unshifted,end` is the saved end-of-consolidation void ratio, which is also
the constant void ratio maintained during undrained shearing.

The implementation uses the saved values `e_f_eq51 - e_f_volumeChange` for
`delta_e`. These references were rounded in the original analysis, so the
shifted measurement series may differ slightly from the rounded final
water-content reference. It is a reference shift, not a full recalculation
using a new dry mass. It preserves Delta e and the slope of e versus log(p').

The viewer's compression plot uses `VoidRatioFinalWaterContentShifted`.
The shift is separate from any machine-compliance correction to shear strain
and stress. Both void-ratio columns are supplied in every shear/compression CSV.
The renamed columns contain exactly the same numerical values as their former
counterparts; this revision changes labels and documentation only.

## Other columns and interpretation

- Stress and pressure are in kPa; time in seconds; strain in percent.
- `ShearStrain_pct` is (2/3) * (axial strain - radial strain), referenced to
  the start of shearing, with the saved compliance correction if applied.
- `q_kPa` and `p_eff_kPa` are the processed deviator and mean effective stress.
- `PorePressure_kPa` is absolute pore pressure; `ExcessPorePressure_kPa`
  subtracts the value at the first valid plotted shear row.
- `AxialStrainRate_pct_min` is the saved measured rate, not a fitted
  rate-effect parameter and not the commanded rate.
- `StageNumber` identifies the test stage. `SourceRow` is the 1-based row in
  the source MATLAB shear table. `PlotValid` is the saved plotting validity
  mask (0/1); downloads retain invalid rows as well as valid ones.
- `*BeforeCompliance*` columns retain the processed quantities before
  machine-compliance adjustment. They are not raw instrument measurements.
- Compression CSVs contain the initial state and valid saved consolidation
  stage points at t100, not continuous consolidation histories.
- In `materials.csv`, K, B and SW denote kaolin K1, bentonite and Speswhite.
  Composition, liquid limit `wL_pct` and clay fraction `CF_pct` are percent;
  `Gs` is dimensionless. Material `Gs` and specimen-processing `Gs_Input`
  are separate source entries and must not be treated as interchangeable.
- Missing metadata stays blank, `NaN` or JSON `null`; it does not mean zero.
  A9 has shear/compression data but no material entry in the saved master table.

Original acquisition files are not included. All exported curves are processed
results; see the provenance within `manifest.json` for source-result filenames
and hashes. Data and documentation are licensed under CC BY 4.0.

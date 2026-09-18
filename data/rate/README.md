# Rate-analysis inputs and definitions

`<LabID>.json` contains `total` rows exported from the saved automatic reference
analysis, `plastic` rows from the existing K1 R analysis, and initial `stiffness`
diagnostics. Missing/nonfinite numeric values are JSON null. No shear preview
curves are used to calculate these results. `manifest.json` records source
filenames and SHA-256 hashes. There are 12 analysed specimens; A9 is unavailable.

## Normalization and coordinates

- `r_step = RateRatioAfterBefore`; `r_ref = RateRatioToReference`.
- Step departures: `DeltaRateMax` / `DeltaRateEnd`, after subtracting the
  preceding stage's last averaged reference departure.
- Reference departures: `DeltaMax` / `DeltaEnd`.
- `q_max_ref = qPeak`, the saved reference-trajectory maximum.
- Step q0 and (q/p')0: `Metric0PreviousStage`, the preceding stage's final
  averaged measured metric. For q this equals `q0PreviousStage`.
- Reference q0 and (q/p')0: `ReferenceMetricAtMax` / `ReferenceMetricEnd`,
  evaluated on the reference trajectory at the response strain.
- Maximum step strain: `epsStageStart + DeltaRateEpsMax`; maximum reference
  strain: `epsMax`; end strain: `epsEnd`. Units are percent.
- Pre-/post-peak classification uses each response strain and its own domain's
  `DomainPeakStrain`, so q and q/p' need not have the same branch.
- Pointwise gamma: saved magnitude `abs(Delta q/qPeak)/abs(log10(r))`.
- Nominal reference-rate stages (`IsReferenceRateStage=1`) are excluded from
  reference sensitivity even if the measured ratio is slightly different from 1.

## Fits and downloads

Fits use `y = coefficient * log10(r)` with no free intercept, independently for
pre- and post-peak points. Beta applies iterative residual rejection using
3.5 times the MAD-derived robust sigma, up to 10 iterations, as in the original
MATLAB analysis. Gamma fits use ordinary least squares. Beta outliers stay
visible as crosses. Fits require at least two finite observations with positive,
nonunit rate ratios. R² is centred: `1 - SSE/sum((y-mean(y))^2)`; it can be
negative and is unavailable for constant responses. Slope standard error uses
`NUsed - 1` degrees of freedom. Every finite fit is shown; `FitAccepted` means
R² is at least 0.70, not that a physical model is independently validated.

The fit-table CSV contains beta_step, beta_ref, normalized gamma_qp_step/ref,
gamma_max_step/ref, gamma_end_step/ref, and K1 gamma_R_step, together with R²,
standard error, branch, fit method, counts and reference basis. Gamma_max/end
fits use the **signed** Delta q/qPeak response versus log10(r), rather than a
mean of the pointwise magnitude coefficients. Gamma_qp is normalized by
(q/p')0, which differs from unnormalized gamma_n in older analysis outputs.

End fits use `PersistentReached` from the saved analysis (Step mode). This is
not a recomputed reference-mode persistence criterion. Nonpersistent endpoint
values remain visible as crosses. Downloads follow specimen and branch
selection; the plot-group selector only changes which figures are visible.

## Existing K1 plastic analysis

Only A7, A8, F2, D1 and D3 have this analysis. R = sigma'_v/sigma'_h =
`(3+2q/p')/(3-q/p')`. R maxima were recalculated in R space, with the previous
stage's departure subtracted, using the existing total-strain reference.
`R0` is the preceding stage's final averaged measured R.

Estimated plastic strain uses the initial 0.05%-strain tangent, subtracts
elastic strain, then clips at zero and enforces nondecreasing accumulation.
The raw and constrained plastic coordinates are preserved in the R summaries.
`EstimatedPlasticStrainAtStepMax_pct` is interpolated from the saved K1 curves
at each q maximum; missing coordinates remain null. The K1 q-state panel
retains the same total-reference q response and normalization. Hover labels and
stage CSVs provide estimated plastic strain; **no equal-plastic-strain reference
has been reconstructed**. Early A7 plastic strain is especially uncertain under
the initial-tangent approximation.

Data and research documentation: CC BY 4.0, as in the parent dataset.

## Displaying rate-ratio groups

Delta-response plots split each specimen/branch into approximate rate-ratio
series. Circles, squares and upward triangles denote step ratios near 0.2,
0.5 and 10, respectively; reference groups are near 0.2, 1 and 2. Filled/open
markers distinguish pre-/post-peak points. Diamonds denote other ratios;
beta outliers remain crosses. Group membership requires relative deviation
of at most 50%; overlapping candidates use the smallest logarithmic distance.
These are display groups, not inferred commanded-rate settings. The measured
ratios still determine every x value and fit. Legends name each specimen/ratio
series and can toggle it; the stage-value CSV adds `RateRatioGroup` alongside
`RateRatio`. Legend visibility does not refit coefficients or filter downloads.

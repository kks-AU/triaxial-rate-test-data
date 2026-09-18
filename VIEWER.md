# Interactive data explorer

The site runs entirely in the browser. It provides test and material selection,
four Plotly charts, absolute/excess pore-pressure switching, logarithmic/linear
compression axes, optional stage markers, CSV downloads and SVG figure export.
The selected test IDs are saved in the URL, so comparisons can be bookmarked.

## Publish with GitHub Pages

1. Commit and push the viewer files, `scripts/`, `.github/workflows/pages.yml`,
   `package.json` and `data/preview/` to this repository's `main` branch.
2. Open the repository's **Settings → Pages** and choose **GitHub Actions** as
   the build/deployment source.
3. In **Actions**, run **Deploy data explorer to GitHub Pages**, or push another
   commit. The workflow rebuilds the plot data and publishes the website.
4. After successful deployment, the viewer will be at
   <https://kks-au.github.io/triaxial-rate-test-data/>.

The workflow packages only the website, data and licence files. It does not
publish `.git`, analysis scripts or workflow source as website content.
Alternatively, with the generated preview data committed, GitHub Pages can
serve `main` at `/ (root)` using its branch-based deployment setting.

## Refresh after changing data

With Node.js 22 or later installed, run from this repository:

```sh
node scripts/build-preview.mjs
```

There are no npm dependencies to install. The GitHub Actions workflow performs
this step automatically on pushes to `main`. For a local preview, use any static
HTTP server from the repository root, for example `python -m http.server 8000`,
then open `http://localhost:8000`. Opening `index.html` directly as a file will
not work because browsers restrict fetching local data files.

## Plot data and scientific meaning

`data/preview/catalogue.json` combines the test catalogue, material properties
and void-ratio definitions. Each `<LabID>.json` contains a reduced shear series
and every exported compression point. Browser selection loads these files on
demand and caches them for the current page session. Full-resolution downloads
link directly to the original CSV files; the viewer does not rewrite them.

The build script separates stages and intervals marked invalid by `PlotValid`.
Within each segment, it retains endpoints and bucket minima/maxima of strain,
q, p', absolute and excess pore pressure, and corrected void ratio. Points stay
in source order and no new experimental values are interpolated. Null rows
separate segments so the charts do not connect across invalid intervals.
Hover labels include the source CSV row, stage and measured axial strain rate.
This reduction is for visual exploration, not for numerical fitting.

Compression lines connect the initial state and valid saved consolidation-stage
points, not a continuous time series. Missing material metadata remains unavailable, including for A9. Saved rate-analysis summaries and fitted parameters are available on `rate-analysis.html`. See data/README.md for the two void-ratio bases.

## External assets and licences

Plotly.js 2.35.2 loads from `cdn.plot.ly` under its MIT licence. DM Sans and
Manrope load from Google Fonts, with system-font fallbacks. An internet
connection is required for Plotly; a visible error is shown if it cannot load.
The application's code is MIT licensed; the research data and documentation
are CC BY 4.0, as described in the main README.

## Rate-analysis page

`rate-analysis.html` provides all 13 requested rate plots, specimen/material
selection, pre-/post-peak filtering, SVG figure export, and CSV downloads of
coefficients and plotted stage values. Test selections carry between pages and
are saved in the URL. A9 has no saved rate-reference analysis. The existing K1
plastic analysis is available for A7, A8, F2, D1 and D3; it retains a total-strain
reference and provides estimated plastic strain as an additional coordinate.

Refresh its analysis summaries from the separate MATLAB project:

```sh
python3 scripts/export-rate-data.py /path/to/RateEffects
npm test
```

The exporter reads original saved analysis CSVs, not the reduced shear preview.
`data/rate/manifest.json` records the source filenames and SHA-256 hashes. The
rate JSON files are committed inputs to GitHub Pages; the workflow does not
need the private/local MATLAB analysis checkout. `npm run build` still refreshes
only the original shear/compression preview.

Fit equations and normalization are documented in the page and
[data/rate/README.md](data/rate/README.md). The companion MATLAB function
`Plot_rate_analysis.m` in the RateEffects project offers matching `Tests`,
`Plots`, `Branch`, `ShowFits`, `Export`, `Formats` and `OutputDir` options.

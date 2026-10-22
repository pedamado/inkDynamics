# Zig Chinese Brush Calibration Analysis (v2)

This document details the image analysis of the physical ink test specimens (`fig1` through `fig5`) and explains how they have been translated into the mathematical and computational model for the **Zig Chinese Brush (v2)**.

---

## 1. Visual Analysis of Reference Images

### A. Initial Contact: Asymmetric "Tibia Bone-Head" Flange (`fig4_bone_heads.jpg`)
* **Observation:** When the flexible brush lands on paper, the long hair cone bends sideways, creating a distinct, angled trapezoidal-elliptical stamp that resembles the articular head of a tibia bone.
* **Orientation:** Typically tilted at an angle ($\sim 20^{\circ}-35^{\circ}$ relative to the stroke axis) with rounded upper lobes and a narrower neck where dragging commences.
* **Implementation:** `_drawBoneHeadStart(ctx, x, y)` draws an asymmetric bezier flange connecting the landing lobes to the initial stroke trajectory.

### B. Longitudinal Starvation Stripes (`fig5_starvation_stripes.jpg` & `fig1_starts_ends.jpg`)
* **Observation:** The stroke does not fade into a uniform semi-transparent gray when moving fast. Instead, the ink remains **100% saturated, crisp, jet black**, while **individual sub-lines (hair bristles) run dry**.
* **Physics:** Fluid delivery from the brush belly cannot keep pace with the contact velocity ($v_{\text{drag}} > v_{\text{capillary}}$). Certain bristles exhaust their ink reserve, leaving crisp white longitudinal tracks between active black filaments.
* **Implementation:** The brush is modeled as an array of $N$ discrete virtual bristles ($N \in [18, 54]$). Each bristle tracks its own ink reserve $R_i \in [0, 1]$. When $R_i < 0.08$, that specific bristle ceases drawing, leaving an uninked gap.

### C. Stroke Endings: Tapered Flick vs. Engorged Stop (`fig1_starts_ends.jpg`)
* **Lift-off at speed:** The stroke tapers down into a fine, razor-sharp point or a small group of trailing dry bristle tracks.
* **Decelerated stop:** Slowing down allows capillary refill to surge, producing an engorged, fully black, slightly swollen ending cap.
* **Implementation:** Handled in `up(point, ctx)` based on instantaneous terminal speed.

### D. Hesitation Knots & Dynamic Contrast (`fig3_width_knots.jpg`)
* **Observation:** Mid-stroke pauses or decelerations immediately expand into organic, rounded-trapezoidal knots along the shaft.
* **Implementation:** Handled by nonlinear speed-to-width pooling with instantaneous dwell detection.

---

## 2. The 4 Calibrated Presets

| Preset | Base Radius | Width Behavior | Speed Response | Refill & Starvation |
| :--- | :--- | :--- | :--- | :--- |
| **1. Fine (Low Width Variation)** | $3.5\,\text{px}$ | Drawn thin; very little variation at normal speed | Almost disappears at extreme speed | Subtle engorgement when slow |
| **2. Fine-Thick (High Contrast Dun)** | $4.5\,\text{px}$ | Thin at normal speed; massive $4.5\times$ swell when slow | High dynamic contrast | Large, solid black puddles and hesitation knots |
| **3. Medium (High Dynamic & Starvation)** | $10.0\,\text{px}$ | Flared bone-head starts; expressive width | Pronounced longitudinal starvation stripes at speed | Tapered flick lift-off or engorged decelerated cap |
| **4. Medium (Uniform Width with Starvation)**| $9.0\,\text{px}$ | Consistent stroke width ($1.15\times$ max swing) | Retains width across speeds | Clear longitudinal bristle tracks when moved fast |

---

## 3. Real-time Telemetry Metrics
The top-right HUD now tracks:
- **Inking Bristles:** Real-time count of active vs starved bristles (e.g. `24/36 (12 starved)`).
- **Velocity:** Instantaneous motion speed in $\text{px/s}$.
- **Effective Stroke Width:** Calculated width in $\text{px}$.
- **Dynamic State Badges:** `BONE-HEAD START`, `SOLID BLACK`, `STARVATION STRIPES`, `SLOW / SWELLING`, `FAST SWEEP`.

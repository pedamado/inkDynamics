# Physics of Ink & Writing Instruments

This document outlines the mathematical and physical foundations of the **Ink Dynamics** simulation engine, modeling ink rheology, paper friction, and the mechanical behaviors of traditional and modern inking instruments.

---

## 1. Kinematics & Velocity-Dependent Inking

### Velocity & Acceleration
Given a discrete sequence of pointer/gaze samples $(x_i, y_i, t_i)$:
$$\vec{v}_i = \frac{\vec{p}_i - \vec{p}_{i-1}}{t_i - t_{i-1}}, \quad s_i = \|\vec{v}_i\|$$
$$\vec{a}_i = \frac{\vec{v}_i - \vec{v}_{i-1}}{t_i - t_{i-1}}$$

### Speed-to-Width & Pooling Dynamics
In physical calligraphy:
- **Low Velocity ($s \to 0$):** Capillary flow from the reservoir continues unabated while paper contact remains stationary, causing ink swelling (engorgement):
  $$W(s) = W_{\text{base}} \cdot \left[ 1 + \kappa_{\text{engorge}} \cdot \left(1 - \frac{s}{s_{\text{slow}}}\right)^2 \right]$$
- **High Velocity ($s \gg s_{\text{slow}}$):** Viscous resistance and finite capillary delivery outpace the contact speed, causing line thinning and dry brush striations:
  $$W(s) \approx W_{\text{base}} \cdot \left[ \kappa_{\text{min}} + (1 - \kappa_{\text{min}}) \cdot e^{-\lambda s} \right]$$

---

## 2. Fluid Mechanics & Gravity Dripping

### Critical Drip Threshold
A droplet breaks away from an ink pool when gravitational potential energy overcomes the capillary surface tension holding the meniscus to the paper fibers:
$$\text{Bo} = \frac{\rho g L^2}{\sigma} > \text{Bo}_{\text{crit}}$$
Where:
- $\rho$ is ink density.
- $g$ is gravity ($9.8 \, \text{m/s}^2$).
- $L$ is pool diameter.
- $\sigma$ is surface tension.

### Viscous Deceleration of Running Drips
Once a drip detaches and runs down a vertical or tilted surface, its downward velocity is governed by the balance of gravity, viscous shear, and paper tooth friction:
$$m \frac{dv}{dt} = m g_{\text{eff}} - \gamma_{\text{visc}} v - F_{\text{paper}}$$
Integrating yields an asymptotic stopping profile where the drip progressively slows down and halts, leaving a tapered bead with a rounded head:
$$v(t) = v_0 e^{-\frac{\gamma}{\eta} t}$$

---

## 3. Stick-Slip Friction & Blade Chatter in Ruling / Folded Pens

### The Mechanical Oscillator
A folded pen or ruling pen consists of two thin flexible metal blades (steel or folded aluminum from a beverage can) pressed against textured paper. When dragged:
1. **Stick Phase:**
   The blade tip catches on paper micro-fibers ($v_{\text{rel}} = 0$). As the artist's hand advances, elastic spring deflection $\Delta x$ accumulates:
   $$F_{\text{spring}} = k_{\text{blade}} \cdot \Delta x$$
2. **Slip Phase:**
   When spring force exceeds static Coulomb friction:
   $$F_{\text{spring}} > \mu_s \cdot F_{\text{normal}}$$
   The blade violently snaps forward ($v_{\text{slip}} \gg v_{\text{hand}}$) with natural resonance frequency:
   $$\omega_n = \sqrt{\frac{k_{\text{blade}}}{m_{\text{blade}}}}$$

### Visual Manifestations
- **Rhythmic Edge Wave:** The high-frequency transverse vibration $\delta_\perp(t) = A \sin(\omega_n t + \phi)$ creates a characteristic wavy, scalloped boundary along the stroke.
- **Micro-Dashed Skipping:** At high velocities, normal force vibrations cause the blade to bounce clear of paper tooth valleys, producing interrupted dashed lines.
- **Blade Snap Spatter (Ink Bursts):** The sudden deceleration when the snapping blade hits the end of its travel exceeds the Weber number critical limit:
  $$\text{We} = \frac{\rho v_{\text{snap}}^2 d_{\text{nozzle}}}{\sigma} > 12$$
  Flinging violent bursts of directional micro-droplets forward and outward!

---

## 4. Multi-Bristle Mechanics & Chinese Brush *Feibai* (飞白)

### Footprint Transition
The long, ultra-soft hairs of a Chinese calligraphy brush (e.g. Zig brush) exhibit extreme compliant deformation:
- Held vertically on the tip: contact area is a circular point ($d \approx 1-2 \, \text{mm}$).
- Dragged or pressed flat: the conical hair bundle collapses sideways into an elongated diagonal ellipse with eccentricity:
  $$e = \sqrt{1 - \left(\frac{b}{a}\right)^2} \approx 0.92$$
  Oriented along the resultant of pen tilt angle and trailing drag inertia.

### *Feibai* (Flying White) Meniscus Rupture
Capillary bridges hold ink between adjacent bristles. When stroke velocity exceeds the fluid replenishment speed:
$$v_{\text{stroke}} > v_{\text{capillary}} = \frac{\sigma \cos \theta_c}{2 \eta r_{\text{fiber}}}$$
The liquid film ruptures, causing the center of the brush to starve while outer bristles scrape over high paper fibers, producing iconic "flying white" calligraphy striations.

---

## 5. Posca Squeezer & Chisel Marker Dynamics

### Posca Squeezer (Mop)
- Soft, porous felt dome with large diameter ($15-25 \, \text{mm}$).
- Non-flexible tip: stroke width varies only slightly ($10-25\%$).
- Fast movement exhausts pore surface ink faster than the internal valve can supply, producing longitudinal track stripes.
- Pausing or turning deposits excessive fluid volume, triggering multiple parallel gravity drip runs.

### Posca Chisel / Square Nib
- Flat rectangular profile with width $W$ and height $H$.
- Travel at direction $\theta$ relative to fixed nib orientation $\phi$:
  $$W_{\text{effective}}(\theta) = |W \cos(\theta - \phi) + H \sin(\theta - \phi)|$$
- Forms sharp calligraphic ribbon strokes with crisp flat terminations.

---

## 6. Overprint, Transparency & Capillary Swell (v4.0)

### Transparent Ink
No drawing ink is perfectly opaque: a stroke laid on paper lets a little of the substrate — and of any ink already
there — show through. InkDynamics 4.0 lays every colour at a density $\rho$ (default 0.97): the colour seen is
$S = \rho\,C + (1-\rho)\,B$, where $B$ is what lies beneath (the paper, or earlier ink). Because $S$ is computed and
then painted opaque, the many sub-steps of one stroke never pile up into darker bands — a physical stroke does not
darken itself either.

### Overprinting = Subtractive Mixing
Where wet ink crosses earlier ink, the pigments act as filters in series: each absorbs part of the light the other
lets through — a subtractive (multiply) mix, $M = C \cdot B / 255$ per channel. Yellow over blue goes green, red over
yellow stays red, two blacks get blacker, and a light ink drawn through a dark one picks up its darkness (white over
black turns grey). The blending intensity sets how far the crossing goes toward $M$.

### Picking Up & Carrying Pigment
A nib that enters wet ink loads it at once; once out, it keeps depositing the mixed ink for a while, fading back to
its own colour as its reservoir refreshes. Hence an asymmetric envelope: a short approach length (the mix comes in
within a fraction of the nib's radius) and a longer release length (a few radii).

### Capillary Swell by Viscosity & Drying
Paper fibres already wetted by earlier ink offer less resistance: the new ink spreads further across them and the line
swells. How much depends on the ink:
- **low-viscosity, fast-running, quick-drying drawing ink (ruling pens):** it runs on and dries before it can pool —
  **≈ 5 %**;
- **slow-running, low-viscosity sumi (the Zig brush):** it soaks in more slowly — **≈ 7.5 %**;
- **high-viscosity acrylic (the Posca mop):** it sits on the surface and pools — **≈ 10 %**.

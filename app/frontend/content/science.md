<!-- Text of the Science page. Text between COPY START and COPY END is shown on the page; a line [VISUAL name] places a figure; [IMAGE PLACEHOLDER IMG-x] lines name the figures set in app/science/page.tsx. -->

## S0. Hero

COPY START
# Reading a molecule from its fingerprint of broken pieces
A mass spectrometer breaks a molecule apart and weighs the pieces. This project asks: can a machine learn, from those pieces alone, what kind of drug it was?
COPY END

---

## S1. Why this project exists

COPY START
## Why I built this

New drugs appear faster than laboratories can describe them. A lab that finds an unknown powder first compares its spectrum to a library of known substances. When the compound is new, nothing in the library matches, and that search has nothing to say.

But a new compound is often a small change to an old one: a new synthetic opioid still looks like a fentanyl, a new synthetic cannabinoid still looks like the ones before it. Its spectrum shares pieces with its relatives. So even when the exact compound is unknown, the *kind* of compound may be readable.

This project builds that first hint. You give it a spectrum, and it says which family and which class of drug it most resembles, and how sure it is. It also says "uncertain" when it is not sure.

**What it is not.** It does not identify a compound, and it does not replace laboratory confirmation. It is a student project on a public research library, tested on held-out compounds that were not used to train or choose the model. The [Results](/results) page shows exactly how well it works, including where it fails.

Related reading: [designer drug](https://en.wikipedia.org/wiki/Designer_drug), [new psychoactive substance](https://en.wikipedia.org/wiki/New_psychoactive_substance), [forensic chemistry](https://en.wikipedia.org/wiki/Forensic_chemistry).
COPY END

---

## S2. What a mass spectrometer does

COPY START
## The instrument: a scale for molecules

A [mass spectrometer](https://en.wikipedia.org/wiki/Mass_spectrometry) does three things.

1. **Ionize.** It gives the molecules an electric charge, because only charged particles can be steered by electric fields. These charged molecules are [ions](https://en.wikipedia.org/wiki/Ion).
2. **Sort.** It separates the ions by their [mass-to-charge ratio](https://en.wikipedia.org/wiki/Mass-to-charge_ratio), written *m/z*. For an ion with one charge, m/z is simply its mass. Different instruments sort them in different ways, for example with a [quadrupole](https://en.wikipedia.org/wiki/Quadrupole_mass_analyzer) or by flight time ([time of flight](https://en.wikipedia.org/wiki/Time-of-flight_mass_spectrometry)).
3. **Detect.** A detector counts the ions that arrive at each m/z.

The result is a [mass spectrum](https://en.wikipedia.org/wiki/Mass_spectrum): a plot with m/z along the bottom and the number of ions (intensity) up the side. Each vertical line is a peak. The strongest peak is called the base peak, and the others are measured against it.

A spectrum tells you the weight of the whole molecule (the *precursor* peak) and the weights of the pieces it broke into. Two different molecules rarely break into exactly the same pieces. That is why a spectrum works like a fingerprint.
COPY END

[IMAGE PLACEHOLDER IMG-S1] Alt text: "Diagram of a mass spectrometer: sample enters the ion source, ions are sorted in the analyzer and counted at the detector."

---

## S3. This library: DART and in-source fragmentation

COPY START
## How the data in this project was made

The spectra come from the NIST "Locust" library of forensic compounds. Every compound was measured the same way.

**DART.** The ionization method is [DART (direct analysis in real time)](https://en.wikipedia.org/wiki/Direct_analysis_in_real_time), an [ambient ionization](https://en.wikipedia.org/wiki/Ambient_ionization) technique. A stream of heated gas (here, helium) carries energy to a sample held in open air, and the sample's molecules become ions without any preparation. Every spectrum here is in *positive mode*: the main ion is the molecule plus one proton, written [M+H]⁺ ([protonation](https://en.wikipedia.org/wiki/Protonation)).

**Three fragmentation levels.** After ionization the ions are pushed through a region where they collide with gas. The harder the push, the more they break apart. This is [in-source fragmentation](https://en.wikipedia.org/wiki/Fragmentation_(mass_spectrometry)). The library records every compound three times, at LOW, MID and HIGH.

- **LOW**: almost nothing breaks. You mostly see the intact molecule, which tells you its weight.
- **HIGH**: much of it breaks. You see the pieces, which hint at its structure.
- **MID**: in between.

Together the three levels give both the weight and the pieces, which is why the model uses all three.

The library has 1,570 compounds and 4,761 spectra. The project can only be used with spectra measured in the same way: positive-mode DART-MS with these three levels.
COPY END

[IMAGE PLACEHOLDER IMG-S2] Alt text: "A DART ion source with a sample held in the heated gas stream."

---

## S4. Structure elucidation

COPY START
## How chemists read a spectrum: structure elucidation

[Structure elucidation](https://en.wikipedia.org/wiki/Structure_elucidation) is the work of deducing what a molecule looks like when you only have measurements of it. Chemists combine several techniques:

- **Mass spectrometry** gives the weight, and the pieces it breaks into.
- [**NMR spectroscopy**](https://en.wikipedia.org/wiki/Nuclear_magnetic_resonance_spectroscopy) shows how the atoms are connected.
- [**Infrared spectroscopy**](https://en.wikipedia.org/wiki/Infrared_spectroscopy) shows which functional groups are present.

In a mass spectrum, the key move is subtraction. If the whole molecule weighs 337 and a strong peak sits at 188, then a piece weighing 149 broke off. Chemists know the weights of common pieces (for example 18 for water, 17 for ammonia), so the differences between peaks point to the parts the molecule is made of. This lost piece is called a [neutral loss](https://en.wikipedia.org/wiki/Neutral_loss).

A trained chemist reads a spectrum like this one peak at a time. It works, but it is slow, needs expertise, and works best on one compound at a time.
COPY END

[IMAGE PLACEHOLDER IMG-S3] Alt text: "An NMR spectrum and an infrared spectrum of an organic compound."

---

## S5. How this inspired the project

COPY START
## From reading one spectrum to learning patterns

Structure elucidation reads one spectrum and asks: what *exactly* is this molecule? I started from a different question: not *what exactly*, but *what kind*.

The observation is that related molecules break in related ways. A molecule is a core with small variations, and the core decides many of the pieces. In this library, 81% of the labeled nitazenes show a peak at m/z 100 in their HIGH spectrum, and 89% of the labeled tryptamines show one at m/z 160. These are not hand-written rules. They are patterns that appear again and again across a family.

A person can learn a few such patterns by experience. A computer can learn hundreds at once from examples. So instead of deducing a structure, the model learns which combinations of peaks go with which family of drug, then sums the families into a class.
COPY END

---

## S6. What the model sees

COPY START
## From a spectrum to 3,929 numbers

A model cannot read a picture of a spectrum. It needs a list of numbers, the same length for every compound. This section builds that list step by step, on real compounds of the library. Pick one here and every figure below follows it.

[VISUAL s6-picker]

### 1. Clean the spectrum

A raw spectrum has dozens or hundreds of peaks, measured in counts that depend on how much sample went into the instrument and on how the instrument was tuned that day. Cleaning makes spectra comparable. Below is the same spectrum before and after; the dashed grey peaks are the ones the cleaning removes.

[VISUAL s6-raw-clean]

The cleaning is five small steps. Call the raw intensities $x_i$, one for each peak $i$. Press Next to watch each step change the spectrum.

[VISUAL s6-stepper]

1. **Scale.** Divide every intensity by the strongest one: $\tilde{x}_i = x_i / \max_j x_j$. The strongest peak becomes 1 and the spectrum no longer depends on the amount of sample.
2. **Drop noise.** Remove the peaks with $\tilde{x}_i < 0.005$, that is below 0.5% of the strongest. They are mostly electronic noise and add numbers without adding information.
3. **Keep the best.** Keep the 200 largest peaks. Some spectra have over 1,000 peaks, others 10 or fewer; this caps the work and keeps every compound on the same footing.
4. **Take the square root.** $y_i = \sqrt{\tilde{x}_i}$. A peak at 1% of the strongest becomes 10%, so the small peaks, which often carry the information that tells relatives apart, are not drowned by the large one.
5. **Equalize the length.** Divide by the length of the whole spectrum: $\hat{y}_i = y_i / \lVert y \rVert_2$ with $\lVert y \rVert_2 = \sqrt{\sum_i y_i^2}$. Every level of every compound now has length 1, so two spectra differ by their shape and not by their overall size. This is the same quantity the cosine similarity below is built on.

### 2. Put the spectra in a row

The model needs the same number of inputs for every compound, but spectra have different numbers of peaks. The answer is a ruler: slots one m/z unit wide, from 0 to 649. Peak $i$ goes into slot $b_i = \lfloor m/z_i \rfloor$, and a slot keeps its strongest peak, $v_b = \max_{i:\, b_i = b} \hat{y}_i$, or 0 if no peak falls in it. That is 650 numbers for each of the three fragmentation levels (LOW, MID, HIGH). The precursor $m/z$ divided by 650 is added at the end, so the first part of the row has $3 \times 650 + 1 = 1{,}951$ numbers.

[VISUAL s6-joined]

### 3. What the slots throw away

The instrument measures masses to four decimals, and a whole-unit slot keeps none of them. Yet the decimals say a lot about which atoms a piece contains. So 1,978 more numbers are computed from the exact masses, in four groups called A to D.

#### Group A: the mass defect (6 numbers)

Carbon is defined as exactly 12. Every other atom is a little off a whole number: hydrogen is 1.007825 (+0.0078), nitrogen 14.0031 (+0.0031), oxygen 15.9949 (−0.0051), fluorine 18.9984 (−0.0016), sulfur 31.9721 (−0.0279), chlorine 34.9689 (−0.0311) and bromine 78.9183 (−0.0817). The **mass defect** of a mass $m$ is how far it lies from the nearest whole number:

$$\delta = m - \operatorname{round}(m)$$

A molecule rich in hydrogen has a positive defect; one with oxygen, chlorine or bromine has a lower one. The figure shows all 1,570 precursors, the two shapes marking the parity of the whole mass. That parity follows the **nitrogen rule**: a molecule with an even number of nitrogens has an even mass, and its ion, one hydrogen heavier, has an odd whole mass; with an odd number of nitrogens it is the other way round. The feature `odd mass` is $\operatorname{round}(m/z) \bmod 2$, a cheap way to tell the model whether the number of nitrogens is even or odd.

[VISUAL s6-defect]

Group A has six numbers: the parity above; the defect $\delta$ of the precursor; the **Kendrick defect**, which uses a ruler where $\mathrm{CH_2}$ weighs exactly 14, $KM = m \cdot \dfrac{14}{14.01565}$ and $KMD = \operatorname{round}(KM) - KM$, so that compounds that differ only by $\mathrm{CH_2}$ groups share it; and, for each level, the intensity-weighted mean defect of the fragments, $\bar{\delta} = \dfrac{\sum_i \hat{y}_i\, \delta_i}{\sum_i \hat{y}_i}$.

[VISUAL s6-a-values]

#### Group B: the formula behind the precursor (10 numbers)

If the mass is exact enough, only a few formulas fit it. The neutral molecule weighs $M = (m/z) - 1.007825$, because the ion carries one extra hydrogen atom (checked on the true formulas of the library). The search lists every combination of carbon (1 to 50), nitrogen (0 to 10), oxygen (0 to 12), sulfur (0 to 2), fluorine (0 to 6), chlorine (0 to 3) and bromine (0 to 2) whose ratios to carbon are usual for molecules (the "golden rules" of Kind and Fiehn); hydrogen fills the rest, $n_\mathrm{H} = \operatorname{round}\big((M - M_\mathrm{heavy}) / 1.007825\big)$. A formula is kept if

$$\lvert M - M_\mathrm{formula} \rvert \le 5 \times 10^{-6}\, M + 0.0005, \qquad \mathrm{DBE} = n_\mathrm{C} - \frac{n_\mathrm{H} + n_\mathrm{F} + n_\mathrm{Cl} + n_\mathrm{Br}}{2} + \frac{n_\mathrm{N}}{2} + 1 \in \{0, 1, 2, \dots\}$$

where DBE counts the rings and double bonds, and so cannot be a fraction or negative. Several formulas can still survive, so each gets a weight that falls with its mass error (in ppm) and with every rare element it contains (sulfur, fluorine, chlorine, bromine, $r$ of them):

$$w = \exp\!\Big(-\tfrac{1}{2}\big(\tfrac{\mathrm{ppm}}{0.3}\big)^2\Big) \cdot 0.3^{\,r}$$

The ten numbers are weighted averages over the candidates: the number of C, N, O, S, F, Cl and Br atoms, DBE, hydrogens per carbon, and the logarithm of the number of candidates. It is a way of telling the model "this compound has about two nitrogens and one oxygen" without ever being told the name.

[VISUAL s6-formula]

#### Group C: neutral losses (3 × 650 numbers)

A fragment tells what stayed in the piece that was measured; the **neutral loss** tells what left. For a peak at $(m/z)_i$ and a precursor $m_\mathrm{precursor}$ the loss is $\ell_i = m_\mathrm{precursor} - (m/z)_i$. Two close relatives often differ by a group on the part that stays in the fragments. All their fragments then shift, and their spectra look different. Their losses do not shift: they break off the same pieces. So each spectrum is binned a second time, by loss instead of by m/z, into 650 slots per level. The figure compares two relatives with the **cosine similarity** of their binned spectra, $\cos\theta = \dfrac{a \cdot b}{\lVert a \rVert\, \lVert b \rVert}$, which is 1 for the same shape and 0 for no peak in common.

[VISUAL s6-losses]

#### Group D: summaries of each spectrum (12 numbers)

Four numbers per level that the bins cannot express well: the number of peaks that survived the cleaning; the m/z of the strongest peak; the share of the intensity above half the precursor, $\dfrac{\sum_{m_i > m_\mathrm{precursor}/2} \hat{y}_i}{\sum_i \hat{y}_i}$, which tells whether the molecule broke into small pieces or stayed large; and the intensity of the intact ion, the peak within 0.02 of the precursor mass, or 0 if there is none.

[VISUAL s6-d-values]

#### Scaling

Each new number is divided by a fixed constant, $x' = x / d$, so that every column lies between about −1 and 1, like the bins (for example the number of peaks is divided by 200, the m/z of the strongest peak by 650, DBE by 25). Without it the numbers measured in hundreds would dominate the others in the model.

### 4. The whole row

Put it all end to end: $1{,}951 + 6 + 10 + 1{,}950 + 12 = 3{,}929$ numbers. Nothing else goes in: not the name, not the structure, not the family.

[VISUAL s6-barcode]

### 5. What was tried and dropped

- **Reducing the numbers before the model** (PCA or SVD, keeping 50 to 200 directions): it did not help and it made the model worse at telling the class "other" apart, so it was dropped.
- **Finer slots, the isotope pattern and the formulas of the fragments:** left out; each would need more work than this project could justify.
- **The equal-length step** made no difference for one method and a small gain for another, so it was kept.

The exact-mass groups were the part that helped most: with them, the first test score (self-training with logistic regression) rose clearly, while the cleaning and the slots alone were not enough to tell close relatives apart.
COPY END

---

## S7. Families and classes

COPY START
## Two levels: families, then classes

A spectrum reflects a molecule's **structure**. A drug's class (stimulant, opioid, and so on) is about its **effect on the body**. Two molecules with different structures can have similar effects, and two with similar structures can differ. So the model works in two steps:

1. It predicts the **family**, a group of chemically similar compounds, such as the [fentanyl](https://en.wikipedia.org/wiki/Fentanyl) type or the [tryptamines](https://en.wikipedia.org/wiki/Tryptamine). There are 19.
2. The families are added up into 7 **classes** using a fixed table that I made: [stimulant](https://en.wikipedia.org/wiki/Stimulant), [depressant](https://en.wikipedia.org/wiki/Depressant), [opioid](https://en.wikipedia.org/wiki/Opioid), [cannabinoid](https://en.wikipedia.org/wiki/Cannabinoid), [psychedelic](https://en.wikipedia.org/wiki/Psychedelic_drug), [dissociative](https://en.wikipedia.org/wiki/Dissociative) and *other* (steroids, ordinary medicines and everything else I picked by hand).

The families and the table were chosen by me and are not a standard. Every one of the 637 labeled compounds was checked by me before it was used. The remaining 933 compounds in the library were left unlabeled on purpose.

Two ways of turning family probabilities into a class (adding them up, or taking the class of the single most likely family) are compared on the [Results](/results) page.
COPY END

---

## S8. The semi-supervised idea

COPY START
## Learning from compounds nobody labeled

Labeling a compound takes research, so I could only label 637 of the 1,570. The other 933 have spectra but no label. A *supervised* model would ignore them. A *semi-supervised* model tries to use them.

The method that worked best is called [self-training](https://en.wikipedia.org/wiki/Semi-supervised_learning). It works in rounds:

1. Train on the labeled compounds.
2. Predict the unlabeled ones. Keep only the predictions the model is very sure of (70% or more).
3. Treat those as if they were labeled, and train again.
4. Repeat until no confident predictions are left.

The risk is clear: if the model is confidently wrong, it teaches itself the mistake. Self-training was compared with three other semi-supervised methods (co-training, label spreading and cluster-then-label) on the [Results](/results) page, where it scored best.
COPY END

---

## S9. Why machine learning, not deep learning

COPY START
## Why classical machine learning

This project is for a machine-learning course, so I used classical machine-learning methods inside the semi-supervised ones: [logistic regression](https://en.wikipedia.org/wiki/Logistic_regression), a [support vector machine](https://en.wikipedia.org/wiki/Support_vector_machine), [k-nearest neighbours](https://en.wikipedia.org/wiki/K-nearest_neighbors_algorithm) and [k-means clustering](https://en.wikipedia.org/wiki/K-means_clustering). I did not use [deep learning](https://en.wikipedia.org/wiki/Deep_learning). The choice also suits the data:

- **The labeled set is small.** 637 compounds, of which 511 were used for training. Deep networks usually need far more labeled examples than that to work well.
- **The input is already a clean row of numbers.** After the cleaning above, a simple model can use it directly.
- **A small model is easy to run.** The final model is a table of weights and fits in a few hundred kilobytes, so the app answers quickly on a free server.
- **It is easier to check.** With a simple model I could test each step honestly, as the Results page shows.

The data tells you whether more labels would help. When I trained the same model with only a share of the labels, the score kept rising as I added more, and it had not flattened at 100%. That points to labeling as the limit, not to the choice of algorithm.
COPY END


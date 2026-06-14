// Life-expectancy model (satirical/art-installation estimate — NOT medical fact).
//
// Base: a compact period life table (approx. US, both sexes) giving annual
// mortality q(x). From it we derive a survival curve S(t) and remaining life
// expectancy e(x). On top of that we apply hazard modifiers inferred from a
// person's news mentions — acute events (hospitalized, shot, crash) spike
// near-term hazard; chronic ones (illness) raise it persistently. This is the
// mechanism that makes "TMZ says X is in the ICU" lower X's expectancy.

const round = (n, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Annual probability of death q(x) at anchor ages; log-linear interpolation
// between anchors. Both-sexes, rounded approximations.
const Q_ANCHORS = [
  [1, 0.0004], [5, 0.0001], [10, 0.0001], [15, 0.0003], [20, 0.0009],
  [25, 0.0012], [30, 0.0015], [35, 0.002], [40, 0.0026], [45, 0.0038],
  [50, 0.0056], [55, 0.008], [60, 0.012], [65, 0.018], [70, 0.027],
  [75, 0.043], [80, 0.067], [85, 0.1], [90, 0.16], [95, 0.24],
  [100, 0.33], [105, 0.43], [110, 0.55], [115, 0.7],
];

function qx(age) {
  const a = clamp(age, 0, 119);
  if (a <= Q_ANCHORS[0][0]) return Q_ANCHORS[0][1];
  for (let i = 1; i < Q_ANCHORS.length; i++) {
    const [x1, q1] = Q_ANCHORS[i];
    if (a <= x1) {
      const [x0, q0] = Q_ANCHORS[i - 1];
      const f = (a - x0) / (x1 - x0);
      return q0 * Math.exp(Math.log(q1 / q0) * f); // log-linear
    }
  }
  return 0.85;
}

const sexFactor = (sex) => (sex === "M" ? 1.5 : sex === "F" ? 0.7 : 1);

// Build a survival curve from `startAge` and the implied remaining life
// expectancy. `chronicMult` scales baseline mortality persistently (illness);
// `acuteExcess` is an extra near-term death probability (a gunshot/ICU spike)
// that decays over ~1.5 years.
function project(startAge, sex, { chronicMult = 1, acuteExcess = 0 } = {}, maxYears = 75) {
  const sf = sexFactor(sex);
  let s = 1;
  let le = 0.5; // half-year correction
  const curve = [{ t: 0, s: 1 }];
  for (let t = 1; t <= maxYears; t++) {
    const age = startAge + t - 1;
    const excess = acuteExcess * Math.exp(-(t - 1) / 1.5); // fades ~1.5yr
    let q = qx(age) * sf * chronicMult + excess;
    q = clamp(q, 0, 0.999);
    s *= 1 - q;
    le += s;
    curve.push({ t, s: round(s, 4) });
    if (s < 0.01) break;
  }
  return { le, curve };
}

// ---- inference from text ----

// Small, intentionally-limited first-name → likely sex map (heuristic only).
const FEMALE = new Set([
  "mary", "patricia", "jennifer", "linda", "elizabeth", "barbara", "susan",
  "jessica", "sarah", "karen", "nancy", "lisa", "betty", "margaret", "sandra",
  "ashley", "kimberly", "emily", "donna", "michelle", "carol", "amanda",
  "anna", "alix", "amelia", "keke", "vanessa", "tyra", "rosie", "harper",
  "greta", "ingrid", "beatrice", "priya", "junko", "eleanor", "tina", "billie",
]);
const MALE = new Set([
  "james", "john", "robert", "michael", "william", "david", "richard", "joseph",
  "thomas", "charles", "christopher", "daniel", "matthew", "anthony", "mark",
  "donald", "steven", "paul", "andrew", "joshua", "kenneth", "kevin", "brian",
  "george", "edward", "ronald", "aldon", "marcus", "walter", "samuel", "henry",
  "tomas", "rex", "dex", "gene", "joe", "alan", "lee", "gordon", "ernest",
]);
function inferSex(name) {
  const first = (name || "").trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "");
  if (FEMALE.has(first)) return "F";
  if (MALE.has(first)) return "M";
  return null;
}

function extractCurrentAge(mentions) {
  for (const m of mentions) {
    const text = `${m.title || ""} ${m.description || ""}`;
    let mt =
      text.match(/\b(\d{1,3})[\s-]year[\s-]old\b/i) ||
      text.match(/\baged?\s+(\d{1,3})\b/i) ||
      text.match(/\bturns?\s+(\d{1,3})\b/i) ||
      text.match(/,\s*(\d{1,3})\s*,/);
    if (mt) {
      const n = parseInt(mt[1], 10);
      if (n >= 1 && n <= 115) return n;
    }
  }
  return null;
}

// Event hazard rules.
//   kind "acute"    -> `amount` is an immediate excess death probability
//   kind "chronic"  -> `amount` is a persistent mortality multiplier
//   kind "mitigate" -> `amount` is a factor applied to the acute total (<1)
const RISK_RULES = [
  { re: /\b(gun\s?shot|shooting|shot dead|shot and|fatally shot|shot (?:in|outside|multiple|several|to death)|\bshot\b|stabbed|gunfire|opens? fire)\b/i, label: "VIOLENCE", kind: "acute", amount: 0.28 },
  { re: /\b(overdose|\bo\.?d\.?d?\b)\b/i, label: "OVERDOSE", kind: "acute", amount: 0.18 },
  { re: /\b(hospitaliz|in the hospital|\bicu\b|intensive care|critical condition|life support|on a ventilator|coma|unresponsive|rushed to)\b/i, label: "HOSPITALIZED", kind: "acute", amount: 0.15 },
  { re: /\b(crash|collision|accident|wreck|injured|injury|hit by)\b/i, label: "ACCIDENT", kind: "acute", amount: 0.08 },
  { re: /\b(surgery|operation|undergoes)\b/i, label: "SURGERY", kind: "acute", amount: 0.03 },
  { re: /\b(cancer|tumou?r|diagnos|terminal|stroke|heart attack|disease|chronic|ailing|hospice)\b/i, label: "ILLNESS", kind: "chronic", amount: 1.8 },
  { re: /\b(arrested|jailed|charged|prison|indicted)\b/i, label: "LEGAL", kind: "chronic", amount: 1.05 },
  { re: /\b(recover|released from|out of the hospital|healthy|clean bill|in good spirits|doing (?:great|well)|on the mend)\b/i, label: "RECOVERY", kind: "mitigate", amount: 0.4 },
];

function riskModifiers(mentions) {
  const best = new Map(); // label -> rule + source
  for (const m of mentions) {
    const text = `${m.title || ""} ${m.description || ""}`;
    for (const rule of RISK_RULES) {
      if (rule.re.test(text)) {
        if (!best.has(rule.label)) {
          best.set(rule.label, { ...rule, source: m.sourceCode });
        }
      }
    }
  }
  return [...best.values()].map((m) => {
    let display;
    let worse;
    if (m.kind === "acute") {
      display = `+${Math.round(m.amount * 100)}% NEAR-TERM`;
      worse = true;
    } else if (m.kind === "chronic") {
      display = `×${m.amount} ONGOING`;
      worse = m.amount > 1;
    } else {
      display = `−${Math.round((1 - m.amount) * 100)}% MITIGATION`;
      worse = false;
    }
    return { label: m.label, kind: m.kind, amount: m.amount, source: m.source, display, worse };
  });
}

const DEFAULT_ASSUMED_AGE = 50;

export function buildLifeModel({ name, age, status, mentions = [] }, now = Date.now()) {
  const year = new Date(now).getFullYear();
  const sex = inferSex(name);

  if (status === "settled") {
    // Contract is closed; report the realized outcome (and what an average
    // cohort member of that age/sex would still have been expected to get).
    return {
      status: "settled",
      sex,
      ageAtDeath: age ?? null,
      realized: true,
    };
  }

  const detected = extractCurrentAge(mentions);
  const ageKnown = detected != null;
  const startAge = ageKnown ? detected : DEFAULT_ASSUMED_AGE;

  const modifiers = riskModifiers(mentions);
  let chronicMult = 1;
  let acuteExcess = 0;
  let mitigate = 1;
  for (const m of modifiers) {
    if (m.kind === "chronic") chronicMult *= m.amount;
    else if (m.kind === "acute") acuteExcess += m.amount;
    else mitigate *= m.amount;
  }
  chronicMult = clamp(chronicMult, 0.3, 6);
  acuteExcess = clamp(acuteExcess * mitigate, 0, 0.7);

  const base = project(startAge, sex, {});
  const adj = project(startAge, sex, { chronicMult, acuteExcess });
  const hazard = round((adj.le && base.le ? base.le / adj.le : 1), 2); // >1 means worse

  return {
    status: "open",
    sex,
    age: startAge,
    ageKnown,
    baseLE: round(base.le),
    adjustedLE: round(adj.le),
    hazard,
    projectedAge: Math.round(startAge + adj.le),
    projectedYear: year + Math.round(adj.le),
    modifiers,
    curve: adj.curve,
    baseCurve: base.curve,
    confidence: ageKnown ? (sex ? "MED" : "LOW") : "LOW",
  };
}

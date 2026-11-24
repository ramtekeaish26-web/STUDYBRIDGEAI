import {
  ExperimentScenario,
  FocusSession,
  QuizAttempt,
  QuizBank,
  SimplifiedLesson,
  StudentSettings,
  TopicMasteryRecord,
  TutorModelId,
  TutorRoleId,
  TutorThread,
  WeeklyStudyDay,
} from '../types/study';

export const INITIAL_SETTINGS: StudentSettings = {
  studentName: 'Aarav',
  academicFocus: 'STEM & AP Foundations',
  defaultLevel: 'Intermediate',
  defaultLanguage: 'English',
  weeklyQuizGoal: 6,
  showInstantFeedback: true,
  autoSaveLessons: true,
};

export const INITIAL_WEEKLY_ACTIVITY: WeeklyStudyDay[] = [
  { day: 'Mon', minutes: 35, quizzes: 1 },
  { day: 'Tue', minutes: 48, quizzes: 1 },
  { day: 'Wed', minutes: 25, quizzes: 0 },
  { day: 'Thu', minutes: 62, quizzes: 2 },
  { day: 'Fri', minutes: 40, quizzes: 1 },
  { day: 'Sat', minutes: 55, quizzes: 1 },
  { day: 'Sun', minutes: 30, quizzes: 0 },
];

export const INITIAL_LESSONS: SimplifiedLesson[] = [
  {
    id: 'lesson-cellular-respiration',
    topic: 'Cellular Respiration & ATP',
    title: 'How Cells Turn Glucose into Usable ATP Energy',
    subject: 'Biology',
    level: 'Intermediate',
    language: 'English',
    readMinutes: 5,
    summary:
      'Cellular respiration breaks down glucose step-by-step in the presence of oxygen to charge adenosine triphosphate (ATP), the universal energy currency of living cells.',
    definition:
      'Cellular respiration is the controlled metabolic pathway (glycolysis, pyruvate oxidation, the Krebs cycle, and oxidative phosphorylation) that converts chemical energy stored in glucose into approximately 30 to 32 ATP molecules per glucose.',
    coreMechanism: [
      'Glycolysis (cytosol): One 6-carbon glucose splits into two 3-carbon pyruvate molecules, yielding 2 net ATP and 2 NADH without requiring oxygen.',
      'Pyruvate Oxidation & Krebs Cycle (mitochondrial matrix): Pyruvate converts to acetyl-CoA and enters a cyclic series of reactions, releasing CO2 and loading high-energy electrons onto NADH and FADH2.',
      'Electron Transport Chain (inner mitochondrial membrane): NADH and FADH2 donate electrons through protein complexes to pump H+ ions across the membrane.',
      'Chemiosmosis via ATP Synthase: H+ ions flow back down their concentration gradient through ATP synthase, spinning the enzyme rotor to phosphorylate ADP into roughly 26–28 ATP.',
    ],
    examples: [
      {
        title: 'Sprinting vs. Marathon Running',
        detail:
          'During an all-out 100m sprint, muscle cells outpace oxygen delivery and rely briefly on glycolysis plus lactic acid fermentation for rapid ATP; marathon runners depend heavily on aerobic oxidative phosphorylation.',
      },
      {
        title: 'Brown Fat Thermogenesis',
        detail:
          'Infants and hibernating mammals express uncoupling protein-1 (UCP1), allowing protons to bypass ATP synthase and release the electrochemical gradient directly as body heat.',
      },
    ],
    analogies: [
      {
        concept: 'ATP vs. Glucose',
        comparison:
          'Glucose is like a $100 bill — rich in value but too bulky for vending machines. ATP is the pocketful of $1 coins every cellular machine accepts immediately.',
      },
      {
        concept: 'Proton Gradient & ATP Synthase',
        comparison:
          'Pumping H+ ions into the intermembrane space is like filling a hydroelectric reservoir behind a dam; ATP synthase is the turbine spinning as water rushes back through.',
      },
    ],
    keyTakeaways: [
      'Oxygen serves as the final electron acceptor at Complex IV, forming water.',
      'Most ATP (~90%) is produced during oxidative phosphorylation, not glycolysis.',
      'NADH and FADH2 act as rechargeable electron taxis linking the Krebs cycle to the electron transport chain.',
      'Without oxygen, only glycolysis continues, regenerating NAD+ through fermentation.',
    ],
    createdAt: '2026-11-22T14:20:00Z',
  },
  {
    id: 'lesson-photosynthesis',
    topic: 'Photosynthesis & Calvin Cycle',
    title: 'Capturing Photons to Build Carbohydrates',
    subject: 'Biology',
    level: 'Intermediate',
    language: 'English',
    readMinutes: 6,
    summary:
      'Photosynthesis converts solar photons, water, and atmospheric carbon dioxide into glucose and oxygen across two tightly coupled stages inside chloroplasts.',
    definition:
      'Photosynthesis is an anabolic process in plants, algae, and cyanobacteria comprising light-dependent reactions on thylakoid membranes and light-independent carbon fixation (the Calvin cycle) in the stroma.',
    coreMechanism: [
      'Light Absorption (Photosystems II & I): Chlorophyll pigments absorb red and blue photons, exciting electrons and splitting water molecules (photolysis) to release O2.',
      'ATP & NADPH Generation: Excited electrons travel down a thylakoid electron transport chain, creating a proton gradient that drives ATP synthase and reduces NADP+ to NADPH.',
      'Carbon Fixation (Calvin Cycle): The enzyme RuBisCO attaches CO2 to 5-carbon RuBP, forming unstable 6-carbon intermediates that immediately split into 3-PGA.',
      'Reduction & Regeneration: ATP and NADPH reduce 3-PGA into G3P (glyceraldehyde-3-phosphate), which builds glucose while recycling RuBP to keep the cycle turning.',
    ],
    examples: [
      {
        title: 'C4 Corn Adaptation in Hot Climates',
        detail:
          'Maize spatially separates initial CO2 capture from the Calvin cycle inside bundle-sheath cells, minimizing wasteful photorespiration on scorching afternoons.',
      },
      {
        title: 'Greenhouse CO2 Enrichment',
        detail:
          'Commercial tomato growers raise indoor CO2 to 800–1000 ppm because higher substrate concentration speeds up RuBisCO carbon fixation when light is plentiful.',
      },
    ],
    analogies: [
      {
        concept: 'Light Reactions + Calvin Cycle',
        comparison:
          'Think of the light reactions as solar panels charging batteries (ATP and NADPH) on the roof, and the Calvin cycle as a 3D printer downstairs using those batteries to assemble sugar.',
      },
    ],
    keyTakeaways: [
      'Oxygen gas released by plants comes from splitting H2O, not from CO2.',
      'The Calvin cycle does not directly require photons, but stops quickly in darkness when ATP and NADPH run out.',
      'RuBisCO is the most abundant enzyme on Earth and catalyzes the entry of inorganic carbon into the biosphere.',
      'G3P is the true three-carbon sugar output used to synthesize glucose, sucrose, and cellulose.',
    ],
    createdAt: '2026-11-21T10:15:00Z',
  },
  {
    id: 'lesson-newtons-laws',
    topic: "Newton's Laws of Motion",
    title: 'Inertia, Net Force, and Action-Reaction Pairs',
    subject: 'Physics',
    level: 'Beginner',
    language: 'English',
    readMinutes: 4,
    summary:
      'Classical mechanics rests on three foundational laws describing how objects resist velocity changes, accelerate under net force, and exchange equal and opposite impulses.',
    definition:
      "Newton's three laws of motion establish the mathematical relationship between forces acting on a body and its resulting translational acceleration in an inertial reference frame.",
    coreMechanism: [
      'First Law (Inertia): An object remains at rest or in uniform straight-line motion unless acted upon by a nonzero net external force.',
      'Second Law (F = ma): Acceleration is directly proportional to the vector sum of forces and inversely proportional to mass (a = ΣF / m).',
      'Third Law (Force Pairs): Whenever object A exerts a force on object B, object B simultaneously exerts a force of equal magnitude and opposite direction back on A.',
    ],
    examples: [
      {
        title: 'Seatbelts During Sudden Braking',
        detail:
          'When a car brakes sharply, friction stops the chassis while your body tends to maintain forward velocity due to inertia until the seatbelt provides a backward net force.',
      },
      {
        title: 'Rocket Propulsion in Vacuum',
        detail:
          'A rocket accelerates in empty space not by pushing against air, but by pushing exhaust gas backward while the gas pushes the rocket forward with equal force.',
      },
    ],
    analogies: [
      {
        concept: 'Mass as Resistance to Change',
        comparison:
          'Pushing an empty shopping cart versus a loaded one with the same shove shows inertia: double the mass cuts your acceleration in half.',
      },
    ],
    keyTakeaways: [
      'Zero acceleration can mean either stationary OR moving at constant velocity.',
      'Always sum all forces as vectors before applying F = ma.',
      'Action-reaction pairs never cancel each other because they act on two different objects.',
      'Mass stays constant across planets, whereas weight (mg) changes with local gravity.',
    ],
    createdAt: '2026-11-20T18:05:00Z',
  },
  {
    id: 'lesson-supply-demand',
    topic: 'Supply & Demand Equilibrium',
    title: 'How Market Prices Clear Shortages and Surpluses',
    subject: 'Economics',
    level: 'Intermediate',
    language: 'English',
    readMinutes: 5,
    summary:
      'Competitive markets converge toward an equilibrium price where the quantity buyers want matches the quantity producers are willing to supply.',
    definition:
      'Market equilibrium occurs at the intersection of the downward-sloping demand curve and upward-sloping supply curve, leaving zero excess supply (surplus) or excess demand (shortage).',
    coreMechanism: [
      'Law of Demand: Lower prices increase quantity demanded because consumers gain purchasing power and substitute away from pricier alternatives.',
      'Law of Supply: Higher prices incentivize firms to expand output as marginal revenues cover higher marginal production costs.',
      'Price Discovery: Above equilibrium, unsold inventory piles up (surplus), pushing prices down; below equilibrium, eager buyers bid prices up (shortage).',
      'Curve Shifts vs. Movements: A price change moves along existing curves, whereas income, input costs, or technology shift an entire curve.',
    ],
    examples: [
      {
        title: 'Seasonal Strawberry Harvests',
        detail:
          'A bumper summer harvest shifts the supply curve rightward, lowering supermarket berry prices and increasing total quantity purchased.',
      },
      {
        title: 'Semiconductor Input Shocks',
        detail:
          'Rising wafer fabrication costs shift chip supply leftward, lifting equilibrium prices and reducing quantity sold until new fabs open.',
      },
    ],
    analogies: [
      {
        concept: 'Equilibrium Price as a Thermostat',
        comparison:
          'Price behaves like a thermostat: too high creates cooling pressure from unsold stock; too low creates heating pressure from empty shelves.',
      },
    ],
    keyTakeaways: [
      'Equilibrium maximizes total economic surplus (consumer + producer surplus) in competitive markets.',
      'Price ceilings held below equilibrium create persistent shortages.',
      'Distinguish carefully between a change in quantity demanded and a shift in the demand curve.',
      'Elasticity determines whether buyers or sellers absorb more of a price or tax shock.',
    ],
    createdAt: '2026-11-19T16:45:00Z',
  },
];

export const INITIAL_QUIZ_BANKS: Record<string, QuizBank> = {
  'Cellular Respiration & ATP': {
    topic: 'Cellular Respiration & ATP',
    subject: 'Biology',
    level: 'Intermediate',
    questions: [
      {
        id: 'cr-1',
        prompt: 'Which stage of cellular respiration takes place in the cytosol and does not require oxygen?',
        options: [
          'Krebs (Citric Acid) cycle',
          'Glycolysis',
          'Oxidative phosphorylation',
          'Pyruvate oxidation',
        ],
        correctIndex: 1,
        explanation:
          'Glycolysis occurs in the cytosol across both aerobic and anaerobic conditions, splitting glucose into two pyruvate molecules.',
      },
      {
        id: 'cr-2',
        prompt: 'What is the direct role of molecular oxygen (O2) in aerobic cellular respiration?',
        options: [
          'It breaks glucose directly during glycolysis',
          'It combines with carbon in the Krebs cycle to form CO2',
          'It serves as the final electron acceptor at the end of the electron transport chain',
          'It phosphorylates ADP directly inside the cytosol',
        ],
        correctIndex: 2,
        explanation:
          'Oxygen accepts low-energy electrons at Complex IV and combines with H+ ions to form water, keeping the electron transport chain flowing.',
      },
      {
        id: 'cr-3',
        prompt: 'Which enzyme uses the electrochemical H+ gradient to synthesize the majority of cellular ATP?',
        options: ['RuBisCO', 'Hexokinase', 'ATP synthase', 'Lactate dehydrogenase'],
        correctIndex: 2,
        explanation:
          'ATP synthase acts as a molecular turbine powered by protons flowing down their gradient across the inner mitochondrial membrane.',
      },
      {
        id: 'cr-4',
        prompt: 'Where do NADH and FADH2 deliver their high-energy electrons?',
        options: [
          'To the inner mitochondrial membrane electron transport chain',
          'Directly to ribosomes for protein folding',
          'To the chloroplast thylakoid lumen',
          'Out of the cell via exocytosis',
        ],
        correctIndex: 0,
        explanation:
          'NADH and FADH2 oxidize at Complexes I and II of the inner mitochondrial membrane, fueling proton pumping.',
      },
      {
        id: 'cr-5',
        prompt: 'If a toxin blocks Complex IV so electrons can no longer pass to oxygen, what happens first?',
        options: [
          'Glycolysis instantly produces 36 ATP',
          'The proton gradient collapses and oxidative phosphorylation halts',
          'The Krebs cycle accelerates to compensate',
          'Cells begin producing O2 gas',
        ],
        correctIndex: 1,
        explanation:
          'Blocking Complex IV backs up the entire electron transport chain, halting proton pumping and stopping ATP synthase.',
      },
    ],
  },
  'Photosynthesis & Calvin Cycle': {
    topic: 'Photosynthesis & Calvin Cycle',
    subject: 'Biology',
    level: 'Intermediate',
    questions: [
      {
        id: 'ps-1',
        prompt: 'Where does the oxygen gas (O2) released during photosynthesis originate?',
        options: [
          'Carbon dioxide (CO2) split by RuBisCO',
          'Water (H2O) split at Photosystem II',
          'Breakdown of glucose in the stroma',
          'Atmospheric nitrogen fixation',
        ],
        correctIndex: 1,
        explanation:
          'Photolysis splits water molecules at Photosystem II to replace excited chlorophyll electrons, releasing O2 as a byproduct.',
      },
      {
        id: 'ps-2',
        prompt: 'Which two energy-carrying molecules link the light-dependent reactions to the Calvin cycle?',
        options: [
          'NADH and FADH2',
          'ATP and NADPH',
          'Glucose and Pyruvate',
          'CO2 and RuBP',
        ],
        correctIndex: 1,
        explanation:
          'Thylakoid light reactions generate ATP and NADPH in the stroma, which power carbon reduction inside the Calvin cycle.',
      },
      {
        id: 'ps-3',
        prompt: 'In which compartment of the chloroplast does the Calvin cycle occur?',
        options: ['Thylakoid lumen', 'Outer membrane', 'Stroma', 'Mitochondrial matrix'],
        correctIndex: 2,
        explanation:
          'The Calvin cycle enzymes, including RuBisCO, are dissolved in the fluid stroma surrounding the thylakoid stacks.',
      },
      {
        id: 'ps-4',
        prompt: 'What key reaction does the enzyme RuBisCO catalyze?',
        options: [
          'Splitting water using blue light',
          'Attaching inorganic CO2 to the 5-carbon sugar RuBP',
          'Transporting sucrose through phloem vessels',
          'Pumping H+ ions out of guard cells',
        ],
        correctIndex: 1,
        explanation:
          'RuBisCO fixes atmospheric CO2 onto ribulose-1,5-bisphosphate (RuBP), initiating organic carbon synthesis.',
      },
      {
        id: 'ps-5',
        prompt: 'Why does the Calvin cycle stop shortly after a plant is placed in complete darkness?',
        options: [
          'Chlorophyll dissolves without sunlight',
          'Stomata permanently seal shut forever',
          'Supplies of light-generated ATP and NADPH are rapidly depleted',
          'Oxygen destroys the stroma in darkness',
        ],
        correctIndex: 2,
        explanation:
          'Although the Calvin cycle does not absorb photons directly, it consumes ATP and NADPH produced exclusively during light reactions.',
      },
    ],
  },
  "Newton's Laws of Motion": {
    topic: "Newton's Laws of Motion",
    subject: 'Physics',
    level: 'Beginner',
    questions: [
      {
        id: 'nl-1',
        prompt: 'A hockey puck slides across frictionless ice at a constant 12 m/s. What is the net horizontal force acting on it?',
        options: ['12 N forward', 'Zero (0 N)', 'Equal to its weight', 'Increasing steadily'],
        correctIndex: 1,
        explanation:
          "By Newton's First Law, constant velocity means zero acceleration, so the net force must be zero.",
      },
      {
        id: 'nl-2',
        prompt: 'If you triple the net force on a cart while keeping its mass unchanged, what happens to its acceleration?',
        options: [
          'It drops to one-third',
          'It stays the same',
          'It triples',
          'It increases ninefold',
        ],
        correctIndex: 2,
        explanation:
          'From a = F_net / m, acceleration is directly proportional to net force when mass is constant.',
      },
      {
        id: 'nl-3',
        prompt: 'A heavy truck collides with a small bicycle. How do the magnitudes of the collision forces compare?',
        options: [
          'The truck exerts a much larger force on the bicycle',
          'The bicycle exerts a larger force on the truck',
          'Both exert forces of equal magnitude and opposite direction',
          'Only the moving object exerts a force',
        ],
        correctIndex: 2,
        explanation:
          "Newton's Third Law states action and reaction forces are always equal in magnitude; the bicycle accelerates more only because its mass is smaller.",
      },
      {
        id: 'nl-4',
        prompt: 'Why do action-reaction force pairs never cancel each other out to produce zero motion?',
        options: [
          'They act at different times',
          'They act on two different objects',
          'Friction destroys one of the forces',
          'One force is always vertical',
        ],
        correctIndex: 1,
        explanation:
          'Only forces acting on the same object sum to determine that object’s net force; action and reaction forces act on separate bodies.',
      },
    ],
  },
  'Supply & Demand Equilibrium': {
    topic: 'Supply & Demand Equilibrium',
    subject: 'Economics',
    level: 'Intermediate',
    questions: [
      {
        id: 'sd-1',
        prompt: 'When the current market price of headphones is set above equilibrium, what occurs?',
        options: [
          'A shortage (excess demand)',
          'A surplus (excess supply)',
          'Both curves shift outward immediately',
          'Zero transactions occur',
        ],
        correctIndex: 1,
        explanation:
          'Above equilibrium, quantity supplied exceeds quantity demanded, creating unsold inventory (a surplus) that pressures prices downward.',
      },
      {
        id: 'sd-2',
        prompt: 'Suppose battery lithium costs drop sharply. How does the electric scooter market adjust?',
        options: [
          'Supply shifts right, lowering equilibrium price and raising quantity',
          'Demand shifts left, raising equilibrium price',
          'Supply shifts left, creating a shortage',
          'Neither curve moves; only consumers change preferences',
        ],
        correctIndex: 0,
        explanation:
          'Lower input costs make production more profitable at every price, shifting supply rightward and clearing at a lower price and higher quantity.',
      },
      {
        id: 'sd-3',
        prompt: 'What is the immediate effect of a binding price ceiling placed below the market equilibrium rent?',
        options: [
          'A persistent surplus of vacant apartments',
          'A persistent housing shortage as quantity demanded exceeds quantity supplied',
          'Instant elimination of demand',
          'Higher equilibrium construction rates',
        ],
        correctIndex: 1,
        explanation:
          'Holding price artificially below equilibrium encourages more renters while discouraging supply, creating a chronic shortage.',
      },
      {
        id: 'sd-4',
        prompt: 'Which change causes a movement ALONG the existing demand curve rather than a shift of the curve?',
        options: [
          'A rise in consumer household income',
          'A change in the good’s own price',
          'A sudden viral trend increasing popularity',
          'A steep drop in the price of a close substitute',
        ],
        correctIndex: 1,
        explanation:
          'Changes in the good’s own price alter quantity demanded along the same curve; non-price determinants shift the entire curve.',
      },
    ],
  },
  'Quantum Entanglement': {
    topic: 'Quantum Entanglement',
    subject: 'Physics',
    level: 'Advanced',
    questions: [
      {
        id: 'qe-1',
        prompt: 'What defines an entangled two-particle quantum state?',
        options: [
          'The particles are physically glued together by strong nuclear force',
          'The joint state cannot be factored into independent single-particle states',
          'Both particles always travel faster than light',
          'Each particle has a hidden classical trajectory',
        ],
        correctIndex: 1,
        explanation:
          'Entanglement means the composite wavefunction is non-separable, creating correlations between measurement outcomes regardless of distance.',
      },
      {
        id: 'qe-2',
        prompt: 'Why cannot quantum entanglement be used to transmit faster-than-light messages?',
        options: [
          'Entanglement breaks after 1 meter',
          'Local measurement outcomes appear completely random without classical communication to compare results',
          'Photons lose polarization in vacuum',
          'Only protons can be entangled',
        ],
        correctIndex: 1,
        explanation:
          'Each observer sees a 50/50 random stream locally; the correlation is only revealed once results are compared via a sub-light classical channel.',
      },
      {
        id: 'qe-3',
        prompt: 'What did experimental violations of Bell inequalities demonstrate?',
        options: [
          'Energy conservation fails at low temperatures',
          'Local hidden-variable theories cannot account for quantum correlations',
          'Electrons lack magnetic spin',
          'Gravity is stronger than electromagnetism',
        ],
        correctIndex: 1,
        explanation:
          'Bell tests confirm that measured quantum correlations exceed the maximum bound allowed by any local hidden-variable theory.',
      },
      {
        id: 'qe-4',
        prompt: 'Which practical technology directly leverages entanglement and no-cloning for security?',
        options: [
          'Internal combustion timing',
          'Quantum Key Distribution (QKD)',
          'Standard AM radio broadcasting',
          'Incandescent lighting',
        ],
        correctIndex: 1,
        explanation:
          'QKD protocols like E91 use entangled photon pairs so any eavesdropper measurably disturbs the quantum correlations.',
      },
    ],
  },
};

export const INITIAL_TOPIC_MASTERY: TopicMasteryRecord[] = [
  {
    topic: 'Cellular Respiration & ATP',
    subject: 'Biology',
    correctAnswers: 4,
    attemptedQuestions: 5,
    previousScorePercent: 60,
    latestScorePercent: 80,
    lastPracticedAt: '2026-11-22T15:00:00Z',
    strongConcepts: ['Glycolysis location & ATP yield', 'Role of oxygen as final electron acceptor', 'ATP synthase chemiosmosis'],
    weakConcepts: ['Complex IV inhibition cascade'],
    revisionAdvice: 'Review how electron transport chain inhibitors impact NADH oxidation and proton gradients.',
  },
  {
    topic: "Newton's Laws of Motion",
    subject: 'Physics',
    correctAnswers: 4,
    attemptedQuestions: 4,
    previousScorePercent: 75,
    latestScorePercent: 100,
    lastPracticedAt: '2026-11-21T19:10:00Z',
    strongConcepts: ['Inertia & constant velocity', 'F = ma proportional scaling', 'Action-reaction pairs on distinct bodies'],
    weakConcepts: [],
    revisionAdvice: 'Strong mastery achieved. Try Advanced 2D inclined-plane problems or Experiment Lab gravity simulations.',
  },
  {
    topic: 'Supply & Demand Equilibrium',
    subject: 'Economics',
    correctAnswers: 2,
    attemptedQuestions: 4,
    previousScorePercent: 50,
    latestScorePercent: 50,
    lastPracticedAt: '2026-11-20T17:30:00Z',
    strongConcepts: ['Excess supply above equilibrium'],
    weakConcepts: ['Curve shifts vs. movements along curves', 'Binding price ceilings'],
    revisionAdvice: 'Revisit how input costs shift supply curves versus how a good’s own price moves along demand.',
  },
  {
    topic: 'Photosynthesis & Calvin Cycle',
    subject: 'Biology',
    correctAnswers: 2,
    attemptedQuestions: 5,
    previousScorePercent: null,
    latestScorePercent: 40,
    lastPracticedAt: '2026-11-19T11:20:00Z',
    strongConcepts: ['Chloroplast stroma compartment'],
    weakConcepts: ['Photolysis oxygen origin', 'RuBisCO carbon fixation', 'Darkness ATP/NADPH depletion'],
    revisionAdvice: 'Priority revision: review the Photosynthesis simplified lesson and retake the 5-question quiz.',
  },
  {
    topic: 'Quantum Entanglement',
    subject: 'Physics',
    correctAnswers: 0,
    attemptedQuestions: 0,
    previousScorePercent: null,
    latestScorePercent: null,
    lastPracticedAt: null,
    strongConcepts: [],
    weakConcepts: [],
    revisionAdvice: 'Not yet tested. Take a diagnostic quiz in Quiz Arena to establish your baseline mastery.',
  },
];

export const INITIAL_QUIZ_ATTEMPTS: QuizAttempt[] = [
  {
    id: 'att-1',
    topic: 'Cellular Respiration & ATP',
    correctCount: 4,
    totalQuestions: 5,
    scorePercent: 80,
    timestamp: '2026-11-22T15:00:00Z',
  },
  {
    id: 'att-2',
    topic: "Newton's Laws of Motion",
    correctCount: 4,
    totalQuestions: 4,
    scorePercent: 100,
    timestamp: '2026-11-21T19:10:00Z',
  },
  {
    id: 'att-3',
    topic: 'Supply & Demand Equilibrium',
    correctCount: 2,
    totalQuestions: 4,
    scorePercent: 50,
    timestamp: '2026-11-20T17:30:00Z',
  },
  {
    id: 'att-4',
    topic: 'Photosynthesis & Calvin Cycle',
    correctCount: 2,
    totalQuestions: 5,
    scorePercent: 40,
    timestamp: '2026-11-19T11:20:00Z',
  },
];

export const SAMPLE_EXPERIMENTS: ExperimentScenario[] = [
  {
    id: 'exp-gravity',
    question: "What if Earth's surface gravity doubled from 9.8 m/s² to 19.6 m/s²?",
    title: 'Planetary Surface Gravity & Atmospheric Compression',
    domain: 'Physics & Earth Science',
    summary:
      'Doubling gravitational acceleration compresses the atmospheric column, halves projectile peak height for a given launch speed, and dramatically increases structural load on living organisms.',
    predictions: [
      {
        metric: 'Projectile Peak Height',
        projectedOutcome: 'Drops by 50% for the same initial upward velocity (h = v² / 2g).',
        confidence: 'Exact analytical law',
      },
      {
        metric: 'Atmospheric Scale Height',
        projectedOutcome: 'Compresses to half (~4.2 km), concentrating air density closer to sea level.',
        confidence: 'High certainty',
      },
      {
        metric: 'Pendulum Period',
        projectedOutcome: 'Swings ~29% faster (T ∝ 1 / √g), speeding up mechanical pendulum clocks.',
        confidence: 'Exact analytical law',
      },
    ],
    parameters: [
      {
        id: 'gravity',
        label: 'Surface Gravity (g)',
        unit: 'm/s²',
        min: 4.9,
        max: 24.5,
        step: 0.7,
        baseline: 9.8,
        value: 19.6,
        sensitivity: 1.0,
      },
      {
        id: 'launchVelocity',
        label: 'Launch Velocity',
        unit: 'm/s',
        min: 10,
        max: 40,
        step: 2,
        baseline: 20,
        value: 20,
        sensitivity: 0.65,
      },
      {
        id: 'atmTemp',
        label: 'Surface Temperature',
        unit: 'K',
        min: 250,
        max: 330,
        step: 5,
        baseline: 288,
        value: 288,
        sensitivity: 0.35,
      },
    ],
    outcomeExplanation: [
      'Because gravitational potential energy scales linearly with g (PE = mgh), lifting any mass requires twice the energy per meter climbed.',
      'Air molecules experience twice the downward pull against thermal kinetic motion, shrinking the atmospheric scale height H = RT / (Mg).',
      'Biological skeletons and tree trunks must thicken cross-sectional area faster than height to avoid buckling under doubled weight.',
    ],
    realWorldApplications: [
      {
        title: 'Exoplanet Habitability Modeling',
        description:
          'Astrophysicists compute scale height and surface gravity on Super-Earths to predict atmospheric retention and flight feasibility.',
      },
      {
        title: 'Centrifuge Structural Testing',
        description:
          'Aerospace engineers spin payloads at 2g–10g to verify joint tolerances during rocket launch acceleration.',
      },
      {
        title: 'Biomechanics & Bone Density',
        description:
          'Understanding gravity loading informs resistance training protocols for astronauts returning from microgravity.',
      },
    ],
    chartSeries: [
      { label: 'Max Jump (cm)', baseline: 50, simulated: 25 },
      { label: 'Scale Height (km)', baseline: 8.5, simulated: 4.25 },
      { label: 'Escape Energy', baseline: 100, simulated: 200 },
      { label: 'Pendulum Freq', baseline: 100, simulated: 141 },
      { label: 'Tree Max Height (m)', baseline: 110, simulated: 55 },
    ],
  },
  {
    id: 'exp-ocean-ph',
    question: 'What if global ocean surface pH dropped from 8.1 to 7.6?',
    title: 'Ocean Acidification & Carbonate Chemistry Shift',
    domain: 'Chemistry & Ecology',
    summary:
      'Because pH is logarithmic, a 0.5-unit drop more than triples hydrogen ion concentration, stripping carbonate ions needed by shell-building marine organisms.',
    predictions: [
      {
        metric: 'Hydrogen Ion Acidity [H+]',
        projectedOutcome: 'Increases by +216% (3.16x more acidic) due to logarithmic pH scaling.',
        confidence: 'Exact chemical law',
      },
      {
        metric: 'Aragonite Saturation (Ω)',
        projectedOutcome: 'Drops below 1.2 in temperate waters, slowing coral & mollusk calcification.',
        confidence: 'High certainty',
      },
      {
        metric: 'Sound Absorption (Low Freq)',
        projectedOutcome: 'Decreases slightly, making oceans acoustically louder for marine mammals.',
        confidence: 'Moderate–High',
      },
    ],
    parameters: [
      {
        id: 'oceanPh',
        label: 'Ocean Surface pH',
        unit: 'pH',
        min: 7.4,
        max: 8.2,
        step: 0.1,
        baseline: 8.1,
        value: 7.6,
        sensitivity: 1.2,
      },
      {
        id: 'co2Ppm',
        label: 'Atmospheric CO2',
        unit: 'ppm',
        min: 280,
        max: 950,
        step: 25,
        baseline: 420,
        value: 750,
        sensitivity: 0.85,
      },
      {
        id: 'waterTemp',
        label: 'Sea Surface Temp',
        unit: '°C',
        min: 10,
        max: 28,
        step: 1,
        baseline: 18,
        value: 21,
        sensitivity: 0.45,
      },
    ],
    outcomeExplanation: [
      'Dissolved CO2 reacts with seawater to form carbonic acid (H2CO3), which dissociates into bicarbonate (HCO3-) and free hydrogen ions (H+).',
      'Extra H+ ions bind preferentially with carbonate ions (CO3²-), starving corals, pteropods, and oysters of the building blocks for calcium carbonate shells.',
      'Cold polar waters absorb more CO2 and experience undersaturation fastest, disrupting foundational food webs.',
    ],
    realWorldApplications: [
      {
        title: 'Pacific Northwest Oyster Hatcheries',
        description:
          'Aquaculture facilities monitor incoming upwelling pH and buffer tanks with sodium carbonate to protect larval shell formation.',
      },
      {
        title: 'Coral Reef Restoration',
        description:
          'Marine biologists breed heat- and acid-tolerant coral strains using controlled seawater mesocosms.',
      },
      {
        title: 'Carbon Capture Measurement',
        description:
          'Oceanographers track ocean alkalinity enhancement as a pathway for durable CO2 mineralization.',
      },
    ],
    chartSeries: [
      { label: 'Relative [H+]', baseline: 32, simulated: 100 },
      { label: 'Carbonate (CO3)', baseline: 100, simulated: 36 },
      { label: 'Calcification Rate', baseline: 95, simulated: 44 },
      { label: 'Dissolved CO2', baseline: 42, simulated: 88 },
      { label: 'Reef Resilience', baseline: 86, simulated: 39 },
    ],
  },
  {
    id: 'exp-interest-rates',
    question: 'What if central banks raise policy interest rates by 300 basis points?',
    title: 'Monetary Tightening & Aggregate Demand Transmission',
    domain: 'Macroeconomics',
    summary:
      'Higher policy rates lift borrowing costs across mortgages, corporate bonds, and consumer credit, cooling inflation with a lagged reduction in investment and spending.',
    predictions: [
      {
        metric: 'Business Capital Investment',
        projectedOutcome: 'Contracts as hurdle rates rise and bond refinancing becomes costlier.',
        confidence: 'High certainty',
      },
      {
        metric: 'Inflation Momentum (12–18 mo)',
        projectedOutcome: 'Moderates downward as aggregate demand aligns closer to productive capacity.',
        confidence: 'High certainty',
      },
      {
        metric: 'Currency Exchange Value',
        projectedOutcome: 'Strengthens relative to lower-yielding currencies as capital inflows increase.',
        confidence: 'Moderate–High',
      },
    ],
    parameters: [
      {
        id: 'rateHike',
        label: 'Policy Rate Change',
        unit: 'bps',
        min: 0,
        max: 500,
        step: 25,
        baseline: 0,
        value: 300,
        sensitivity: 1.0,
      },
      {
        id: 'inflation',
        label: 'Starting Inflation',
        unit: '%',
        min: 1.5,
        max: 8.5,
        step: 0.5,
        baseline: 3.0,
        value: 5.5,
        sensitivity: 0.75,
      },
      {
        id: 'creditPass',
        label: 'Credit Pass-Through',
        unit: '%',
        min: 40,
        max: 100,
        step: 5,
        baseline: 75,
        value: 80,
        sensitivity: 0.6,
      },
    ],
    outcomeExplanation: [
      'Commercial banks reprice variable loans and mortgage offers upward, increasing monthly debt-service ratios for households.',
      'Higher risk-free yields raise the discount rate on future corporate cash flows, cooling speculative growth valuations.',
      'Over 4–6 quarters, slower credit creation eases wage-price pressures while testing highly leveraged sectors.',
    ],
    realWorldApplications: [
      {
        title: 'Corporate Treasury Hedging',
        description:
          'CFOs lock in fixed-rate debt maturities or interest rate swaps ahead of tightening cycles.',
      },
      {
        title: 'Housing Affordability Forecasting',
        description:
          'Urban planners track 30-year mortgage spreads to anticipate construction slowdowns and rental demand shifts.',
      },
      {
        title: 'Central Bank Taylor Rule Calibration',
        description:
          'Policy committees balance output-gap costs against inflation anchoring using forward-looking simulations.',
      },
    ],
    chartSeries: [
      { label: 'Borrowing Cost', baseline: 35, simulated: 92 },
      { label: 'Capex Growth', baseline: 78, simulated: 44 },
      { label: 'Core Inflation', baseline: 85, simulated: 48 },
      { label: 'Savings Yield', baseline: 28, simulated: 84 },
      { label: 'Housing Starts', baseline: 80, simulated: 51 },
    ],
  },
];

export const TUTOR_ROLES: Array<{
  id: TutorRoleId;
  label: string;
  description: string;
  defaultModel: TutorModelId;
}> = [
  {
    id: 'socratic',
    label: 'Socratic Coach',
    description: 'Guides you with targeted questions and hints before revealing the final answer.',
    defaultModel: 'gemini-4-hydrogen',
  },
  {
    id: 'stem-solver',
    label: 'STEM Problem Solver',
    description: 'Breaks down equations, units, and multi-step derivations interactively.',
    defaultModel: 'gemini-4-neon',
  },
  {
    id: 'deep-mentor',
    label: 'Deep Research Mentor',
    description: 'Explores first-principles proofs, edge cases, and deeper mechanisms.',
    defaultModel: 'gemini-4-carbon',
  },
  {
    id: 'quick-explainer',
    label: 'Quick Flash Explainer',
    description: 'Fast, concise summaries and memory hooks when revising quickly.',
    defaultModel: 'gemini-3.1-flash-lite',
  },
];

export const TUTOR_MODELS: Array<{
  id: TutorModelId;
  label: string;
  badge: string;
  description: string;
}> = [
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    badge: 'General + Web Search',
    description: 'Balanced tutoring and live Google Search grounding.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    badge: 'Fast Response',
    description: 'Low-latency explanations and rapid concept checks.',
  },
  {
    id: 'gemini-4-neon',
    label: 'Gemini 4 Neon',
    badge: 'Complex Interactive',
    description: 'Multi-step STEM problem solving and interactive derivations.',
  },
  {
    id: 'gemini-4-carbon',
    label: 'Gemini 4 Carbon',
    badge: 'Deep Reasoning',
    description: 'Rigorous proofs, root-cause diagnostics, and deep analysis.',
  },
];

export const INITIAL_FOCUS_SESSIONS: FocusSession[] = [
  {
    id: 'fs-1',
    durationMinutes: 25,
    focusTopic: 'Cellular Respiration & ATP',
    createdAt: '2026-11-23T16:15:00Z',
  },
  {
    id: 'fs-2',
    durationMinutes: 15,
    focusTopic: 'Photosynthesis & Calvin Cycle',
    createdAt: '2026-11-24T08:30:00Z',
  },
];

export const INITIAL_TUTOR_THREADS: TutorThread[] = [
  {
    id: 'thread-photosynthesis-gap',
    title: 'Calvin Cycle & Light Reactions Link',
    roleId: 'socratic',
    modelId: 'gemini-4-hydrogen',
    useSearchGrounding: false,
    createdAt: '2026-11-24T08:40:00Z',
    updatedAt: '2026-11-24T08:45:00Z',
    messages: [
      {
        id: 'tm-1',
        role: 'user',
        text: 'Why does the Calvin cycle stop in the dark if it is called light-independent?',
        createdAt: '2026-11-24T08:40:00Z',
      },
      {
        id: 'tm-2',
        role: 'model',
        modelId: 'gemini-4-hydrogen',
        text: 'Great question! Even though the Calvin cycle enzymes do not absorb photons directly, two essential energy-carrying inputs come straight from the thylakoid light reactions.\n\nCan you recall which two molecules are charged during the light reactions and spent in the stroma to reduce 3-PGA into G3P?',
        createdAt: '2026-11-24T08:41:00Z',
      },
      {
        id: 'tm-3',
        role: 'user',
        text: 'ATP and NADPH!',
        createdAt: '2026-11-24T08:43:00Z',
      },
      {
        id: 'tm-4',
        role: 'model',
        modelId: 'gemini-4-hydrogen',
        text: 'Exactly right — ATP provides chemical phosphorylation energy and NADPH donates high-energy electrons. Once sunlight disappears, both pools drain within seconds to minutes, so carbon fixation pauses until light returns.',
        createdAt: '2026-11-24T08:45:00Z',
      },
    ],
  },
];


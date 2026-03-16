/**
 * Naada — Shared Constants & Configuration Data
 */

var COURSES = {
    stress_7day: {
        name: "7-Day Stress Relief Journey",
        icon: "spa",
        description: "A progressive journey from tension release to deep inner peace. Each day builds on the last.",
        days: [
            { day: 1, therapy: "tibetan_bowls", duration: 10, title: "Release Tension", meditation: "body_scan" },
            { day: 2, therapy: "solfeggio", duration: 10, title: "Emotional Clearing", meditation: "breathing" },
            { day: 3, therapy: "ocean_waves", duration: 15, title: "Ocean of Calm", meditation: "visualization" },
            { day: 4, therapy: "om_drone", duration: 15, title: "Om Grounding", meditation: "mantra" },
            { day: 5, therapy: "nature_rain", duration: 15, title: "Rain Meditation", meditation: "body_scan" },
            { day: 6, therapy: "chakra_tune", duration: 20, title: "Chakra Balance", meditation: "loving_kindness" },
            { day: 7, therapy: "theta_meditation", duration: 20, title: "Deep Peace", meditation: "visualization" },
        ]
    },
    sleep_5day: {
        name: "5-Day Better Sleep Program",
        icon: "bedtime",
        description: "Train your mind to find deep, restful sleep through progressive sound therapy.",
        days: [
            { day: 1, therapy: "delta_waves", duration: 15, title: "Delta Descent", meditation: "breathing" },
            { day: 2, therapy: "nature_rain", duration: 15, title: "Rain Lullaby", meditation: "body_scan" },
            { day: 3, therapy: "ocean_waves", duration: 20, title: "Ocean Dreams", meditation: "visualization" },
            { day: 4, therapy: "om_drone", duration: 20, title: "Om Lullaby", meditation: "breathing" },
            { day: 5, therapy: "theta_meditation", duration: 20, title: "Theta Sleep", meditation: "body_scan" },
        ]
    },
    focus_3day: {
        name: "3-Day Focus Bootcamp",
        icon: "psychology",
        description: "Sharpen your concentration and mental clarity through targeted frequency training.",
        days: [
            { day: 1, therapy: "binaural_focus", duration: 15, title: "Beta Clarity", meditation: "breathing" },
            { day: 2, therapy: "tibetan_bowls", duration: 15, title: "Bowl Focus", meditation: "mantra" },
            { day: 3, therapy: "chakra_tune", duration: 20, title: "Full Alignment", meditation: "visualization" },
        ]
    },
    meditation_21day: {
        name: "21-Day Meditation Journey",
        icon: "self_improvement",
        description: "Build a lasting meditation habit with daily guided sessions that deepen over 3 weeks.",
        days: Array.from({length: 21}, (_, i) => {
            const therapies = ["om_drone", "tibetan_bowls", "theta_meditation", "solfeggio", "indian_raga", "chakra_tune", "ocean_waves"];
            const meditations = ["breathing", "body_scan", "visualization", "loving_kindness", "mantra"];
            const titles = ["First Breath", "Body Awareness", "Inner Garden", "Heart Opening", "Sound of Om",
                "Chakra Flow", "Ocean Stillness", "Gratitude Wave", "Mountain Peace", "Moonlight Rest",
                "River of Thoughts", "Cloud Gazing", "Starlight Bath", "Forest Walk", "Sunrise Energy",
                "Sacred Space", "Golden Light", "Infinite Sky", "Diamond Mind", "Lotus Bloom", "Unity"];
            return {
                day: i + 1,
                therapy: therapies[i % therapies.length],
                duration: Math.min(10 + Math.floor(i / 3) * 2, 25),
                title: titles[i] || `Day ${i + 1}`,
                meditation: meditations[i % meditations.length],
            };
        })
    }
};

var DIRECT_PLAY_MAP = {
    baby_sleep: { therapy: "nature_rain", label: "Baby Sleep - Gentle Rain" },
    cant_sleep: { therapy: "delta_waves", label: "Sleep - Delta Waves" },
};

var THERAPY_LABELS = {
    tibetan_bowls: "Tibetan Singing Bowls",
    indian_raga: "Indian Raga Drone",
    delta_waves: "Delta Wave Binaural",
    binaural_focus: "Beta Focus Binaural",
    om_drone: "Om Drone (136.1 Hz)",
    solfeggio: "Solfeggio (528 Hz)",
    nature_rain: "Rain & Thunder Ambient",
    ocean_waves: "Ocean Waves",
    theta_meditation: "Theta Meditation (6 Hz)",
    chakra_tune: "7 Chakra Alignment",
    adhd_smr: "ADHD — SMR 13Hz Binaural",
    ptsd_theta: "PTSD — Theta 6Hz @ 432Hz",
    chronic_pain_delta: "Chronic Pain — Delta 2Hz @ 174Hz",
    tinnitus_mask: "Tinnitus — Notched Pink Noise",
    parkinsons_ras: "Parkinson's — 130 BPM RAS",
    aphasia_melody: "Aphasia — MIT Pentatonic",
    gamma_40hz: "Gamma 40Hz — Cognitive",
    generative_raga: "Live AI Raga Composition",
};

var THERAPY_SCIENCE = {
    tibetan_bowls: { hz: "396-528 Hz", name: "Tibetan Singing Bowls", desc: "Dissolves negative energy, reduces cortisol levels", evidence: "Used in Himalayan healing traditions for 3000+ years" },
    indian_raga: { hz: "Pentatonic Scale", name: "Indian Raga Therapy", desc: "Awakens energy through ancient melodic patterns", evidence: "Raga Chikitsa — documented in Ayurvedic medicine" },
    delta_waves: { hz: "1-4 Hz", name: "Delta Binaural Beats", desc: "Promotes deep sleep & cell regeneration", evidence: "Proven to increase growth hormone release during sleep" },
    binaural_focus: { hz: "14-30 Hz", name: "Beta Entrainment", desc: "Enhances concentration & mental alertness", evidence: "Studied at Monroe Institute since 1970s" },
    om_drone: { hz: "136.1 Hz", name: "Earth Frequency (Om)", desc: "Matches Earth's orbital vibration period", evidence: "Calms nervous system, deepens meditation state" },
    solfeggio: { hz: "528 Hz", name: "Love Frequency", desc: "DNA repair & cellular stress reduction", evidence: "Central frequency in Solfeggio healing scale" },
    nature_rain: { hz: "Pink Noise", name: "Rain Ambient Therapy", desc: "Masks intrusive thoughts, promotes calm", evidence: "Studies show 38% faster sleep onset with pink noise" },
    ocean_waves: { hz: "~0.1 Hz Rhythm", name: "Ocean Wave Therapy", desc: "Entrains breathing to natural wave rhythms", evidence: "Reduces blood pressure and heart rate variability" },
    theta_meditation: { hz: "4-8 Hz", name: "Theta Wave Meditation", desc: "Deep meditative state & creativity access", evidence: "EEG-verified brainwave entrainment in clinical studies" },
    chakra_tune: { hz: "7 Frequencies", name: "Full Chakra Alignment", desc: "Root to Crown energy center harmonization", evidence: "Based on ancient Vedic energy body mapping system" },
    generative: { hz: "Live Synthesis", name: "AI Raga Composition", desc: "Unique, never-repeating music — physically-modeled instruments", evidence: "Karplus-Strong strings, procedural raga melodic generation" },
};

var THERAPY_MOOD_MAP = {
    tibetan_bowls: "calm", indian_raga: "happy", delta_waves: "peaceful",
    binaural_focus: "focused", om_drone: "peaceful", solfeggio: "relaxed",
    nature_rain: "peaceful", ocean_waves: "calm", theta_meditation: "peaceful",
    chakra_tune: "relaxed",
};

var CHAKRA_MAP = {
    tibetan_bowls: ["heart", "throat", "third-eye"],
    indian_raga: ["heart", "sacral", "solar"],
    delta_waves: ["root", "sacral"],
    binaural_focus: ["third-eye", "crown"],
    om_drone: ["crown", "third-eye", "throat"],
    solfeggio: ["heart", "throat", "solar"],
    nature_rain: ["root", "sacral", "heart"],
    ocean_waves: ["sacral", "solar", "heart"],
    theta_meditation: ["crown", "third-eye"],
    chakra_tune: ["root", "sacral", "solar", "heart", "throat", "third-eye", "crown"],
};

var THERAPY_FREQ_DATA = {
    tibetan_bowls: { hz: "396–528 Hz", brainwave: "Alpha/Theta", effect: "Stress & fear release" },
    indian_raga: { hz: "Various", brainwave: "Alpha", effect: "Mood elevation, energy" },
    delta_waves: { hz: "1–4 Hz beat", brainwave: "Delta", effect: "Deep sleep, healing" },
    binaural_focus: { hz: "14–30 Hz beat", brainwave: "Beta", effect: "Focus, alertness" },
    om_drone: { hz: "136.1 Hz", brainwave: "Alpha/Theta", effect: "Grounding, inner peace" },
    solfeggio: { hz: "528 Hz", brainwave: "Alpha", effect: "DNA repair, love freq." },
    nature_rain: { hz: "Pink noise", brainwave: "Alpha", effect: "Sleep, stress relief" },
    ocean_waves: { hz: "0.1–0.5 Hz", brainwave: "Delta/Theta", effect: "Deep relaxation" },
    theta_meditation: { hz: "6 Hz beat", brainwave: "Theta", effect: "Deep meditation, REM" },
    chakra_tune: { hz: "174–963 Hz", brainwave: "Full spectrum", effect: "Full body alignment" },
    adhd_smr: { hz: "13 Hz beat", brainwave: "Beta (SMR)", effect: "Sensorimotor rhythm" },
    ptsd_theta: { hz: "6 Hz beat", brainwave: "Theta", effect: "Trauma processing" },
    chronic_pain_delta: { hz: "2 Hz beat", brainwave: "Delta", effect: "Pain modulation" },
    tinnitus_mask: { hz: "5 kHz notch", brainwave: "—", effect: "Tinnitus relief" },
    parkinsons_ras: { hz: "130 BPM", brainwave: "Beta", effect: "Gait entrainment" },
    aphasia_melody: { hz: "196–330 Hz", brainwave: "Alpha/Beta", effect: "Language recovery" },
    gamma_40hz: { hz: "40 Hz beat", brainwave: "Gamma", effect: "Cognitive, memory" },
};

var BRAINWAVE_ZONES = {
    tibetan_bowls: "alpha", indian_raga: "alpha", delta_waves: "delta",
    binaural_focus: "beta", om_drone: "theta", solfeggio: "alpha",
    nature_rain: "alpha", ocean_waves: "delta", theta_meditation: "theta",
    chakra_tune: "alpha", adhd_smr: "beta", ptsd_theta: "theta",
    chronic_pain_delta: "delta", tinnitus_mask: null, parkinsons_ras: "beta",
    aphasia_melody: "alpha", gamma_40hz: "gamma",
};

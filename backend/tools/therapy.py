"""
Therapy Tools
Sound therapy playback, mixing, raga composition, and volume control.
"""

from google.adk.tools.tool_context import ToolContext


def start_therapy(
    therapy_type: str,
    reason: str,
    tool_context: ToolContext,
) -> dict:
    """Start a sound therapy session. This triggers the frontend to play the corresponding sounds.

    Args:
        therapy_type: Type of therapy to play. Must be one of:
            "tibetan_bowls" - Tibetan singing bowl frequencies (396-528 Hz) for stress/anxiety
            "indian_raga" - Raga-inspired tones for low energy/sadness
            "delta_waves" - Delta binaural beats (1-4 Hz) for sleep/rest
            "binaural_focus" - Beta binaural beats (14-30 Hz) for concentration
            "om_drone" - Om frequency (136.1 Hz) for meditation/general wellness
            "solfeggio" - Solfeggio frequencies (528 Hz) for emotional healing
            "nature_rain" - Rain and thunder ambient sounds for sleep and calm
            "ocean_waves" - Ocean wave sounds for deep relaxation
            "theta_meditation" - Theta binaural beats (6 Hz) for deep meditation
            "chakra_tune" - All 7 chakra frequencies layered for full body alignment
            --- CLINICAL / CONDITION-SPECIFIC THERAPIES (synthesized, no files needed) ---
            "adhd_smr" - SMR binaural 13 Hz over 200 Hz carrier — Sensorimotor Rhythm training for ADHD
            "ptsd_theta" - Theta binaural 6 Hz over 432 Hz carrier — trauma processing, nervous system regulation
            "chronic_pain_delta" - Isochronic delta 2 Hz at 174 Hz carrier — chronic pain modulation
            "tinnitus_mask" - Notched pink noise at 5 kHz — tinnitus relief via cortical remapping
            "parkinsons_ras" - Rhythmic Auditory Stimulation at 130 BPM — Parkinson's gait entrainment
            "aphasia_melody" - Melodic Intonation Therapy pentatonic sequence — aphasia language recovery
            "gamma_40hz" - Gamma binaural 40 Hz — Alzheimer's / cognitive function improvement
        reason: Brief explanation of why this therapy was chosen

    Returns:
        dict with therapy session details and frontend instruction
    """
    if "therapy_sessions" not in tool_context.state:
        tool_context.state["therapy_sessions"] = []

    session = {
        "type": therapy_type,
        "reason": reason,
        "mood_at_start": tool_context.state.get("current_mood", "unknown"),
    }
    tool_context.state["therapy_sessions"] = (
        tool_context.state["therapy_sessions"] + [session]
    )
    tool_context.state["active_therapy"] = therapy_type

    return {
        "status": "started",
        "therapy_type": therapy_type,
        "reason": reason,
        "instruction": f"FRONTEND_PLAY:{therapy_type}",
        "total_sessions": len(tool_context.state["therapy_sessions"]),
    }


def mix_therapy(
    layers: str,
    reason: str,
    tool_context: ToolContext,
) -> dict:
    """Create a custom sound mix by layering multiple therapy sounds together.
    Use this to create richer, more personalized soundscapes by combining sounds.

    Args:
        layers: Comma-separated list of therapy_type:volume pairs.
            Each layer is "type:volume" where volume is 0.0-1.0.
            Example: "nature_rain:0.7,tibetan_bowls:0.4,om_drone:0.2"
            Available types: tibetan_bowls, indian_raga, delta_waves, binaural_focus,
            om_drone, solfeggio, nature_rain, ocean_waves, theta_meditation, chakra_tune,
            adhd_smr, ptsd_theta, chronic_pain_delta, tinnitus_mask, parkinsons_ras,
            aphasia_melody, gamma_40hz
        reason: Brief explanation of why this mix was chosen

    Returns:
        dict with mix details
    """
    parsed = []
    for part in layers.split(","):
        part = part.strip()
        if ":" in part:
            t, v = part.split(":", 1)
            parsed.append({"type": t.strip(), "volume": float(v.strip())})
        else:
            parsed.append({"type": part.strip(), "volume": 0.5})

    tool_context.state["active_therapy"] = "mix"
    tool_context.state["active_mix"] = parsed

    return {
        "status": "mix_started",
        "layers": parsed,
        "reason": reason,
        "instruction": "FRONTEND_MIX",
    }


def compose_raga(
    raga: str,
    instrument: str,
    tempo: int,
    with_tabla: bool,
    with_tanpura: bool,
    mood: str,
    reason: str,
    tool_context: ToolContext,
) -> dict:
    """Generate unique, never-repeating live therapeutic music using AI-composed Indian classical raga.
    This creates real-time algorithmic music using physically-modeled instruments (sitar, bansuri flute,
    harp, veena) with procedural melodic generation following raga grammar. Every performance is unique.

    Also use this for "recitation mode" — when you want to recite poetry, mantras, or slokas
    with live-generated background music. Set instrument to "recitation" for this mode.

    Args:
        raga: The Indian classical raga to compose in. Options:
            "bhairav" - Morning awakening raga (S r G M P d N) — contemplative, serious
            "yaman" - Evening peace raga (S R G M# P D N) — serene, beautiful, most popular
            "malkauns" - Midnight meditation raga (S g m d n) — deep, introspective, pentatonic
            "darbari" - Night calm raga (S R g M P d n) — majestic, deeply calming
            "bageshree" - Night healing raga (S R g M P D n) — romantic, emotionally healing
            "todi" - Morning contemplation raga (S r g M# P d N) — serious, profound
            "durga" - Evening strength raga (S R M P D) — bright, energetic pentatonic
            "bhoopali" - Evening joy raga (S R G P D) — light, joyful pentatonic
            "auto" - Let the system choose based on mood
        instrument: Lead instrument for the composition. Options:
            "sitar" - Plucked string with sympathetic resonance (Karplus-Strong synthesis)
            "bansuri" - Bamboo flute with breath noise and vibrato
            "harp" - Clean plucked strings (Western-Indian fusion)
            "veena" - Deep plucked string similar to sitar but warmer
            "recitation" - Background music mode for poetry/mantra recitation (gentle harp + drone)
        tempo: Beats per minute. Range 30-120. Recommendations:
            30-45 = very meditative, deep calm
            45-60 = meditative, standard therapy pace
            60-80 = moderate, gentle movement
            80-120 = energetic, rhythmic (use with tabla)
        with_tabla: Whether to include tabla percussion rhythm. True for rhythmic sessions,
            False for pure meditation/calm. Tabla adds grounding beat.
        with_tanpura: Whether to include tanpura drone. Almost always True — provides
            the harmonic foundation. Only set False for minimal/sparse compositions.
        mood: The emotional context. Used to fine-tune the composition:
            "stressed", "anxious", "sad", "calm", "peaceful", "meditative",
            "awakening", "healing", "focused", "joyful", "contemplative", "strength"
        reason: Brief explanation of why this composition was chosen

    Returns:
        dict with composition details
    """
    tool_context.state["active_therapy"] = "generative_raga"
    tool_context.state["active_raga"] = raga
    tool_context.state["active_instrument"] = instrument

    return {
        "status": "composing",
        "raga": raga,
        "instrument": instrument,
        "tempo": tempo,
        "with_tabla": with_tabla,
        "with_tanpura": with_tanpura,
        "mood": mood,
        "reason": reason,
        "instruction": "FRONTEND_COMPOSE_RAGA",
        "note": "Live algorithmic music is now being generated — every note is unique and unrepeatable.",
    }


def adjust_therapy_volume(
    volume_level: float,
    tool_context: ToolContext,
) -> dict:
    """Adjust the volume of the currently playing therapy sounds.
    Use this when the user asks to increase/decrease/change the therapy sound volume,
    or when they want the music louder/softer, or your voice quieter/louder relative to sounds.

    Args:
        volume_level: Volume from 0.0 (silent) to 1.0 (full volume).
            Typical values: 0.1 = very quiet, 0.3 = normal, 0.5 = loud, 0.7 = very loud, 1.0 = max.
            If user says "increase volume" use 0.5-0.7. If "lower volume" use 0.1-0.2.

    Returns:
        dict with volume adjustment confirmation
    """
    vol = max(0.0, min(1.0, volume_level))
    tool_context.state["therapy_volume"] = vol
    return {
        "status": "volume_adjusted",
        "volume": vol,
        "instruction": f"FRONTEND_VOLUME:{vol}",
    }

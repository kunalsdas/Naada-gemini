"""
Mood Assessment Tools
Emotion detection, mood tracking, wellness scoring, and session summaries.
"""

from google.adk.tools.tool_context import ToolContext

THERAPY_MAP = {
    "stressed": "tibetan_bowls",
    "anxious": "tibetan_bowls",
    "sad": "indian_raga",
    "tired": "indian_raga",
    "restless": "delta_waves",
    "insomnia": "delta_waves",
    "sleepy": "nature_rain",
    "unfocused": "binaural_focus",
    "distracted": "binaural_focus",
    "calm": "om_drone",
    "meditative": "theta_meditation",
    "angry": "solfeggio",
    "hurt": "solfeggio",
    "happy": "om_drone",
    "overwhelmed": "ocean_waves",
    "tense": "chakra_tune",
}


def assess_mood(
    detected_emotion: str,
    confidence: str,
    facial_observations: str,
    voice_observations: str,
    tool_context: ToolContext,
) -> dict:
    """Assess and log the user's current emotional state based on camera and voice.

    Args:
        detected_emotion: Primary emotion detected (e.g., "stressed", "anxious", "sad", "calm", "happy", "tired", "restless", "angry")
        confidence: How confident the assessment is ("high", "medium", "low")
        facial_observations: What was observed in facial expression (e.g., "furrowed brow, tense jaw, tired eyes")
        voice_observations: What was observed in voice tone (e.g., "flat tone, speaking slowly, trembling voice")

    Returns:
        dict with mood assessment details
    """
    if "mood_history" not in tool_context.state:
        tool_context.state["mood_history"] = []

    entry = {
        "emotion": detected_emotion,
        "confidence": confidence,
        "facial": facial_observations,
        "voice": voice_observations,
        "phase": "initial",
    }
    tool_context.state["mood_history"] = (
        tool_context.state["mood_history"] + [entry]
    )
    tool_context.state["current_mood"] = detected_emotion

    recommended = THERAPY_MAP.get(detected_emotion, "om_drone")

    return {
        "status": "assessed",
        "emotion": detected_emotion,
        "confidence": confidence,
        "recommended_therapy": recommended,
        "total_assessments": len(tool_context.state["mood_history"]),
    }


def log_mood_change(
    new_emotion: str,
    observation: str,
    tool_context: ToolContext,
) -> dict:
    """Log a change in the user's mood during or after therapy.

    Args:
        new_emotion: The new emotion detected (e.g., "relaxed", "calmer", "peaceful", "focused")
        observation: What changed (e.g., "jaw relaxed, shoulders dropped, breathing slower")

    Returns:
        dict with mood change tracking
    """
    if "mood_history" not in tool_context.state:
        tool_context.state["mood_history"] = []

    previous_mood = tool_context.state.get("current_mood", "unknown")

    entry = {
        "emotion": new_emotion,
        "observation": observation,
        "previous_mood": previous_mood,
        "phase": "during_therapy",
    }
    tool_context.state["mood_history"] = (
        tool_context.state["mood_history"] + [entry]
    )
    tool_context.state["current_mood"] = new_emotion

    return {
        "status": "logged",
        "previous_mood": previous_mood,
        "new_mood": new_emotion,
        "observation": observation,
        "improvement": previous_mood != new_emotion,
        "total_mood_entries": len(tool_context.state["mood_history"]),
    }


def update_wellness_score(
    score: int,
    indicators: str,
    tool_context: ToolContext,
) -> dict:
    """Update the user's real-time wellness score based on observed facial expressions, voice tone, and body language.
    Call this at the START of the session to establish baseline, then every 30-60 seconds during therapy.
    The score reflects overall stress/wellness — higher score = more stressed, lower = more relaxed/healed.

    Args:
        score: Wellness stress score from 0-100.
            0-20 = deeply calm and relaxed (green)
            20-40 = mild calm, beginning to relax (green-yellow)
            40-60 = moderate stress, neutral (yellow)
            60-80 = elevated stress, tension visible (orange)
            80-100 = high stress, anxiety visible (red)
            Base on: facial tension, jaw clenching, brow furrowing, eye squinting,
            breathing rate (visible chest movement), voice tremor, speech pace,
            fidgeting, shoulder tension. Lower the score as therapy takes effect.
        indicators: Comma-separated list of what you observed that led to this score.
            Example: "jaw tension reduced, breathing slower, shoulders dropped, slight smile"

    Returns:
        dict with score tracking details
    """
    if "wellness_scores" not in tool_context.state:
        tool_context.state["wellness_scores"] = []

    entry = {"score": score, "indicators": indicators}
    tool_context.state["wellness_scores"] = (
        tool_context.state["wellness_scores"] + [entry]
    )
    tool_context.state["current_wellness_score"] = score

    scores = tool_context.state["wellness_scores"]
    initial = scores[0]["score"] if scores else score
    improvement = initial - score

    return {
        "status": "score_updated",
        "score": score,
        "initial_score": initial,
        "improvement": improvement,
        "improvement_percent": round((improvement / max(initial, 1)) * 100, 1),
        "total_readings": len(scores),
        "indicators": indicators,
    }


def get_session_summary(tool_context: ToolContext) -> dict:
    """Get a summary of the therapy session including mood journey.

    Returns:
        dict with full session data
    """
    mood_history = tool_context.state.get("mood_history", [])
    sessions = tool_context.state.get("therapy_sessions", [])
    current_mood = tool_context.state.get("current_mood", "unknown")

    initial_mood = mood_history[0]["emotion"] if mood_history else "unknown"

    return {
        "mood_journey": mood_history,
        "initial_mood": initial_mood,
        "current_mood": current_mood,
        "therapy_sessions_count": len(sessions),
        "therapies_used": [s["type"] for s in sessions],
        "total_mood_readings": len(mood_history),
        "improved": initial_mood != current_mood,
    }

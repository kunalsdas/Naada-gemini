"""
Naada Agent Tools
All ADK tool functions for the Gemini Live agent.
"""

from tools.mood import (
    assess_mood,
    log_mood_change,
    update_wellness_score,
    get_session_summary,
)
from tools.therapy import (
    start_therapy,
    mix_therapy,
    compose_raga,
    adjust_therapy_volume,
)
from tools.meditation import (
    start_meditation,
    end_meditation,
    show_affirmation,
    share_session_insight,
)
from tools.spotify import (
    spotify_play,
    spotify_control_playback,
    spotify_now_playing,
)

ALL_TOOLS = [
    assess_mood,
    start_therapy,
    mix_therapy,
    compose_raga,
    start_meditation,
    end_meditation,
    adjust_therapy_volume,
    update_wellness_score,
    log_mood_change,
    get_session_summary,
    show_affirmation,
    share_session_insight,
    spotify_play,
    spotify_control_playback,
    spotify_now_playing,
]

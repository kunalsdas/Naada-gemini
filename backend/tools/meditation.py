"""
Meditation & Engagement Tools
Guided meditation, affirmation cards, and real-time session insights.
"""

from google.adk.tools.tool_context import ToolContext


def start_meditation(
    style: str,
    duration_minutes: int,
    focus_theme: str,
    tool_context: ToolContext,
) -> dict:
    """Start a guided meditation session. Therapy sounds play louder while you guide softly.

    Args:
        style: Meditation style. Must be one of:
            "breathing" - Focused breathing exercise (breathe in, hold, breathe out counts)
            "body_scan" - Progressive body relaxation from head to toe
            "visualization" - Guided imagery (forest, ocean, mountain, garden)
            "loving_kindness" - Metta meditation with affirmations of love and peace
            "mantra" - Om or mantra-based meditation with repetition
        duration_minutes: How long the meditation should last (3, 5, 10, 15, or 20)
        focus_theme: What to focus on (e.g., "stress relief", "sleep preparation", "self-love", "inner peace", "gratitude")

    Returns:
        dict with meditation session details
    """
    tool_context.state["meditation_active"] = True
    tool_context.state["meditation_style"] = style
    tool_context.state["meditation_duration"] = duration_minutes

    return {
        "status": "meditation_started",
        "style": style,
        "duration_minutes": duration_minutes,
        "focus_theme": focus_theme,
    }


def end_meditation(tool_context: ToolContext) -> dict:
    """End the current meditation session and return to normal therapy mode.

    Returns:
        dict with meditation end confirmation
    """
    tool_context.state["meditation_active"] = False
    return {
        "status": "meditation_ended",
    }


def show_affirmation(
    text: str,
    theme: str,
    tool_context: ToolContext,
) -> dict:
    """Display a beautiful affirmation card on the user's screen.
    Use this to show personalized healing affirmations during therapy.
    Call this occasionally (every 60-90 seconds) during therapy to reinforce healing.

    Args:
        text: The affirmation text to display. Keep it 1-2 sentences max.
            Examples: "You are safe. You are enough."
            "With every breath, tension melts away."
            "Your mind is clear. Your heart is at peace."
            Make it relevant to the user's current emotion and therapy.
        theme: Visual theme for the affirmation card. One of:
            "calm" - soft blue/cyan tones
            "energy" - warm amber/gold tones
            "love" - pink/rose tones
            "healing" - green tones
            "spiritual" - purple/violet tones
            "peace" - white/silver tones

    Returns:
        dict with affirmation display confirmation
    """
    if "affirmations" not in tool_context.state:
        tool_context.state["affirmations"] = []

    tool_context.state["affirmations"] = (
        tool_context.state["affirmations"] + [{"text": text, "theme": theme}]
    )

    return {
        "status": "displayed",
        "text": text,
        "theme": theme,
        "total_affirmations": len(tool_context.state["affirmations"]),
    }


def share_session_insight(
    insight: str,
    category: str,
    tool_context: ToolContext,
) -> dict:
    """Share a real-time clinical observation or insight with the user during therapy.
    Use this every 45-90 seconds during active therapy to provide feedback on what you observe.
    These appear as brief floating notifications on screen, making the experience feel alive and responsive.

    Args:
        insight: A brief observation (max 15 words). Examples:
            "Jaw tension releasing — great progress"
            "Breathing rhythm becoming more steady"
            "Shoulder drop detected — muscles relaxing"
            "Voice pitch lowered — stress reducing"
            "Eye blink rate normalized — entering calm state"
            "Facial micro-expressions show increasing comfort"
        category: Type of insight. One of:
            "observation" - what you see/hear changing
            "progress" - positive change detected
            "suggestion" - gentle guidance
            "milestone" - significant achievement moment

    Returns:
        dict with insight display confirmation
    """
    if "insights" not in tool_context.state:
        tool_context.state["insights"] = []

    tool_context.state["insights"] = (
        tool_context.state["insights"] + [{"text": insight, "category": category}]
    )

    return {
        "status": "displayed",
        "insight": insight,
        "category": category,
        "total_insights": len(tool_context.state["insights"]),
    }

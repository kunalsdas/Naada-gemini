"""
Spotify Agent Tools
ADK tool functions for controlling Spotify playback during therapy.
"""

import asyncio
import logging
import platform

from google.adk.tools.tool_context import ToolContext

import spotify_control

logger = logging.getLogger("naada.spotify")

_IS_MACOS = platform.system() == "Darwin"


def spotify_play(
    mood_or_query: str,
    tool_context: ToolContext,
) -> dict:
    """Play music from the Spotify desktop app. Use this when the user wants real music
    from Spotify alongside or instead of therapy sounds. Spotify plays through desktop
    speakers and mixes naturally with browser therapy sounds.

    If Spotify is already playing, it will stop current playback first then play the new request.
    The user can interrupt mid-session to ask for specific songs/playlists.

    Args:
        mood_or_query: Either a mood keyword (stressed, calm, sleep, focus, meditation,
            sad, energy, happy, nature, wellness, baby_sleep, relaxed, anxious, insomnia)
            which plays a curated playlist, OR a free-text search query like
            "relaxing piano music" or "Ludovico Einaudi" to search Spotify.

    Returns:
        dict with playback status and what is playing
    """
    if not _IS_MACOS:
        return {
            "status": "unavailable",
            "error": "Spotify desktop control is only available when running locally on macOS. Suggest the user play therapy sounds instead, or tell them to open Spotify manually.",
        }

    mood_key = mood_or_query.lower().strip()
    playlist_info = spotify_control.MOOD_PLAYLISTS.get(mood_key)

    loop = asyncio.get_event_loop()

    async def _stop_then_play_uri(uri):
        await spotify_control.control("pause")
        await asyncio.sleep(0.3)
        await spotify_control.play_uri(uri)
        await spotify_control.set_volume(40)

    async def _stop_then_search(query):
        await spotify_control.control("pause")
        await asyncio.sleep(0.3)
        await spotify_control.play_search(query)
        await spotify_control.set_volume(40)
        info = await spotify_control.get_now_playing()
        if info.get("is_playing"):
            logger.info(f"Now playing: {info.get('track')} by {info.get('artist')}")

    if playlist_info:
        uri, name = playlist_info
        loop.create_task(_stop_then_play_uri(uri))
        tool_context.state["spotify_active"] = True
        tool_context.state["spotify_source"] = name
        return {
            "status": "playing",
            "source": f"Spotify playlist: {name}",
            "type": "playlist",
            "mood": mood_key,
        }
    else:
        loop.create_task(_stop_then_search(mood_or_query))
        tool_context.state["spotify_active"] = True
        tool_context.state["spotify_source"] = mood_or_query
        return {
            "status": "searching_and_playing",
            "source": f"Spotify search: {mood_or_query}",
            "type": "search",
            "query": mood_or_query,
        }


def spotify_control_playback(
    action: str,
    tool_context: ToolContext,
) -> dict:
    """Control Spotify playback — pause, resume, skip tracks, or adjust volume.

    Args:
        action: One of:
            "pause" - Pause Spotify playback
            "resume" - Resume Spotify playback
            "next" - Skip to next track
            "previous" - Go to previous track
            "volume_up" - Increase Spotify volume by 15
            "volume_down" - Decrease Spotify volume by 15

    Returns:
        dict with action result
    """
    if not _IS_MACOS:
        return {"status": "unavailable", "error": "Spotify control only available on local macOS."}

    loop = asyncio.get_event_loop()

    if action in ("volume_up", "volume_down"):
        async def adjust_volume():
            info = await spotify_control.get_now_playing()
            current = info.get("volume", 50)
            new_vol = current + 15 if action == "volume_up" else current - 15
            await spotify_control.set_volume(max(0, min(100, new_vol)))
        loop.create_task(adjust_volume())
        return {"status": "volume_adjusted", "action": action}
    else:
        loop.create_task(spotify_control.control(action))
        if action == "pause":
            tool_context.state["spotify_active"] = False
        elif action == "resume":
            tool_context.state["spotify_active"] = True
        return {"status": "done", "action": action}


def spotify_now_playing(tool_context: ToolContext) -> dict:
    """Get information about what is currently playing on Spotify.

    Returns:
        dict with track name, artist, album, and playback state
    """
    if not _IS_MACOS:
        return {"status": "unavailable", "is_playing": False, "error": "Spotify control only available on local macOS."}

    source = tool_context.state.get("spotify_source", "")
    is_active = tool_context.state.get("spotify_active", False)

    return {
        "status": "checked",
        "is_playing": is_active,
        "source": source,
        "note": "Track info will be sent to frontend via Spotify bar.",
    }

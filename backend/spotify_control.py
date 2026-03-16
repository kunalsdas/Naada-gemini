"""
Spotify Desktop Controller for Naada
Controls Spotify desktop app via AppleScript (macOS only).
No API key needed — uses osascript to send commands to the Spotify app.
"""

import asyncio
import subprocess
import logging
import urllib.parse

logger = logging.getLogger("naada.spotify")

# Curated mood → Spotify playlist URI mapping
MOOD_PLAYLISTS = {
    "stressed": ("spotify:playlist:37i9dQZF1DWXe9gFZP0gtP", "Stress Relief"),
    "anxious": ("spotify:playlist:37i9dQZF1DWXe9gFZP0gtP", "Stress Relief"),
    "sleep": ("spotify:playlist:37i9dQZF1DWZd79rJ6a7lp", "Sleep"),
    "insomnia": ("spotify:playlist:37i9dQZF1DWZd79rJ6a7lp", "Sleep"),
    "focus": ("spotify:playlist:37i9dQZF1DX4sWSpwq3LiO", "Peaceful Piano"),
    "meditation": ("spotify:playlist:37i9dQZF1DWZqd5JICZI0u", "Peaceful Meditation"),
    "sad": ("spotify:playlist:37i9dQZF1DX3rxVfibe1L0", "Mood Booster"),
    "calm": ("spotify:playlist:37i9dQZF1DX1s9knjP51Oa", "Calm Vibes"),
    "energy": ("spotify:playlist:37i9dQZF1DX0UrRvztWcAU", "Wake Up Happy"),
    "happy": ("spotify:playlist:37i9dQZF1DX0UrRvztWcAU", "Wake Up Happy"),
    "nature": ("spotify:playlist:37i9dQZF1DX4PP3DA4J0N8", "Nature Sounds"),
    "relaxed": ("spotify:playlist:37i9dQZF1DX1s9knjP51Oa", "Calm Vibes"),
    "wellness": ("spotify:playlist:37i9dQZF1DWZqd5JICZI0u", "Peaceful Meditation"),
    "baby_sleep": ("spotify:playlist:37i9dQZF1DWZd79rJ6a7lp", "Sleep"),
}


async def _run_osascript(script: str) -> str:
    """Run an AppleScript command and return stdout."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "osascript", "-e", script,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15)
        result = stdout.decode("utf-8").strip()
        if proc.returncode != 0:
            err = stderr.decode("utf-8").strip()
            logger.warning(f"osascript error: {err}")
            return ""
        return result
    except asyncio.TimeoutError:
        logger.error("osascript timed out")
        return ""
    except Exception as e:
        logger.error(f"osascript failed: {e}")
        return ""


async def is_running() -> bool:
    """Check if Spotify app is currently running."""
    result = await _run_osascript(
        'tell application "System Events" to (name of processes) contains "Spotify"'
    )
    return result.lower() == "true"


async def launch():
    """Launch Spotify app if not running."""
    if not await is_running():
        await _run_osascript('tell application "Spotify" to activate')
        await asyncio.sleep(3)  # Give it time to start
        logger.info("Launched Spotify")


async def play_uri(uri: str):
    """Play a Spotify URI (track, playlist, album)."""
    await launch()
    await _run_osascript(f'tell application "Spotify" to play track "{uri}"')
    logger.info(f"Playing URI: {uri}")


async def play_search(query: str):
    """Search Spotify and auto-play the top result.

    Uses clipboard-paste approach for reliable text entry, then navigates
    to first result and plays it.
    """
    await launch()

    # Sanitize query - escape for AppleScript string
    safe_query = query.replace("\\", "\\\\").replace('"', '\\"')

    # Strategy 1: Use clipboard paste into search field (most reliable)
    logger.info(f"Spotify search: trying strategy 1 (clipboard paste + navigate)")
    await _run_osascript(f'''
        tell application "Spotify" to activate
        delay 1
        -- Set clipboard to search query
        set the clipboard to "{safe_query}"
        tell application "System Events"
            tell process "Spotify"
                -- Focus search field with Cmd+L
                keystroke "l" using command down
                delay 0.5
                -- Select all existing text and paste query
                keystroke "a" using command down
                delay 0.2
                keystroke "v" using command down
                delay 4
                -- Press Enter to confirm search
                key code 36
                delay 2
                -- Now navigate into results: Escape unfocuses search,
                -- Tab moves into content area, Enter plays
                key code 53
                delay 0.5
                key code 48
                delay 0.3
                key code 48
                delay 0.3
                key code 36
            end tell
        end tell
    ''')

    await asyncio.sleep(2)
    info = await get_now_playing()
    if info.get("is_playing"):
        logger.info(f"Search & play OK (strategy 1): {query} -> {info.get('track', '?')}")
        return

    # Strategy 2: Try Cmd+L + paste + use Space to play top result
    logger.warning(f"Strategy 1 failed for '{query}', trying strategy 2 (space play)")
    await _run_osascript('''
        tell application "Spotify" to activate
        delay 0.3
        tell application "System Events"
            tell process "Spotify"
                -- Try pressing Space which toggles play in Spotify
                key code 49
            end tell
        end tell
    ''')

    await asyncio.sleep(2)
    info = await get_now_playing()
    if info.get("is_playing"):
        logger.info(f"Search & play OK (strategy 2): {query} -> {info.get('track', '?')}")
        return

    # Strategy 3: Open search URI and try clicking top result area
    logger.warning(f"Strategy 2 failed for '{query}', trying strategy 3 (URI + click)")
    encoded = urllib.parse.quote(query)
    proc = await asyncio.create_subprocess_exec(
        "open", f"spotify:search:{encoded}",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    await proc.communicate()
    await asyncio.sleep(5)

    # Try clicking the play button area of the top result card
    await _run_osascript('''
        tell application "Spotify" to activate
        delay 0.5
        tell application "System Events"
            tell process "Spotify"
                -- Navigate: Escape, then Down arrows into results, then Enter
                key code 53
                delay 0.4
                key code 125
                delay 0.3
                key code 125
                delay 0.3
                key code 125
                delay 0.3
                key code 36
            end tell
        end tell
    ''')

    await asyncio.sleep(2)
    info = await get_now_playing()
    if info.get("is_playing"):
        logger.info(f"Search & play OK (strategy 3): {query} -> {info.get('track', '?')}")
    else:
        logger.error(f"All strategies failed to play '{query}'. Spotify may need manual interaction.")


async def control(action: str):
    """Control Spotify playback.

    Args:
        action: One of "play", "pause", "next", "previous", "playpause"
    """
    cmd_map = {
        "play": "play",
        "pause": "pause",
        "resume": "play",
        "next": "next track",
        "previous": "previous track",
        "playpause": "playpause",
    }
    cmd = cmd_map.get(action, "playpause")
    await _run_osascript(f'tell application "Spotify" to {cmd}')
    logger.info(f"Spotify control: {action}")


async def set_volume(level: int):
    """Set Spotify volume (0-100)."""
    level = max(0, min(100, level))
    await _run_osascript(f'tell application "Spotify" to set sound volume to {level}')
    logger.info(f"Spotify volume: {level}")


async def get_now_playing() -> dict:
    """Get info about the currently playing track."""
    if not await is_running():
        return {"is_playing": False, "track": "", "artist": "", "album": ""}

    script = '''
    tell application "Spotify"
        if player state is playing then
            set trackName to name of current track
            set trackArtist to artist of current track
            set trackAlbum to album of current track
            set vol to sound volume
            return trackName & "|||" & trackArtist & "|||" & trackAlbum & "|||" & vol & "|||playing"
        else if player state is paused then
            set trackName to name of current track
            set trackArtist to artist of current track
            set trackAlbum to album of current track
            set vol to sound volume
            return trackName & "|||" & trackArtist & "|||" & trackAlbum & "|||" & vol & "|||paused"
        else
            return "|||||||stopped"
        end if
    end tell
    '''
    result = await _run_osascript(script)
    if not result or "|||" not in result:
        return {"is_playing": False, "track": "", "artist": "", "album": ""}

    parts = result.split("|||")
    return {
        "track": parts[0] if len(parts) > 0 else "",
        "artist": parts[1] if len(parts) > 1 else "",
        "album": parts[2] if len(parts) > 2 else "",
        "volume": int(parts[3]) if len(parts) > 3 and parts[3].isdigit() else 50,
        "is_playing": parts[4] == "playing" if len(parts) > 4 else False,
    }

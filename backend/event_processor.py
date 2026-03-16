"""
Event Processor
Maps ADK events to frontend WebSocket messages.
Intercepts tool calls and converts them to typed JSON payloads.
"""

import asyncio
import json
import logging

from fastapi import WebSocket, WebSocketDisconnect

import spotify_control

logger = logging.getLogger("naada")


def _is_audio_part(part):
    """Check if a content part contains audio data."""
    return (
        part.inline_data
        and part.inline_data.mime_type
        and part.inline_data.mime_type.startswith("audio/")
        and part.inline_data.data
    )


# --- Tool Call Handlers ---

async def _handle_start_therapy(ws, args):
    therapy_type = args.get("therapy_type", "")
    if therapy_type:
        await ws.send_text(json.dumps({
            "type": "therapy_play",
            "therapy_type": therapy_type,
        }))


async def _handle_mix_therapy(ws, args):
    layers_str = args.get("layers", "")
    parsed_layers = []
    for segment in layers_str.split(","):
        segment = segment.strip()
        if ":" in segment:
            t, v = segment.split(":", 1)
            parsed_layers.append({"type": t.strip(), "volume": float(v.strip())})
        else:
            parsed_layers.append({"type": segment.strip(), "volume": 0.5})
    if parsed_layers:
        await ws.send_text(json.dumps({
            "type": "therapy_mix",
            "layers": parsed_layers,
        }))


async def _handle_compose_raga(ws, args):
    await ws.send_text(json.dumps({
        "type": "compose_raga",
        "raga": args.get("raga", "auto"),
        "instrument": args.get("instrument", "sitar"),
        "tempo": int(args.get("tempo", 60)),
        "with_tabla": bool(args.get("with_tabla", True)),
        "with_tanpura": bool(args.get("with_tanpura", True)),
        "mood": args.get("mood", "calm"),
    }))


async def _handle_start_meditation(ws, args):
    await ws.send_text(json.dumps({
        "type": "meditation_start",
        "style": args.get("style", "breathing"),
        "duration_minutes": args.get("duration_minutes", 5),
        "focus_theme": args.get("focus_theme", ""),
    }))


async def _handle_end_meditation(ws, _args):
    await ws.send_text(json.dumps({"type": "meditation_end"}))


async def _handle_adjust_volume(ws, args):
    await ws.send_text(json.dumps({
        "type": "therapy_volume",
        "volume": float(args.get("volume_level", 0.3)),
    }))


async def _handle_spotify_play(ws, args):
    await ws.send_text(json.dumps({
        "type": "spotify_play",
        "query": args.get("mood_or_query", ""),
    }))

    async def _send_now_playing_after_delay():
        try:
            await asyncio.sleep(8)
            info = await spotify_control.get_now_playing()
            if info.get("is_playing"):
                await ws.send_text(json.dumps({
                    "type": "spotify_now_playing",
                    "track": info.get("track", ""),
                    "artist": info.get("artist", ""),
                    "album": info.get("album", ""),
                    "is_playing": True,
                }))
        except Exception:
            pass
    asyncio.create_task(_send_now_playing_after_delay())


async def _handle_spotify_control(ws, args):
    await ws.send_text(json.dumps({
        "type": "spotify_status",
        "action": args.get("action", ""),
    }))


async def _handle_spotify_now_playing(ws, _args):
    await ws.send_text(json.dumps({"type": "spotify_now_playing"}))


async def _handle_assess_mood(ws, args):
    await ws.send_text(json.dumps({
        "type": "mood_assessed",
        "emotion": args.get("detected_emotion", args.get("emotion", "neutral")),
        "confidence": args.get("confidence", "medium"),
        "facial_observations": args.get("facial_observations", ""),
        "voice_observations": args.get("voice_observations", ""),
    }))


async def _handle_update_wellness(ws, args):
    await ws.send_text(json.dumps({
        "type": "wellness_score",
        "score": int(args.get("score", 50)),
        "indicators": args.get("indicators", ""),
    }))


async def _handle_show_affirmation(ws, args):
    text = args.get("text", "")
    if text:
        await ws.send_text(json.dumps({
            "type": "affirmation",
            "text": text,
            "theme": args.get("theme", "calm"),
        }))


async def _handle_share_insight(ws, args):
    insight = args.get("insight", "")
    if insight:
        await ws.send_text(json.dumps({
            "type": "session_insight",
            "insight": insight,
            "category": args.get("category", "observation"),
        }))


async def _handle_log_mood_change(ws, args):
    observation = args.get("observation", "")
    await ws.send_text(json.dumps({
        "type": "mood_changed",
        "from_mood": "",
        "to_mood": args.get("new_emotion", ""),
        "trigger": observation,
        "observations": observation,
    }))


# Tool name → handler dispatch table
TOOL_HANDLERS = {
    "start_therapy": _handle_start_therapy,
    "mix_therapy": _handle_mix_therapy,
    "compose_raga": _handle_compose_raga,
    "start_meditation": _handle_start_meditation,
    "end_meditation": _handle_end_meditation,
    "adjust_therapy_volume": _handle_adjust_volume,
    "spotify_play": _handle_spotify_play,
    "spotify_control_playback": _handle_spotify_control,
    "spotify_now_playing": _handle_spotify_now_playing,
    "assess_mood": _handle_assess_mood,
    "update_wellness_score": _handle_update_wellness,
    "show_affirmation": _handle_show_affirmation,
    "share_session_insight": _handle_share_insight,
    "log_mood_change": _handle_log_mood_change,
}


async def send_event_to_client(websocket: WebSocket, event):
    """Process an ADK event and send typed messages to the browser.

    Extracts audio, transcripts, tool calls, and status from raw ADK events
    and forwards them as small, typed WebSocket messages.
    """
    try:
        if event.content and event.content.parts:
            for part in event.content.parts:
                if _is_audio_part(part):
                    await websocket.send_bytes(part.inline_data.data)

                elif part.text:
                    text = part.text.strip()
                    if text and not text.startswith("**"):
                        await websocket.send_text(json.dumps({
                            "type": "agent_text",
                            "text": text,
                            "partial": event.partial or False,
                        }))

                elif part.function_call:
                    tool_name = part.function_call.name
                    args = part.function_call.args or {}

                    handler = TOOL_HANDLERS.get(tool_name)
                    if handler:
                        await handler(websocket, args)

                    await websocket.send_text(json.dumps({
                        "type": "status",
                        "status": "thinking",
                        "detail": f"Using tool: {tool_name}",
                    }))

        if event.input_transcription and event.input_transcription.text:
            await websocket.send_text(json.dumps({
                "type": "input_transcript",
                "text": event.input_transcription.text,
                "final": not (event.partial is True),
            }))

        if event.output_transcription and event.output_transcription.text:
            await websocket.send_text(json.dumps({
                "type": "output_transcript",
                "text": event.output_transcription.text,
                "final": not (event.partial is True),
            }))

        if event.turn_complete:
            await websocket.send_text(json.dumps({"type": "turn_complete"}))

        if event.interrupted:
            await websocket.send_text(json.dumps({"type": "interrupted"}))

    except WebSocketDisconnect:
        raise
    except Exception as e:
        logger.error(f"Error processing event: {e}")

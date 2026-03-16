"""
WebSocket Handler
Bidirectional streaming between browser and ADK/Gemini Live API.
"""

import asyncio
import base64
import json
import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from google.adk.runners import Runner
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.sessions import InMemorySessionService
from google.genai import types
from google.genai import errors as genai_errors

try:
    from websockets.exceptions import ConnectionClosedOK, ConnectionClosedError
except ImportError:
    ConnectionClosedOK = None
    ConnectionClosedError = None

from config import APP_NAME, SEND_SAMPLE_RATE
from agent import root_agent
from event_processor import send_event_to_client

logger = logging.getLogger("naada")

router = APIRouter()

session_service = InMemorySessionService()
runner = Runner(
    app_name=APP_NAME,
    agent=root_agent,
    session_service=session_service,
)


@router.get("/api/session")
async def create_session():
    """Create a new session and return session details."""
    user_id = f"user_{uuid.uuid4().hex[:8]}"
    session_id = f"session_{uuid.uuid4().hex[:8]}"

    await session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )

    return {"user_id": user_id, "session_id": session_id, "status": "created"}


@router.websocket("/ws/{user_id}/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    session_id: str,
):
    """Bidirectional WebSocket for real-time audio/video streaming with Gemini.

    Client sends:
      - Binary frames: Raw PCM audio (16kHz, 16-bit, mono)
      - Text frames (JSON):
        - {"type": "image", "data": "<base64>", "mimeType": "image/jpeg"}
        - {"type": "text", "text": "user message"}

    Server sends:
      - Binary frames: Raw PCM audio (24kHz, 16-bit, mono) from agent
      - Text frames (JSON): typed messages (transcripts, tool results, status)
    """
    await websocket.accept()
    logger.info(f"WebSocket connected: user={user_id}, session={session_id}")

    session = await session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id,
    )
    if not session:
        session = await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id,
        )
        logger.info(f"Created new session: {session_id}")

    run_config = RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Kore"
                )
            ),
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=False,
                start_of_speech_sensitivity=types.StartSensitivity.START_SENSITIVITY_HIGH,
                end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_HIGH,
                silence_duration_ms=500,
                prefix_padding_ms=300,
            )
        ),
    )

    live_request_queue = LiveRequestQueue()
    is_closed = asyncio.Event()

    async def upstream_messages():
        """Receive from browser WebSocket and forward to ADK LiveRequestQueue."""
        try:
            while not is_closed.is_set():
                message = await websocket.receive()

                if message.get("type") == "websocket.disconnect":
                    break

                if "bytes" in message and message["bytes"]:
                    audio_blob = types.Blob(
                        mime_type=f"audio/pcm;rate={SEND_SAMPLE_RATE}",
                        data=message["bytes"],
                    )
                    live_request_queue.send_realtime(audio_blob)

                elif "text" in message and message["text"]:
                    try:
                        json_msg = json.loads(message["text"])
                    except json.JSONDecodeError:
                        continue

                    msg_type = json_msg.get("type", "")

                    if msg_type == "image":
                        blob = types.Blob(
                            mime_type=json_msg.get("mimeType", "image/jpeg"),
                            data=base64.b64decode(json_msg.get("data", "")),
                        )
                        content = types.Content(
                            parts=[types.Part(inline_data=blob)]
                        )
                        live_request_queue.send_content(content)
                        logger.info("Sent camera frame to Gemini")

                    elif msg_type == "text":
                        text = json_msg.get("text", "")
                        if text:
                            content = types.Content(
                                parts=[types.Part(text=text)]
                            )
                            live_request_queue.send_content(content)
                            logger.info(f"Sent text: {text[:80]}")

        except WebSocketDisconnect:
            logger.info(f"Client disconnected: {user_id}")
        except Exception as e:
            logger.error(f"Upstream error: {e}")
        finally:
            is_closed.set()
            live_request_queue.close()

    async def downstream_events():
        """Run ADK agent in live mode and stream events to browser."""
        try:
            async for event in runner.run_live(
                user_id=user_id,
                session_id=session_id,
                live_request_queue=live_request_queue,
                run_config=run_config,
            ):
                if is_closed.is_set():
                    break
                await send_event_to_client(websocket, event)

        except WebSocketDisconnect:
            logger.info(f"Session ended normally: {user_id}")
        except genai_errors.APIError as e:
            # 1000 = normal WebSocket close, not a real error
            if "1000" in str(e):
                logger.info(f"Session ended normally: {user_id}")
            else:
                logger.error(f"Gemini API error: {e}")
        except Exception as e:
            err_str = str(e)
            # All of these are normal session teardown — not errors
            if (
                (ConnectionClosedOK and isinstance(e, ConnectionClosedOK))
                or (ConnectionClosedError and isinstance(e, ConnectionClosedError))
                or "1000" in err_str
                or "1008" in err_str
                or "ConnectionClosed" in type(e).__name__
                or "policy violation" in err_str.lower()
            ):
                logger.info(f"Session ended normally: {user_id}")
            else:
                logger.error(f"Downstream error: {e}")
        finally:
            is_closed.set()
            try:
                await websocket.close()
            except Exception:
                pass

    try:
        await asyncio.gather(upstream_messages(), downstream_events())
    except Exception as e:
        err_str = str(e)
        if any(p in err_str for p in ["1000", "1008", "ConnectionClosed", "policy violation"]):
            logger.info(f"Session ended normally: {user_id}/{session_id}")
        else:
            logger.error(f"WebSocket session error: {e}")
    finally:
        live_request_queue.close()
        logger.info(f"Session ended: {user_id}/{session_id}")

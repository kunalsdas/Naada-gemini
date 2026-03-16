"""
Naada Agent Definition
Configures the ADK root agent with all tools and model settings.
"""

from google.adk.agents.llm_agent import Agent
from google.adk.tools import google_search
from google.genai import types

from config import GEMINI_LIVE_MODEL
from system_prompt import SYSTEM_INSTRUCTION
from tools import ALL_TOOLS

root_agent = Agent(
    model=GEMINI_LIVE_MODEL,
    name="naada_agent",
    description=(
        "Naada is a real-time AI sound therapy companion that detects your emotional "
        "state through camera and voice, then guides you through personalized sound "
        "healing sessions using ancient traditions (Tibetan bowls, Indian ragas, "
        "Solfeggio frequencies) and modern neuroscience (binaural beats). "
        "It continuously monitors your mood and adapts the therapy in real-time."
    ),
    instruction=SYSTEM_INSTRUCTION,
    tools=[google_search] + ALL_TOOLS,
    generate_content_config=types.GenerateContentConfig(
        safety_settings=[
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.OFF,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold=types.HarmBlockThreshold.OFF,
            ),
        ],
        temperature=0.5,
    ),
)

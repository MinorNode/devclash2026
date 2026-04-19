import json
import os
from datetime import datetime
from huggingface_hub import InferenceClient

# Load .env file if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Configuration
RAW_FILE = os.path.join("data", "meeting.json")
DISPLAY_FILE = os.path.join("data", "display.json")
MODEL_ID = "meta-llama/Llama-3.3-70B-Instruct"
# User-provided token (loaded from environment variable)
HF_TOKEN = os.environ.get("HF_TOKEN")

def load_raw_data():
    if not os.path.exists(RAW_FILE):
        print(f"Error: {RAW_FILE} not found.")
        return None
    with open(RAW_FILE, "r", encoding='utf-8') as f:
        return json.load(f)

def save_display_data(entry):
    items = []
    if os.path.exists(DISPLAY_FILE):
        try:
            with open(DISPLAY_FILE, "r", encoding='utf-8') as f:
                items = json.load(f)
        except Exception as e:
            print(f"Warning: Could not read display.json: {e}")
            pass
    
    # Update if ID exists, or append
    found = False
    for i, item in enumerate(items):
        if str(item["id"]) == str(entry["id"]):
            items[i] = entry
            found = True
            break
    
    if not found:
        items.append(entry)
        
    with open(DISPLAY_FILE, "w", encoding='utf-8') as f:
        json.dump(items, f, indent=2)

def process_meeting(raw_entry, client):
    mic_text = raw_entry.get("mic sst", "")
    web_text = raw_entry.get("web sst", "")
    
    combined_transcript = f"Microphone Transcript:\n{mic_text}\n\nWeb/Tab Audio Transcript:\n{web_text}"
    
    prompt = f"""
    Analyze the following meeting transcripts and provide a structured summary in JSON format.
    
    Transcripts:
    {combined_transcript}
    
    Required JSON Schema:
    {{
        "briefSummary": "A 1-2 sentence overview of the meeting",
        "detailedSummary": "A comprehensive summary of the discussion points",
        "topics": ["Topic 1", "Topic 2"],
        "tasks": [
            {{ "person": "Name", "task": "Description", "deadline": "Date" }}
        ],
        "keyNotes": ["Point 1", "Point 2"]
    }}
    
    Return ONLY the raw JSON.
    """
    
    try:
        response = client.chat_completion(
            messages=[
                {"role": "system", "content": "You are a professional meeting assistant. Output strictly valid JSON."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=1024,
            temperature=0.1,
        )
        
        response_text = response.choices[0].message.content
        
        # Extract JSON from response
        clean_json = response_text.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json.split("```json")[1].split("```")[0].strip()
        elif "{" in clean_json:
            # Fallback to finding the first { and last }
            start = clean_json.find("{")
            end = clean_json.rfind("}") + 1
            clean_json = clean_json[start:end]
            
        analysis = json.loads(clean_json)
    except Exception as e:
        print(f"Error calling LLM API or parsing JSON: {e}")
        # Return fallback data
        analysis = {
            "briefSummary": "AI processing failed. Raw transcript available.",
            "detailedSummary": combined_transcript[:500],
            "topics": ["Unprocessed"],
            "tasks": [],
            "keyNotes": ["Check backend logs for API errors"]
        }
        
    # Build final display object
    display_entry = {
        "id": raw_entry["id"],
        "title": raw_entry["title"],
        "date": raw_entry["date"],
        "time": raw_entry["time"],
        "briefSummary": analysis.get("briefSummary", ""),
        "detailedSummary": analysis.get("detailedSummary", ""),
        "topics": analysis.get("topics", []),
        "tasks": analysis.get("tasks", []),
        "keyNotes": analysis.get("keyNotes", []),
        "transcript": mic_text 
    }
    
    return display_entry

def main():
    print(f"Initializing InferenceClient for model: {MODEL_ID}")
    client = InferenceClient(model=MODEL_ID, token=HF_TOKEN)
    
    raw_data = load_raw_data()
    if not raw_data:
        print("No raw data found to process.")
        return

    # Process the latest entry
    latest_entry = raw_data[-1]
    print(f"Processing latest meeting: {latest_entry['title']} ({latest_entry['id']})")
    
    display_entry = process_meeting(latest_entry, client)
    save_display_data(display_entry)
    
    print("Successfully updated display.json via AI API.")

if __name__ == "__main__":
    main()

import json
from pathlib import Path

# Define input/output path
input_path = Path(__file__).resolve().parent.parent / "data" / "updated_shelters.geojson"

# Load GeoJSON
with open(input_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# Add name and notes to each feature
for i, feature in enumerate(data["features"], start=1):
    props = feature.get("properties", {})
    props["name"] = f"Shelter#{i}"
    props["notes"] = "to be added"
    feature["properties"] = props

# Save updated GeoJSON
with open(input_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

print(f"Updated {len(data['features'])} features with name and notes.")

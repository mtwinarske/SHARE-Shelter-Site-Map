from flask import Flask, request, jsonify, send_from_directory
import json
from pathlib import Path

app = Flask(__name__)

# Serve the main HTML page
@app.route("/")
def index():
    return send_from_directory("html", "index.html")

@app.route("/<path:filename>")
def static_files(filename):
    if filename.endswith(".html") or filename.endswith(".css") or filename.endswith(".js"):
        return send_from_directory("html", filename)
    return send_from_directory(".", filename)

# Save a new shelter to the GeoJSON file
@app.route("/save_shelter", methods=["POST"])
def save_shelter():
    new_feature = request.get_json()
    geojson_path = Path("data/updated_shelters.geojson")

    with geojson_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    data["features"].append(new_feature)

    with geojson_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return jsonify({"status": "success"}), 200

if __name__ == "__main__":
    app.run(debug=True)

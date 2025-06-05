from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
from pathlib import Path

app = Flask(__name__, static_folder="static")
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
GEOJSON_PATH = BASE_DIR / "data" / "updated_shelters.geojson"

@app.route("/")
def index():
    return send_from_directory("html", "index.html")

# Save shelter data
@app.route("/save_shelter", methods=["POST"])
def save_shelter():
    try:
        new_feature = request.get_json()

        if GEOJSON_PATH.exists():
            with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
                geojson_data = json.load(f)
        else:
            geojson_data = {"type": "FeatureCollection", "features": []}

        geojson_data["features"].append(new_feature)

        with open(GEOJSON_PATH, "w", encoding="utf-8") as f:
            json.dump(geojson_data, f, indent=2)

        return jsonify({"status": "success"}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Serve GeoJSON
@app.route("/data/<path:filename>")
def data_files(filename):
    return send_from_directory("data", filename)

@app.route("/delete_shelter", methods=["DELETE"])
def delete_shelter():
    try:
        name = request.args.get("name")
        if not name:
            return jsonify({"status": "error", "message": "Name parameter missing"}), 400

        if GEOJSON_PATH.exists():
            with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
                geojson_data = json.load(f)
        else:
            geojson_data = {"type": "FeatureCollection", "features": []}

        geojson_data["features"] = [
            f for f in geojson_data["features"] if f["properties"]["name"] != name
        ]

        with open(GEOJSON_PATH, "w", encoding="utf-8") as f:
            json.dump(geojson_data, f, indent=2)

        return jsonify({"status": "success"}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500



if __name__ == "__main__":
    app.run(debug=True, port=5000
            )
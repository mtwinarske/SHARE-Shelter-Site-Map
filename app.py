from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
from pathlib import Path
import os
import subprocess

app = Flask(__name__, static_folder="static")
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
GEOJSON_PATH = BASE_DIR / "data" / "updated_shelters.geojson"


@app.route("/")
def index():
    return send_from_directory("html", "index.html")


@app.route("/about.html")
def about_page():
    return send_from_directory("html", "about.html")


@app.route("/user_guide.html")
def guide_page():
    return send_from_directory("html", "user_guide.html")

# User-end Website-based Github Commit Logic
def push_to_github():
    try:
        # Set Git identity
        subprocess.run(["git",
                        "config",
                        "--global",
                        "user.name",
                        "Render Auto Commit Bot"], check=True)
        subprocess.run(["git",
                        "config",
                        "--global",
                        "user.email",
                        "bot@sharesitemap.org"], check=True)

        # Stage the updated geojson file
        subprocess.run(["git",
                        "add",
                        "data/updated_shelters.geojson"], check=True)

        # Commit with a standard message
        subprocess.run(["git",
                        "commit",
                        "-m",
                        "Add new shelter via site submission"], check=True)

        # Push to GitHub using the personal access token
        repo_url = f"https://{os.environ['GITHUB_TOKEN']}@github.com/{os.environ['GITHUB_USERNAME']}/{os.environ['GITHUB_REPO']}.git"
        subprocess.run(["git",
                        "push",
                        repo_url], check=True)

        print("Successfully pushed to GitHub.")

    except subprocess.CalledProcessError as e:
        print(f"Git command failed: {e}")
    except Exception as e:
        print(f"Unexpected error during Git push: {e}")

# Save shelter data #
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

        push_to_github()

        return jsonify({"status": "success"}), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Serve GeoJSON


@app.route("/data/<path:filename>")
def data_files(filename):
    return send_from_directory("data", filename)


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)

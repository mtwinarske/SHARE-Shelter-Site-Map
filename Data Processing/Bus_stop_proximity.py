import geopandas as gpd
from scipy import stats

def score_parcels_by_transit(parcel_path, bus_stops_path, output_path, buffer_radius=800):
    # --- Load data ---
    parcels = gpd.read_file(parcel_path)
    bus_stops = gpd.read_file(bus_stops_path)

    # --- Project to meters ---
    parcels = parcels.to_crs(epsg=3857)
    bus_stops = bus_stops.to_crs(parcels.crs)

    # --- Create buffer around parcel centroids ---
    parcel_buffers = parcels.copy()
    parcel_buffers["geometry"] = parcels.geometry.buffer(buffer_radius)

    # --- Spatial join: bus stops within parcel buffer zones ---
    joined = gpd.sjoin(bus_stops, parcel_buffers, predicate="within")

    # --- Count number of bus stops per parcel ---
    stop_counts = joined.groupby("index_right").size()

    # --- Add raw count and normalized score ---
    scored = parcels.copy()
    scored["num_stops_within_800m"] = scored.index.map(stop_counts).fillna(0).astype(int)
    scored["total_stop_count"] = len(bus_stops)
    max_count = scored["num_stops_within_800m"].max()
    scored["transit_score"] = scored["num_stops_within_800m"] / max_count if max_count > 0 else 0

    # --- Select fields and save ---
    output = scored[["geometry", "num_stops_within_800m", "transit_score", "total_stop_count"]]
    output.to_file(output_path, driver="GeoJSON")

    print(f"✅ Transit scoring complete. Output saved to: {output_path}")



"""
gdf = gpd.read_file("data/parcels_transit_scored.geojson")

# Extract the transit score column
scores = gdf["transit_score"]

# Basic statistics
mean = scores.mean()
median = scores.median()
mode = scores.mode().iloc[0] if not scores.mode().empty else None
min_score = scores.min()
max_score = scores.max()
std_dev = scores.std()
quantiles = scores.quantile([0.25, 0.5, 0.75])

# Print results
print(f"📊 Transit Score Stats:")
print(f"Mean:    {mean:.4f}")
print(f"Median:  {median:.4f}")
print(f"Mode:    {mode:.4f}")
print(f"Min:     {min_score:.4f}")
print(f"Max:     {max_score:.4f}")
print(f"Std Dev: {std_dev:.4f}")
print(f"25%:     {quantiles[0.25]:.4f}")
print(f"75%:     {quantiles[0.75]:.4f}")

"""


import geopandas as gpd

# Load scored parcels
scored = gpd.read_file("data/parcels_transit_scored.geojson")

# Categorize transit scores
def categorize(score):
    if score <= 0.05:
        return "No access"
    elif score <= 0.15:
        return "Low access"
    elif score <= 0.30:
        return "Medium access"
    elif score <= 0.60:
        return "High access"
    else:
        return "Excellent access"

# Apply category column
scored["score_category"] = scored["transit_score"].apply(categorize)

# Save updated GeoJSON
scored.to_file("data/parcels_transit_scored_categorized.geojson", driver="GeoJSON")

print("✅ Categorized GeoJSON saved.")


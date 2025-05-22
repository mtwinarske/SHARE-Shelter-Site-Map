import geopandas as gpd
from shapely.geometry import Point, box
import json

import geopandas as gpd

def generate_shelter_buffers(input_geojson, mile_radius):
    """
    Generates circular buffers around each shelter point.

    Parameters:
    - input_geojson: str, path to shelter point GeoJSON
    - mile_radius: float, buffer radius in miles
    Returns:
    - GeoDataFrame with buffer polygons (in WGS84 / EPSG:4326)
    """
    # Miles to meters
    radius_meters = mile_radius * 1609.34

    # Load point data
    gdf = gpd.read_file(input_geojson)

    # Project to meters for accurate buffering
    gdf = gdf.to_crs(epsg=3857)

    # Create buffers in meters
    gdf["geometry"] = gdf.buffer(radius_meters)

    # Reproject back to WGS84
    gdf = gdf.to_crs(epsg=4326)

    return gdf

# Example usage:
# buffers = generate_shelter_buffers("shelter_locations.geojson", 0.25)
# buffers.to_file("shelter_buffers.geojson", driver="GeoJSON")

def transit_proximity_check(bus_stops_geojson_path, shelter_boxes_geojson_path, output_filename):
    """
    Takes in a GeoJSON file of bus stops and a GeoJSON file of shelter bounding boxes, and adds
    the number of bus-stops within the bounding box t o the bounding box's properties.
    """
    # Load shelter bounding boxes
    shelter_boxes = gpd.read_file(shelter_boxes_geojson_path)

    # Load bus stop data
    with open(bus_stops_geojson_path, "r") as f:
        bus_stop_data = json.load(f)

    for feature in bus_stop_data["features"]:
        lon, lat = feature["geometry"]["coordinates"]
        point = Point(lon, lat)

        # Check if the point is within any shelter bounding box
        in_proximity = 0
        for bbox in shelter_boxes["geometry"]:
            if bbox.contains(point):
                in_proximity = 1
                break

        # Add the proximity attribute
        feature["properties"]["proximity_to_stop"] = in_proximity

    # Save the updated bus stop data
    output_data = {
        "type": "FeatureCollection",
        "features": bus_stop_data["features"]
    }

    with open(output_filename, "w") as f:
        json.dump(output_data, f, indent=4)

    print(f"Saved updated bus stop data with proximity info to '{output_filename}'!")


buffers = generate_shelter_buffers("assets/fake_shelters.geojson", 0.25)
buffers.to_file("assets/shelter_buffers.geojson", driver="GeoJSON")

transit_proximity_check(
    "assets/fake_bustops.geojson",
    "assets/shelter_buffers.geojson",
    "assets/bustops_with_proximity.geojson"
)

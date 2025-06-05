import geopandas as gpd

# Paths
hospital_input = "data/Seattle_Hospitals.geojson"
school_input = "data/Seattle_Public_Schools.geojson"

hospital_output = "data/Seattle_Hospitals_converted.geojson"
school_output = "data/Seattle_Public_Schools_converted.geojson"

# EPSG codes
src_crs = "EPSG:2926"
dst_crs = "EPSG:4326"

# Convert Hospitals
hospitals = gpd.read_file(hospital_input)
hospitals = hospitals.set_crs(src_crs, allow_override=True)
hospitals = hospitals.to_crs(dst_crs)
hospitals.to_file(hospital_output, driver="GeoJSON")
print(f"Converted hospitals saved to {hospital_output}")

# Convert Schools
schools = gpd.read_file(school_input)
schools = schools.set_crs(src_crs, allow_override=True)
schools = schools.to_crs(dst_crs)
schools.to_file(school_output, driver="GeoJSON")
print(f"Converted schools saved to {school_output}")

// GLOBAL STATE
let allShelterData = [];
let currentShelterCoords = null;
let currentShelterAddress = "";
let hospitalsData = null;
let schoolsData = null;
  
  fetch('data/Seattle_Hospitals_converted.geojson')
    .then(res => res.json())
    .then(data => {
      hospitalsData = data;
    });
  
  fetch('data/Seattle_Public_Schools_converted.geojson')
    .then(res => res.json())
    .then(data => {
      schoolsData = data;
    });
  
let busStopsData = null;

fetch('data/KCM_Bus_Stops.geojson')
  .then(res => res.json())
  .then(data => {
    busStopsData = data;
    // No need to add to map → will be used in JS only
  });



// MAP FILTER
const sidebar = document.getElementById("mySidebar");
const overlay = document.getElementById("myOverlay");

function openSidebar() {
  sidebar.classList.add("active");
  overlay.classList.add("active");
  setTimeout(() => map.resize(), 300);
}

function closeSidebar() {
  sidebar.classList.remove("active");
  overlay.classList.remove("active");
  setTimeout(() => map.resize(), 300);
}

const sqftSlider = document.getElementById('sqftSlider');
const sqftRangeText = document.getElementById('sqftRangeText');

noUiSlider.create(sqftSlider, {
  start: [0, 2500],
  connect: true,
  step: 50,
  range: {
    min: 0,
    max: 5000
  },
  format: {
    to: value => Math.round(value),
    from: value => parseInt(value)
  }
});

sqftSlider.noUiSlider.on('update', function (values) {
  sqftRangeText.textContent = `${values[0]} sq. ft. – ${values[1]} sq. ft.`;
});

// MAPBOX SETUP
mapboxgl.accessToken = 'pk.eyJ1IjoiZ252ZWxleiIsImEiOiJjbTZzdGZzcWMwYjJzMm5wd2xmYnRyeHU0In0.1qw-r2WipRZcibgMfyoLJw';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-122.335167, 47.608013],
  zoom: 12
});

// GEOCODER SETUP
const addGeocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  mapboxgl: mapboxgl,
  marker: true,
  placeholder: 'Search for a location...',
  bbox: [-122.4594, 47.4919, -122.2244, 47.7341]
});

const geocoderContainer = document.getElementById('add-shelter-geocoder');
if (geocoderContainer) {
  geocoderContainer.appendChild(addGeocoder.onAdd(map));

  addGeocoder.on('result', function (e) {
    currentShelterCoords = e.result.geometry.coordinates;
    currentShelterAddress = e.result.place_name;
  });
}

// MAP LOAD
map.on('load', () => {

  // Reset right sidebar scroll to top on load
document.querySelector('.right-sidebar').scrollTop = 0;

  // 🏠 Load Shelter Data
  fetch('/data/updated_shelters.geojson')
    .then(res => res.json())
    .then(data => {
      allShelterData = data.features;

      map.addSource('shelters', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: allShelterData
        }
      });

      allShelterData.forEach((feature) => {
        const coords = feature.geometry.coordinates;
        const marker = new mapboxgl.Marker({ color: '#007bff' }) // default red marker
          .setLngLat(coords)
          .addTo(map)
          .getElement()
          .addEventListener("click", () => showShelterDetails(feature));
      });      

      renderShelterList(allShelterData);
      setupFilters();
      clearFilters();
    })
    .catch(err => {
      console.error("Failed to load existing shelter data:", err);
    });

  //  Add Parcels Source
  map.addSource('parcels', {
    type: 'geojson',
    data: '/data/transit_score_dissolved.geojson'
  });

  // Add Bus Stops Source

  map.loadImage('https://cdn-icons-png.flaticon.com/128/4330/4330636.png', (error, image) => {
  if (error) throw error;
  if (!map.hasImage('bus-icon')) {
    map.addImage('bus-icon', image);
  }
});

map.loadImage('https://cdn-icons-png.flaticon.com/128/4006/4006511.png', (error, image) => {
  if (error) throw error;
  if (!map.hasImage('hospital-icon')) {
    map.addImage('hospital-icon', image);
  }
});

map.loadImage('https://cdn-icons-png.flaticon.com/128/5404/5404967.png', (error, image) => {
  if (error) throw error;
  if (!map.hasImage('school-icon')) {
    map.addImage('school-icon', image);
  }
});

  // Add Parcel Layer
  map.addLayer({
    id: 'parcel-transit-score',
    type: 'fill',
    source: 'parcels',
    layout: {
      visibility: 'none'
    },
    paint: {
      'fill-color': [
        'match',
        ['get', 'score_category'],
        'No access', '#d3d3d3',
        'Low access', '#f03b20',
        'Medium access', '#feb24c',
        'High access', '#78c679',
        'Excellent access', '#238443',
        '#cccccc' // fallback
      ],
      'fill-opacity': 0.8
    }
  });

  document.getElementById('transitLayerToggle').checked = false

  // Transit Layer Toggle Control
document.getElementById('transitLayerToggle').addEventListener('change', function(e) {
  const visibility = e.target.checked ? 'visible' : 'none';
  map.setLayoutProperty('parcel-transit-score', 'visibility', visibility);
});

// Show/hide legend with Transit layer
document.getElementById('transitLayerToggle').addEventListener('change', function(e) {
  const showLegend = e.target.checked;
  document.getElementById('transitLegend').style.display = showLegend ? 'block' : 'none';
});


  // Transit Layer Description

  document.getElementById('transitInfoIcon').addEventListener('click', function() {
    alert("Transit Access Layer: This layer shows the relative accessibility of each parcel based on nearby bus stops. Categories range from 'No access' to 'Excellent access' based on the number of stops within an 800m walking distance.");
  });

  // Popup on click
  map.on('click', 'parcel-transit-score', function (e) {
    const props = e.features[0].properties;
    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <strong>Transit Score:</strong> ${props.transit_score}<br>
        <strong>Nearby Stops:</strong> ${props.num_stops_within_800m}<br>
        <strong>Access Level:</strong> ${props.score_category}
      `)
      .addTo(map);
  });

  map.on('mouseenter', 'parcel-transit-score', () => {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'parcel-transit-score', () => {
    map.getCanvas().style.cursor = '';
  });
});



// TAB SWITCHING
function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  const activeTab = document.getElementById('tab-' + tab);
  if (activeTab) activeTab.style.display = 'block';
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const clickedBtn = document.querySelector(`[onclick="showTab('${tab}')"]`);
  if (clickedBtn) clickedBtn.classList.add('active');


  // Also clear ALL nearby features buffers when switching tabs
const bufferLayers = [
  'allfeatures-hospitals-buffer-layer',
  'allfeatures-schools-buffer-layer',
  'allfeatures-busstops-buffer-layer',
  'allfeatures-hospitals-points-layer',
  'allfeatures-schools-points-layer',
  'allfeatures-busstops-points-layer'
];

const bufferSources = [
  'allfeatures-hospitals-buffer',
  'allfeatures-schools-buffer',
  'allfeatures-busstops-buffer',
  'allfeatures-hospitals-points',
  'allfeatures-schools-points',
  'allfeatures-busstops-points'
];

bufferLayers.forEach(layerId => {
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
});

bufferSources.forEach(sourceId => {
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
});

// Also clear result text
document.getElementById('allNearbyFeaturesResult').textContent = '';
document.getElementById('hospitalAccessResult').textContent = '';
document.getElementById('schoolAccessResult').textContent = '';
document.getElementById('busStopsAccessResult').textContent = '';

}

// ADD SHELTER
function submitNewShelter() {
  if (!currentShelterCoords || !currentShelterAddress) {
    alert("Please use the search box to select a shelter location first.");
    return;
  }
  const duplicate = allShelterData.some(f => f.properties.name === currentShelterAddress);
  if (duplicate) {
    alert("A shelter at this address already exists.");
    return;
  }
  const newFeature = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: currentShelterCoords
    },
    properties: {
      name: currentShelterAddress,
      shelter_type: document.getElementById("typeInput").value,
      gas: document.getElementById("gasInput").checked,
      water: document.getElementById("waterInput").checked,
      electricity: document.getElementById("electricityInput").checked,
      sewage: document.getElementById("sewageInput").checked,
      amenities: Array.from(document.querySelectorAll('input[name="amenities"]:checked')).map(cb => cb.value),
      notes: document.getElementById("notesInput").value.trim()
    }
  };
  allShelterData.push(newFeature);
  map.getSource('shelters').setData({ type: 'FeatureCollection', features: allShelterData });
  fetch('/save_shelter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newFeature)
  }).then(res => {
    if (res.ok) {
      alert("Shelter added successfully!");
      resetAddForm();
      renderShelterList(allShelterData);
    } else {
      alert("Error saving shelter.");
    }
  });
}

function deleteShelter(name) {
  const confirmed = window.confirm(`WARNING: You are about to permanently delete "${name}". This action CANNOT be undone. Proceed?`);
  if (!confirmed) return;

  fetch(`/delete_shelter?name=${encodeURIComponent(name)}`, { method: "DELETE" })
    .then(res => res.ok ? res.json() : Promise.reject())
    .then(() => {
      allShelterData = allShelterData.filter(f => f.properties.name !== name);
      map.getSource('shelters').setData({
        type: 'FeatureCollection',
        features: allShelterData
      });
      renderShelterList(allShelterData);
      alert("Shelter deleted successfully.");
    })
    .catch(() => alert("Failed to delete shelter."));
}

function checkNearbyFeatures(featureData, layerPrefix, iconName, radiusMeters, resultElementId) {
  if (!currentShelterCoords) {
    alert("Please select an address first.");
    return 0;  // <— return 0 if no address
  }

  const shelterPoint = turf.point(currentShelterCoords);
  const buffer = turf.buffer(shelterPoint, radiusMeters, { units: 'meters' });

  // Find features inside buffer
  let featuresInBuffer = [];

  if (featureData) {
    featureData.features.forEach(f => {
      const pt = turf.point(f.geometry.coordinates);
      if (turf.booleanPointInPolygon(pt, buffer)) {
        featuresInBuffer.push(f);
      }
    });
  }

  // Show result
  // Friendly layer name
let layerName = '';
if (resultElementId === 'hospitalAccessResult') layerName = 'hospitals';
else if (resultElementId === 'schoolAccessResult') layerName = 'schools';
else if (resultElementId === 'busStopsAccessResult') layerName = 'bus stops';

document.getElementById(resultElementId).textContent = `${featuresInBuffer.length} ${layerName} within ${radiusMeters}m`;


  // Plot buffer
  const bufferSourceId = `${layerPrefix}-buffer`;
  const bufferLayerId = `${layerPrefix}-buffer-layer`;

  if (map.getSource(bufferSourceId)) {
    map.getSource(bufferSourceId).setData(buffer);
  } else {
    map.addSource(bufferSourceId, {
      type: 'geojson',
      data: buffer
    });

    map.addLayer({
      id: bufferLayerId,
      type: 'fill',
      source: bufferSourceId,
      paint: {
        'fill-color': '#ffa500',
        'fill-opacity': 0.09,
        'fill-outline-color': '#ffa500'
      }
    });
  }

  // Plot points inside buffer
  const pointsGeoJSON = {
    type: 'FeatureCollection',
    features: featuresInBuffer
  };

  const pointsSourceId = `${layerPrefix}-points`;
  const pointsLayerId = `${layerPrefix}-points-layer`;

  if (map.getSource(pointsSourceId)) {
    map.getSource(pointsSourceId).setData(pointsGeoJSON);
  } else {
    map.addSource(pointsSourceId, {
      type: 'geojson',
      data: pointsGeoJSON
    });

    map.addLayer({
      id: pointsLayerId,
      type: 'symbol',
      source: pointsSourceId,
      layout: {
        'icon-image': iconName,
        'icon-size': 0.15,
        'icon-allow-overlap': true
      }
    });

    // Move shelters-layer on top
if (map.getLayer('shelters-layer')) {
  map.moveLayer('shelters-layer');
}

  }

  return featuresInBuffer.length;  // <— ADD THIS: return count to caller!
}

function checkAllNearbyFeatures() {
  const radiusMeters = parseInt(document.getElementById('bufferRadiusInput').value) || 400;

  // Run each layer and capture counts
  const hospitalsCount = checkNearbyFeatures(hospitalsData, 'allfeatures-hospitals', 'hospital-icon', radiusMeters, 'hospitalAccessResult');
  const schoolsCount = checkNearbyFeatures(schoolsData, 'allfeatures-schools', 'school-icon', radiusMeters, 'schoolAccessResult');
  const busStopsCount = checkNearbyFeatures(busStopsData, 'allfeatures-busstops', 'bus-icon', radiusMeters, 'busStopsAccessResult');

  // Build combined message
  //const summaryText = `Features within the buffer: ${schoolsCount} schools, ${busStopsCount} bus stops, ${hospitalsCount} hospitals.`;

  // Display it
  //document.getElementById('allNearbyFeaturesResult').textContent = summaryText;
}


// SHELTER LIST
function renderShelterList(features) {
  document.getElementById("shelterListView").style.display = "block";
  document.getElementById("shelterDetails").style.display = "none";

  const shelterList = document.getElementById("shelterList");
  shelterList.innerHTML = "";

  features.forEach((feature, index) => {
    const li = document.createElement("li");
    const name = feature.properties.name || `Shelter #${index + 1}`;
    const type = capitalize(feature.properties.shelter_type || "Unknown");

    li.innerHTML = `
  <div class="shelter-item-header">
    <div class="shelter-item-title">${name}</div>
    <button class="delete-btn" data-name="${feature.properties.name}">×</button>
  </div>
  <div class="shelter-item-sub">Type: ${type}</div>
`;

li.querySelector(".delete-btn").onclick = (e) => {
  e.stopPropagation(); // Prevents triggering the detail view
  const shelterName = e.target.getAttribute("data-name");

  fetch(`/delete_shelter?name=${encodeURIComponent(shelterName)}`, { method: "DELETE" })
    .then(res => res.ok ? res.json() : Promise.reject())
    .then(() => {
      allShelterData = allShelterData.filter(f => f.properties.name !== shelterName);
      renderShelterList(allShelterData);
      map.getSource('shelters').setData({
        type: 'FeatureCollection',
        features: allShelterData
      });
    })
    .catch(() => alert("Failed to delete shelter."));
};



    li.onclick = () => showShelterDetails(feature);
    shelterList.appendChild(li);
  });
}

// SHELTER DETAIL
function showShelterDetails(feature) {
  const coords = feature.geometry.coordinates;
  map.flyTo({ center: coords, zoom: 15, speed: 1 });

  // Remove previous marker
  if (window.selectedShelterMarker) {
    window.selectedShelterMarker.remove();
  }

  // Add new red marker
  window.selectedShelterMarker = new mapboxgl.Marker({ color: 'red' })
    .setLngLat(coords)
    .addTo(map);

  document.getElementById("shelterListView").style.display = "none";
  document.getElementById("shelterDetails").style.display = "block";

  const p = feature.properties;
  document.getElementById("detail-name").textContent = p.name;
  document.getElementById("detail-type").textContent = capitalize(p.shelter_type);
  document.getElementById("detail-gas").textContent = p.gas;
  document.getElementById("detail-water").textContent = p.water;
  document.getElementById("detail-electricity").textContent = p.electricity;
  document.getElementById("detail-sewage").textContent = p.sewage;
  document.getElementById("detail-sqft").textContent = p.square_footage || "N/A";
  document.getElementById("detail-amenities").textContent = Array.isArray(p.amenities) ? p.amenities.join(", ") : p.amenities;
  document.getElementById("detail-notes").textContent = p.notes || "None";
}


function backToList() {
  renderShelterList(allShelterData);
  if (map.getSource('selected-shelter')) {
    map.removeLayer('selected-shelter-layer');
    map.removeSource('selected-shelter');
  }
}

// FILTER
function setupFilters() {
  document.querySelectorAll('#mySidebar input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', applyFilters);
  });
  sqftSlider.noUiSlider.on('update', applyFilters);
}

document.getElementById("clearFiltersBtn").addEventListener("click", () => {
  document.querySelectorAll('#mySidebar input[type="checkbox"]').forEach(cb => cb.checked = false);
  sqftSlider.noUiSlider.set([0, 5000]);
  map.getSource('shelters').setData({ type: 'FeatureCollection', features: allShelterData });
  renderShelterList(allShelterData);
});

function applyFilters() {
  const sqftRange = sqftSlider.noUiSlider.get().map(Number);
  const selectedTypes = [];
  if (document.getElementById("indoorFilter").checked) selectedTypes.push("indoor");
  if (document.getElementById("outdoorFilter").checked) selectedTypes.push("outdoor");
  const selectedUtilities = {
    gas: document.getElementById("gasFilter").checked,
    water: document.getElementById("waterFilter").checked,
    electricity: document.getElementById("electricityFilter").checked,
    sewage: document.getElementById("sewageFilter").checked
  };
  const selectedAmenities = [];
  if (document.getElementById("showerFilter").checked) selectedAmenities.push("shower");
  if (document.getElementById("kitchenFilter").checked) selectedAmenities.push("kitchen");
  if (document.getElementById("laundryFilter").checked) selectedAmenities.push("laundry");

  const filtered = allShelterData.filter(f => {
    const p = f.properties;
    if (p.square_footage < sqftRange[0] || p.square_footage > sqftRange[1]) return false;
    if (selectedTypes.length && !selectedTypes.includes(p.shelter_type?.toLowerCase())) return false;
    for (let util in selectedUtilities) {
      if (selectedUtilities[util] && !p[util]) return false;
    }
    if (selectedAmenities.length) {
      const amenities = Array.isArray(p.amenities) ? p.amenities.map(a => a.toLowerCase()) : [];
      for (let a of selectedAmenities) {
        if (!amenities.includes(a)) return false;
      }
    }
    return true;
  });

  map.getSource('shelters').setData({ type: 'FeatureCollection', features: filtered });
  renderShelterList(filtered);
}

function resetAddForm() {
  document.getElementById("typeInput").value = "indoor";
  ["gasInput", "waterInput", "electricityInput", "sewageInput"].forEach(id => {
    document.getElementById(id).checked = false;
  });
  document.querySelectorAll('input[name="amenities"]').forEach(cb => cb.checked = false);
  document.getElementById("notesInput").value = "";
  document.getElementById("sqftInput").value = "";
  currentShelterCoords = null;
  currentShelterAddress = "";
}

document.getElementById("searchInput").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  if (!query) {
    applyFilters();
    return;
  }
  const filtered = allShelterData.filter(f => {
    const name = f.properties.name?.toLowerCase() || "";
    const notes = f.properties.notes?.toLowerCase() || "";
    return name.includes(query) || notes.includes(query);
  });
  renderShelterList(filtered);
  map.getSource('shelters').setData({ type: 'FeatureCollection', features: filtered });
});

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}


function openInfoSidebar() {
  document.getElementById("infoSidebar").classList.add("active");
  document.getElementById("myOverlay").classList.add("active");
}

function closeInfoSidebar() {
  document.getElementById("infoSidebar").classList.remove("active");
  document.getElementById("myOverlay").classList.remove("active");
}


// GLOBAL STATE
let allShelterData = [];
let currentShelterCoords = null;
let currentShelterAddress = "";

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
  start: [0, 5000],
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
  zoom: 10
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

      map.loadImage('https://cdn-icons-png.flaticon.com/512/684/684908.png', (error, image) => {
        if (error) throw error;
        if (!map.hasImage('pin-icon')) {
          map.addImage('pin-icon', image);
        }

        map.addLayer({
          id: 'shelters-layer',
          type: 'symbol',
          source: 'shelters',
          layout: {
            "icon-image": "pin-icon",
            "icon-size": 0.05,
            "icon-allow-overlap": true
          }
        });

        renderShelterList(allShelterData);
        setupFilters();
        clearFilters();
      });
    })
    .catch(err => {
      console.error("Failed to load existing shelter data:", err);
    });

  //  Add Parcels Source
  map.addSource('parcels', {
    type: 'geojson',
    data: '/data/parcels_transit_scored_categorized.geojson'
  });

  // Add Parcel Layer
  map.addLayer({
    id: 'parcel-transit-score',
    type: 'fill',
    source: 'parcels',
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
      'fill-opacity': 0.6
    }
  });

  // 🧭 Zoom to parcel bounds after loading data
  fetch('/data/parcels_transit_scored_categorized.geojson')
    .then(res => res.json())
    .then(data => {
      map.getSource('parcels').setData(data);

      const bounds = new mapboxgl.LngLatBounds();
      data.features.forEach(feature => {
        const coords = feature.geometry.coordinates[0];
        coords.forEach(coord => bounds.extend(coord));
      });

      map.fitBounds(bounds, { padding: 20 });
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
  const highlightSource = { type: 'FeatureCollection', features: [feature] };
  if (map.getSource('selected-shelter')) {
    map.getSource('selected-shelter').setData(highlightSource);
  } else {
    map.addSource('selected-shelter', { type: 'geojson', data: highlightSource });
    map.addLayer({
      id: 'selected-shelter-layer',
      type: 'circle',
      source: 'selected-shelter',
      paint: {
        'circle-radius': 10,
        'circle-color': '#ff6600',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });
  }
  document.getElementById("shelterListView").style.display = "none";
  document.getElementById("shelterDetails").style.display = "block";
  const p = feature.properties;
  const content = `
    <h3>${p.name}</h3>
    <p><strong>Type:</strong> ${capitalize(p.shelter_type)}</p>
    <p><strong>Gas:</strong> ${p.gas}</p>
    <p><strong>Water:</strong> ${p.water}</p>
    <p><strong>Electricity:</strong> ${p.electricity}</p>
    <p><strong>Sewage:</strong> ${p.sewage}</p>
    <p><strong>Square Footage:</strong> ${p.square_footage || 'N/A'}</p>
    <p><strong>Amenities:</strong> ${Array.isArray(p.amenities) ? p.amenities.join(', ') : p.amenities}</p>
    <p><strong>Notes:</strong> ${p.notes || 'None'}</p>
  `;
  document.getElementById("shelterDetailContent").innerHTML = content;
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




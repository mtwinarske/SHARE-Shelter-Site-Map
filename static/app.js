// GLOBAL STATE
let allShelterData = [];
let currentShelterCoords = null;
let currentShelterAddress = "";

// INFO SIDEBAR
function openInfoSidebar() {
  document.getElementById("infoSidebar").classList.add("active");
  document.getElementById("myOverlay").classList.add("active");
  setTimeout(() => map.resize(), 300);
}

// MAP FILTER SIDEBAR
function openSidebar() {
  document.getElementById("mySidebar").classList.add("active");
  document.getElementById("myOverlay").classList.add("active");
  setTimeout(() => map.resize(), 300);
}

// CLOSE BOTH SIDEBARS
function closeAllSidebars() {
  document.getElementById("mySidebar").classList.remove("active");
  document.getElementById("infoSidebar").classList.remove("active");
  document.getElementById("myOverlay").classList.remove("active");
  setTimeout(() => map.resize(), 300);
}

const sqftSlider = document.getElementById('sqftSlider');
const sqftRangeText = document.getElementById('sqftRangeText');

noUiSlider.create(sqftSlider, {
  start: [500, 2000],
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
  placeholder: 'Search for address...',
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

      map.addLayer({
        id: 'shelters-layer',
        type: 'circle',
        source: 'shelters',
        paint: {
          'circle-radius': 7,
          'circle-color': '#007bff',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff'
        }
      });
      renderShelterList(allShelterData);
    })
    .catch(err => {
      console.error("Failed to load existing shelter data:", err);
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

  map.getSource('shelters').setData({
    type: 'FeatureCollection',
    features: allShelterData
  });

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
      <div class="shelter-item-title">${name}</div>
      <div class="shelter-item-sub">${type}</div>
    `;
    li.onclick = () => showShelterDetails(feature);
    shelterList.appendChild(li);
  });
}

// SHELTER DETAIL

function showShelterDetails(feature) {
  const coords = feature.geometry.coordinates;

  map.flyTo({
    center: coords,
    zoom: 15,
    speed: 1
  });

  const highlightSource = {
    type: 'FeatureCollection',
    features: [feature]
  };

  if (map.getSource('selected-shelter')) {
    map.getSource('selected-shelter').setData(highlightSource);
  } else {
    map.addSource('selected-shelter', {
      type: 'geojson',
      data: highlightSource
    });

    map.addLayer({
      id: 'selected-shelter-layer',
      type: 'circle',
      source: 'selected-shelter',
      paint: {
        'circle-radius': 10,
        'circle-color': '#eb0000',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff'
      }
    });
  }

  document.getElementById("shelterListView").style.display = "none";
  document.getElementById("shelterDetails").style.display = "block";

  const p = feature.properties;
  const content = `
    <table class="shelter-detail-table">
      <tr><th>Name</th><td>${p.name}</td></tr>
      <tr><th>Type</th><td>${capitalize(p.shelter_type)}</td></tr>
      <tr><th>Gas</th><td>${p.gas}</td></tr>
      <tr><th>Water</th><td>${p.water}</td></tr>
      <tr><th>Electricity</th><td>${p.electricity}</td></tr>
      <tr><th>Sewage</th><td>${p.sewage}</td></tr>
      <tr><th>Square Footage</th><td>${p.square_footage || 'N/A'}</td></tr>
      <tr><th>Amenities</th><td>${Array.isArray(p.amenities) ? p.amenities.join(', ') : p.amenities}</td></tr>
      <tr><th>Notes</th><td>${p.notes || 'None'}</td></tr>
    </table>
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
// FUNCTIONS
// HERE
function setupFilters() {
}

// RESET FORM AFTER SUBMIT
function resetAddForm() {
  document.getElementById("typeInput").value = "indoor";
  ["gasInput", "waterInput", "electricityInput", "sewageInput"].forEach(id => {
    document.getElementById(id).checked = false;
  });
  document.querySelectorAll('input[name="amenities"]').forEach(cb => cb.checked = false);
  document.getElementById("notesInput").value = "";
  currentShelterCoords = null;
  currentShelterAddress = "";
}

// LIVE SEARCH
document.getElementById("searchInput").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allShelterData.filter(f => {
    const name = f.properties.name?.toLowerCase() || "";
    return name.includes(query);
  });
  renderShelterList(filtered);
});


// Capitalize
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

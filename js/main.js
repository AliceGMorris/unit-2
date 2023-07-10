//declare map variable globally so all functions have access
var map;
var minValue;
var dataStats = {};

//step 1 create map
function createMap(){

    //create the map
    map = L.map('map', {
		 center: [38, -95],
		 zoom: 5
    });

    //add OSM base tilelayer
    L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', {
		 maxZoom: 20,
		 attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>'
    }).addTo(map);

    //call getData function
    getData(map);
};

function calculateMinValue(data){
    //create empty array to store all data values
    var allValues = [];
    //loop through each state
    for(var state of data.features){
        //loop through each year
        for(var year = 2007; year <= 2015; year+=1){
              //get mine for current year
              var value = state.properties["Mine_" + String(year)];
              //add value to array
              allValues.push(value);
        }
    }
    //get minimum value of our array
    var minValue = Math.min(...allValues)

    return minValue;
}

//calculate the radius of each proportional symbol
function calcPropRadius(attValue) {
    //constant factor adjusts symbol sizes evenly
    var minRadius = 3;
    //Flannery Apperance Compensation formula
    var radius = 1.0083 * Math.pow(attValue/minValue,0.5715) * minRadius

    return radius;
};

//function to convert markers to circle markers
function pointToLayer(feature, latlng, attributes){
	 //Determine which attribute to visualize with proportional symbols
	 var attribute = attributes[0];
	 
	 //check
	 //console.log(attribute);
	 
	 //create marker options
	 var options = {
		 fillColor: "#ff7800",
		 color: "#000",
		 weight: 1,
		 opacity: 1,
		 fillOpacity: 0.8
	 };
	 //For each feature, determine its value for the selected attribute
	 var attValue = Number(feature.properties[attribute]);
	 
	 //Give each feature's circle marker a radius based on its attribute value
	 options.radius = calcPropRadius(attValue);
	 
	 //create circle marker layer
	 var layer = L.circleMarker(latlng, options);
	 
	 //Example 3.18 line 4
	 
	//build popup content string starting with state...Example 2.1 line 24
	var popupContent = createPopupContent(feature.properties, attribute);
	
	//bind the popup to the circle marker 
	layer.bindPopup(popupContent, { offset: new L.Point(0,-options.radius) });
	 
	 //return the circle marker to the L.geoJson pointToLayer option
	 return layer;
};

//Add circle markers for point features to the map
function createPropSymbols(data, attributes){
	 //create a Leaflet GeoJSON layer and add it to the map
	 L.geoJson(data, {
		pointToLayer: function(feature, latlng){
			return pointToLayer(feature, latlng, attributes);
		}
	 }).addTo(map);
};

function createSequenceControls(attributes){
	
	var SequenceControl = L.Control.extend({
		options: {
			position: 'bottomleft'
		},
		
		onAdd: function () {
			// create the control container div with a particular class name
			var container = L.DomUtil.create('div', 'sequence-control-container');
			
			//create range input element (slider)
			container.insertAdjacentHTML('beforeend', '<input class="range-slider" type="range">')
			
			//add skip buttons
			container.insertAdjacentHTML('beforeend', '<button class="step" id="reverse" title="Reverse"><img src="img/reverse.png"></button>'); 
			container.insertAdjacentHTML('beforeend', '<button class="step" id="forward" title="Forward"><img src="img/forward.png"></button>');
			
			//disable any mouse event listeners for the container
			L.DomEvent.disableClickPropagation(container);
			
			return container;
		}
	});
	
	map.addControl(new SequenceControl());
	
	//set slider attributes
	document.querySelector(".range-slider").max = 8;
	document.querySelector(".range-slider").min = 0;
	document.querySelector(".range-slider").value = 0;
	document.querySelector(".range-slider").step = 1;
	
	document.querySelectorAll('.step').forEach(function(step){
		 step.addEventListener("click", function(){
			//sequence
			var index = document.querySelector('.range-slider').value;
			
			if (step.id == 'forward'){
				 index++;
				 //Step 7: if past the last attribute, wrap around to first attribute
				 index = index > 8 ? 0 : index;
			} else if (step.id == 'reverse'){
				 index--;
				 //Step 7: if past the first attribute, wrap around to last attribute
				 index = index < 0 ? 8 : index;
				 };
			 //Step 8: update slider
			 document.querySelector('.range-slider').value = index
			 updatePropSymbols(attributes[index]);
			 //console.log(attributes[index]);
		 })
	 })
	 
	 document.querySelector('.range-slider').addEventListener('input', function(){
		//sequence
		var index = this.value;
		//console.log(index)
		updatePropSymbols(attributes[index]);
	 });
}

function createLegend(attribute){
	var LegendControl = L.Control.extend({
		options: {
			position: 'bottomright'
			},
			
		onAdd: function () {
			// create the control container with a particular class name
			var container = L.DomUtil.create('div', 'legend-control-container');
		
			container.innerHTML = '<p class="temporalLegend">Number of mines in <span class="year">2007</span></p>';
			
			//Step 1: start attribute legend svg string
			var svg = '<svg id="attribute-legend" width="auto" height="90px">';
			
			//array of circle names to base loop on
			var circles = ["max", "mean", "min"];
			
			//Step 2: loop to add each circle and text to svg string
			for (var i=0; i<circles.length; i++){
				
				//Step 3: assign the r and cy attributes 
				var radius = calcPropRadius(dataStats[circles[i]]); 
				var cy = 90 - radius;
				
				//circle string
				svg += '<circle class="legend-circle" id="' + circles[i] + '" r="' + radius + '"cy="' + cy + '" fill="#F47821" fill-opacity="0.8" stroke="#000000" cx="50"/>';
				
				//evenly space out labels 
				var textY = i * 20 + 47; 
				//text string 
				svg += '<text id="' + circles[i] + '-text" x="95" y="' + textY + '">' + Math.round(dataStats[circles[i]]*100)/100 + " mines" + '</text>';
			};
 
			//close svg string
			svg += "</svg>";
			
			//add attribute legend svg to container
			container.insertAdjacentHTML('beforeend',svg);
			
			return container;
		}
	});
	
	map.addControl(new LegendControl());
};

function calcStats(data){
	//create empty array to store all data values
	var allValues = [];
	//loop through each mines
	for(var mines of data.features){
		//loop through each year
		for(var year = 2007; year <= 2015; year+=1){
			//get population for current year
			var value = mines.properties["Mine_"+ String(year)];
			//add value to array
			allValues.push(value);
		}
	}
	//get min, max, mean stats for our array
	dataStats.min = Math.min(...allValues);
	dataStats.max = Math.max(...allValues);
	
	//calculate meanValue
	var sum = allValues.reduce(function(a, b){return a+b;});
	dataStats.mean = sum/ allValues.length;
}

function processData(data){
	 //empty array to hold attributes
	 var attributes = [];
	 
	 //properties of the first feature in the dataset
	 var properties = data.features[0].properties;
	 
	 //push each attribute name into attributes array
	 for (var attribute in properties){
		//only take attributes with mine values
		if (attribute.indexOf("Mine") > -1){
			attributes.push(attribute);
		};
	 };
	 
	 //check result
	 //console.log(attributes);
	 
	 return attributes;
};

function updatePropSymbols(attribute){
	var year = attribute.split("_")[1];
	//update temporal legend
	document.querySelector("span.year").innerHTML = year;
	 map.eachLayer(function(layer){
		if (layer.feature && layer.feature.properties[attribute]){
			//update the layer style and popup
			//access feature properties
			 var props = layer.feature.properties;
			 //update each feature's radius based on new attribute values
			 var radius = calcPropRadius(props[attribute]);
			 layer.setRadius(radius);
		 
		 
			 //build popup content string starting with state...Example 2.1 line 24
			 var popupContent = createPopupContent(props, attribute);
			 
			 //update popup with new content 
			 popup = layer.getPopup(); 
			 popup.setContent(popupContent).update();
		
			//update popup content 
			 popup = layer.getPopup(); 
			 popup.setContent(popupContent).update();
		};
	 });
};

function createPopupContent(properties, attribute){
	 //add state to popup content string
	 var popupContent = "<p><b>State:</b> " + properties.State + "</p>";
	 
	 //add formatted attribute to panel content string
	 var year = attribute.split("_")[1];
	 popupContent += "<p><b>Number of mines in " + year + ":</b> " + properties[attribute] + " </p>";
	 
	 return popupContent;
};

//Step 2: Import GeoJSON data
function getData(){
    //load the data
    fetch("data/NumMines.geojson")
        .then(function(response){
            return response.json();
        })
        .then(function(json){
			//create an attributes array
			var attributes = processData(json);
			
			calcStats(json);
			
            //calculate minimum data value
            minValue = calculateMinValue(json);
            //call function to create proportional symbols
            createPropSymbols(json, attributes);
			
			createSequenceControls(attributes);
			
			createLegend(attributes);
		
        })
};

document.addEventListener('DOMContentLoaded',createMap)
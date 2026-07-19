/**
 * GlowSky Weather App Logic
 * Uses Open-Meteo APIs for Geocoding and Weather Forecast.
 */

document.addEventListener("DOMContentLoaded", () => {
    // API Endpoints
    const WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast";
    const GEOCODING_API_URL = "https://geocoding-api.open-meteo.com/v1/search";

    // Application State
    let state = {
        unit: "C", // "C" or "F"
        currentCity: {
            name: "İstanbul",
            country: "Türkiye",
            latitude: 41.0138,
            longitude: 28.9497
        },
        weatherData: null,
        searchDebounceTimeout: null
    };

    // DOM Elements
    const citySearchInput = document.getElementById("city-search");
    const clearSearchBtn = document.getElementById("clear-search");
    const suggestionsList = document.getElementById("suggestions-list");
    const btnGeolocation = document.getElementById("btn-geolocation");
    const unitCBtn = document.getElementById("unit-c");
    const unitFBtn = document.getElementById("unit-f");
    
    const locationNameEl = document.getElementById("location-name");
    const currentDateEl = document.getElementById("current-date");
    const currentTempEl = document.getElementById("current-temp");
    const weatherDescriptionEl = document.getElementById("weather-description");
    const mainWeatherIconEl = document.getElementById("main-weather-icon");
    const tempMaxEl = document.getElementById("temp-max");
    const tempMinEl = document.getElementById("temp-min");

    const metricHumidityEl = document.getElementById("metric-humidity");
    const humidityStatusEl = document.getElementById("humidity-status");
    const metricWindEl = document.getElementById("metric-wind");
    const windDirIconEl = document.getElementById("wind-dir-icon");
    const windDirTextEl = document.getElementById("wind-dir-text");
    const metricUvEl = document.getElementById("metric-uv");
    const uvStatusEl = document.getElementById("uv-status");
    const metricPressureEl = document.getElementById("metric-pressure");
    const pressureStatusEl = document.getElementById("pressure-status");
    const metricPrecipitationEl = document.getElementById("metric-precipitation");
    const precipitationStatusEl = document.getElementById("precipitation-status");
    const metricSunriseEl = document.getElementById("metric-sunrise");
    const metricSunsetEl = document.getElementById("metric-sunset");

    const hourlyForecastListEl = document.getElementById("hourly-forecast-list");
    const dailyForecastListEl = document.getElementById("daily-forecast-list");
    const notificationToast = document.getElementById("notification-toast");
    const notificationMessage = document.getElementById("notification-message");

    // Initialize application
    init();

    function init() {
        // Load initial state from LocalStorage if available
        loadSavedState();

        // Attach Event Listeners
        setupEventListeners();

        // Fetch Initial Weather
        fetchWeather(state.currentCity.latitude, state.currentCity.longitude);
    }

    function setupEventListeners() {
        // Search inputs
        citySearchInput.addEventListener("input", handleSearchInput);
        citySearchInput.addEventListener("focus", () => {
            if (suggestionsList.children.length > 0) {
                suggestionsList.style.display = "flex";
            }
        });

        clearSearchBtn.addEventListener("click", () => {
            citySearchInput.value = "";
            clearSearchBtn.style.display = "none";
            suggestionsList.innerHTML = "";
            suggestionsList.style.display = "none";
            citySearchInput.focus();
        });

        // Close suggestions dropdown when clicking outside
        document.addEventListener("click", (e) => {
            if (!citySearchInput.contains(e.target) && !suggestionsList.contains(e.target)) {
                suggestionsList.style.display = "none";
            }
        });

        // Geolocation
        btnGeolocation.addEventListener("click", handleGeolocation);

        // Unit Switchers
        unitCBtn.addEventListener("click", () => setTemperatureUnit("C"));
        unitFBtn.addEventListener("click", () => setTemperatureUnit("F"));
    }

    // ==========================================
    // API CALLS
    // ==========================================

    /**
     * Fetches weather information using latitude and longitude
     */
    async function fetchWeather(lat, lon) {
        try {
            showLoaders();
            const url = `${WEATHER_API_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max&timezone=auto`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error("Hava durumu verisi alınamadı.");
            
            const data = await response.json();
            state.weatherData = data;
            
            // Render all UI elements with new data
            renderWeatherUI();
            saveStateToLocalStorage();
        } catch (error) {
            console.error("Weather fetch error:", error);
            showToast("Hava durumu verileri yüklenirken bir sorun oluştu.");
        }
    }

    /**
     * Geocodes the user input text to list matched cities
     */
    async function searchCity(query) {
        if (!query || query.trim().length < 2) {
            suggestionsList.innerHTML = "";
            suggestionsList.style.display = "none";
            return;
        }

        try {
            const url = `${GEOCODING_API_URL}?name=${encodeURIComponent(query)}&count=5&language=tr&format=json`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Arama sonucu alınamadı.");
            
            const data = await response.json();
            renderSuggestions(data.results || []);
        } catch (error) {
            console.error("Geocoding fetch error:", error);
        }
    }

    // ==========================================
    // RENDERING & INTERFACE
    // ==========================================

    function showLoaders() {
        hourlyForecastListEl.innerHTML = '<div class="forecast-loading">Saatlik veriler yükleniyor...</div>';
        dailyForecastListEl.innerHTML = '<div class="forecast-loading">Günlük veriler yükleniyor...</div>';
    }

    function renderWeatherUI() {
        if (!state.weatherData) return;

        const current = state.weatherData.current;
        const daily = state.weatherData.daily;
        const hourly = state.weatherData.hourly;

        // Set dynamic theme class on body
        updateTheme(current.weather_code);

        // Header and metadata
        locationNameEl.textContent = `${state.currentCity.name}, ${state.currentCity.country}`;
        currentDateEl.textContent = formatDate(new Date());

        // Temperatures
        const temp = formatTemperature(current.temperature_2m);
        const tempMax = formatTemperature(daily.temperature_2m_max[0]);
        const tempMin = formatTemperature(daily.temperature_2m_min[0]);
        
        currentTempEl.textContent = temp;
        tempMaxEl.innerHTML = `<i data-lucide="arrow-up" class="range-icon max-color"></i> En Yüksek: ${tempMax}°`;
        tempMinEl.innerHTML = `<i data-lucide="arrow-down" class="range-icon min-color"></i> En Düşük: ${tempMin}°`;

        // Weather Code details
        const wmoInfo = getWmoCodeDetails(current.weather_code);
        weatherDescriptionEl.textContent = wmoInfo.description;
        
        // Large main weather icon
        mainWeatherIconEl.innerHTML = `<i data-lucide="${wmoInfo.icon}" class="weather-icon-large"></i>`;

        // Detailed Metrics
        // 1. Humidity
        metricHumidityEl.textContent = current.relative_humidity_2m;
        humidityStatusEl.textContent = getHumidityStatusText(current.relative_humidity_2m);

        // 2. Wind
        const windSpeed = state.unit === "C" ? current.wind_speed_10m : kmhToMph(current.wind_speed_10m).toFixed(1);
        metricWindEl.textContent = windSpeed;
        const windUnitText = state.unit === "C" ? "km/s" : "mph";
        document.getElementById("wind-unit").textContent = windUnitText;

        const windDirDeg = current.wind_direction_10m;
        windDirIconEl.style.transform = `rotate(${windDirDeg}deg)`;
        windDirTextEl.textContent = getWindDirectionText(windDirDeg);

        // 3. UV Index
        const uvIndex = daily.uv_index_max[0];
        metricUvEl.textContent = uvIndex.toFixed(1);
        uvStatusEl.textContent = getUvStatusText(uvIndex);

        // 4. Pressure
        metricPressureEl.textContent = Math.round(current.pressure_msl);
        pressureStatusEl.textContent = getPressureStatusText(current.pressure_msl);

        // 5. Precipitation Probability
        const precProb = daily.precipitation_probability_max[0];
        metricPrecipitationEl.textContent = precProb;
        precipitationStatusEl.textContent = getPrecipitationStatusText(precProb);

        // 6. Sunrise & Sunset
        metricSunriseEl.textContent = formatTimeString(daily.sunrise[0]);
        metricSunsetEl.textContent = formatTimeString(daily.sunset[0]);

        // Render Hourly forecast
        renderHourlyForecast(hourly);

        // Render 7-day forecast
        renderDailyForecast(daily);

        // Re-draw Lucide Icons
        lucide.createIcons();
    }

    function renderSuggestions(cities) {
        suggestionsList.innerHTML = "";
        
        if (cities.length === 0) {
            suggestionsList.style.display = "none";
            return;
        }

        cities.forEach(city => {
            const li = document.createElement("li");
            li.className = "suggestion-item";
            
            const cityName = city.name;
            const cityCountry = city.country || "";
            const adminRegion = city.admin1 ? `, ${city.admin1}` : "";
            
            li.innerHTML = `
                <i data-lucide="map-pin"></i>
                <span>${cityName}${adminRegion} (${cityCountry})</span>
            `;
            
            li.addEventListener("click", () => {
                state.currentCity = {
                    name: cityName,
                    country: cityCountry,
                    latitude: city.latitude,
                    longitude: city.longitude
                };
                
                // Clear and close search Suggestions dropdown
                citySearchInput.value = `${cityName}, ${cityCountry}`;
                suggestionsList.style.display = "none";
                clearSearchBtn.style.display = "flex";

                // Fetch weather
                fetchWeather(city.latitude, city.longitude);
            });

            suggestionsList.appendChild(li);
        });

        lucide.createIcons();
        suggestionsList.style.display = "flex";
    }

    function renderHourlyForecast(hourly) {
        hourlyForecastListEl.innerHTML = "";

        // Get the current hour index from the response timezone details
        const currentHourIndex = new Date().getHours();
        
        // Show the next 24 hours starting from the current hour
        for (let i = currentHourIndex; i < currentHourIndex + 24; i++) {
            if (i >= hourly.time.length) break;

            const timeStr = formatTimeString(hourly.time[i]);
            const tempVal = formatTemperature(hourly.temperature_2m[i]);
            const code = hourly.weather_code[i];
            const wmoInfo = getWmoCodeDetails(code);

            const card = document.createElement("div");
            card.className = "hourly-card glass-card";
            
            // Format hour representation (e.g. 14:00 or 02:00 PM)
            card.innerHTML = `
                <span class="hourly-time">${timeStr}</span>
                <i data-lucide="${wmoInfo.icon}" class="hourly-icon"></i>
                <span class="hourly-temp">${tempVal}°</span>
            `;

            hourlyForecastListEl.appendChild(card);
        }
    }

    function renderDailyForecast(daily) {
        dailyForecastListEl.innerHTML = "";

        // Calculate absolute overall min/max to render temperature progress bars
        const minTempOverall = Math.min(...daily.temperature_2m_min);
        const maxTempOverall = Math.max(...daily.temperature_2m_max);
        const tempRangeOverall = maxTempOverall - minTempOverall;

        // Skip index 0 (today) to render the 7 upcoming days
        for (let i = 1; i < daily.time.length; i++) {
            const dateVal = new Date(daily.time[i]);
            const dayName = formatDayName(dateVal);
            
            const wmoInfo = getWmoCodeDetails(daily.weather_code[i]);
            const minTemp = formatTemperature(daily.temperature_2m_min[i]);
            const maxTemp = formatTemperature(daily.temperature_2m_max[i]);

            // Calculate progress bar limits
            const rangeMin = daily.temperature_2m_min[i];
            const rangeMax = daily.temperature_2m_max[i];
            const barLeft = tempRangeOverall > 0 ? ((rangeMin - minTempOverall) / tempRangeOverall) * 100 : 0;
            const barWidth = tempRangeOverall > 0 ? ((rangeMax - rangeMin) / tempRangeOverall) * 100 : 100;

            const row = document.createElement("div");
            row.className = "daily-row glass-card";

            row.innerHTML = `
                <span class="daily-day-name">${dayName}</span>
                <div class="daily-icon-wrapper">
                    <i data-lucide="${wmoInfo.icon}" class="daily-icon"></i>
                </div>
                <span class="daily-condition">${wmoInfo.description}</span>
                <div class="daily-temps">
                    <span class="daily-min">${minTemp}°</span>
                    <div class="daily-temp-bar-container">
                        <div class="daily-temp-bar" style="margin-left: ${barLeft}%; width: ${barWidth}%;"></div>
                    </div>
                    <span class="daily-max">${maxTemp}°</span>
                </div>
            `;

            dailyForecastListEl.appendChild(row);
        }
    }

    // ==========================================
    // THEMING & CSS MODIFICATIONS
    // ==========================================

    function updateTheme(weatherCode) {
        const body = document.body;
        
        // Reset old class
        body.classList.remove(
            "theme-sunny",
            "theme-cloudy",
            "theme-rainy",
            "theme-snowy",
            "theme-stormy"
        );

        // Fetch theme key based on weather interpretation code
        const codeMap = {
            0: "theme-sunny", // Clear
            1: "theme-cloudy", // Mainly clear
            2: "theme-cloudy", // Partly cloudy
            3: "theme-cloudy", // Overcast
            45: "theme-cloudy", // Fog
            48: "theme-cloudy", // Depositing rime fog
            51: "theme-rainy", // Drizzle
            53: "theme-rainy",
            55: "theme-rainy",
            56: "theme-rainy",
            57: "theme-rainy",
            61: "theme-rainy", // Rain
            63: "theme-rainy",
            65: "theme-rainy",
            66: "theme-rainy",
            67: "theme-rainy",
            71: "theme-snowy", // Snow fall
            73: "theme-snowy",
            75: "theme-snowy",
            77: "theme-snowy",
            80: "theme-rainy", // Rain showers
            81: "theme-rainy",
            82: "theme-rainy",
            85: "theme-snowy", // Snow showers
            86: "theme-snowy",
            95: "theme-stormy", // Thunderstorm
            96: "theme-stormy",
            99: "theme-stormy"
        };

        const targetTheme = codeMap[weatherCode] || "theme-sunny";
        body.classList.add(targetTheme);
    }

    // ==========================================
    // UTILITY & FORMATTING FUNCTIONS
    // ==========================================

    function setTemperatureUnit(unit) {
        if (state.unit === unit) return;
        state.unit = unit;

        if (unit === "C") {
            unitCBtn.classList.add("active");
            unitFBtn.classList.remove("active");
            document.querySelectorAll(".temp-unit").forEach(el => el.textContent = "°C");
        } else {
            unitFBtn.classList.add("active");
            unitCBtn.classList.remove("active");
            document.querySelectorAll(".temp-unit").forEach(el => el.textContent = "°F");
        }

        renderWeatherUI();
    }

    function formatTemperature(celsiusVal) {
        if (state.unit === "F") {
            return Math.round((celsiusVal * 9) / 5 + 32);
        }
        return Math.round(celsiusVal);
    }

    function kmhToMph(kmh) {
        return kmh * 0.621371;
    }

    function formatDate(date) {
        const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
        return date.toLocaleDateString("tr-TR", options);
    }

    function formatDayName(date) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) return "Bugün";
        if (date.toDateString() === tomorrow.toDateString()) return "Yarın";

        const options = { weekday: "long" };
        return date.toLocaleDateString("tr-TR", options);
    }

    function formatTimeString(isoString) {
        if (!isoString) return "--:--";
        const date = new Date(isoString);
        return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    }

    function handleSearchInput(e) {
        const query = e.target.value;
        
        if (query.trim().length > 0) {
            clearSearchBtn.style.display = "flex";
        } else {
            clearSearchBtn.style.display = "none";
            suggestionsList.innerHTML = "";
            suggestionsList.style.display = "none";
        }

        clearTimeout(state.searchDebounceTimeout);
        state.searchDebounceTimeout = setTimeout(() => {
            searchCity(query);
        }, 350);
    }

    function handleGeolocation() {
        if (!navigator.geolocation) {
            showToast("Tarayıcınız konum servisini desteklemiyor.");
            return;
        }

        // Show button active status or spinner
        btnGeolocation.querySelector("span").textContent = "Aranıyor...";
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;

                // Try to reverse geocode using Nominatim API (OpenStreetMap) to get the city name
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=tr`);
                    if (response.ok) {
                        const data = await response.json();
                        const address = data.address;
                        const cityName = address.province || address.city || address.town || address.village || "Bilinmeyen Şehir";
                        const countryName = address.country || "Türkiye";
                        
                        state.currentCity = {
                            name: cityName,
                            country: countryName,
                            latitude: lat,
                            longitude: lon
                        };
                    } else {
                        // Fallback generic name if name geocoding fails
                        state.currentCity = {
                            name: "Bulunduğunuz Konum",
                            country: "",
                            latitude: lat,
                            longitude: lon
                        };
                    }
                } catch (error) {
                    console.error("Reverse geocoding failed", error);
                    state.currentCity = {
                        name: "Bulunduğunuz Konum",
                        country: "",
                        latitude: lat,
                        longitude: lon
                    };
                }

                btnGeolocation.querySelector("span").textContent = "Konum";
                citySearchInput.value = state.currentCity.name;
                clearSearchBtn.style.display = "flex";

                fetchWeather(lat, lon);
            },
            (error) => {
                console.error("Geolocation error:", error);
                btnGeolocation.querySelector("span").textContent = "Konum";
                showToast("Konumunuza erişilemedi. Lütfen elle arama yapın.");
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    }

    function showToast(message) {
        notificationMessage.textContent = message;
        notificationToast.style.display = "flex";

        setTimeout(() => {
            notificationToast.style.display = "none";
        }, 4000);
    }

    // ==========================================
    // CACHING STATE IN LOCALSTORAGE
    // ==========================================

    function saveStateToLocalStorage() {
        try {
            localStorage.setItem("glowsky_state", JSON.stringify({
                unit: state.unit,
                currentCity: state.currentCity
            }));
        } catch (error) {
            console.error("Failed to save state:", error);
        }
    }

    function loadSavedState() {
        try {
            const saved = localStorage.getItem("glowsky_state");
            if (saved) {
                const parsed = JSON.parse(saved);
                state.unit = parsed.unit || "C";
                state.currentCity = parsed.currentCity || state.currentCity;
                
                // Set correct search input value
                citySearchInput.value = `${state.currentCity.name}, ${state.currentCity.country}`;
                clearSearchBtn.style.display = "flex";

                // Setup toggle active button
                if (state.unit === "C") {
                    unitCBtn.classList.add("active");
                    unitFBtn.classList.remove("active");
                } else {
                    unitFBtn.classList.add("active");
                    unitCBtn.classList.remove("active");
                }
            }
        } catch (error) {
            console.error("Failed to load state:", error);
        }
    }

    // ==========================================
    // METRIC STATUS LOGICS & WMO CODES
    // ==========================================

    function getHumidityStatusText(humidity) {
        if (humidity < 30) return "Çok Kuru (Nemlendirici Önerilir)";
        if (humidity <= 60) return "Kararlı & Rahat";
        return "Çok Nemli (Yapışkan Hava)";
    }

    function getUvStatusText(uvIndex) {
        if (uvIndex < 3) return "Düşük (Güvenli)";
        if (uvIndex < 6) return "Orta (Güneş kremi kullanın)";
        if (uvIndex < 8) return "Yüksek (Gölge tercih edin)";
        return "Çok Yüksek (Güneşe çıkmayın)";
    }

    function getPressureStatusText(pressure) {
        if (pressure < 1009) return "Alçak Basınç (Kararsız Hava)";
        if (pressure <= 1022) return "Kararlı (Normal)";
        return "Yüksek Basınç (Sakin/Açık Hava)";
    }

    function getPrecipitationStatusText(precProb) {
        if (precProb === 0) return "Yağış ihtimali yok";
        if (precProb < 30) return "Çok zayıf ihtimal";
        if (precProb < 60) return "Orta ihtimal (Şemsiye alabilirsiniz)";
        return "Yüksek İhtimal (Şemsiye Önerilir)";
    }

    function getWindDirectionText(deg) {
        const directions = [
            "Kuzey (K)", "Kuzeydoğu (KD)", "Doğu (D)", "Güneydoğu (GD)",
            "Güney (G)", "Güneybatı (GB)", "Batı (B)", "Kuzeybatı (KB)"
        ];
        // 360 degrees divided by 8 directions = 45 degrees step
        const index = Math.round(deg / 45) % 8;
        return directions[index];
    }

    /**
     * Map WMO Weather Interpretation Codes to descriptions and Lucide Icons
     * WMO Codes description: https://open-meteo.com/en/docs
     */
    function getWmoCodeDetails(code) {
        const codes = {
            0: { description: "Güneşli / Açık", icon: "sun" },
            1: { description: "Çoğunlukla Açık", icon: "cloud-sun" },
            2: { description: "Parçalı Bulutlu", icon: "cloud-sun" },
            3: { description: "Bulutlu", icon: "cloud" },
            45: { description: "Sisli", icon: "cloud-fog" },
            48: { description: "Puslu Sis", icon: "cloud-fog" },
            51: { description: "Hafif Çiseleyen Yağmur", icon: "cloud-drizzle" },
            53: { description: "Çiseleyen Yağmur", icon: "cloud-drizzle" },
            55: { description: "Yoğun Çiseleyen Yağmur", icon: "cloud-drizzle" },
            56: { description: "Hafif Dondurucu Çiseleme", icon: "cloud-drizzle" },
            57: { description: "Yoğun Dondurucu Çiseleme", icon: "cloud-drizzle" },
            61: { description: "Hafif Şiddetli Yağmur", icon: "cloud-rain" },
            63: { description: "Orta Şiddetli Yağmur", icon: "cloud-rain" },
            65: { description: "Kuvvetli Yağmur", icon: "cloud-rain" },
            66: { description: "Hafif Dondurucu Yağmur", icon: "cloud-rain" },
            67: { description: "Kuvvetli Dondurucu Yağmur", icon: "cloud-rain" },
            71: { description: "Hafif Kar Yağışı", icon: "snowflake" },
            73: { description: "Orta Kar Yağışı", icon: "snowflake" },
            75: { description: "Yoğun Kar Yağışı", icon: "snowflake" },
            77: { description: "Kar Çisintisi", icon: "snowflake" },
            80: { description: "Hafif Sağanak Yağış", icon: "cloud-rain-wind" },
            81: { description: "Orta Sağanak Yağış", icon: "cloud-rain-wind" },
            82: { description: "Şiddetli Sağanak Yağış", icon: "cloud-rain-wind" },
            85: { description: "Hafif Sağanak Kar", icon: "cloud-snow" },
            86: { description: "Kuvvetli Sağanak Kar", icon: "cloud-snow" },
            95: { description: "Gök Gürültülü Sağanak", icon: "cloud-lightning" },
            96: { description: "Dolu ile Gök Gürültülü Sağanak", icon: "cloud-lightning" },
            99: { description: "Kuvvetli Dolu ile Gök Gürültülü Sağanak", icon: "cloud-lightning" }
        };

        return codes[code] || { description: "Bilinmeyen Durum", icon: "help-circle" };
    }
});

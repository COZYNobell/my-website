// 이 함수는 dashboard.html에서 Google Maps API 스크립트가 로드된 후 자동으로 호출됩니다.
async function initDashboardMap() {
    console.log("initDashboardMap 함수 시작됨.");

    const initialLocation = { lat: 37.5665, lng: 126.9780 };
    
    const mapElement = document.getElementById('map-container');
    const addressElement = document.getElementById('address-display');
    const weatherTodayElement = document.getElementById('weather-today');
    const weatherForecastElement = document.getElementById('weather-forecast'); // ✨ 예보 표시 요소 가져오기

    if (!mapElement) {
        console.error("지도 컨테이너 요소를 찾을 수 없습니다: #map-container");
        if (addressElement) addressElement.textContent = '지도 초기화 오류.';
        if (weatherTodayElement) weatherTodayElement.innerHTML = '<h2>오늘 날씨</h2><p>지도 초기화 오류.</p>';
        if (weatherForecastElement) weatherForecastElement.innerHTML = '<h2>주간 예보 (내일/모레)</h2><p>지도 초기화 오류.</p>'; // ✨ 예보 요소에도 오류 표시
        return;
    }
    if (!addressElement) {
        console.warn("주소 표시 요소를 찾을 수 없습니다: #address-display.");
    }
    if (!weatherTodayElement) {
        console.warn("오늘 날씨 표시 요소를 찾을 수 없습니다: #weather-today.");
    }
    if (!weatherForecastElement) { // ✨ 예보 요소 확인
        console.warn("주간 예보 표시 요소를 찾을 수 없습니다: #weather-forecast.");
    }

    const map = new google.maps.Map(mapElement, {
        zoom: 15,
        center: initialLocation,
    });

    const marker = new google.maps.Marker({
        position: initialLocation,
        map: map,
        title: '선택된 위치'
    });

    // 초기 위치 정보 표시
    if (addressElement) {
        displayAddress(initialLocation, addressElement);
    }
    if (weatherTodayElement) {
        displayWeather(initialLocation.lat, initialLocation.lng, weatherTodayElement);
    }
    if (weatherForecastElement) { // ✨ 초기 위치 예보 표시 함수 호출
        displayForecast(initialLocation.lat, initialLocation.lng, weatherForecastElement);
    }

    // 지도 클릭 이벤트 리스너
    map.addListener('click', async (event) => {
      const clickedLat = event.latLng.lat();
      const clickedLng = event.latLng.lng();
      const clickedLocation = { lat: clickedLat, lng: clickedLng };

      console.log(`지도 클릭됨: 위도 ${clickedLat.toFixed(4)}, 경도 ${clickedLng.toFixed(4)}`);
      marker.setPosition(clickedLocation);

      if (addressElement) {
          displayAddress(clickedLocation, addressElement);
      }
      if (weatherTodayElement) {
          displayWeather(clickedLat, clickedLng, weatherTodayElement);
      }
      if (weatherForecastElement) { // ✨ 클릭된 위치 예보 표시 함수 호출
          displayForecast(clickedLat, clickedLng, weatherForecastElement);
      }
    });

    console.log("initDashboardMap 함수 끝남. 지도 클릭 리스너 활성화됨.");
}

// 주소 표시 함수 (이전과 동일)
function displayAddress(location, element) {
    if (!element) return;
    const geocoder = new google.maps.Geocoder();
    element.textContent = '주소 정보를 요청하는 중...';
    geocoder.geocode({ 'location': location }, function(results, status) {
        if (status === 'OK') {
            if (results[0]) {
                element.textContent = `주소: ${results[0].formatted_address}`;
            } else {
                element.textContent = '주소를 찾을 수 없습니다.';
            }
        } else {
            element.textContent = 'Geocoder 요청 실패: ' + status;
            console.error('Geocoder failed due to: ' + status);
        }
    });
}

// 특정 좌표의 현재 날씨를 가져와 표시하는 함수 (이전과 동일)
async function displayWeather(lat, lon, element) {
    if (!element) return;
    element.innerHTML = '<h2>오늘 날씨</h2><p>날씨 정보를 불러오는 중...</p>';
    try {
        const response = await fetch(`/api/weather-by-coords?lat=${lat}&lon=${lon}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `날씨 정보 서버 요청 실패: ${response.status} - 응답 JSON 파싱 불가` }));
            throw new Error(errorData.message || `날씨 정보 서버 요청 실패: ${response.status}`);
        }
        const weatherData = await response.json();
        const iconUrl = `https://openweathermap.org/img/wn/${weatherData.icon}@2x.png`;
        element.innerHTML = `
            <h2>오늘 날씨 (${weatherData.cityName})</h2>
            <img src="${iconUrl}" alt="${weatherData.description}" style="vertical-align: middle;">
            <span style="text-transform: capitalize;">${weatherData.description}</span>
            <p><strong>온도:</strong> ${weatherData.temperature}°C (체감: ${weatherData.feels_like}°C)</p>
            <p><strong>습도:</strong> ${weatherData.humidity}%</p>
        `;
    } catch (error) {
        console.error('오늘 날씨 정보 표시 중 오류:', error);
        element.innerHTML = `<h2>오늘 날씨</h2><p style="color: red;">날씨 정보를 가져오는 데 실패했습니다: ${error.message}</p>`;
    }
}

// ✨✨✨ NEW: 특정 좌표의 내일/모레 날씨 예보를 가져와 표시하는 함수 - 이 함수가 새로 추가되었습니다! ✨✨✨
async function displayForecast(lat, lon, element) {
    if (!element) return; // 요소가 없으면 실행 중단
    element.innerHTML = '<h2>주간 예보 (내일/모레)</h2><p>예보 정보를 불러오는 중...</p>'; // 로딩 메시지

    try {
        // 서버의 /api/weather-forecast 엔드포인트 호출
        const response = await fetch(`/api/weather-forecast?lat=${lat}&lon=${lon}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `예보 정보 서버 요청 실패: ${response.status} - 응답 JSON 파싱 불가` }));
            throw new Error(errorData.message || `예보 정보 서버 요청 실패: ${response.status}`);
        }
        const forecastPayload = await response.json(); // { cityName: "...", forecast: [...] } 형태
        
        let forecastHtml = `<h2>주간 예보 (${forecastPayload.cityName}, 내일/모레)</h2>`;
        if (forecastPayload.forecast && forecastPayload.forecast.length > 0) {
            forecastPayload.forecast.forEach(dailyData => {
                const iconUrl = `https://openweathermap.org/img/wn/${dailyData.icon}@2x.png`;
                // 날짜를 'YYYY-MM-DD'에서 'MM월 DD일' 형태로 바꾸기 (간단 예시)
                const dateParts = dailyData.date.split('-');
                const displayDate = `${parseInt(dateParts[1])}월 ${parseInt(dateParts[2])}일`;

                forecastHtml += `
                    <div style="border: 1px solid #eee; padding: 10px; margin-bottom: 10px;">
                        <strong>${displayDate} (${dailyData.date})</strong><br>
                        <img src="${iconUrl}" alt="${dailyData.description}" style="vertical-align: middle; width: 50px; height: 50px;">
                        <span style="text-transform: capitalize;">${dailyData.description}</span><br>
                        <span>최저: ${dailyData.temp_min}°C / 최고: ${dailyData.temp_max}°C</span>
                    </div>
                `;
            });
        } else {
            forecastHtml += '<p>예보 정보를 가져올 수 없습니다.</p>';
        }
        element.innerHTML = forecastHtml;

    } catch (error) {
        console.error('날씨 예보 정보 표시 중 오류:', error);
        element.innerHTML = `<h2>주간 예보 (내일/모레)</h2><p style="color: red;">예보 정보를 가져오는 데 실패했습니다: ${error.message}</p>`;
    }
}

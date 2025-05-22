// 이 함수는 dashboard.html에서 Google Maps API 스크립트가 로드된 후 자동으로 호출됩니다.
async function initDashboardMap() {
    console.log("initDashboardMap 함수 시작됨.");

    // 1. 초기 위치 설정 (예: 서울 시청)
    const initialLocation = { lat: 37.5665, lng: 126.9780 }; // 위도, 경도
    
    // HTML 요소 가져오기
    const mapElement = document.getElementById('map-container');
    const addressElement = document.getElementById('address-display');
    const weatherTodayElement = document.getElementById('weather-today');
    // ✨ 나중에 사용할 예보 표시 요소도 미리 가져올 수 있습니다.
    // const weatherForecastElement = document.getElementById('weather-forecast');


    // 필수 HTML 요소들이 있는지 확인
    if (!mapElement) {
        console.error("지도 컨테이너 요소를 찾을 수 없습니다: #map-container");
        if (addressElement) addressElement.textContent = '지도 초기화 오류.';
        if (weatherTodayElement) weatherTodayElement.innerHTML = '<h2>오늘 날씨</h2><p>지도 초기화 오류.</p>';
        return;
    }
    if (!addressElement) {
        console.warn("주소 표시 요소를 찾을 수 없습니다: #address-display. 주소 업데이트가 작동하지 않습니다.");
    }
    if (!weatherTodayElement) {
        console.warn("오늘 날씨 표시 요소를 찾을 수 없습니다: #weather-today. 날씨 업데이트가 작동하지 않습니다.");
    }

    // 2. 지도 생성
    const map = new google.maps.Map(mapElement, {
        zoom: 15,
        center: initialLocation,
    });

    // 3. 마커 생성 (하나의 마커를 계속 재사용)
    const marker = new google.maps.Marker({
        position: initialLocation,
        map: map,
        title: '선택된 위치' // 마커 타이틀 변경
    });

    // 4. 초기 위치 주소 및 날씨 표시
    if (addressElement) {
        displayAddress(initialLocation, addressElement);
    }
    if (weatherTodayElement) {
        displayWeather(initialLocation.lat, initialLocation.lng, weatherTodayElement);
    }
    // ✨ 초기 위치 예보 표시 (다음 단계에서 displayForecast 함수 구현 후 호출)
    // if (weatherForecastElement) {
    //     displayForecast(initialLocation.lat, initialLocation.lng, weatherForecastElement);
    // }


    // 5. 지도 클릭 이벤트 리스너 추가
    map.addListener('click', async (event) => {
      const clickedLat = event.latLng.lat();
      const clickedLng = event.latLng.lng();
      const clickedLocation = { lat: clickedLat, lng: clickedLng };

      console.log(`지도 클릭됨: 위도 ${clickedLat.toFixed(4)}, 경도 ${clickedLng.toFixed(4)}`);

      // 마커 위치 업데이트
      marker.setPosition(clickedLocation);

      // 클릭된 위치의 주소 업데이트
      if (addressElement) {
          displayAddress(clickedLocation, addressElement);
      }

      // 클릭된 위치의 오늘 날씨 업데이트
      if (weatherTodayElement) {
          displayWeather(clickedLat, clickedLng, weatherTodayElement);
      }
      
      // ✨ 클릭된 위치 예보 표시 (다음 단계에서 displayForecast 함수 구현 후 호출)
      // if (weatherForecastElement) {
      //   displayForecast(clickedLat, clickedLng, weatherForecastElement);
      // }
    });

    console.log("initDashboardMap 함수 끝남. 지도 클릭 리스너 활성화됨.");
}

// 주소 표시 함수 (이전과 동일)
function displayAddress(location, element) {
    if (!element) return; // 요소가 없으면 실행 중단
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
    if (!element) return; // 요소가 없으면 실행 중단
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
        console.error('날씨 정보 표시 중 오류:', error);
        element.innerHTML = `<h2>오늘 날씨</h2><p style="color: red;">날씨 정보를 가져오는 데 실패했습니다: ${error.message}</p>`;
    }
}

// ✨ 다음 단계에서 추가할 내일/모레 날씨 예보 표시 함수 (아직은 빈 함수 또는 주석 처리)
// async function displayForecast(lat, lon, element) {
//   if (!element) return;
//   element.innerHTML = '<h2>주간 예보 (내일/모레)</h2><p>예보 정보를 불러오는 중...</p>';
//   // 여기에 서버에 /api/weather-forecast 요청 보내고 결과 표시하는 로직 추가
// }

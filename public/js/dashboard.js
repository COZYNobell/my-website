// 이 함수는 dashboard.html에서 Google Maps API 스크립트가 로드된 후 자동으로 호출됩니다.
async function initDashboardMap() {
    console.log("initDashboardMap 함수 시작됨.");

    // 1. 초기 위치 설정 (예: 서울 시청)
    const initialLocation = { lat: 37.5665, lng: 126.9780 }; // 위도, 경도
    const mapElement = document.getElementById('map-container');
    const addressElement = document.getElementById('address-display');
    const weatherTodayElement = document.getElementById('weather-today');

    if (!mapElement) {
        console.error("지도 컨테이너 요소를 찾을 수 없습니다: #map-container");
        return;
    }
    if (!addressElement) {
        console.error("주소 표시 요소를 찾을 수 없습니다: #address-display");
        // return; // 주소 표시는 실패해도 날씨는 시도해볼 수 있도록 일단 주석 처리
    }
    if (!weatherTodayElement) {
        console.error("오늘 날씨 표시 요소를 찾을 수 없습니다: #weather-today");
        // return; // 날씨 표시는 실패해도 주소는 시도해볼 수 있도록 일단 주석 처리
    }


    // 2. 지도 생성
    const map = new google.maps.Map(mapElement, {
        zoom: 15,
        center: initialLocation,
    });

    // 3. 마커 생성
    const marker = new google.maps.Marker({
        position: initialLocation,
        map: map,
        title: '현재 위치'
    });

    // 4. 초기 위치 주소 표시 함수 호출
    if (addressElement) { // 요소가 있을 때만 호출
        displayAddress(initialLocation, addressElement);
    }


    // 5. 초기 위치 오늘 날씨 표시 함수 호출
    if (weatherTodayElement) { // 요소가 있을 때만 호출
        displayWeather(initialLocation.lat, initialLocation.lng, weatherTodayElement);
    }

    // (향후 추가될 기능) 지도 클릭 이벤트 리스너
    // map.addListener('click', async (event) => {
    //   const clickedLat = event.latLng.lat();
    //   const clickedLng = event.latLng.lng();
    //   console.log(`지도 클릭됨: ${clickedLat}, ${clickedLng}`);
    //   marker.setPosition(event.latLng); // 마커 이동
    //   if (addressElement) {
    //       displayAddress({ lat: clickedLat, lng: clickedLng }, addressElement);
    //   }
    //   if (weatherTodayElement) {
    //       displayWeather(clickedLat, clickedLng, weatherTodayElement);
    //   }
    //   // 여기에 내일/모레 날씨 로직도 추가...
    // });
}

// 주소 표시 함수
function displayAddress(location, element) {
    const geocoder = new google.maps.Geocoder();
    element.textContent = '주소 정보를 요청하는 중...'; // 로딩 메시지 업데이트

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

// 특정 좌표의 현재 날씨를 가져와 표시하는 함수
async function displayWeather(lat, lon, element) {
    element.innerHTML = '<h2>오늘 날씨</h2><p>날씨 정보를 불러오는 중...</p>'; // 이전 내용 초기화 및 로딩 메시지

    try {
        // 서버의 /api/weather-by-coords 엔드포인트 호출
        const response = await fetch(`/api/weather-by-coords?lat=${lat}&lon=${lon}`);
        if (!response.ok) {
            // 서버에서 에러 응답 (4xx, 5xx)을 보낸 경우
            const errorData = await response.json().catch(() => ({ message: `날씨 정보 서버 요청 실패: ${response.status} - 응답 JSON 파싱 불가` }));
            throw new Error(errorData.message || `날씨 정보 서버 요청 실패: ${response.status}`);
        }
        const weatherData = await response.json();

        // 날씨 정보를 HTML로 구성하여 표시
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

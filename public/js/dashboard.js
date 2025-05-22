// 현재 로그인 상태를 저장할 변수
let currentUser = null; 

// 로그인 상태에 따라 UI를 업데이트하는 함수
async function updateLoginUI() {
    console.log("updateLoginUI 함수 호출됨");
    const authLinksDiv = document.querySelector('.header .auth-links');
    const favoritesButton = document.getElementById('btn-favorites');
    const weatherTodayElement = document.getElementById('weather-today'); // ✨ 추가: 날씨 표시 제어를 위해
    const weatherForecastElement = document.getElementById('weather-forecast'); // ✨ 추가: 예보 표시 제어를 위해

    try {
        const response = await fetch('/api/current-user');
        const data = await response.json();

        if (authLinksDiv) {
            if (data.loggedIn && data.user) {
                currentUser = data.user; 
                authLinksDiv.innerHTML = `
                    <span>${currentUser.email}님 환영합니다!</span> | 
                    <a href="/logout">로그아웃</a>
                `;
                if (favoritesButton) {
                    favoritesButton.disabled = false; 
                    favoritesButton.textContent = '⭐ 즐겨찾기';
                }
                console.log("로그인 상태: O, 사용자:", currentUser.email);
                // ✨ 로그인 시, 초기 위치 날씨/예보를 다시 로드하거나, 사용자에게 안내
                // (initDashboardMap에서 이미 초기 로드 시 currentUser를 확인하므로 중복 호출 방지 필요)

            } else {
                currentUser = null; 
                authLinksDiv.innerHTML = `
                    <a href="/signup.html">회원가입</a> | 
                    <a href="/login.html">로그인</a>
                `;
                if (favoritesButton) {
                    favoritesButton.disabled = true; 
                    favoritesButton.textContent = '⭐ 즐겨찾기 (로그인 필요)';
                }
                // ✨ 로그아웃 시, 날씨/예보 섹션 초기화
                if (weatherTodayElement) {
                    weatherTodayElement.innerHTML = '<h2>오늘 날씨</h2><p>날씨 정보를 보려면 로그인 후 지도에서 위치를 선택하세요.</p>';
                }
                if (weatherForecastElement) {
                    weatherForecastElement.innerHTML = '<h2>주간 예보 (내일/모레)</h2><p>예보 정보를 보려면 로그인 후 지도에서 위치를 선택하세요.</p>';
                }
                console.log("로그인 상태: X");
            }
        }
    } catch (error) {
        console.error("현재 사용자 정보 가져오기 실패:", error);
        if (authLinksDiv) {
            authLinksDiv.innerHTML = '<a href="/login.html">로그인 정보 로드 오류 (새로고침)</a>';
        }
        currentUser = null;
    }
}

// 이 함수는 dashboard.html에서 Google Maps API 스크립트가 로드된 후 자동으로 호출됩니다.
async function initDashboardMap() {
    console.log("initDashboardMap 함수 시작됨.");
    await updateLoginUI(); // ✨ 페이지 로드 시 로그인 상태 먼저 확인 및 UI 업데이트

    const initialLocation = { lat: 37.5665, lng: 126.9780 };
    
    const mapElement = document.getElementById('map-container');
    const addressElement = document.getElementById('address-display');
    const weatherTodayElement = document.getElementById('weather-today');
    const weatherForecastElement = document.getElementById('weather-forecast');

    if (!mapElement) {
        console.error("지도 컨테이너 요소를 찾을 수 없습니다: #map-container");
        if (addressElement) addressElement.textContent = '지도 초기화 오류.';
        if (weatherTodayElement) weatherTodayElement.innerHTML = '<h2>오늘 날씨</h2><p>지도 초기화 오류.</p>';
        if (weatherForecastElement) weatherForecastElement.innerHTML = '<h2>주간 예보 (내일/모레)</h2><p>지도 초기화 오류.</p>';
        return;
    }
    if (!addressElement) console.warn("주소 표시 요소를 찾을 수 없습니다: #address-display.");
    if (!weatherTodayElement) console.warn("오늘 날씨 표시 요소를 찾을 수 없습니다: #weather-today.");
    if (!weatherForecastElement) console.warn("주간 예보 표시 요소를 찾을 수 없습니다: #weather-forecast.");

    const map = new google.maps.Map(mapElement, {
        zoom: 15,
        center: initialLocation,
        clickableIcons: false // ✨ 중요: 지도 위의 기본 POI 클릭 방지 (날씨 정보와 충돌 피하기 위해)
    });

    const marker = new google.maps.Marker({
        position: initialLocation,
        map: map,
        title: '선택된 위치'
    });

    // 초기 위치 주소는 항상 표시
    if (addressElement) {
        displayAddress(initialLocation, addressElement);
    }
    
    // 로그인 상태에 따라 초기 날씨/예보 로드
    if (currentUser) {
        if (weatherTodayElement) {
            displayWeather(initialLocation.lat, initialLocation.lng, weatherTodayElement);
        }
        if (weatherForecastElement) {
            displayForecast(initialLocation.lat, initialLocation.lng, weatherForecastElement);
        }
    } else {
        // 로그아웃 상태 메시지는 updateLoginUI에서 이미 처리
        console.log("사용자가 로그인하지 않아 초기 날씨/예보 정보를 로드하지 않습니다.");
    }

    map.addListener('click', async (event) => {
        if (!currentUser) { // ✨ 로그인한 사용자만 지도 클릭 상세 정보 조회 가능
            console.log("로그인되지 않은 사용자는 지도 클릭 상세 정보 조회가 제한됩니다.");
            if(addressElement) addressElement.textContent = "상세 정보(날씨/예보)를 보려면 로그인해주세요.";
            // 마커만 이동시키고, 주소는 기본 주소로 유지하거나, 클릭된 위치의 주소만 보여줄 수 있음.
            // 여기서는 일단 마커만 이동.
            marker.setPosition(event.latLng); 
            // displayAddress(event.latLng, addressElement); // 주소는 보여주도록 할 수도 있음
            return; 
        }

        const clickedLat = event.latLng.lat();
        const clickedLng = event.latLng.lng();
        const clickedLocation = { lat: clickedLat, lng: clickedLng };

        console.log(`지도 클릭됨 (로그인 사용자): 위도 ${clickedLat.toFixed(4)}, 경도 ${clickedLng.toFixed(4)}`);
        marker.setPosition(clickedLocation);

        if (addressElement) {
            displayAddress(clickedLocation, addressElement);
        }
        if (weatherTodayElement) {
            displayWeather(clickedLat, clickedLng, weatherTodayElement);
        }
        if (weatherForecastElement) {
            displayForecast(clickedLat, clickedLng, weatherForecastElement);
        }
    });
    console.log("initDashboardMap 함수 끝남. 지도 클릭 리스너 활성화됨.");
}

// 주소 표시 함수 (변경 없음)
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

// 특정 좌표의 현재 날씨를 가져와 표시하는 함수 (변경 없음)
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

// 특정 좌표의 내일/모레 날씨 예보를 가져와 표시하는 함수 (변경 없음)
async function displayForecast(lat, lon, element) {
    if (!element) return; 
    element.innerHTML = '<h2>주간 예보 (내일/모레)</h2><p>예보 정보를 불러오는 중...</p>';
    try {
        const response = await fetch(`/api/weather-forecast?lat=${lat}&lon=${lon}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `예보 정보 서버 요청 실패: ${response.status} - 응답 JSON 파싱 불가` }));
            throw new Error(errorData.message || `예보 정보 서버 요청 실패: ${response.status}`);
        }
        const forecastPayload = await response.json(); 
        let forecastHtml = `<h2>주간 예보 (${forecastPayload.cityName}, 내일/모레)</h2>`;
        if (forecastPayload.forecast && forecastPayload.forecast.length > 0) {
            forecastPayload.forecast.forEach(dailyData => {
                const iconUrl = `https://openweathermap.org/img/wn/${dailyData.icon}@2x.png`;
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

// 페이지의 DOM 콘텐츠가 모두 로드된 후 로그인 상태 확인 및 UI 업데이트 함수를 실행합니다.
document.addEventListener('DOMContentLoaded', updateLoginUI);

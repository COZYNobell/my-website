// 현재 로그인 상태 및 현재 지도 위치 정보를 저장할 변수
let currentUser = null;
let currentMapCenter = { lat: 37.5665, lng: 126.9780 }; // 초기값은 서울 시청
let currentMapAddress = "주소를 찾을 수 없습니다."; // 현재 지도의 주소 정보

// 즐겨찾기 목록을 화면에 렌더링하는 함수
function renderFavoritesList(favorites) {
    const favoritesListDiv = document.getElementById('favorites-list');
    if (!favoritesListDiv) {
        console.warn("즐겨찾기 목록 표시 요소를 찾을 수 없습니다: #favorites-list");
        return;
    }

    if (!currentUser) {
        favoritesListDiv.innerHTML = '<p>로그인하시면 즐겨찾기 목록을 볼 수 있습니다.</p>';
        return;
    }

    if (!favorites || favorites.length === 0) {
        favoritesListDiv.innerHTML = '<p>아직 추가된 즐겨찾기가 없습니다. 지도에서 장소를 선택하고 즐겨찾기 해보세요!</p>';
        return;
    }

    let html = '<ul>';
    favorites.forEach(fav => {
        html += `
            <li class="favorite-item" 
                data-id="${fav.id}" 
                data-lat="${fav.latitude}" 
                data-lon="${fav.longitude}"
                data-name="${escape(fav.location_name)}"> 
                <span class="favorite-name">${fav.location_name}</span>
                <button class="delete-favorite-btn">삭제</button>
            </li>`;
    });
    html += '</ul>';
    favoritesListDiv.innerHTML = html;

    // 즐겨찾기 이름 클릭 이벤트 리스너 추가
    document.querySelectorAll('.favorite-item .favorite-name').forEach(item => {
        item.addEventListener('click', function() {
            const parentLi = this.closest('.favorite-item');
            const lat = parseFloat(parentLi.dataset.lat);
            const lon = parseFloat(parentLi.dataset.lon);
            const name = unescape(parentLi.dataset.name);

            console.log(`즐겨찾기 클릭: ${name} (${lat}, ${lon})`);
            
            // ✨ HTML 요소들을 클릭 이벤트 핸들러 내에서 다시 가져옵니다.
            const addressElement = document.getElementById('address-display');
            const weatherTodayElement = document.getElementById('weather-today');
            const weatherForecastElement = document.getElementById('weather-forecast');
            
            if (window.dashboardMap && window.dashboardMarker) {
                const newLocation = { lat: lat, lng: lon };
                window.dashboardMap.setCenter(newLocation);
                window.dashboardMarker.setPosition(newLocation);
                
                currentMapCenter = newLocation; // 현재 지도 중심 업데이트

                if(addressElement) {
                    displayAddress(newLocation, addressElement, (fetchedAddress) => {
                        currentMapAddress = fetchedAddress; // 주소 업데이트
                    });
                }
                if(weatherTodayElement) { // 요소가 존재하는지 확인 후 호출
                    displayWeather(lat, lon, weatherTodayElement);
                }
                if(weatherForecastElement) { // 요소가 존재하는지 확인 후 호출
                    displayForecast(lat, lon, weatherForecastElement);
                }
            } else {
                console.warn("지도 또는 마커 객체를 찾을 수 없습니다. (window.dashboardMap or window.dashboardMarker)");
            }
        });
    });

    // 즐겨찾기 삭제 버튼 이벤트 리스너 추가
    document.querySelectorAll('.favorite-item .delete-favorite-btn').forEach(button => {
        button.addEventListener('click', async function() {
            const parentLi = this.closest('.favorite-item');
            const favoriteId = parentLi.dataset.id;
            if (confirm(`'${unescape(parentLi.dataset.name)}' 즐겨찾기를 삭제하시겠습니까?`)) {
                try {
                    const response = await fetch(`/api/favorites/${favoriteId}`, {
                        method: 'DELETE'
                    });
                    const result = await response.json();
                    if (response.ok) {
                        alert(result.message);
                        loadAndDisplayFavorites(); // 목록 새로고침
                    } else {
                        alert(`즐겨찾기 삭제 실패: ${result.message}`);
                    }
                } catch (error) {
                    console.error('즐겨찾기 삭제 중 오류:', error);
                    alert('즐겨찾기 삭제 중 오류가 발생했습니다.');
                }
            }
        });
    });
}

// 서버에서 즐겨찾기 목록을 불러와 표시하는 함수
async function loadAndDisplayFavorites() {
    if (!currentUser) {
        renderFavoritesList(null);
        return;
    }
    try {
        const response = await fetch('/api/favorites');
        if (!response.ok) {
            if (response.status === 401) {
                console.log("즐겨찾기 로드: 로그인이 필요합니다.");
                renderFavoritesList(null);
                return;
            }
            const errorData = await response.json().catch(() => ({ message: '즐겨찾기 목록 로드 실패' }));
            throw new Error(errorData.message || `서버 응답 실패: ${response.status}`);
        }
        const favorites = await response.json();
        renderFavoritesList(favorites);
    } catch (error) {
        console.error('즐겨찾기 목록 로드 중 오류:', error);
        const favoritesListDiv = document.getElementById('favorites-list');
        if (favoritesListDiv) {
            favoritesListDiv.innerHTML = '<p style="color:red;">즐겨찾기 목록을 불러오는 데 실패했습니다.</p>';
        }
    }
}

// 로그인 상태에 따라 UI를 업데이트하는 함수
async function updateLoginUI() {
    console.log("updateLoginUI 함수 호출됨");
    const authLinksDiv = document.querySelector('.header .auth-links');
    const favoritesButton = document.getElementById('btn-favorites');
    const weatherTodayElement = document.getElementById('weather-today');
    const weatherForecastElement = document.getElementById('weather-forecast');

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
                    favoritesButton.textContent = '⭐ 현재 위치 즐겨찾기';
                }
                console.log("로그인 상태: O, 사용자:", currentUser.email);
                await loadAndDisplayFavorites();
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
                if (weatherTodayElement) {
                    weatherTodayElement.innerHTML = '<h2>오늘 날씨</h2><p>날씨 정보를 보려면 로그인 후 지도에서 위치를 선택하세요.</p>';
                }
                if (weatherForecastElement) {
                    weatherForecastElement.innerHTML = '<h2>주간 예보 (내일/모레)</h2><p>예보 정보를 보려면 로그인 후 지도에서 위치를 선택하세요.</p>';
                }
                renderFavoritesList(null);
                console.log("로그인 상태: X");
            }
        }
    } catch (error) {
        console.error("현재 사용자 정보 가져오기 실패:", error);
        if (authLinksDiv) authLinksDiv.innerHTML = '<a href="/login.html">로그인 정보 로드 오류 (새로고침)</a>';
        currentUser = null;
        renderFavoritesList(null);
    }
}

// 이 함수는 dashboard.html에서 Google Maps API 스크립트가 로드된 후 자동으로 호출됩니다.
async function initDashboardMap() {
    console.log("initDashboardMap 함수 시작됨.");
    await updateLoginUI(); 

    currentMapCenter = { lat: 37.5665, lng: 126.9780 }; 
    
    const mapElement = document.getElementById('map-container');
    const addressElement = document.getElementById('address-display');
    const weatherTodayElement = document.getElementById('weather-today');
    const weatherForecastElement = document.getElementById('weather-forecast');
    const favoritesButton = document.getElementById('btn-favorites');

    if (!mapElement) { /* ... (오류 처리) ... */ return; }
    // ... (다른 요소 null 체크)

    window.dashboardMap = new google.maps.Map(mapElement, {
        zoom: 15,
        center: currentMapCenter,
        clickableIcons: false 
    });
    window.dashboardMarker = new google.maps.Marker({
        position: currentMapCenter,
        map: window.dashboardMap,
        title: '선택된 위치'
    });

    if (addressElement) {
        displayAddress(currentMapCenter, addressElement, (address) => {
            currentMapAddress = address; 
        });
    }
    
    if (currentUser) {
        if (weatherTodayElement) displayWeather(currentMapCenter.lat, currentMapCenter.lng, weatherTodayElement);
        if (weatherForecastElement) displayForecast(currentMapCenter.lat, currentMapCenter.lng, weatherForecastElement);
    } else {
        console.log("사용자가 로그인하지 않아 초기 날씨/예보 정보를 로드하지 않습니다.");
    }

    window.dashboardMap.addListener('click', async (event) => {
        const clickedLat = event.latLng.lat();
        const clickedLng = event.latLng.lng();
        currentMapCenter = { lat: clickedLat, lng: clickedLng }; 

        console.log(`지도 클릭됨: 위도 ${clickedLat.toFixed(4)}, 경도 ${clickedLng.toFixed(4)}`);
        window.dashboardMarker.setPosition(currentMapCenter);

        if (addressElement) {
            displayAddress(currentMapCenter, addressElement, (address) => {
                currentMapAddress = address; 
            });
        }
        
        if (!currentUser) {
            console.log("로그인되지 않은 사용자는 지도 클릭 상세 정보 조회가 제한됩니다.");
            if(addressElement && !currentMapAddress.startsWith("주소:")) addressElement.textContent = "상세 정보(날씨/예보)를 보려면 로그인해주세요.";
            if(weatherTodayElement) weatherTodayElement.innerHTML = '<h2>오늘 날씨</h2><p>날씨 정보를 보려면 로그인해주세요.</p>';
            if(weatherForecastElement) weatherForecastElement.innerHTML = '<h2>주간 예보 (내일/모레)</h2><p>예보 정보를 보려면 로그인해주세요.</p>';
            return; 
        }

        if (weatherTodayElement) displayWeather(clickedLat, clickedLng, weatherTodayElement);
        if (weatherForecastElement) displayForecast(clickedLat, clickedLng, weatherForecastElement);
    });

    if (favoritesButton) {
        favoritesButton.addEventListener('click', async () => {
            if (!currentUser) {
                alert("로그인이 필요합니다.");
                return;
            }
            if (!currentMapAddress || currentMapAddress === "주소를 찾을 수 없습니다." || currentMapAddress.includes("요청하는 중") || currentMapAddress.includes("Geocoder 요청 실패")) {
                alert("현재 위치의 주소 정보를 정확히 가져온 후 다시 시도해주세요.");
                return;
            }

            const favoriteData = {
                location_name: currentMapAddress.startsWith('주소: ') ? currentMapAddress.substring(4) : currentMapAddress, // "주소: " 부분 제거
                latitude: currentMapCenter.lat,
                longitude: currentMapCenter.lng
            };

            try {
                const response = await fetch('/api/favorites', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(favoriteData),
                });
                const result = await response.json();
                if (response.ok) {
                    alert(result.message);
                    loadAndDisplayFavorites(); 
                } else {
                    alert(`즐겨찾기 추가 실패: ${result.message}`);
                }
            } catch (error) {
                console.error('즐겨찾기 추가 중 오류:', error);
                alert('즐겨찾기 추가 중 오류가 발생했습니다.');
            }
        });
    }
    console.log("initDashboardMap 함수 끝남. 지도 클릭 리스너 및 즐겨찾기 버튼 리스너 활성화됨.");
}

// 주소 표시 함수
function displayAddress(location, element, callback) {
    if (!element) return; 
    const geocoder = new google.maps.Geocoder();
    element.textContent = '주소 정보를 요청하는 중...';
    geocoder.geocode({ 'location': location }, function(results, status) {
        let fetchedAddress = "주소를 찾을 수 없습니다.";
        if (status === 'OK') {
            if (results[0]) {
                fetchedAddress = results[0].formatted_address;
                element.textContent = `주소: ${fetchedAddress}`;
            } else {
                element.textContent = fetchedAddress;
            }
        } else {
            fetchedAddress = 'Geocoder 요청 실패: ' + status;
            element.textContent = fetchedAddress;
            console.error('Geocoder failed due to: ' + status);
        }
        // ✨ 주소 정보를 currentMapAddress 업데이트 및 즐겨찾기 추가 시 사용하기 위해 콜백으로 전달
        if (callback) callback(fetchedAddress); 
    });
}

// 특정 좌표의 현재 날씨를 가져와 표시하는 함수
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

// 특정 좌표의 내일/모레 날씨 예보를 가져와 표시하는 함수
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
document.addEventListener('DOMContentLoaded', async () => {
    await updateLoginUI(); 
    // Google Maps API는 dashboard.html에서 callback=initDashboardMap 으로 initDashboardMap을 호출합니다.
    // initDashboardMap 내부에서 updateLoginUI가 다시 호출될 수 있으나, currentUser 상태를 공유하므로 큰 문제는 없습니다.
    // 또는, initDashboardMap에서 API 로드 후 updateLoginUI를 명시적으로 호출하는 것도 좋습니다.
    // 현재는 initDashboardMap 시작 시 updateLoginUI를 await로 호출하고 있으므로,
    // DOMContentLoaded에서는 updateLoginUI만으로 충분할 수 있습니다.
    // 하지만 Google Maps API가 비동기 로드되므로, initDashboardMap 콜백 내에서 UI 관련 초기화를 하는 것이 안전합니다.
    // 따라서 DOMContentLoaded에서는 특별히 initDashboardMap을 호출하지 않습니다.
});

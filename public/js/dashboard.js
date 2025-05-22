// 현재 로그인 상태 및 현재 지도 위치 정보를 저장할 변수
let currentUser = null;
let currentMapCenter = { lat: 37.5665, lng: 126.9780 }; // 초기값은 서울 시청
let currentMapAddress = "주소를 찾을 수 없습니다."; // 현재 지도의 주소 정보

// ✨ NEW: 즐겨찾기 목록을 화면에 렌더링하는 함수
function renderFavoritesList(favorites) {
    const favoritesListDiv = document.getElementById('favorites-list');
    if (!favoritesListDiv) {
        console.warn("즐겨찾기 목록 표시 요소를 찾을 수 없습니다: #favorites-list");
        return;
    }

    if (!currentUser) { // 로그아웃 상태면 초기 메시지 표시
        favoritesListDiv.innerHTML = '<p>로그인하시면 즐겨찾기 목록을 볼 수 있습니다.</p>';
        return;
    }

    if (!favorites || favorites.length === 0) {
        favoritesListDiv.innerHTML = '<p>아직 추가된 즐겨찾기가 없습니다. 지도에서 장소를 선택하고 즐겨찾기 해보세요!</p>';
        return;
    }

    let html = '<ul>';
    favorites.forEach(fav => {
        // data-* 속성을 사용하여 즐겨찾기 ID, 위도, 경도, 장소 이름을 저장
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

    // ✨ NEW: 즐겨찾기 이름 클릭 이벤트 리스너 추가
    document.querySelectorAll('.favorite-item .favorite-name').forEach(item => {
        item.addEventListener('click', function() {
            const parentLi = this.closest('.favorite-item');
            const lat = parseFloat(parentLi.dataset.lat);
            const lon = parseFloat(parentLi.dataset.lon);
            const name = unescape(parentLi.dataset.name); // unescape로 원래 이름 복원
            
            console.log(`즐겨찾기 클릭: ${name} (${lat}, ${lon})`);
            
            // 지도 이동 및 정보 업데이트 (initDashboardMap에 있는 map과 marker 객체 접근 필요)
            // 여기서는 전역 변수나 다른 방식으로 map, marker 객체에 접근해야 합니다.
            // 혹은, 이 기능을 initDashboardMap 내부로 옮기거나, map/marker를 전달받도록 수정 필요.
            // 지금은 간단히 전역 변수로 map, marker가 있다고 가정하고 진행 (좋은 방식은 아님)
            if (window.dashboardMap && window.dashboardMarker) {
                const newLocation = { lat: lat, lng: lon };
                window.dashboardMap.setCenter(newLocation);
                window.dashboardMarker.setPosition(newLocation);
                
                const addressElement = document.getElementById('address-display');
                const weatherTodayElement = document.getElementById('weather-today');
                const weatherForecastElement = document.getElementById('weather-forecast');

                if(addressElement) displayAddress(newLocation, addressElement);
                if(weatherTodayElement) displayWeather(lat, lon, weatherTodayElement);
                if(weatherForecastElement) displayForecast(lat, lon, weatherForecastElement);
                
                // 현재 지도 위치 정보 업데이트
                currentMapCenter = newLocation;
                currentMapAddress = name; // 주소는 Geocoding을 통해 더 정확히 가져올 수 있음
            }
        });
    });

    // ✨ NEW: 즐겨찾기 삭제 버튼 이벤트 리스너 추가
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

// ✨ NEW: 서버에서 즐겨찾기 목록을 불러와 표시하는 함수
async function loadAndDisplayFavorites() {
    if (!currentUser) { // 로그인하지 않았으면 함수 종료 또는 초기 메시지 표시
        renderFavoritesList(null); // 즐겨찾기 목록을 초기 상태로 (로그인 필요 메시지)
        return;
    }
    try {
        const response = await fetch('/api/favorites');
        if (!response.ok) {
            if (response.status === 401) { // 로그인이 필요한 경우
                console.log("즐겨찾기 로드: 로그인이 필요합니다.");
                renderFavoritesList(null); // 로그인 필요 메시지 표시
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
                    favoritesButton.textContent = '⭐ 현재 위치 즐겨찾기'; // ✨ 버튼 텍스트 변경
                }
                console.log("로그인 상태: O, 사용자:", currentUser.email);
                await loadAndDisplayFavorites(); // ✨ 로그인 시 즐겨찾기 목록 로드
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
                renderFavoritesList(null); // ✨ 로그아웃 시 즐겨찾기 목록 초기화
                console.log("로그인 상태: X");
            }
        }
    } catch (error) {
        console.error("현재 사용자 정보 가져오기 실패:", error);
        if (authLinksDiv) authLinksDiv.innerHTML = '<a href="/login.html">로그인 정보 로드 오류 (새로고침)</a>';
        currentUser = null;
        renderFavoritesList(null); // ✨ 에러 시 즐겨찾기 목록 초기화
    }
}

// 이 함수는 dashboard.html에서 Google Maps API 스크립트가 로드된 후 자동으로 호출됩니다.
async function initDashboardMap() {
    console.log("initDashboardMap 함수 시작됨.");
    // ✨ 중요: Google Maps API가 로드된 *후에* updateLoginUI를 호출해야
    // ✨ 로그인 상태에 따른 초기 날씨/예보 로드가 정상적으로 currentUser 값을 참조할 수 있음.
    // ✨ 또는, updateLoginUI가 먼저 호출되더라도, 날씨/예보 로드 함수들은 currentUser 값을 확인하므로 괜찮음.
    // ✨ 여기서는 DOMContentLoaded에서 먼저 호출하고, initDashboardMap에서도 다시 호출하여
    // ✨ API 로드 전/후 모두 UI가 적절히 업데이트 되도록 합니다.
    await updateLoginUI(); 

    currentMapCenter = { lat: 37.5665, lng: 126.9780 }; // 초기 위치 (서울 시청)
    
    const mapElement = document.getElementById('map-container');
    const addressElement = document.getElementById('address-display');
    const weatherTodayElement = document.getElementById('weather-today');
    const weatherForecastElement = document.getElementById('weather-forecast');
    const favoritesButton = document.getElementById('btn-favorites'); // ✨ 즐겨찾기 버튼 가져오기

    if (!mapElement) { /* ... (오류 처리) ... */ return; }
    // ... (다른 요소 null 체크)

    // ✨ 지도와 마커 객체를 전역에서 접근 가능하도록 window 객체에 할당 (간단한 예시)
    // ✨ 더 좋은 방법은 모듈이나 클래스를 사용하는 것이지만, 지금은 간단하게 진행합니다.
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

    // 초기 위치 주소는 항상 표시, 주소 로드 후 currentMapAddress 업데이트
    if (addressElement) {
        displayAddress(currentMapCenter, addressElement, (address) => {
            currentMapAddress = address; // ✨ 주소 업데이트 콜백
        });
    }
    
    if (currentUser) {
        if (weatherTodayElement) displayWeather(currentMapCenter.lat, currentMapCenter.lng, weatherTodayElement);
        if (weatherForecastElement) displayForecast(currentMapCenter.lat, currentMapCenter.lng, weatherForecastElement);
    } else {
        console.log("사용자가 로그인하지 않아 초기 날씨/예보 정보를 로드하지 않습니다.");
    }

    // 지도 클릭 이벤트 리스너
    window.dashboardMap.addListener('click', async (event) => {
        const clickedLat = event.latLng.lat();
        const clickedLng = event.latLng.lng();
        currentMapCenter = { lat: clickedLat, lng: clickedLng }; // ✨ 현재 지도 중심 업데이트

        console.log(`지도 클릭됨: 위도 ${clickedLat.toFixed(4)}, 경도 ${clickedLng.toFixed(4)}`);
        window.dashboardMarker.setPosition(currentMapCenter);

        if (addressElement) {
            displayAddress(currentMapCenter, addressElement, (address) => {
                currentMapAddress = address; // ✨ 주소 업데이트 콜백
            });
        }
        
        if (!currentUser) {
            console.log("로그인되지 않은 사용자는 지도 클릭 상세 정보 조회가 제한됩니다.");
            if(addressElement && !currentMapAddress.startsWith("주소:")) addressElement.textContent = "상세 정보(날씨/예보)를 보려면 로그인해주세요."; // 주소가 아직 로드 안됐을 경우
            if(weatherTodayElement) weatherTodayElement.innerHTML = '<h2>오늘 날씨</h2><p>날씨 정보를 보려면 로그인해주세요.</p>';
            if(weatherForecastElement) weatherForecastElement.innerHTML = '<h2>주간 예보 (내일/모레)</h2><p>예보 정보를 보려면 로그인해주세요.</p>';
            return; 
        }

        if (weatherTodayElement) displayWeather(clickedLat, clickedLng, weatherTodayElement);
        if (weatherForecastElement) displayForecast(clickedLat, clickedLng, weatherForecastElement);
    });

    // ✨ NEW: 즐겨찾기 버튼 클릭 이벤트 리스너 추가
    if (favoritesButton) {
        favoritesButton.addEventListener('click', async () => {
            if (!currentUser) {
                alert("로그인이 필요합니다.");
                return;
            }
            if (!currentMapAddress || currentMapAddress === "주소를 찾을 수 없습니다." || currentMapAddress.includes("요청하는 중")) {
                alert("현재 위치의 주소 정보를 가져오는 중이거나 가져올 수 없습니다. 잠시 후 다시 시도해주세요.");
                return;
            }

            const favoriteData = {
                location_name: currentMapAddress.replace('주소: ', ''), // "주소: " 부분 제거
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
                    loadAndDisplayFavorites(); // 즐겨찾기 목록 새로고침
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

// 주소 표시 함수 (✨ 콜백 추가하여 주소 정보 반환)
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
        if (callback) callback(fetchedAddress); // ✨ 주소 정보 콜백으로 전달
    });
}

// 특정 좌표의 현재 날씨를 가져와 표시하는 함수 (변경 없음)
async function displayWeather(lat, lon, element) { /* ... (이전과 동일) ... */ }

// 특정 좌표의 내일/모레 날씨 예보를 가져와 표시하는 함수 (변경 없음)
async function displayForecast(lat, lon, element) { /* ... (이전과 동일) ... */ }

// 페이지의 DOM 콘텐츠가 모두 로드된 후 로그인 상태 확인 및 UI 업데이트 함수를 실행합니다.
document.addEventListener('DOMContentLoaded', async () => {
    await updateLoginUI(); // 먼저 로그인 UI를 업데이트하고 currentUser를 설정
    // Google Maps API는 dashboard.html에서 callback=initDashboardMap 으로 initDashboardMap을 호출하므로
    // DOMContentLoaded에서 initDashboardMap을 직접 호출할 필요는 없습니다.
    // updateLoginUI가 여기서 호출되어 currentUser가 설정되면, 이후 initDashboardMap에서 이를 사용합니다.
});

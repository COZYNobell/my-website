// ✅ 현재 로그인 상태 및 지도 정보 저장용 변수
let currentUser = null;
let currentMapCenter = { lat: 37.5665, lng: 126.9780 }; // 서울 시청
let currentMapAddress = "주소를 찾을 수 없습니다.";

// ✅ 즐겨찾기 목록 렌더링 함수
function renderFavoritesList(favorites) {
    const favoritesListDiv = document.getElementById('favorites-list');
    if (!favoritesListDiv) return;

    if (!currentUser) {
        favoritesListDiv.innerHTML = '<p>로그인하시면 즐겨찾기 목록을 볼 수 있습니다.</p>';
        return;
    }

    if (!favorites || favorites.length === 0) {
        favoritesListDiv.innerHTML = '<p>아직 추가된 즐겨찾기가 없습니다.</p>';
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

    document.querySelectorAll('.favorite-item .favorite-name').forEach(item => {
        item.addEventListener('click', () => {
            const parentLi = item.closest('.favorite-item');
            const lat = parseFloat(parentLi.dataset.lat);
            const lon = parseFloat(parentLi.dataset.lon);
            const name = unescape(parentLi.dataset.name);

            const addressElement = document.getElementById('address-display');
            const weatherTodayElement = document.getElementById('weather-today');
            const weatherForecastElement = document.getElementById('weather-forecast');

            const newLocation = { lat, lng: lon };
            if (window.dashboardMap && window.dashboardMarker) {
                window.dashboardMap.setCenter(newLocation);
                window.dashboardMarker.setPosition(newLocation);
                currentMapCenter = newLocation;

                displayAddress(newLocation, addressElement, fetched => currentMapAddress = fetched);
                if (weatherTodayElement) displayWeather(lat, lon, weatherTodayElement);
                if (weatherForecastElement) displayForecast(lat, lon, weatherForecastElement);
            }
        });
    });

    document.querySelectorAll('.favorite-item .delete-favorite-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const parentLi = button.closest('.favorite-item');
            const favoriteId = parentLi.dataset.id;

            if (confirm(`'${unescape(parentLi.dataset.name)}' 즐겨찾기를 삭제하시겠습니까?`)) {
                try {
                    const res = await fetch(`/api/favorites/${favoriteId}`, { method: 'DELETE' });
                    const result = await res.json();
                    if (res.ok) {
                        alert(result.message);
                        loadAndDisplayFavorites();
                    } else {
                        alert(`삭제 실패: ${result.message}`);
                    }
                } catch (e) {
                    alert('삭제 중 오류 발생');
                }
            }
        });
    });
}

// ✅ 즐겨찾기 목록 불러오기
async function loadAndDisplayFavorites() {
    if (!currentUser) return renderFavoritesList(null);
    try {
        const res = await fetch('/api/favorites');
        const contentType = res.headers.get("Content-Type") || "";
        if (!contentType.includes("application/json")) throw new Error("서버 응답이 JSON이 아님");
        const favorites = await res.json();
        renderFavoritesList(favorites);
    } catch (e) {
        const listDiv = document.getElementById('favorites-list');
        if (listDiv) listDiv.innerHTML = '<p style="color:red;">목록을 불러오는 데 실패했습니다.</p>';
    }
}

// ✅ 로그인 UI 업데이트
async function updateLoginUI() {
    const authLinksDiv = document.querySelector('.auth-links');
    const favoritesButton = document.getElementById('btn-favorites');
    try {
        const res = await fetch('/api/current-user');
        const contentType = res.headers.get("Content-Type") || "";
        if (!contentType.includes("application/json")) throw new Error("응답이 JSON이 아님");

        const data = await res.json();
        if (data.loggedIn && data.user) {
            currentUser = data.user;
            if (authLinksDiv) authLinksDiv.innerHTML = `${currentUser.email}님 환영합니다! | <a href="/logout">로그아웃</a>`;
            if (favoritesButton) {
                favoritesButton.disabled = false;
                favoritesButton.textContent = '⭐ 현재 위치 즐겨찾기';
            }
            await loadAndDisplayFavorites();
        } else {
            throw new Error("로그인 안 됨");
        }
    } catch (e) {
        currentUser = null;
        if (authLinksDiv) authLinksDiv.innerHTML = '<a href="/signup.html">회원가입</a> | <a href="/login.html">로그인</a>';
        renderFavoritesList(null);
    }
}

// ✅ 주소 정보 표시
function displayAddress(location, element, callback) {
    if (!element) return;
    const geocoder = new google.maps.Geocoder();
    element.textContent = '주소 정보를 요청 중...';
    geocoder.geocode({ location }, (results, status) => {
        let address = '주소를 찾을 수 없습니다.';
        if (status === 'OK' && results[0]) {
            address = results[0].formatted_address;
            element.textContent = `주소: ${address}`;
        } else {
            element.textContent = `Geocoder 실패: ${status}`;
        }
        if (callback) callback(address);
    });
}

// ✅ 날씨 표시
async function displayWeather(lat, lon, element) {
    if (!element) return;
    element.innerHTML = '<p>날씨 정보를 불러오는 중...</p>';
    try {
        const res = await fetch(`/api/weather-by-coords?lat=${lat}&lon=${lon}`);
        const data = await res.json();
        const icon = `https://openweathermap.org/img/wn/${data.icon}@2x.png`;
        element.innerHTML = `
        <h3>오늘 날씨 (${data.cityName})</h3>
        <img src="${icon}" alt="weather icon" />
        <p>${data.description}</p>
        <p>기온: ${data.temperature}°C (체감: ${data.feels_like}°C)</p>
        <p>습도: ${data.humidity}%</p>`;
    } catch (e) {
        element.innerHTML = '<p style="color:red;">날씨 정보를 불러오는 데 실패했습니다.</p>';
    }
}

// ✅ 예보 표시
async function displayForecast(lat, lon, element) {
    if (!element) return;
    element.innerHTML = '<p>예보 정보를 불러오는 중...</p>';
    try {
        const res = await fetch(`/api/weather-forecast?lat=${lat}&lon=${lon}`);
        const data = await res.json();
        let html = `<h3>주간 예보 (${data.cityName})</h3>`;
        data.forecast.forEach(d => {
            const icon = `https://openweathermap.org/img/wn/${d.icon}@2x.png`;
            html += `
            <div>
                <strong>${d.date}</strong><br>
                <img src="${icon}" alt="forecast icon" />
                ${d.description}<br>
                🌡 ${d.temp_min}°C ~ ${d.temp_max}°C
            </div>`;
        });
        element.innerHTML = html;
    } catch (e) {
        element.innerHTML = '<p style="color:red;">예보 정보를 불러오는 데 실패했습니다.</p>';
    }
}

// ✅ 지도 초기화 (Google Maps API callback)
async function initDashboardMap() {
    await updateLoginUI();

    const mapEl = document.getElementById('map-container');
    const addressEl = document.getElementById('address-display');
    const weatherTodayEl = document.getElementById('weather-today');
    const weatherForecastEl = document.getElementById('weather-forecast');
    const favoritesButton = document.getElementById('btn-favorites');

    window.dashboardMap = new google.maps.Map(mapEl, {
        zoom: 15,
        center: currentMapCenter,
        clickableIcons: false
    });

    window.dashboardMarker = new google.maps.Marker({
        position: currentMapCenter,
        map: window.dashboardMap
    });

    if (addressEl) displayAddress(currentMapCenter, addressEl, a => currentMapAddress = a);
    if (currentUser && weatherTodayEl) displayWeather(currentMapCenter.lat, currentMapCenter.lng, weatherTodayEl);
    if (currentUser && weatherForecastEl) displayForecast(currentMapCenter.lat, currentMapCenter.lng, weatherForecastEl);

    window.dashboardMap.addListener('click', (e) => {
        currentMapCenter = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        window.dashboardMarker.setPosition(currentMapCenter);
        displayAddress(currentMapCenter, addressEl, a => currentMapAddress = a);
        if (currentUser) {
            if (weatherTodayEl) displayWeather(currentMapCenter.lat, currentMapCenter.lng, weatherTodayEl);
            if (weatherForecastEl) displayForecast(currentMapCenter.lat, currentMapCenter.lng, weatherForecastEl);
        }
    });

    if (favoritesButton) {
        favoritesButton.addEventListener('click', async () => {
            if (!currentUser) return alert("로그인이 필요합니다.");
            if (!currentMapAddress || currentMapAddress.includes("요청") || currentMapAddress.includes("실패")) {
                return alert("주소 정보가 불완전합니다.");
            }
            const favorite = {
                location_name: currentMapAddress.replace(/^주소: /, ''),
                latitude: currentMapCenter.lat,
                longitude: currentMapCenter.lng
            };
            try {
                const res = await fetch('/api/favorites', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(favorite)
                });
                const result = await res.json();
                if (res.ok) {
                    alert(result.message);
                    loadAndDisplayFavorites();
                } else {
                    alert(`추가 실패: ${result.message}`);
                }
            } catch (e) {
                alert('추가 중 오류 발생');
            }
        });
    }
}

// ✅ 전역 등록
window.initDashboardMap = initDashboardMap;

// ✅ 초기에 로그인 상태 체크
document.addEventListener('DOMContentLoaded', updateLoginUI);

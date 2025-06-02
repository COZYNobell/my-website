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

    document.querySelectorAll('.favorite-item .favorite-name').forEach(item => {
        item.addEventListener('click', function() {
            const parentLi = this.closest('.favorite-item');
            const lat = parseFloat(parentLi.dataset.lat);
            const lon = parseFloat(parentLi.dataset.lon);
            const name = unescape(parentLi.dataset.name);

            console.log(`즐겨찾기 클릭: ${name} (${lat}, ${lon})`);

            const addressElement = document.getElementById('address-display');
            const weatherTodayElement = document.getElementById('weather-today');
            const weatherForecastElement = document.getElementById('weather-forecast');

            if (window.dashboardMap && window.dashboardMarker) {
                const newLocation = { lat: lat, lng: lon };
                window.dashboardMap.setCenter(newLocation);
                window.dashboardMarker.setPosition(newLocation);

                currentMapCenter = newLocation;

                if(addressElement) {
                    displayAddress(newLocation, addressElement, (fetchedAddress) => {
                        currentMapAddress = fetchedAddress;
                    });
                }
                if(weatherTodayElement) {
                    displayWeather(lat, lon, weatherTodayElement);
                }
                if(weatherForecastElement) {
                    displayForecast(lat, lon, weatherForecastElement);
                }
            } else {
                console.warn("지도 또는 마커 객체를 찾을 수 없습니다. (window.dashboardMap or window.dashboardMarker)");
            }
        });
    });

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
                        loadAndDisplayFavorites();
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

async function loadAndDisplayFavorites() {
    if (!currentUser) {
        renderFavoritesList(null);
        return;
    }
    try {
        const response = await fetch('/api/favorites');
        const contentType = response.headers.get("Content-Type") || "";
        if (!contentType.includes("application/json")) {
            throw new Error("서버에서 JSON이 아닌 응답을 받았습니다.");
        }
        if (!response.ok) {
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

async function updateLoginUI() {
    console.log("updateLoginUI 함수 호출됨");
    const authLinksDiv = document.querySelector('.header .auth-links');
    const favoritesButton = document.getElementById('btn-favorites');
    const weatherTodayElement = document.getElementById('weather-today');
    const weatherForecastElement = document.getElementById('weather-forecast');

    try {
        const response = await fetch('/api/current-user');
        const contentType = response.headers.get("Content-Type") || "";
        if (!contentType.includes("application/json")) {
            throw new Error("서버에서 JSON이 아닌 응답을 받았습니다.");
        }

        const data = await response.json();
        if (!data || !data.loggedIn || !data.user) throw new Error("로그인 정보가 유효하지 않습니다.");

        currentUser = data.user;
        if (authLinksDiv) {
            authLinksDiv.innerHTML = `<span>${currentUser.email}님 환영합니다!</span> | <a href="/logout">로그아웃</a>`;
        }
        if (favoritesButton) {
            favoritesButton.disabled = false;
            favoritesButton.textContent = '⭐ 현재 위치 즐겨찾기';
        }
        console.log("로그인 상태: O, 사용자:", currentUser.email);
        await loadAndDisplayFavorites();
    } catch (error) {
        console.error("현재 사용자 정보 가져오기 실패:", error);
        if (authLinksDiv) authLinksDiv.innerHTML = '<a href="/login.html">로그인 정보 로드 오류 (새로고침)</a>';
        currentUser = null;
        renderFavoritesList(null);
    }
}

// 이하 initDashboardMap, displayAddress, displayWeather, displayForecast 등은 기존과 동일하며 필요 시 추가 개선 가능

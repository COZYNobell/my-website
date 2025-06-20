// -----------dashboard.js---------------------

// public/js/dashboard.js

// 중요한 수정 사항: API Gateway의 호출 URL을 여기에 입력하세요
const API_GATEWAY_BASE_URL = "https://7bsjoaagma.execute-api.ap-northeast-2.amazonaws.com/test2/api";

// --- DOM 요소 가져오기 ---
const userEmailSpan = document.getElementById('userEmail');
const userInfoSpanElement = document.getElementById('userInfoSpan');

const favoritesSectionDiv = document.getElementById('favorites-section');
const favoritesListUl = document.getElementById('favorites-list');
const noFavoritesP = document.getElementById('noFavorites');
const loadingFavoritesP = document.getElementById('loadingFavorites');

const weatherTodaySection = document.getElementById('weather-today');
const weatherForecastSection = document.getElementById('weather-forecast');
const weatherTodayP = weatherTodaySection ? weatherTodaySection.querySelector('p') : null;
const weatherForecastP = weatherForecastSection ? weatherForecastSection.querySelector('p') : null;

const addressDisplayDiv = document.getElementById('address-display');
const currentAddressTextSpan = document.getElementById('currentAddressText');
const addToFavoritesBtn = document.getElementById('addToFavoritesBtn');

const loginLink = document.getElementById('loginLink');
const signupLink = document.getElementById('signupLink');
const logoutLink = document.getElementById('logoutLink');

let map;
let geocoder;
let currentMarker;
let currentUser = null;
let currentMapSelection = null;

async function fetchData(apiUrl, options = {}) {
    const token = localStorage.getItem('token');
    if (token) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }

    try {
        const response = await fetch(apiUrl, options);
        if (response.status === 401) {
            const data = await response.json().catch(() => ({
                message: '로그인이 필요합니다. 로그인 페이지로 이동합니다.',
                redirectTo: '/login.html'
            }));
            if (data.redirectTo) window.location.href = data.redirectTo;
            else window.location.href = '/login.html';
            throw new Error(data.message || '로그인이 필요합니다.');
        }

        if (!response.ok) {
            let errorData = { message: `서버 응답 오류: ${response.status}` };
            try {
                errorData = await response.json();
            } catch {}
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API 호출 (${apiUrl}) 실패:`, error.message);
        throw error;
    }
}

function updateUIForLoggedInState(user) {
    currentUser = user;
    if (userInfoSpanElement) {
        userInfoSpanElement.classList.remove('hidden');
        if (userEmailSpan) userEmailSpan.textContent = user.email;
    }
    if (favoritesSectionDiv) favoritesSectionDiv.classList.remove('hidden');
    if (loginLink) loginLink.classList.add('hidden');
    if (signupLink) signupLink.classList.add('hidden');
    if (logoutLink) logoutLink.classList.remove('hidden');
    if (currentMapSelection && addToFavoritesBtn) addToFavoritesBtn.classList.remove('hidden');
}

function updateUIForLoggedOutState() {
    currentUser = null;
    if (userInfoSpanElement) userInfoSpanElement.classList.add('hidden');
    if (userEmailSpan) userEmailSpan.textContent = '';
    if (favoritesSectionDiv) favoritesSectionDiv.classList.add('hidden');
    if (favoritesListUl) favoritesListUl.innerHTML = '';
    if (noFavoritesP) {
        noFavoritesP.innerHTML = '로그인하시면 즐겨찾기 목록을 볼 수 있습니다. <a href="/login.html">로그인</a>';
        noFavoritesP.classList.remove('hidden');
    }
    if (loginLink) loginLink.classList.remove('hidden');
    if (signupLink) signupLink.classList.remove('hidden');
    if (logoutLink) logoutLink.classList.add('hidden');
    if (addToFavoritesBtn) addToFavoritesBtn.classList.add('hidden');
    if (weatherTodayP) weatherTodayP.textContent = '날씨 정보를 보려면 지도에서 위치를 선택하거나 로그인하세요.';
    if (weatherForecastP) weatherForecastP.textContent = '예보 정보를 보려면 지도에서 위치를 선택하거나 로그인하세요.';
    if (currentAddressTextSpan) currentAddressTextSpan.textContent = '지도를 클릭하여 위치를 선택해주세요.';
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    updateUIForLoggedOutState();
    window.location.href = '/login.html';
}

async function loadCurrentUserInfo() {
    try {
        const data = await fetchData(`${API_GATEWAY_BASE_URL}/current-user`);
        if (data && data.loggedIn) {
            updateUIForLoggedInState(data.user);
            return data.user;
        } else {
            updateUIForLoggedOutState();
            return null;
        }
    } catch (error) {
        updateUIForLoggedOutState();
        return null;
    }
}

async function loadAndDisplayFavorites() {
    if (!currentUser) {
        updateUIForLoggedOutState();
        return;
    }
    favoritesSectionDiv.classList.remove('hidden');
    loadingFavoritesP.classList.remove('hidden');
    favoritesListUl.innerHTML = '';
    noFavoritesP.classList.add('hidden');
    try {
        const favorites = await fetchData(`${API_GATEWAY_BASE_URL}/favorites`);
        if (favorites && favorites.length > 0) {
            favorites.forEach(fav => {
                const li = document.createElement('li');
                li.className = 'favorite-item';

                const nameSpan = document.createElement('span');
                nameSpan.textContent = fav.location_name;
                nameSpan.style.cursor = 'pointer';
                nameSpan.onclick = () => {
                    const location = { lat: parseFloat(fav.latitude), lng: parseFloat(fav.longitude) };
                    map.setCenter(location);
                    map.setZoom(15);
                    if (currentMarker) {
                        currentMarker.setPosition(location);
                    } else {
                        currentMarker = new google.maps.Marker({ position: location });
                    }
                    currentMarker.setMap(map);
                    updateAddressAndWeather(location.lat, location.lng, fav.location_name);
                };
                const deleteButton = document.createElement('button');
                deleteButton.textContent = '삭제';
                deleteButton.dataset.id = fav.id;
                deleteButton.onclick = async function () {
                    if (confirm(`'${fav.location_name}' 즐겨찾기를 삭제하시겠습니까?`)) {
                        await fetchData(`${API_GATEWAY_BASE_URL}/favorites/${fav.id}`, { method: 'DELETE' });
                        loadAndDisplayFavorites();
                    }
                };
                li.appendChild(nameSpan);
                li.appendChild(deleteButton);
                favoritesListUl.appendChild(li);
            });
        } else {
            noFavoritesP.textContent = '등록된 즐겨찾기가 없습니다.';
            noFavoritesP.classList.remove('hidden');
        }
    } catch (error) {
        favoritesListUl.innerHTML = '<li>즐겨찾기를 불러오는 데 실패했습니다.</li>';
    } finally {
        loadingFavoritesP.classList.add('hidden');
    }
}

async function fetchAndDisplayWeather(lat, lon, locationName = null) {
    if (!weatherTodayP || !weatherForecastP) return;
    weatherTodayP.innerHTML = '오늘 날씨 정보를 가져오는 중...';
    weatherForecastP.innerHTML = '주간 예보 정보를 가져오는 중...';
    try {
        const currentWeatherData = await fetchData(`${API_GATEWAY_BASE_URL}/weather-by-coords?lat=${lat}&lon=${lon}`);
        const forecastData = await fetchData(`${API_GATEWAY_BASE_URL}/weather-forecast?lat=${lat}&lon=${lon}`);

        if (currentWeatherData) {
            weatherTodayP.innerHTML = `
                <strong>${locationName || currentWeatherData.cityName}</strong><br>
                상태: ${currentWeatherData.description} <img src="http://openweathermap.org/img/wn/${currentWeatherData.icon}.png" alt="날씨 아이콘" style="vertical-align: middle;"><br>
                온도: ${currentWeatherData.temperature}°C (체감: ${currentWeatherData.feels_like}°C)<br>
                습도: ${currentWeatherData.humidity}%
            `;
        }

        if (forecastData && forecastData.forecast) {
            let forecastHtml = `<strong>${locationName || forecastData.cityName} 예보</strong><br>`;
            forecastData.forecast.forEach(day => {
                forecastHtml += `
                    <div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #efefef;">
                        <strong>${day.date}</strong>: ${day.description} <img src="http://openweathermap.org/img/wn/${day.icon}.png" alt="날씨 아이콘" style="vertical-align: middle;"><br>
                        최저 ${day.temp_min}°C / 최고 ${day.temp_max}°C
                    </div>`;
            });
            weatherForecastP.innerHTML = forecastHtml;
        }
    } catch (error) {
        weatherTodayP.textContent = '날씨 정보를 불러오는 데 실패했습니다.';
        weatherForecastP.textContent = '예보 정보를 불러오는 데 실패했습니다.';
    }
}

async function updateAddressAndWeather(lat, lng, predefinedAddress = null) {
    let addressToDisplay = predefinedAddress;
    if (currentAddressTextSpan) {
        currentAddressTextSpan.textContent = predefinedAddress || '주소 변환 중...';
    }

    if (!predefinedAddress && geocoder) {
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results[0]) {
                addressToDisplay = results[0].formatted_address;
            } else {
                addressToDisplay = `위도: ${lat.toFixed(4)}, 경도: ${lng.toFixed(4)}`;
            }
            if (currentAddressTextSpan) currentAddressTextSpan.textContent = addressToDisplay;
            currentMapSelection = { name: addressToDisplay, lat, lng };
            if (currentUser && addToFavoritesBtn) addToFavoritesBtn.classList.remove('hidden');
            fetchAndDisplayWeather(lat, lng, addressToDisplay);
        });
    } else {
        addressToDisplay ||= `위도: ${lat.toFixed(4)}, 경도: ${lng.toFixed(4)}`;
        if (currentAddressTextSpan) currentAddressTextSpan.textContent = addressToDisplay;
        currentMapSelection = { name: addressToDisplay, lat, lng };
        if (currentUser && addToFavoritesBtn) addToFavoritesBtn.classList.remove('hidden');
        else if (addToFavoritesBtn) addToFavoritesBtn.classList.add('hidden');
        fetchAndDisplayWeather(lat, lng, addressToDisplay);
    }
}

async function handleAddFavoriteClick() {
    if (!currentUser) return;
    if (!currentMapSelection || !currentMapSelection.name) {
        alert("지도에서 위치를 선택해주세요.");
        return;
    }
    const newFavoriteData = {
        location_name: currentMapSelection.name,
        latitude: currentMapSelection.lat,
        longitude: currentMapSelection.lng
    };
    try {
        const result = await fetchData(`${API_GATEWAY_BASE_URL}/favorites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newFavoriteData)
        });
        alert(result.message || '즐겨찾기에 추가되었습니다!');
        loadAndDisplayFavorites();
        if (addToFavoritesBtn) addToFavoritesBtn.classList.add('hidden');
    } catch (error) {
        alert(`즐겨찾기 추가 실패: ${error.message}`);
    }
}

function initDashboardMap() {
    const initialLat = 37.5665;
    const initialLng = 126.9780;
    const mapElement = document.getElementById('map-container');

    if (!mapElement || typeof google === 'undefined' || typeof google.maps === 'undefined') {
        console.error("Google 지도 초기화 실패");
        return;
    }

    map = new google.maps.Map(mapElement, { zoom: 12, center: { lat: initialLat, lng: initialLng } });
    geocoder = new google.maps.Geocoder();
    currentMarker = new google.maps.Marker({ map: null });

    map.addListener('click', (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        if (currentMarker) {
            currentMarker.setPosition(e.latLng);
            currentMarker.setMap(map);
        }
        updateAddressAndWeather(lat, lng);
    });

    if (localStorage.getItem('token')) {
        updateAddressAndWeather(initialLat, initialLng, "서울특별시 (기본 위치)");
    }
}

window.initDashboardMap = initDashboardMap;

document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUserInfo();
    if (currentUser) loadAndDisplayFavorites();
    if (addToFavoritesBtn) {
        addToFavoritesBtn.addEventListener('click', handleAddFavoriteClick);
        if (!localStorage.getItem('token') || !currentMapSelection) {
            addToFavoritesBtn.classList.add('hidden');
        }
    }
    if (logoutLink) {
        logoutLink.addEventListener('click', e => {
            e.preventDefault();
            handleLogout();
        });
    }
});

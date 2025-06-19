// public/js/dashboard.js

// API Gateway의 기본 호출 URL을 설정합니다.
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

// --- 전역 변수 ---
let map;
let geocoder;
let currentMarker;
let currentUser = null; 
let currentMapSelection = null; 

/**
 * ✨ API 요청을 보내는 범용 헬퍼 함수 (JWT 인증 헤더 자동 추가) ✨
 * @param {string} apiUrl - 요청할 API의 전체 URL
 * @param {object} options - fetch 함수의 옵션 객체
 * @returns {Promise<any>} - API 응답의 JSON 데이터
 */
async function fetchWithAuth(apiUrl, options = {}) {
    // localStorage에서 저장된 JWT 토큰을 가져옵니다.
    const token = localStorage.getItem('token');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // 토큰이 존재하면 Authorization 헤더에 추가합니다.
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(apiUrl, { ...options, headers });

        // 인증 실패(401) 또는 권한 없음(403) 시 로그아웃 처리
        if (response.status === 401 || response.status === 403) {
            alert('인증 정보가 유효하지 않습니다. 다시 로그인해주세요.');
            logout(); 
            throw new Error('Unauthorized');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: '서버 응답 오류' }));
            throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        return text ? JSON.parse(text) : {};

    } catch (error) {
        console.error(`API 호출 실패 (${apiUrl}):`, error);
        throw error;
    }
}

/**
 * ✨ 로그아웃 함수 ✨
 */
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    window.location.href = '/login.html';
}

// --- UI 업데이트 함수 ---
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
    if (weatherTodayP) weatherTodayP.textContent = '날씨 정보를 보려면 로그인 후 지도를 클릭하세요.';
    if (weatherForecastP) weatherForecastP.textContent = '예보 정보를 보려면 로그인 후 지도를 클릭하세요.';
    if (currentAddressTextSpan) currentAddressTextSpan.textContent = '지도를 클릭하여 위치를 선택해주세요.';
}

// --- 핵심 기능 함수들 (모든 API 호출에 fetchWithAuth 사용) ---
async function loadCurrentUserInfo() {
    try {
        const data = await fetchWithAuth(`${API_GATEWAY_BASE_URL}/current-user`); 
        if (data && data.user) {
            updateUIForLoggedInState(data.user);
            return data.user; 
        } else {
            updateUIForLoggedOutState(); 
            return null;
        }
    } catch (error) {
        console.error('현재 사용자 정보 로드 최종 실패:', error.message);
        updateUIForLoggedOutState();
        return null;
    }
}

async function loadAndDisplayFavorites() {
    if (!currentUser) return;
    loadingFavoritesP.classList.remove('hidden');
    favoritesListUl.innerHTML = '';
    noFavoritesP.classList.add('hidden');

    try {
        const favorites = await fetchWithAuth(`${API_GATEWAY_BASE_URL}/favorites`);
        if (favorites && favorites.length > 0) {
            favorites.forEach(fav => {
                const li = document.createElement('li');
                li.className = 'favorite-item';
                
                const nameSpan = document.createElement('span');
                nameSpan.textContent = fav.location_name;
                nameSpan.title = `클릭하여 지도 이동: ${fav.location_name}`;
                nameSpan.style.cursor = 'pointer';
                nameSpan.onclick = () => {
                    if (map) { 
                        const location = { lat: parseFloat(fav.latitude), lng: parseFloat(fav.longitude) };
                        map.setCenter(location);
                        map.setZoom(15);
                        currentMarker.setPosition(location);
                        currentMarker.setMap(map);
                        updateAddressAndWeather(location.lat, location.lng, fav.location_name);
                    }
                };
                
                const deleteButton = document.createElement('button');
                deleteButton.textContent = '삭제';
                deleteButton.onclick = async () => {
                    if (confirm(`'${fav.location_name}' 즐겨찾기를 삭제하시겠습니까?`)) {
                        try {
                            await fetchWithAuth(`${API_GATEWAY_BASE_URL}/favorites/${fav.id}`, { method: 'DELETE' });
                            loadAndDisplayFavorites(); 
                        } catch (deleteError) {
                            alert(`삭제 실패: ${deleteError.message}`);
                        }
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
        if (favoritesListUl) favoritesListUl.innerHTML = '<li>즐겨찾기를 불러오는 데 실패했습니다.</li>';
    } finally {
        if (loadingFavoritesP) loadingFavoritesP.classList.add('hidden');
    }
}

async function fetchAndDisplayWeather(lat, lon, locationName = null) {
    if (!weatherTodayP || !weatherForecastP) return;
    weatherTodayP.innerHTML = '오늘 날씨 정보를 가져오는 중...';
    weatherForecastP.innerHTML = '주간 예보 정보를 가져오는 중...';
    try {
        const [currentWeatherData, forecastData] = await Promise.all([
            fetchWithAuth(`${API_GATEWAY_BASE_URL}/weather-by-coords?lat=${lat}&lon=${lon}`),
            fetchWithAuth(`${API_GATEWAY_BASE_URL}/weather-forecast?lat=${lat}&lon=${lon}`)
        ]);

        if (currentWeatherData) {
            weatherTodayP.innerHTML = `<strong>${locationName || currentWeatherData.name || '알 수 없는 지역'}</strong><br>상태: ${currentWeatherData.weather[0].description || '정보 없음'} <img src="https://openweathermap.org/img/wn/${currentWeatherData.weather[0].icon || '01d'}.png" alt="날씨 아이콘" style="vertical-align: middle;"><br>온도: ${currentWeatherData.main.temp?.toFixed(1)}°C (체감: ${currentWeatherData.main.feels_like?.toFixed(1)}°C)<br>습도: ${currentWeatherData.main.humidity}%`;
        }
        
        if (forecastData && forecastData.list) {
            const dailyForecasts = {};
            forecastData.list.forEach(item => {
                const date = item.dt_txt.split(' ')[0];
                if (!dailyForecasts[date]) dailyForecasts[date] = { temps: [], weather_descriptions: [], icons: [] };
                dailyForecasts[date].temps.push(item.main.temp);
                dailyForecasts[date].weather_descriptions.push(item.weather[0].description);
                dailyForecasts[date].icons.push(item.weather[0].icon);
            });
            let forecastHtml = `<strong>${locationName || forecastData.city.name || '알 수 없는 지역'} 예보</strong><br>`;
            Object.keys(dailyForecasts).slice(1, 4).forEach(date => {
                const dayData = dailyForecasts[date];
                const representativeDescription = dayData.weather_descriptions[Math.floor(dayData.weather_descriptions.length / 2)];
                const representativeIcon = dayData.icons[Math.floor(dayData.icons.length / 2)].replace('n', 'd');
                forecastHtml += `<div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #efefef;"><strong>${date}</strong>: ${representativeDescription} <img src="https://openweathermap.org/img/wn/${representativeIcon}.png" alt="날씨 아이콘" style="vertical-align: middle;"><br>최저 ${Math.min(...dayData.temps).toFixed(1)}°C / 최고 ${Math.max(...dayData.temps).toFixed(1)}°C</div>`;
            });
            weatherForecastP.innerHTML = forecastHtml;
        }
    } catch (error) {
        weatherTodayP.textContent = '날씨 정보를 불러오는 데 실패했습니다.';
        weatherForecastP.textContent = '예보 정보를 불러오는 데 실패했습니다.';
    }
}

async function updateAddressAndWeather(lat, lng, predefinedAddress = null) {
    if (currentAddressTextSpan) currentAddressTextSpan.textContent = predefinedAddress || '주소 변환 중...';
    if (!predefinedAddress && geocoder) {
        geocoder.geocode({ 'location': { lat, lng } }, (results, status) => {
            let addressToDisplay = `위도: ${lat.toFixed(4)}, 경도: ${lng.toFixed(4)}`;
            if (status === 'OK' && results[0]) addressToDisplay = results[0].formatted_address;
            else console.warn('Geocoder 실패:', status);
            if (currentAddressTextSpan) currentAddressTextSpan.textContent = addressToDisplay;
            currentMapSelection = { name: addressToDisplay, lat, lng };
            if (currentUser && addToFavoritesBtn) addToFavoritesBtn.classList.remove('hidden');
            fetchAndDisplayWeather(lat, lng, addressToDisplay);
        });
    } else {
        const addressToDisplay = predefinedAddress || `위도: ${lat.toFixed(4)}, 경도: ${lng.toFixed(4)}`;
        currentMapSelection = { name: addressToDisplay, lat, lng };
        if (currentUser && addToFavoritesBtn) addToFavoritesBtn.classList.remove('hidden');
        fetchAndDisplayWeather(lat, lng, addressToDisplay);
    }
}

async function handleAddFavoriteClick() {
    if (!currentUser || !currentMapSelection) { alert("먼저 지도에서 유효한 위치를 선택해주세요."); return; }
    try {
        const result = await fetchWithAuth(`${API_GATEWAY_BASE_URL}/favorites`, {
            method: 'POST',
            body: JSON.stringify({
                location_name: currentMapSelection.name,
                latitude: currentMapSelection.lat,
                longitude: currentMapSelection.lng
            })
        });
        alert(result.message || "즐겨찾기에 추가되었습니다!");
        loadAndDisplayFavorites(); 
    } catch (error) {
        alert(`즐겨찾기 추가 실패: ${error.message}`);
    }
}

function initDashboardMap() {
    const initialLocation = { lat: 37.5665, lng: 126.9780 };
    const mapElement = document.getElementById('map-container');
    if (!mapElement) return;
    try {
        map = new google.maps.Map(mapElement, { zoom: 12, center: initialLocation });
        geocoder = new google.maps.Geocoder();
        currentMarker = new google.maps.Marker({ map: null });
        map.addListener('click', (e) => {
            const lat = e.latLng.lat(), lng = e.latLng.lng();
            currentMarker.setPosition(e.latLng);
            currentMarker.setMap(map);
            updateAddressAndWeather(lat, lng);
        });
        updateAddressAndWeather(initialLocation.lat, initialLocation.lng, "서울특별시 (기본 위치)");
    } catch (e) {
        console.error("지도 초기화 중 오류:", e);
        mapElement.innerHTML = "<p>지도 초기화 중 오류가 발생했습니다.</p>";
    }
}
window.initDashboardMap = initDashboardMap; 

// --- 페이지 로드 시 실행될 메인 로직 ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUserInfo(); 
    if (currentUser) {
        loadAndDisplayFavorites();
    }
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    if (addToFavoritesBtn) {
        addToFavoritesBtn.addEventListener('click', handleAddFavoriteClick);
    }
});

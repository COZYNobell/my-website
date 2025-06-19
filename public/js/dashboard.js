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
    const token = localStorage.getItem('token');
    
    if (!options.headers) {
        options.headers = {};
    }
    options.headers['Content-Type'] = 'application/json';

    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(apiUrl, options);
        
        if (response.status === 401) {
            const data = await response.json().catch(() => ({ 
                message: '로그인이 필요합니다. 로그인 페이지로 이동합니다.', 
                redirectTo: '/login.html'
            }));
            console.warn('fetchWithAuth 401:', data.message);
            logout(); // 로그아웃 처리
            throw new Error(data.message || '로그인이 필요합니다.');
        }

        if (!response.ok) {
            let errorData = { message: `서버 응답 오류: ${response.status}` };
            try {
                errorData = await response.json();
            } catch (e) {
                console.warn('오류 응답 JSON 파싱 실패:', response.status, response.statusText);
            }
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        
        // 응답 본문이 비어있을 수 있는 경우(e.g., 204 No Content)를 처리
        const text = await response.text();
        return text ? JSON.parse(text) : {};

    } catch (error) {
        console.error(`API 호출 실패 (${apiUrl}):`, error.message);
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
    if (loginLink) loginLink.classList.remove('hidden');
    if (signupLink) signupLink.classList.remove('hidden');
    if (logoutLink) logoutLink.classList.add('hidden');
    if (addToFavoritesBtn) addToFavoritesBtn.classList.add('hidden'); 
    if (weatherTodayP) weatherTodayP.textContent = '날씨 정보를 보려면 지도에서 위치를 선택하거나 로그인하세요.';
    if (weatherForecastP) weatherForecastP.textContent = '예보 정보를 보려면 지도에서 위치를 선택하거나 로그인하세요.';
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
                nameSpan.onclick = () => { /* ... 지도 이동 로직 ... */ };
                
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
    weatherTodayP.innerHTML = '오늘 날씨 정보 가져오는 중...';
    weatherForecastP.innerHTML = '주간 예보 정보를 가져오는 중...';
    try {
        const [currentWeatherData, forecastData] = await Promise.all([
            fetchWithAuth(`${API_GATEWAY_BASE_URL}/weather-by-coords?lat=${lat}&lon=${lon}`),
            fetchWithAuth(`${API_GATEWAY_BASE_URL}/weather-forecast?lat=${lat}&lon=${lon}`)
        ]);
        // ... (이하 날씨 정보 표시 로직은 이전과 동일)
    } catch (error) {
        weatherTodayP.textContent = '날씨 정보를 불러오는 데 실패했습니다.';
        weatherForecastP.textContent = '예보 정보를 불러오는 데 실패했습니다.';
    }
}

async function updateAddressAndWeather(lat, lng, predefinedAddress = null) {
    // ... (이전 로직과 동일, 내부의 fetchAndDisplayWeather 호출은 그대로 유지)
}

async function handleAddFavoriteClick() {
    if (!currentUser || !currentMapSelection) return; 
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
    // ... (이전 로직과 동일)
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

// -----------dashboard.js---------------------

// public/js/dashboard.js

// ⭐⭐⭐ 중요한 수정 사항: API Gateway의 호출 URL을 여기에 입력하세요 ⭐⭐⭐
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
const logoutLink = document.getElementById('logoutLink'); // ⭐⭐ 로그아웃 링크 가져오기 ⭐⭐

// --- 전역(모듈 스코프) 변수 ---
let map;
let geocoder;
let currentMarker;
let currentUser = null;          
let currentMapSelection = null;

// --- API 호출 공통 헬퍼 함수 ---
async function fetchData(apiUrl, options = {}) {
    // ⭐⭐ Authorization 헤더 추가 ⭐⭐
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
                redirectTo: '/login.html' // ⭐⭐ 기본 리디렉션 URL 명확화 ⭐⭐
            }));
            console.warn('fetchData 401:', data.message, data.redirectTo);
            if (data.redirectTo) {
                window.location.href = data.redirectTo;
            } else {
                window.location.href = '/login.html'; // 안전장치로 기본 로그인 페이지 이동
            }
            throw new Error(data.message || '로그인이 필요합니다.');
        }

        if (!response.ok) { 
            let errorData = { message: `서버 응답 오류: ${response.status}` };
            try {
                errorData = await response.json();
            } catch (e) {
                console.warn('오류 응답 JSON 파싱 실패, 기본 메시지 사용. 응답 상태:', response.status, response.statusText);
            }
            console.error('API 응답 오류:', errorData);
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API 호출 (${apiUrl}) 실패:`, error.message);
        throw error; 
    }
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
    if (currentMapSelection && addToFavoritesBtn) {
        addToFavoritesBtn.classList.remove('hidden');
    }
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

// ⭐⭐ 로그아웃 함수 추가 ⭐⭐
function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    updateUIForLoggedOutState();
    window.location.href = '/login.html'; // 로그인 페이지로 리디렉션
}

// --- 핵심 기능 함수들 ---
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
        console.error('현재 사용자 정보 로드 최종 실패 (대시보드):', error.message);
        // ⭐⭐ 401 에러는 fetchData에서 이미 리디렉션 처리하므로 여기서는 추가 처리 불필요 ⭐⭐
        updateUIForLoggedOutState(); 
        return null;
    }
}

// loadAndDisplayFavorites, fetchAndDisplayWeather, updateAddressAndWeather, handleAddFavoriteClick 함수는 유지

// Google 지도 초기화 (HTML의 API 스크립트 로드 후 &callback=initDashboardMap 으로 호출됨)
function initDashboardMap() {
    console.log("Google 지도 초기화 (initDashboardMap) 시작");
    const initialLat = 37.5665; 
    const initialLng = 126.9780;
    const initialLocation = { lat: initialLat, lng: initialLng };
    const mapElement = document.getElementById('map-container');
    if (!mapElement) {
        console.error("#map-container 요소를 찾을 수 없습니다.");
        if (weatherTodayP) weatherTodayP.textContent = '지도 컨테이너를 찾을 수 없어 날씨 정보를 표시할 수 없습니다.';
        if (weatherForecastP) weatherForecastP.textContent = '지도 컨테이너를 찾을 수 없어 예보 정보를 표시할 수 없습니다.';
        return;
    }
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        console.error("Google Maps API가 로드되지 않았습니다.");
        mapElement.innerHTML = "<p>지도 API 로드 실패. 인터넷 연결 및 API 키를 확인하세요.</p>";
        return;
    }

    try {
        map = new google.maps.Map(mapElement, {
            zoom: 12,
            center: initialLocation
        });
        geocoder = new google.maps.Geocoder();
        currentMarker = new google.maps.Marker({ map: null });
        map.addListener('click', (mapsMouseEvent) => {
            const clickedLat = mapsMouseEvent.latLng.lat();
            const clickedLng = mapsMouseEvent.latLng.lng();
            if (currentMarker) {
                currentMarker.setPosition(mapsMouseEvent.latLng);
                currentMarker.setMap(map); 
            }
            updateAddressAndWeather(clickedLat, clickedLng);
        });
        // ⭐⭐ currentUser 확인 후 초기 주소 및 날씨 정보 로딩 ⭐⭐
        if (localStorage.getItem('token')) { // 토큰이 있다면 로그인된 것으로 간주
            updateAddressAndWeather(initialLat, initialLng, "서울특별시 (기본 위치)");
        } else {
            if (currentAddressTextSpan) currentAddressTextSpan.textContent = '지도를 클릭하여 위치를 선택해주세요.';
            if (weatherTodayP) weatherTodayP.textContent = '날씨 정보를 보려면 로그인 후 지도를 클릭하세요.';
            if (weatherForecastP) weatherForecastP.textContent = '예보 정보를 보려면 로그인 후 지도를 클릭하세요.';
        }

    } catch (e) {
        console.error("Google 지도 초기화 중 오류:", e);
        if (mapElement) mapElement.innerHTML = "<p>지도 초기화 중 오류가 발생했습니다.</p>";
    }
}
window.initDashboardMap = initDashboardMap;

// 페이지 로드 시 실행될 메인 로직
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard DOMContentLoaded. 사용자 정보 로드 시도...');
    
    await loadCurrentUserInfo(); 

    if (currentUser) {
        console.log('사용자 인증됨. 즐겨찾기 로드.');
        loadAndDisplayFavorites();
    } else {
        console.log('사용자 인증 안됨. UI가 로그아웃 상태로 업데이트됩니다.');
    }

    if (addToFavoritesBtn) {
        addToFavoritesBtn.addEventListener('click', handleAddFavoriteClick);
        // ⭐⭐ 토큰 유무로 즐겨찾기 버튼 표시 여부 초기화 ⭐⭐
        if(!localStorage.getItem('token') || !currentMapSelection) { 
             addToFavoritesBtn.classList.add('hidden');
        }
    } else {
        console.warn("ID 'addToFavoritesBtn' 요소를 찾을 수 없습니다.");
    }

    // ⭐⭐ 로그아웃 링크 이벤트 리스너 추가 ⭐⭐
    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }
});

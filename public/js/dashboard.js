// -----------dashboard.js---------------------

// public/js/dashboard.js

// ⭐⭐⭐ 중요한 수정 사항: API Gateway의 호출 URL을 여기에 입력하세요 ⭐⭐⭐
const API_GATEWAY_BASE_URL = "https://7bsjoaagma.execute-api.ap-northeast-2.amazonaws.com/test2/api"; // 

// --- DOM 요소 가져오기 ---
const userEmailSpan = document.getElementById('userEmail'); // 헤더의 사용자 이메일 표시용 (strong 태그 안) 
const userInfoSpanElement = document.getElementById('userInfoSpan'); // 헤더의 "안녕하세요, ...님!" 전체 span 

const favoritesSectionDiv = document.getElementById('favorites-section'); // 
const favoritesListUl = document.getElementById('favorites-list'); // 즐겨찾기 <ul> 
const noFavoritesP = document.getElementById('noFavorites');           // "즐겨찾기 없음" 메시지 
const loadingFavoritesP = document.getElementById('loadingFavorites'); // "로딩 중" 메시지 

const weatherTodaySection = document.getElementById('weather-today'); // 오늘 날씨 섹션 
const weatherForecastSection = document.getElementById('weather-forecast'); // 주간 예보 섹션 
const weatherTodayP = weatherTodaySection ? weatherTodaySection.querySelector('p') : null; // 오늘 날씨 정보 p 태그 
const weatherForecastP = weatherForecastSection ? weatherForecastSection.querySelector('p') : null; // 주간 예보 정보 p 태그 

const addressDisplayDiv = document.getElementById('address-display'); // 주소와 즐겨찾기 버튼을 감싸는 div 
const currentAddressTextSpan = document.getElementById('currentAddressText'); // 주소 텍스트만 표시할 span 
const addToFavoritesBtn = document.getElementById('addToFavoritesBtn');        // 즐겨찾기 추가(별표) 버튼 

const loginLink = document.getElementById('loginLink'); // 헤더 로그인 링크 
const signupLink = document.getElementById('signupLink');        // 헤더 회원가입 링크 
const logoutLink = document.getElementById('logoutLink'); // 헤더 로그아웃 링크 

// --- 전역(모듈 스코프) 변수 ---
let map; // Google 지도 객체 
let geocoder; // Google Geocoder 객체 
let currentMarker; // 현재 지도에 표시된 마커 
let currentUser = null;          // 현재 로그인된 사용자 정보 {id, email} 
let currentMapSelection = null; // 현재 지도에서 선택/표시된 위치 정보 {name, lat, lng} 

// --- API 호출 공통 헬퍼 함수 ---
async function fetchData(apiUrl, options = {}) {
    // ⭐⭐ Authorization 헤더 추가 ⭐⭐ 
    const token = localStorage.getItem('token'); [cite: 8]
    if (token) { // 
        options.headers = { // 
            ...options.headers, // 
            'Authorization': `Bearer ${token}` // 
        }; // 
    } // 

    try {
        const response = await fetch(apiUrl, options); [cite: 10, 68]
        if (response.status === 401) { // 서버가 401 Unauthorized 응답 
            const data = await response.json().catch(() => ({ // 
                message: '로그인이 필요합니다. 로그인 페이지로 이동합니다.', // 
                redirectTo: '/login.html' // ⭐⭐ 기본 리디렉션 URL 명확화 ⭐⭐  (최근꺼)
            })); // 
            console.warn('fetchData 401:', data.message, data.redirectTo); [cite: 11, 69]
            if (data.redirectTo) { // 
                window.location.href = data.redirectTo; [cite: 12, 70]
            } else { // 
                window.location.href = '/login.html'; // 안전장치로 기본 로그인 페이지 이동  (최근꺼)
            } // 
            throw new Error(data.message || '로그인이 필요합니다.'); // 
        } // 

        if (!response.ok) { // 401 외의 다른 HTTP 오류 
            let errorData = { message: `서버 응답 오류: ${response.status}` }; [cite: 15, 73]
            try { // 
                errorData = await response.json(); [cite: 16, 74]
            } catch (e) { // 
                console.warn('오류 응답 JSON 파싱 실패, 기본 메시지 사용. 응답 상태:', response.status, response.statusText); [cite: 17, 75]
            } // 
            console.error('API 응답 오류:', errorData); [cite: 18, 76]
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`); [cite: 18, 76]
        } // 
        return await response.json(); // 성공 시 JSON 데이터 반환 
    } catch (error) {
        console.error(`API 호출 (${apiUrl}) 실패:`, error.message); [cite: 19, 78]
        throw error; // 
    } // 
} // 

// --- UI 업데이트 함수 ---
function updateUIForLoggedInState(user) {
    currentUser = user; [cite: 21, 79]
    if (userInfoSpanElement) { [cite: 21, 79]
        userInfoSpanElement.classList.remove('hidden'); [cite: 21, 79]
        if (userEmailSpan) userEmailSpan.textContent = user.email; [cite: 22, 80]
    } // 
    if (favoritesSectionDiv) favoritesSectionDiv.classList.remove('hidden'); // 
    
    if (loginLink) loginLink.classList.add('hidden'); // 
    if (signupLink) signupLink.classList.add('hidden'); // 
    if (logoutLink) logoutLink.classList.remove('hidden'); [cite: 23, 81]
    if (currentMapSelection && addToFavoritesBtn) { // 
        addToFavoritesBtn.classList.remove('hidden'); [cite: 24, 82]
    } // 
} // 

function updateUIForLoggedOutState() {
    currentUser = null; [cite: 25, 83]
    if (userInfoSpanElement) userInfoSpanElement.classList.add('hidden'); [cite: 25, 83]
    if (userEmailSpan) userEmailSpan.textContent = ''; // 

    if (favoritesSectionDiv) favoritesSectionDiv.classList.add('hidden'); [cite: 25, 83]
    if (favoritesListUl) favoritesListUl.innerHTML = ''; // 
    if (noFavoritesP) { // 
        noFavoritesP.innerHTML = '로그인하시면 즐겨찾기 목록을 볼 수 있습니다. <a href="/login.html">로그인</a>'; //  (최근꺼)
        noFavoritesP.classList.remove('hidden'); [cite: 26, 84]
    } // 
    
    if (loginLink) loginLink.classList.remove('hidden'); // 
    if (signupLink) signupLink.classList.remove('hidden'); // 
    if (logoutLink) logoutLink.classList.add('hidden'); [cite: 27, 85]
    if (addToFavoritesBtn) addToFavoritesBtn.classList.add('hidden'); // 
    
    if (weatherTodayP) weatherTodayP.textContent = '날씨 정보를 보려면 지도에서 위치를 선택하거나 로그인하세요.'; [cite: 28, 86]
    if (weatherForecastP) weatherForecastP.textContent = '예보 정보를 보려면 지도에서 위치를 선택하거나 로그인하세요.'; [cite: 28, 86]
    if (currentAddressTextSpan) currentAddressTextSpan.textContent = '지도를 클릭하여 위치를 선택해주세요.'; [cite: 29, 87]
} // 

// ⭐⭐ 로그아웃 함수 추가 ⭐⭐ 
function handleLogout() { // 
    localStorage.removeItem('token'); // 
    localStorage.removeItem('userEmail'); // 
    updateUIForLoggedOutState(); // 
    window.location.href = '/login.html'; // 로그인 페이지로 리디렉션 
} // 

// --- 핵심 기능 함수들 ---
async function loadCurrentUserInfo() {
    try {
        // ⭐⭐ 수정된 부분: API_GATEWAY_BASE_URL 사용 ⭐⭐ 
        const data = await fetchData(`${API_GATEWAY_BASE_URL}/current-user`); [cite: 31, 88]
        if (data && data.loggedIn) { [cite: 31, 88]
            updateUIForLoggedInState(data.user); [cite: 32, 89]
            return data.user; [cite: 32, 89]
        } else { [cite: 32, 89]
            updateUIForLoggedOutState(); [cite: 33, 90]
            return null; [cite: 33, 90]
        } // 
    } catch (error) {
        console.error('현재 사용자 정보 로드 최종 실패 (대시보드):', error.message); [cite: 34, 91]
        // ⭐⭐ 401 에러는 fetchData에서 이미 리디렉션 처리하므로 여기서는 추가 처리 불필요 ⭐⭐ 
        updateUIForLoggedOutState(); [cite: 35, 91]
        return null; [cite: 35, 91]
    } // 
} // 

async function loadAndDisplayFavorites() {
    if (!currentUser) { // 
        updateUIForLoggedOutState(); [cite: 92]
        return; // 
    } // 
    if (!favoritesListUl || !noFavoritesP || !loadingFavoritesP || !favoritesSectionDiv) { // 
        console.warn("loadAndDisplayFavorites: 즐겨찾기 관련 DOM 요소 중 일부를 찾을 수 없습니다."); // 
        return; // 
    } // 

    favoritesSectionDiv.classList.remove('hidden'); // 
    loadingFavoritesP.classList.remove('hidden'); // 
    favoritesListUl.innerHTML = ''; // 
    noFavoritesP.classList.add('hidden'); [cite: 94]
    try { // 
        // ⭐⭐ 수정된 부분: API_GATEWAY_BASE_URL 사용 ⭐⭐ 
        const favorites = await fetchData(`${API_GATEWAY_BASE_URL}/favorites`); [cite: 95]
        if (favorites && favorites.length > 0) { [cite: 95]
            favorites.forEach(fav => { // 
                const li = document.createElement('li'); // 
                li.className = 'favorite-item'; // 
                
                const nameSpan = document.createElement('span'); // 
                nameSpan.textContent = fav.location_name; [cite: 96]
                nameSpan.title = `클릭하여 지도 이동: ${fav.location_name} (위도: ${fav.latitude}, 경도: ${fav.longitude})`; // 
                nameSpan.style.cursor = 'pointer'; // 
                nameSpan.onclick = () => { // 
                    if (typeof google !== 'undefined' && map ) { // 
                        const location = { lat: parseFloat(fav.latitude), lng: parseFloat(fav.longitude) }; // 
                        map.setCenter(location); // 
                        map.setZoom(15); // 
                        if (currentMarker) { // 
                            currentMarker.setPosition(location); // 
                        } else { // 
                            currentMarker = new google.maps.Marker({ position: location }); // 
                        } // 
                        currentMarker.setMap(map); [cite: 100]
                        updateAddressAndWeather(location.lat, location.lng, fav.location_name); [cite: 100]
                    } else { console.error("지도 객체가 준비되지 않았습니다."); } // 
                }; // 
                const deleteButton = document.createElement('button'); // 
                deleteButton.textContent = '삭제'; // 
                deleteButton.dataset.id = fav.id; // 
                deleteButton.dataset.name = fav.location_name; [cite: 103]
                deleteButton.addEventListener('click', async function() { // 
                    if (confirm(`'${this.dataset.name}' 즐겨찾기를 삭제하시겠습니까?`)) { // 
                        try { // 
                            // ⭐⭐ 수정된 부분: API_GATEWAY_BASE_URL 사용 ⭐⭐ 
                            await fetchData(`${API_GATEWAY_BASE_URL}/favorites/${this.dataset.id}`, { method: 'DELETE' }); // 
                            alert('즐겨찾기에서 삭제되었습니다.'); // 
                            loadAndDisplayFavorites(); // 
                        } catch (deleteError) { // 
                            alert(`삭제 실패: ${deleteError.message}`); // 
                            console.error("즐겨찾기 삭제 API 호출 실패:", deleteError); // 
                        } // 
                    } // 
                }); // 
                li.appendChild(nameSpan); // 
                li.appendChild(deleteButton); // 
                favoritesListUl.appendChild(li); // 
            }); // 
        } else { // 
            noFavoritesP.textContent = '등록된 즐겨찾기가 없습니다.'; [cite: 108]
            noFavoritesP.classList.remove('hidden'); [cite: 108]
        } // 
    } catch (error) { // 
        console.error('즐겨찾기 목록 로드 중 오류:', error.message); [cite: 109]
        if (favoritesListUl) favoritesListUl.innerHTML = '<li>즐겨찾기를 불러오는 데 실패했습니다. 관리자에게 문의하세요.</li>'; [cite: 109, 110]
    } finally { // 
        if (loadingFavoritesP) loadingFavoritesP.classList.add('hidden'); [cite: 111]
    } // 
} // 

async function fetchAndDisplayWeather(lat, lon, locationName = null) {
    if (!weatherTodayP || !weatherForecastP) { // 
        console.warn("fetchAndDisplayWeather: 날씨 정보 표시 DOM 요소가 없습니다."); // 
        return; // 
    } // 
    weatherTodayP.innerHTML = '오늘 날씨 정보를 가져오는 중...'; // 
    weatherForecastP.innerHTML = '주간 예보 정보를 가져오는 중...'; // 
    try { // 
        const [currentWeatherData, forecastData] = await Promise.all([ // 
            // ⭐⭐ 수정된 부분: API_GATEWAY_BASE_URL 사용 ⭐⭐ 
            fetchData(`${API_GATEWAY_BASE_URL}/weather-by-coords?lat=${lat}&lon=${lon}`), // 
            fetchData(`${API_GATEWAY_BASE_URL}/weather-forecast?lat=${lat}&lon=${lon}`) // 
        ]); // 
        if (currentWeatherData) { // 
            weatherTodayP.innerHTML = ` 
                <strong>${locationName || currentWeatherData.cityName || '알 수 없는 지역'}</strong><br> // 
                 상태: ${currentWeatherData.description || '정보 없음'} <img src="http://openweathermap.org/img/wn/${currentWeatherData.icon || '01d'}.png" alt="날씨 아이콘" style="vertical-align: middle;"><br> // 
                온도: ${currentWeatherData.temperature !== undefined ? currentWeatherData.temperature + '°C' : '정보 없음'} (체감: ${currentWeatherData.feels_like !== undefined ? currentWeatherData.feels_like + '°C' : '정보 없음'})<br> // 
                습도: ${currentWeatherData.humidity !== undefined ? currentWeatherData.humidity + '%' : '정보 없음'} // 
            `; // 
        } else if (weatherTodayP) { // 
            weatherTodayP.textContent = '현재 날씨 정보를 가져올 수 없습니다. (로그인 또는 API 키 확인 필요)'; // 
        } // 

        if (forecastData && forecastData.forecast) { // 
            let forecastHtml = `<strong>${locationName || forecastData.cityName || '알 수 없는 지역'} 예보</strong><br>`; // 
            if (forecastData.forecast.length > 0) { // 
                forecastData.forecast.forEach(day => { // 
                    forecastHtml += ` // 
                        <div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #efefef;"> // 
                            <strong>${day.date}</strong>: ${day.description || '정보 없음'} <img src="http://openweathermap.org/img/wn/${day.icon || '01d'}.png" alt="날씨 아이콘" style="vertical-align: middle;"><br> // 
                            최저 ${day.temp_min}°C / 최고 ${day.temp_max}°C // 
                        </div>`; // 
                }); // 
            } else { // 
                forecastHtml += '예보 정보가 없습니다.'; [cite: 124]
            } // 
            weatherForecastP.innerHTML = forecastHtml; [cite: 125]
        } else if (weatherForecastP) { // 
            weatherForecastP.textContent = '주간 예보 정보를 가져올 수 없습니다. (로그인 또는 API 키 확인 필요)'; // 
        } // 
    } catch (error) { // 
        console.error('날씨 정보 표시 중 오류:', error.message); [cite: 127]
        if (weatherTodayP) weatherTodayP.textContent = '날씨 정보를 불러오는 데 실패했습니다.'; [cite: 127]
        if (weatherForecastP) weatherForecastP.textContent = '예보 정보를 불러오는 데 실패했습니다.'; [cite: 128]
    } // 
} // 

async function updateAddressAndWeather(lat, lng, predefinedAddress = null) {
    let addressToDisplay = predefinedAddress; [cite: 129]
    if (currentAddressTextSpan) { [cite: 129]
        currentAddressTextSpan.textContent = predefinedAddress || '주소 변환 중...'; [cite: 130]
    } // 
    
    if (!predefinedAddress && typeof google !== 'undefined' && google.maps && google.maps.Geocoder && geocoder) { // 
        geocoder.geocode({ 'location': { lat, lng } }, (results, status) => { // 
            if (status === 'OK' && results && results[0]) { // 
                addressToDisplay = results[0].formatted_address; // 
            } else { // 
                addressToDisplay = `위도: ${lat.toFixed(4)}, 경도: ${lng.toFixed(4)}`; // 
                console.warn('Geocoder 실패:', status); // 
            } // 
            if (currentAddressTextSpan) currentAddressTextSpan.textContent = addressToDisplay; // 
            currentMapSelection = { name: addressToDisplay, lat: lat, lng: lng }; // 
            if (currentUser && addToFavoritesBtn) addToFavoritesBtn.classList.remove('hidden'); // 
            
            fetchAndDisplayWeather(lat, lng, addressToDisplay); // 
        }); // 
    } else { // 
        if (!predefinedAddress && currentAddressTextSpan) { // 
            addressToDisplay = `위도: ${lat.toFixed(4)}, 경도: ${lng.toFixed(4)}`; [cite: 134]
        } // 
        if (currentAddressTextSpan) currentAddressTextSpan.textContent = addressToDisplay || `위도: ${lat.toFixed(4)}, 경도: ${lng.toFixed(4)}`; [cite: 135]
        currentMapSelection = { name: addressToDisplay || `위도: ${lat.toFixed(4)}, 경도: ${lng.toFixed(4)}`, lat: lat, lng: lng }; [cite: 135]
        
        if (currentUser && addToFavoritesBtn) addToFavoritesBtn.classList.remove('hidden'); [cite: 136]
        else if (addToFavoritesBtn) addToFavoritesBtn.classList.add('hidden'); [cite: 136]
        
        fetchAndDisplayWeather(lat, lng, addressToDisplay); [cite: 137]
        if (typeof google === 'undefined' || !geocoder) console.warn("Google Maps Geocoder가 준비되지 않았습니다."); [cite: 137]
    } // 
} // 

async function handleAddFavoriteClick() {
    if (!currentUser) return; [cite: 138]
    if (!currentMapSelection || !currentMapSelection.name || currentMapSelection.name.includes("변환 중") || currentMapSelection.name.includes("실패")) { // 
        alert("먼저 지도에서 유효한 위치를 선택하여 주소를 확인해주세요."); [cite: 139]
        return; // 
    } // 
    try { // 
        const newFavoriteData = { // 
            location_name: currentMapSelection.name, // 
            latitude: currentMapSelection.lat, // 
            longitude: currentMapSelection.lng // 
        }; // 
        // ⭐⭐ 수정된 부분: API_GATEWAY_BASE_URL 사용 ⭐⭐ 
        const result = await fetchData(`${API_GATEWAY_BASE_URL}/favorites`, { // 
            method: 'POST', // 
            headers: { 'Content-Type': 'application/json' }, // 
            body: JSON.stringify(newFavoriteData) // 
        }); // 
        alert(result.message || "즐겨찾기에 추가되었습니다!"); [cite: 141]
        loadAndDisplayFavorites(); // 
        if (addToFavoritesBtn) addToFavoritesBtn.classList.add('hidden'); // 
    } catch (error) { // 
        alert(`즐겨찾기 추가 실패: ${error.message}`); [cite: 142]
        console.error("즐겨찾기 추가 API 호출 실패:", error); [cite: 142]
    } // 
} // 

// Google 지도 초기화 (HTML의 API 스크립트 로드 후 &callback=initDashboardMap 으로 호출됨)
function initDashboardMap() {
    console.log("Google 지도 초기화 (initDashboardMap) 시작"); [cite: 36, 143]
    const initialLat = 37.5665; // 
    const initialLng = 126.9780; // 
    const initialLocation = { lat: initialLat, lng: initialLng }; [cite: 37, 144]
    
    const mapElement = document.getElementById('map-container'); [cite: 37, 144]
    if (!mapElement) { // 
        console.error("#map-container 요소를 찾을 수 없습니다."); [cite: 38, 145]
        if (weatherTodayP) weatherTodayP.textContent = '지도 컨테이너를 찾을 수 없어 날씨 정보를 표시할 수 없습니다.'; [cite: 39, 146]
        if (weatherForecastP) weatherForecastP.textContent = '지도 컨테이너를 찾을 수 없어 예보 정보를 표시할 수 없습니다.'; [cite: 39, 146]
        return; [cite: 40, 147]
    } // 
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') { // 
        console.error("Google Maps API가 로드되지 않았습니다."); [cite: 41, 148]
        mapElement.innerHTML = "<p>지도 API 로드 실패. 인터넷 연결 및 API 키를 확인하세요.</p>"; [cite: 41, 148]
        return; [cite: 42, 149]
    } // 

    try {
        map = new google.maps.Map(mapElement, { // 
            zoom: 12, // 
            center: initialLocation // 
        }); // 
        geocoder = new google.maps.Geocoder(); // 
        currentMarker = new google.maps.Marker({ map: null }); // 
        
        map.addListener('click', (mapsMouseEvent) => { // 
            const clickedLat = mapsMouseEvent.latLng.lat(); // 
            const clickedLng = mapsMouseEvent.latLng.lng(); // 
            if (currentMarker) { // 
                currentMarker.setPosition(mapsMouseEvent.latLng); // 
                currentMarker.setMap(map); // 
            } // 
            updateAddressAndWeather(clickedLat, clickedLng); // 
        }); // 
        
        // ⭐⭐ currentUser 확인 후 초기 주소 및 날씨 정보 로딩 ⭐⭐  (최근꺼)
        if (localStorage.getItem('token')) { // 토큰이 있다면 로그인된 것으로 간주  (최근꺼)
            updateAddressAndWeather(initialLat, initialLng, "서울특별시 (기본 위치)"); [cite: 47, 154]
        } else { // 
            if (currentAddressTextSpan) currentAddressTextSpan.textContent = '지도를 클릭하여 위치를 선택해주세요.'; [cite: 48, 155]
            if (weatherTodayP) weatherTodayP.textContent = '날씨 정보를 보려면 로그인 후 지도를 클릭하세요.'; [cite: 49, 156]
            if (weatherForecastP) weatherForecastP.textContent = '예보 정보를 보려면 로그인 후 지도를 클릭하세요.'; [cite: 50, 157]
        } // 

    } catch (e) {
        console.error("Google 지도 초기화 중 오류:", e); [cite: 51, 158]
        if (mapElement) mapElement.innerHTML = "<p>지도 초기화 중 오류가 발생했습니다.</p>"; [cite: 51, 158]
    } // 
} // 

// initDashboardMap을 전역 스코프에 노출시켜 Google Maps API 콜백이 찾을 수 있도록 함 
window.initDashboardMap = initDashboardMap; [cite: 52, 159]

// 페이지 로드 시 실행될 메인 로직 
document.addEventListener('DOMContentLoaded', async () => { // 
    console.log('Dashboard DOMContentLoaded. 사용자 정보 로드 시도...'); // 
    
    await loadCurrentUserInfo(); // 

    if (currentUser) { // 
        console.log('사용자 인증됨. 즐겨찾기 로드.'); // 
        loadAndDisplayFavorites(); // 
    } else { // 
        console.log('사용자 인증 안됨. UI가 로그아웃 상태로 업데이트됩니다.'); // 
    } // 

    if (addToFavoritesBtn) { // 
        addToFavoritesBtn.addEventListener('click', handleAddFavoriteClick); // 
        // ⭐⭐ 토큰 유무로 즐겨찾기 버튼 표시 여부 초기화 ⭐⭐  (최근꺼)
        if(!localStorage.getItem('token') || !currentMapSelection) { //  (최근꺼)
             addToFavoritesBtn.classList.add('hidden'); //  (최근꺼)
        } //  (최근꺼)
    } else { // 
        console.warn("ID 'addToFavoritesBtn' 요소를 찾을 수 없습니다."); // 
    } // 

    // ⭐⭐ 로그아웃 링크 이벤트 리스너 추가 ⭐⭐  (최근꺼)
    if (logoutLink) { //  (최근꺼)
        logoutLink.addEventListener('click', (e) => { //  (최근꺼)
            e.preventDefault(); //  (최근꺼)
            handleLogout(); //  (최근꺼)
        }); //  (최근꺼)
    } //  (최근꺼)
}); //

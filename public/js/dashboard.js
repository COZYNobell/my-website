// public/js/dashboard.js

// ⭐⭐⭐ 중요한 수정 사항: API Gateway의 호출 URL을 여기에 입력하세요 ⭐⭐⭐
// 'https://7bsjoaagma.execute-api.ap-northeast-2.amazonaws.com/test2/api' 이 부분을
// 여러분의 실제 API Gateway 호출 URL (스테이지 이름까지 포함)에 '/api'를 붙여서 사용합니다.
const API_GATEWAY_BASE_URL = "https://7bsjoaagma.execute-api.ap-northeast-2.amazonaws.com/test2/api"; 


// --- DOM 요소 가져오기 ---
const userEmailSpan = document.getElementById('userEmail'); // 헤더의 사용자 이메일 표시용 (strong 태그 안)
const userInfoSpanElement = document.getElementById('userInfoSpan'); // 헤더의 "안녕하세요, ...님!" 전체 span

const favoritesSectionDiv = document.getElementById('favorites-section'); 
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

const loginLink = document.getElementById('loginLink');          // 헤더 로그인 링크
const signupLink = document.getElementById('signupLink');        // 헤더 회원가입 링크
const logoutLink = document.getElementById('logoutLink');        // 헤더 로그아웃 링크

// --- 전역(모듈 스코프) 변수 ---
let map; // Google 지도 객체
let geocoder; // Google Geocoder 객체
let currentMarker; // 현재 지도에 표시된 마커
let currentUser = null;          // 현재 로그인된 사용자 정보 {id, email}
let currentMapSelection = null;   // 현재 지도에서 선택/표시된 위치 정보 {name, lat, lng}

// --- API 호출 공통 헬퍼 함수 ---
async function fetchData(apiUrl, options = {}) {
    try {
        const response = await fetch(apiUrl, options);

        if (response.status === 401) { // 서버가 401 Unauthorized 응답
            const data = await response.json().catch(() => ({ 
                message: '로그인이 필요합니다. 로그인 페이지로 이동합니다.', 
                redirectTo: '/login' // 기본값
            }));
            console.warn('fetchData 401:', data.message);
            if (data.redirectTo) {
                window.location.href = data.redirectTo;
            } else {
                window.location.href = '/login'; // 안전장치로 기본 로그인 페이지 이동
            }
            throw new Error(data.message || '로그인이 필요합니다.'); 
        }

        if (!response.ok) { // 401 외의 다른 HTTP 오류
            let errorData = { message: `서버 응답 오류: ${response.status}` };
            try {
                errorData = await response.json();
            } catch (e) {
                console.warn('오류 응답 JSON 파싱 실패, 기본 메시지 사용. 응답 상태:', response.status, response.statusText);
            }
            console.error('API 응답 오류:', errorData);
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return await response.json(); // 성공 시 JSON 데이터 반환
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
        noFavoritesP.innerHTML = '로그인하시면 즐겨찾기 목록을 볼 수 있습니다. <a href="/login">로그인</a>';
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

// --- 핵심 기능 함수들 ---
async function loadCurrentUserInfo() {
    try {
        // ⭐⭐ 수정된 부분: API_GATEWAY_BASE_URL 사용 ⭐⭐
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
        updateUIForLoggedOutState(); 
        return null;
    }
}

async function loadAndDisplayFavorites() {
    if (!currentUser) { 
        updateUIForLoggedOutState(); 
        return;
    }
    if (!favoritesListUl || !noFavoritesP || !loadingFavoritesP || !favoritesSectionDiv) {
        console.warn("loadAndDisplayFavorites: 즐겨찾기 관련 DOM 요소 중 일부를 찾을 수 없습니다.");
        return;
    }

    favoritesSectionDiv.classList.remove('hidden'); 
    loadingFavoritesP.classList.remove('hidden');
    favoritesListUl.innerHTML = '';
    noFavoritesP.classList.add('hidden');

    try {
        // ⭐⭐ 수정된 부분: API_GATEWAY_BASE_URL 사용 ⭐⭐
        const favorites = await fetchData(`${API_GATEWAY_BASE_URL}/favorites`);
        if (favorites && favorites.length > 0) {
            favorites.forEach(fav => {
                const li = document.createElement('li');
                li.className = 'favorite-item';
                
                const nameSpan = document.createElement('span');
                nameSpan.textContent = fav.location_name;
                nameSpan.title = `클릭하여 지도 이동: ${fav.location_name} (위도: ${fav.latitude}, 경도: ${fav.longitude})`;
                nameSpan.style.cursor = 'pointer';
                nameSpan.onclick = () => {
                    if (typeof google !== 'undefined' && map ) { 
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
                    } else { console.error("지도 객체가 준비되지 않았습니다."); }
                };
                
                const deleteButton = document.createElement('button');
                deleteButton.textContent = '삭제';
                deleteButton.dataset.id = fav.id; 
                deleteButton.dataset.name = fav.location_name; 

                deleteButton.addEventListener('click', async function() { 
                    if (confirm(`'${this.dataset.name}' 즐겨찾기를 삭제하시겠습니까?`)) {
                        try {
                            // ⭐⭐ 수정된 부분: API_GATEWAY_BASE_URL 사용 ⭐⭐
                            await fetchData(`${API_GATEWAY_BASE_URL}/favorites/${this.dataset.id}`, { method: 'DELETE' });
                            alert('즐겨찾기에서 삭제되었습니다.');
                            loadAndDisplayFavorites(); 
                        } catch (deleteError) {
                            alert(`삭제 실패: ${deleteError.message}`);
                            console.error("즐겨찾기 삭제 API 호출 실패:", deleteError);
                        }
                    }
                });
                li.appendChild(nameSpan);
                li.appendChild(deleteButton);
                favoritesListUl.appendChild(li);
            });
        } else {
            noFavoritesP.textContent = '등록된 즐겨찾기가 없습니다.';
            noFavoritesP.classList.remove('hidden');
        }
    } catch (error) {
        console.error('즐겨찾기 목록 로드 중 오류:', error.message);
        if (favoritesListUl) favoritesListUl.innerHTML = '<li>즐겨찾기를 불러오는 데 실패했습니다. 관리자에게 문의하세요.</li>';
    } finally {
        if (loadingFavoritesP) loadingFavoritesP.classList.add('hidden');
    }
}

async function fetchAndDisplayWeather(lat, lon, locationName = null) {
    if (!weatherTodayP || !weatherForecastP) {
           console.warn("fetchAndDisplayWeather: 날씨 정보 표시 DOM 요소가 없습니다.");
           return;
    }
    weatherTodayP.innerHTML = '오늘 날씨 정보를 가져오는 중...';
    weatherForecastP.innerHTML = '주간 예보 정보를 가져오는 중...';

    try {
        const [currentWeatherData, forecastData] = await Promise.all([
            // ⭐⭐ 수정된 부분: API_GATEWAY_BASE_URL 사용 ⭐⭐
            fetchData(`${API_GATEWAY_BASE_URL}/weather-by-coords?lat=${lat}&lon=${lon}`),
            fetchData(`${API_GATEWAY_BASE_URL}/weather-forecast?lat=${lat}&lon=${lon}`)
        ]);

        if (currentWeatherData) {
            weatherTodayP.innerHTML = `
                <strong>${locationName || currentWeatherData.cityName || '알 수 없는 지역'}</strong><br>
                상태: ${currentWeatherData.description || '정보 없음'} <img src="http://openweathermap.org/img/wn/${currentWeatherData.icon || '01d'}.png" alt="날씨 아이콘" style="vertical-align: middle;"><br>
                온도: ${currentWeatherData.temperature !== undefined ? currentWeatherData.temperature + '°C' : '정보 없음'} (체감: ${currentWeatherData.feels_like !== undefined ? currentWeatherData.feels_like + '°C' : '정보 없음'})<br>
                습도: ${currentWeatherData.humidity !== undefined ? currentWeatherData.humidity + '%' : '정보 없음'}
            `;
        } else if (weatherTodayP) { 
            weatherTodayP.textContent = '현재 날씨 정보를 가져올 수 없습니다. (로그인 또는 API 키 확인 필요)';
        }

        if (forecastData && forecastData.forecast) {
            let forecastHtml = `<strong>${locationName || forecastData.cityName || '알 수 없는 지역'} 예보</strong><br>`;
            if (forecastData.forecast.length > 0) {
                forecastData.forecast.forEach(day => {
                    forecastHtml += `
                        <div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #efefef;">
                            <strong>${day.date}</strong>: ${day.description || '정보 없음'} <img src="http://openweathermap.org/img/wn/${day.icon || '01d'}.png" alt="날씨 아이콘" style="vertical-align: middle;"><br>
                            최저 ${day.temp_min}°C / 최고 ${day.temp_max}°C
                        </div>`;
                });
            } else {
                forecastHtml += '예보 정보가 없습니다.';
            }
            weatherForecastP.innerHTML = forecastHtml;
        } else if (weatherForecastP) {
            weatherForecastP.textContent = '주간 예보 정보를 가져올 수 없습니다. (로그인 또는 API 키 확인 필요)';
        }
    } catch (error) {
        console.error('날씨 정보 표시 중 오류:', error.message);
        if (weatherTodayP) weatherTodayP.textContent = '날씨 정보를 불러오는 데 실패했습니다.';
        if (weatherForecastP) weatherForecastP.textContent = '예보 정보를 불러오는 데 실패했습니다.';
    }
}

async function updateAddressAndWeather(lat, lng, predefinedAddress = null) {
    let addressToDisplay = predefinedAddress;
    if (currentAddressTextSpan) {
        currentAddressTextSpan.textContent = predefinedAddress || '주소 변환 중...';
    }
    
    if (!predefinedAddress && typeof google !== 'undefined' && google.maps && google.maps.Geocoder && geocoder) {
        geocoder.geocode({ 'location': { lat, lng } }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
                addressToDisplay = results[0].formatted_address;
            } else {
                addressToDisplay = `위도: ${lat.toFixed(4)}, 경도: ${lng.toFixed(4)}`;
                console.warn('Geocoder 실패:', status);
            }
            if (currentAddressTextSpan) currentAddressTextSpan.textContent = addressToDisplay;
            currentMapSelection = { name: addressToDisplay, lat: lat, lng: lng };
            if (currentUser && addToFavoritesBtn) addToFavoritesBtn.classList.remove('hidden');
            
            fetchAndDisplayWeather(lat, lng, addressToDisplay);
        });
    } else { 
        if (!predefinedAddress && currentAddressTextSpan) {
            addressToDisplay = `위도: ${lat.toFixed(4)}, 경도: ${lng.toFixed(4)}`;
        }
        if (currentAddressTextSpan) currentAddressTextSpan.textContent = addressToDisplay || `위도: ${lat.toFixed(4)}, 경도: ${lng.toFixed(4)}`;
        
        currentMapSelection = { name: addressToDisplay || `위도: ${lat.toFixed(4)}, 경도: ${lng.toFixed(4)}`, lat: lat, lng: lng };
        
        if (currentUser && addToFavoritesBtn) addToFavoritesBtn.classList.remove('hidden');
        else if (addToFavoritesBtn) addToFavoritesBtn.classList.add('hidden');
        
        fetchAndDisplayWeather(lat, lng, addressToDisplay);
        if (typeof google === 'undefined' || !geocoder) console.warn("Google Maps Geocoder가 준비되지 않았습니다.");
    }
}

async function handleAddFavoriteClick() {
    if (!currentUser) return; 
    if (!currentMapSelection || !currentMapSelection.name || currentMapSelection.name.includes("변환 중") || currentMapSelection.name.includes("실패")) {
        alert("먼저 지도에서 유효한 위치를 선택하여 주소를 확인해주세요.");
        return;
    }
    try {
        const newFavoriteData = {
            location_name: currentMapSelection.name,
            latitude: currentMapSelection.lat,
            longitude: currentMapSelection.lng
        };
        // ⭐⭐ 수정된 부분: API_GATEWAY_BASE_URL 사용 ⭐⭐
        const result = await fetchData(`${API_GATEWAY_BASE_URL}/favorites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newFavoriteData)
        });
        alert(result.message || "즐겨찾기에 추가되었습니다!");
        loadAndDisplayFavorites(); 
        if (addToFavoritesBtn) addToFavoritesBtn.classList.add('hidden');
    } catch (error) {
        alert(`즐겨찾기 추가 실패: ${error.message}`);
        console.error("즐겨찾기 추가 API 호출 실패:", error);
    }
}

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
        
        if (currentUser) {
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
// initDashboardMap을 전역 스코프에 노출시켜 Google Maps API 콜백이 찾을 수 있도록 함
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
        if(!currentUser || !currentMapSelection) { 
             addToFavoritesBtn.classList.add('hidden');
        }
    } else {
        console.warn("ID 'addToFavoritesBtn' 요소를 찾을 수 없습니다.");
    }
});

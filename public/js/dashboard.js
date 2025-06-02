// public/js/dashboard.js

// --- DOM 요소들 ---
const userEmailSpan = document.getElementById('userEmail'); // 헤더의 사용자 이메일 표시용 (strong 태그 안)
const userInfoSpanElement = document.getElementById('userInfoSpan'); // 헤더의 "안녕하세요, ...님!" 전체 span

const favoritesSectionDiv = document.getElementById('favorites-section'); // 즐겨찾기 목록 전체 섹션
const favoritesListUl = document.getElementById('favorites-list'); // 즐겨찾기 <ul>
const noFavoritesP = document.getElementById('noFavorites');         // "즐겨찾기 없음" 메시지
const loadingFavoritesP = document.getElementById('loadingFavorites'); // "로딩 중" 메시지

const weatherTodayP = document.querySelector('#weather-today p');       // 오늘 날씨 정보 p 태그
const weatherForecastP = document.querySelector('#weather-forecast p'); // 주간 예보 정보 p 태그

const currentAddressTextSpan = document.getElementById('currentAddressText'); // 주소 텍스트만 표시할 span (dashboard.html에 추가 필요)
const addToFavoritesBtn = document.getElementById('addToFavoritesBtn');       // 즐겨찾기 추가(별표) 버튼 (dashboard.html에 추가 필요)

const loginLink = document.getElementById('loginLink');         // 헤더 로그인 링크
const signupLink = document.getElementById('signupLink');       // 헤더 회원가입 링크
const logoutLink = document.getElementById('logoutLink');       // 헤더 로그아웃 링크

// --- 전역(모듈 스코프) 변수 ---
let map;
let geocoder;
let currentMarker;
let currentUser = null;           // 현재 로그인된 사용자 정보 {id, email}
let currentMapSelection = null;   // 현재 지도에서 선택/표시된 위치 정보 {name, lat, lng}

// --- API 호출 공통 헬퍼 함수 ---
async function fetchData(apiUrl, options = {}) {
    try {
        const response = await fetch(apiUrl, options);

        if (response.status === 401) { // 서버가 401 Unauthorized 응답
            const data = await response.json().catch(() => ({ 
                message: '로그인이 필요합니다. 로그인 페이지로 이동합니다.', 
                redirectTo: '/login' 
            }));
            console.warn('fetchData 401:', data.message, 'Redirecting to:', data.redirectTo);
            window.location.href = data.redirectTo || '/login'; // 로그인 페이지로 리디렉션
            throw new Error(data.message || '로그인이 필요합니다.'); // 함수 실행 중단
        }

        if (!response.ok) { // 401 외의 다른 HTTP 오류
            const errorData = await response.json().catch(() => ({ message: `서버 응답 오류: ${response.status}` }));
            console.error('API 응답 오류:', errorData);
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return await response.json(); // 성공 시 JSON 데이터 반환
    } catch (error) {
        console.error(`API 호출 (${apiUrl}) 실패:`, error.message);
        // 이 함수를 호출한 쪽에서 오류를 인지하고 UI 업데이트 등을 하도록 오류를 다시 throw
        throw error; 
    }
}

// --- UI 업데이트 함수 ---
function updateUIForLoggedInState() {
    if (userInfoSpanElement) userInfoSpanElement.classList.remove('hidden');
    if (userEmailSpan && currentUser) userEmailSpan.textContent = currentUser.email;
    
    if (favoritesSectionDiv) favoritesSectionDiv.classList.remove('hidden');
    
    if (loginLink) loginLink.classList.add('hidden');
    if (signupLink) signupLink.classList.add('hidden');
    if (logoutLink) logoutLink.classList.remove('hidden');

    // 즐겨찾기 추가 버튼은 지도에서 위치가 선택되었을 때만 표시 (updateAddressAndWeather에서 처리)
    if (addToFavoritesBtn && currentMapSelection) {
        addToFavoritesBtn.classList.remove('hidden');
    } else if (addToFavoritesBtn) {
        addToFavoritesBtn.classList.add('hidden');
    }
}

function updateUIForLoggedOutState() {
    currentUser = null;
    if (userInfoSpanElement) userInfoSpanElement.classList.add('hidden');
    if (userEmailSpan) userEmailSpan.textContent = '';

    if (favoritesSectionDiv) favoritesSectionDiv.classList.add('hidden');
    if (favoritesListUl) favoritesListUl.innerHTML = ''; // 목록 비우기
    if (noFavoritesP) {
         noFavoritesP.innerHTML = '로그인하시면 즐겨찾기 목록을 볼 수 있습니다. <a href="/login">로그인</a>';
         noFavoritesP.classList.remove('hidden'); // 로그인 필요 메시지는 보여줌
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
        const data = await fetchData('/api/current-user');
        if (data && data.loggedIn) {
            updateUIForLoggedInState(data.user);
            return data.user; // currentUser는 updateUIForLoggedInState에서 이미 설정됨
        } else {
            updateUIForLoggedOutState(); // 명시적으로 로그아웃 상태 UI 호출
            return null;
        }
    } catch (error) {
        console.error('현재 사용자 정보 로드 실패 (대시보드):', error.message);
        updateUIForLoggedOutState(); // 오류 발생 시 로그아웃 상태 UI
        return null;
    }
}

async function loadAndDisplayFavorites() {
    if (!currentUser) { // 로그인 안 했으면 함수 실행 안 함
        updateUIForLoggedOutState(); // 혹시 모르니 UI 상태 확인
        return;
    }
    if (!favoritesListUl || !noFavoritesP || !loadingFavoritesP) return;

    favoritesSectionDiv.classList.remove('hidden'); // 로그인 했으니 섹션 보이기
    loadingFavoritesP.classList.remove('hidden');
    favoritesListUl.innerHTML = '';
    noFavoritesP.classList.add('hidden');

    try {
        const favorites = await fetchData('/api/favorites');
        if (favorites && favorites.length > 0) {
            favorites.forEach(fav => {
                const li = document.createElement('li');
                li.className = 'favorite-item';
                
                const nameSpan = document.createElement('span');
                nameSpan.textContent = fav.location_name;
                nameSpan.title = `클릭하여 지도 이동: ${fav.location_name} (위도: ${fav.latitude}, 경도: ${fav.longitude})`;
                nameSpan.style.cursor = 'pointer';
                nameSpan.onclick = () => {
                    if (typeof google !== 'undefined' && map) { 
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
                deleteButton.dataset.id = fav.id; // 삭제 시 사용할 ID
                deleteButton.dataset.name = fav.location_name; // 확인 메시지용 이름

                deleteButton.addEventListener('click', async function() { // 일반 함수로 변경하여 this 사용 방지
                    if (confirm(`'${this.dataset.name}' 즐겨찾기를 삭제하시겠습니까?`)) {
                        try {
                            await fetchData(`/api/favorites/${this.dataset.id}`, { method: 'DELETE' });
                            alert('즐겨찾기에서 삭제되었습니다.');
                            loadAndDisplayFavorites(); 
                        } catch (deleteError) {
                            alert(`삭제 실패: ${deleteError.message}`);
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
        // fetchData 내부에서 401 시 리디렉션됨. 여기는 다른 종류의 오류 (예: 500)
        if (favoritesListUl) favoritesListUl.innerHTML = '<li>즐겨찾기를 불러오는 데 실패했습니다. 관리자에게 문의하세요.</li>';
    } finally {
        if (loadingFavoritesP) loadingFavoritesP.classList.add('hidden');
    }
}

async function fetchAndDisplayWeather(lat, lon, locationName = null) {
    if (!weatherTodayP || !weatherForecastP) return;
    weatherTodayP.innerHTML = '오늘 날씨 정보 로딩 중...';
    weatherForecastP.innerHTML = '주간 예보 정보 로딩 중...';

    try {
        const [currentWeatherData, forecastData] = await Promise.all([
            fetchData(`/api/weather-by-coords?lat=${lat}&lon=${lon}`),
            fetchData(`/api/weather-forecast?lat=${lat}&lon=${lon}`)
        ]);

        if (currentWeatherData) {
            weatherTodayP.innerHTML = `
                <strong>${locationName || currentWeatherData.cityName || '알 수 없는 지역'}</strong><br>
                상태: ${currentWeatherData.description || '정보 없음'} <img src="http://openweathermap.org/img/wn/${currentWeatherData.icon || '01d'}.png" alt="날씨 아이콘" style="vertical-align: middle;"><br>
                온도: ${currentWeatherData.temperature !== undefined ? currentWeatherData.temperature + '°C' : '정보 없음'} (체감: ${currentWeatherData.feels_like !== undefined ? currentWeatherData.feels_like + '°C' : '정보 없음'})<br>
                습도: ${currentWeatherData.humidity !== undefined ? currentWeatherData.humidity + '%' : '정보 없음'}
            `;
        } else {
            weatherTodayP.textContent = '현재 날씨 정보를 가져올 수 없습니다.';
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
        } else {
            weatherForecastP.textContent = '주간 예보 정보를 가져올 수 없습니다.';
        }
    } catch (error) {
        console.error('날씨 정보 표시 중 오류:', error.message);
        // fetchData 내부에서 401은 리디렉션 처리됨. 여기서는 다른 오류.
        if (weatherTodayP) weatherTodayP.textContent = '날씨 정보를 불러오는 데 실패했습니다.';
        if (weatherForecastP) weatherForecastP.textContent = '예보 정보를 불러오는 데 실패했습니다.';
    }
}

async function updateAddressAndWeather(lat, lng, predefinedAddress = null) {
    let addressToDisplay = predefinedAddress;
    if (currentAddressTextSpan) currentAddressTextSpan.textContent = predefinedAddress || '주소 변환 중...';
    
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
        if (currentAddressTextSpan) currentAddressTextSpan.textContent = addressToDisplay; // predefinedAddress 또는 위도/경도 표시
        currentMapSelection = { name: addressToDisplay, lat: lat, lng: lng };
        if (currentUser && addToFavoritesBtn) addToFavoritesBtn.classList.remove('hidden');
        
        fetchAndDisplayWeather(lat, lng, addressToDisplay);
        if (typeof google === 'undefined' || !geocoder) console.warn("Google Maps Geocoder가 준비되지 않았습니다.");
    }
}

async function handleAddFavoriteClick() {
    if (!currentUser) return; // 이미 fetchData에서 401 시 리디렉션 처리됨
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
        const result = await fetchData('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newFavoriteData)
        });
        alert(result.message || "즐겨찾기에 추가되었습니다!");
        loadAndDisplayFavorites(); 
        if (addToFavoritesBtn) addToFavoritesBtn.classList.add('hidden');
    } catch (error) {
        // fetchData에서 401은 이미 처리. 여기서는 그 외 오류.
        alert(`즐겨찾기 추가 실패: ${error.message}`);
        console.error("즐겨찾기 추가 API 호출 실패:", error);
    }
}

// Google 지도 초기화 (HTML의 API 스크립트 로드 후 &callback=initDashboardMap 으로 호출됨)
function initDashboardMap() {
    console.log("Google 지도 초기화 (initDashboardMap) 시작");
    const initialLat = 37.5665; // 서울 시청
    const initialLng = 126.9780;
    
    const mapElement = document.getElementById('map-container');
    if (!mapElement) {
        console.error("#map-container 요소를 찾을 수 없습니다.");
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
            center: { lat: initialLat, lng: initialLng }
        });
        geocoder = new google.maps.Geocoder();
        currentMarker = new google.maps.Marker({ map: null }); // 처음에는 마커 숨김

        map.addListener('click', (mapsMouseEvent) => {
            const clickedLat = mapsMouseEvent.latLng.lat();
            const clickedLng = mapsMouseEvent.latLng.lng();
            if (currentMarker) {
                currentMarker.setPosition(mapsMouseEvent.latLng);
                currentMarker.setMap(map); 
            }
            updateAddressAndWeather(clickedLat, clickedLng);
        });
        
        // currentUser가 이미 로드되었다면 (페이지가 매우 빨리 로드된 경우) 기본 날씨 표시
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
window.initDashboardMap = initDashboardMap; // 전역 스코프에 노출

// 페이지 로드 시 실행될 메인 로직
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard DOMContentLoaded. 사용자 정보 로드 시도...');
    await loadCurrentUserInfo(); // 전역 currentUser가 여기서 설정됨

    if (currentUser) {
        console.log('사용자 인증됨. 즐겨찾기 로드.');
        loadAndDisplayFavorites();
        // 기본 날씨는 initDashboardMap에서 currentUser 상태를 보고, 
        // 또는 사용자가 지도를 클릭하거나 즐겨찾기를 선택할 때 로드.
        // initDashboardMap이 Google API 콜백으로 나중에 호출될 수 있으므로,
        // currentUser가 설정된 후 initDashboardMap이 실행될 때 기본 날씨를 표시하는 것이 좋음.
        // 만약 initDashboardMap이 이미 호출되었다면 여기서 다시 기본 날씨 로드 호출 가능
        if (map && geocoder) { // 지도가 이미 초기화 되었다면
             updateAddressAndWeather(37.5665, 126.9780, "서울특별시 (기본 위치)");
        }
    } else {
        console.log('사용자 인증 안됨. UI가 로그아웃 상태로 업데이트됩니다.');
        // updateUIForLoggedOutState는 loadCurrentUserInfo의 catch 블록 또는
        // fetchData의 401 처리에서 이미 호출되었을 수 있습니다.
    }

    if (addToFavoritesBtn) {
        addToFavoritesBtn.addEventListener('click', handleAddFavoriteClick);
        // 초기 버튼 상태는 updateUIForLoggedInState/updateUIForLoggedOutState 및
        // updateAddressAndWeather에서 관리
        if(!currentUser || !currentMapSelection) { // 로그인 안했거나, 지도 선택 전이면 숨김
             addToFavoritesBtn.classList.add('hidden');
        }
    } else {
        console.warn("ID 'addToFavoritesBtn' 요소를 찾을 수 없습니다.");
    }
});

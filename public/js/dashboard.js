// public/js/dashboard.js

// --- DOM 요소 가져오기 ---
const userEmailSpan = document.getElementById('userEmail'); // 헤더의 사용자 이메일 표시용 (strong 태그 안)
const userInfoSpanElement = document.getElementById('userInfoSpan'); // 헤더의 "안녕하세요, ...님!" 전체 span

const favoritesSectionDiv = document.getElementById('favorites-section'); 
const favoritesListUl = document.getElementById('favorites-list'); // 즐겨찾기 <ul>
const noFavoritesP = document.getElementById('noFavorites');         // "즐겨찾기 없음" 메시지
const loadingFavoritesP = document.getElementById('loadingFavorites'); // "로딩 중" 메시지

const weatherTodaySection = document.getElementById('weather-today'); // 오늘 날씨 섹션
const weatherForecastSection = document.getElementById('weather-forecast'); // 주간 예보 섹션
const weatherTodayP = weatherTodaySection ? weatherTodaySection.querySelector('p') : null; // 오늘 날씨 정보 p 태그
const weatherForecastP = weatherForecastSection ? weatherForecastSection.querySelector('p') : null; // 주간 예보 정보 p 태그

const addressDisplayDiv = document.getElementById('address-display'); // 주소와 즐겨찾기 버튼을 감싸는 div
const currentAddressTextSpan = document.getElementById('currentAddressText'); // 주소 텍스트만 표시할 span
const addToFavoritesBtn = document.getElementById('addToFavoritesBtn');       // 즐겨찾기 추가(별표) 버튼

const loginLink = document.getElementById('loginLink');         // 헤더 로그인 링크
const signupLink = document.getElementById('signupLink');       // 헤더 회원가입 링크
const logoutLink = document.getElementById('logoutLink');       // 헤더 로그아웃 링크

// --- 전역(모듈 스코프) 변수 ---
let map; // Google 지도 객체
let geocoder; // Google Geocoder 객체
let currentMarker; // 현재 지도에 표시된 마커
let currentUser = null;           // 현재 로그인된 사용자 정보 {id, email}
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
            // 사용자에게 알림 후 페이지 이동 (선택 사항)
            // alert(data.message); 
            if (data.redirectTo) {
                window.location.href = data.redirectTo;
            } else {
                window.location.href = '/login'; // 안전장치로 기본 로그인 페이지 이동
            }
            // 오류를 발생시켜 .catch() 블록으로 가거나, 
            // 여기서 특정 값을 반환하여 호출부가 인지하고 추가 처리하게 할 수 있음.
            throw new Error(data.message || '로그인이 필요합니다.'); 
        }

        if (!response.ok) { // 401 외의 다른 HTTP 오류
            // response.json()을 먼저 시도하고, 실패하면 기본 오류 메시지 사용
            let errorData = { message: `서버 응답 오류: ${response.status}` };
            try {
                errorData = await response.json();
            } catch (e) {
                console.warn('오류 응답 JSON 파싱 실패, 기본 메시지 사용. 응답 상태:', response.status, response.statusText);
                // text()로 실제 응답 내용을 확인해볼 수도 있습니다.
                // const textError = await response.text();
                // console.error("서버로부터 받은 실제 응답(텍스트):", textError);
            }
            console.error('API 응답 오류:', errorData);
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return await response.json(); // 성공 시 JSON 데이터 반환
    } catch (error) {
        console.error(`API 호출 (${apiUrl}) 실패:`, error.message);
        // 이 함수를 호출한 곳에서 이 오류를 받아서 UI 업데이트 등 적절한 처리를 할 수 있도록 오류를 다시 throw.
        // 또는 여기서 직접 updateUIForLoggedOutStateOnError() 같은 공통 UI 처리 함수를 호출할 수도 있습니다.
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

    // 즐겨찾기 추가 버튼은 지도 위치 선택 시점에 로그인 상태를 보고 표시 여부 결정
    // (updateAddressAndWeather 함수에서 처리)
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
        const data = await fetchData('/api/current-user'); 
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
        } else if (weatherTodayP) { // fetchData가 null을 반환했을 수 있음 (예: 401 후 오류 throw)
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
        // predefinedAddress가 null이면서 geocoder도 사용 불가한 경우 addressToDisplay는 null일 수 있음
        // 이 경우를 대비해 currentAddressTextSpan 업데이트 전에 null 체크 또는 기본값 할당
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
        const result = await fetchData('/api/favorites', {
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
        
        // currentUser가 이 시점에 이미 설정되어 있다면 (DOMContentLoaded 후 loadCurrentUserInfo가 먼저 완료된 경우)
        // 또는 currentUser가 없더라도 기본 위치 날씨를 보여줄 수 있음.
        // 여기서는 사용자가 로그인 되어 있고, 지도가 준비되면 기본 날씨를 표시하도록 함.
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
    
    // 먼저 사용자 정보를 가져와서 currentUser를 설정
    await loadCurrentUserInfo(); 

    // 그 다음에 지도 초기화 함수가 호출되도록 하거나,
    // initDashboardMap 함수 내부에서 currentUser 상태를 보고 동작하도록 함.
    // Google Maps API는 비동기적으로 로드되고 initDashboardMap을 호출하므로,
    // DOMContentLoaded 시점에서는 initDashboardMap이 이미 호출되었거나 곧 호출될 수 있음.
    // initDashboardMap 내부에서 currentUser를 참조하므로, loadCurrentUserInfo가 먼저 완료되는 것이 좋음.

    if (currentUser) {
        console.log('사용자 인증됨. 즐겨찾기 로드.');
        loadAndDisplayFavorites();
        // 만약 initDashboardMap이 DOMContentLoaded보다 늦게 호출되어 currentUser가 이미 설정된 상태라면
        // initDashboardMap 내부의 currentUser 체크 로직이 기본 날씨를 표시할 것임.
        // 만약 initDashboardMap이 먼저 호출되었다면, 여기서 다시 날씨를 로드할 필요는 없음.
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

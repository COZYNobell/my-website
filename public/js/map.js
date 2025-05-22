// 이 함수는 map.html에서 Google Maps API 스크립트가 로드된 후 자동으로 호출됩니다.
function initMap() {
  // 1. 지도의 초기 중심 위치 설정 (예: 서울 시청)
  const initialLocation = { lat: 37.5665, lng: 126.9780 }; // 위도, 경도

  // 2. 'map'이라는 ID를 가진 HTML 요소에 지도를 생성합니다.
  const map = new google.maps.Map(document.getElementById('map'), {
    zoom: 15, // 초기 확대 수준 (숫자가 클수록 확대됨)
    center: initialLocation, // 지도의 중심을 initialLocation으로 설정
  });

  // 3. 초기 위치에 마커(핀)를 생성합니다.
  const marker = new google.maps.Marker({
    position: initialLocation, // 마커의 위치
    map: map, // 이 마커를 위에서 생성한 'map' 객체에 표시
    title: '여기가 초기 위치입니다!' // 마커에 마우스를 올리면 나오는 텍스트 (선택 사항)
  });

  // 4. (다음 단계에서 추가할 내용) 주소 정보를 표시할 로직
  // 우선은 간단하게 초기 위치의 위도/경도를 표시해봅시다.
  const addressDiv = document.getElementById('address');
  addressDiv.textContent = `현재 표시된 위치 (위도/경도): ${initialLocation.lat.toFixed(4)}, ${initialLocation.lng.toFixed(4)}`;
}

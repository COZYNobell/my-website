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

  // 4. Geocoding API를 사용하여 주소 정보 가져오기 ✨ 추가된 부분 시작
  const geocoder = new google.maps.Geocoder(); // Geocoder 객체 생성
  const addressDiv = document.getElementById('address');

  geocoder.geocode({ 'location': initialLocation }, function(results, status) {
    if (status === 'OK') {
      if (results[0]) {
        // results[0].formatted_address 가 보통 전체 주소를 잘 보여줍니다.
        // map.html에서 API 로드 시 language=ko&region=KR 파라미터를 사용했기 때문에
        // 한국어 주소로 잘 나올 가능성이 높습니다.
        addressDiv.textContent = `주소: ${results[0].formatted_address}`;
      } else {
        addressDiv.textContent = '주소를 찾을 수 없습니다.';
        console.warn('No results found for geocoding');
      }
    } else {
      addressDiv.textContent = 'Geocoder에 실패했습니다: ' + status;
      console.error('Geocoder failed due to: ' + status);
    }
  });
  // ✨ 추가된 부분 끝
}

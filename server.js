// 1. 필요한 도구들 가져오기!!
const express = require('express');
const axios = require('axios');
require('dotenv').config(); // .env 파일 내용을 process.env로 로드 (최대한 위쪽에)

// 2. express 앱 만들기
const app = express();
const port = 3000;

// 3. API 키들을 .env 파일에서 안전하게 불러오기
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY; // 이전 단계에서 수정된 정확한 이름
const Maps_API_KEY = process.env.Maps_API_KEY;

// 4. public 폴더를 정적 파일 제공 폴더로 설정
app.use(express.static('public')); // 이 코드가 있어야 public/map.html 접근 가능

// 5. 기본 페이지('/') 요청 처리
app.get('/', (req, res) => {
  // 여러 줄 문자열은 반드시 백틱(`)으로 감싸야 합니다!
  res.send(`
    <h1>나의 멋진 웹사이트! 🌦️ 🗺️ </h1>
    <p><a href="/weather">오늘 날씨 보기</a></p>
    <p><a href="/map.html">지도 보기</a></p> <hr>
    <p><strong>API 키 상태 (Node.js 서버가 인식하는 값):</strong></p>
    <p>OpenWeather API 키: ${OPENWEATHERMAP_API_KEY ? '✔️ 로드됨' : '❌ 로드 안됨 (.env 확인!)'}</p>
    <p>Google Maps API 키: ${Maps_API_KEY ? '✔️ 로드됨' : '❌ 로드 안됨 (.env 확인!)'}</p>
  `); // 백틱으로 끝납니다.
});

// 6. 날씨 정보 보여주는 페이지 ('/weather')
app.get('/weather', async (req, res) => {
  if (!OPENWEATHERMAP_API_KEY) {
    console.error('🔴 OpenWeatherMap API 키가 .env 에서 로드되지 않았습니다!');
    return res.status(500).send('서버에 OpenWeatherMap API 키가 설정되지 않았어요. 😥 관리자에게 문의하세요.');
  }

  const city = 'Seoul';
  // 여기도 백틱(`)으로 감싸고, 변수는 ${변수명} 형태로 사용해야 합니다.
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=kr`;

  try {
    console.log(`날씨 API 요청 보낼 URL (실제 값 확인!): ${weatherUrl}`);
    const response = await axios.get(weatherUrl);
    const weatherData = response.data;

    const weatherDescription = weatherData.weather[0].description;
    const temperature = weatherData.main.temp;
    const feelsLike = weatherData.main.feels_like;
    const humidity = weatherData.main.humidity;
    const cityName = weatherData.name;

    // 날씨 정보를 웹페이지에 표시 (역시 백틱 사용)
    res.send(`
      <h2>${cityName}의 현재 날씨 🌞</h2>
      <p><strong>상태:</strong> ${weatherDescription}</p>
      <p><strong>온도:</strong> ${temperature}°C</p>
      <p><strong>체감 온도:</strong> ${feelsLike}°C</p>
      <p><strong>습도:</strong> ${humidity}%</p>
      <br>
      <p><a href="/">홈으로 돌아가기</a></p>
    `);
  } catch (error) {
    console.error('❌ 날씨 정보 가져오기 실패:', error.message);
    if (error.response) {
      console.error('API 응답 에러 상태:', error.response.status);
      console.error('API 응답 에러 데이터:', error.response.data);
    }
    res.status(500).send('날씨 정보를 가져오는 데 실패했어요. 😥 나중에 다시 시도해주세요.');
  }
});

// 7. (준비중) 지도 보여주는 페이지 ('/map') - 이제 public/map.html 을 사용하므로 이 라우트는 필요 없을 수 있습니다.
// app.get('/map', (req, res) => {
//   res.send('<h1>지도 서비스 준비중입니다... 🚧</h1><p><a href="/">홈으로 돌아가기</a></p>');
// });

// 8. 서버 실행!
app.listen(port, () => {
  console.log(`와! ${port}번 문에서 웹사이트가 열렸어요! 브라우저에서 http://localhost:${port} 로 접속해보세요!`);
  if (OPENWEATHERMAP_API_KEY) {
    console.log('🟢 OpenWeatherMap API 키가 성공적으로 로드되었습니다.');
  } else {
    console.error('🔴 중요! OpenWeatherMap API 키가 .env 파일에서 로드되지 않았습니다! 날씨 기능이 작동하지 않습니다.');
  }
  if (Maps_API_KEY) {
    console.log('🔵 Google Maps API 키가 성공적으로 로드되었습니다. (지금은 사용 안 함)');
  } else {
    // Google Maps 키는 현재 필수는 아니므로 경고 수준으로만 표시
    console.warn('🟡 참고: Google Maps API 키가 .env 파일에서 로드되지 않았습니다. (지금은 사용 안 함)');
  }
});

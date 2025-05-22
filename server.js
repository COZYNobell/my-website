// 1. 필요한 도구들 가져오기!!
const express = require('express');
const axios = require('axios');
require('dotenv').config(); // .env 파일 내용을 process.env로 로드 (최대한 위쪽에)

// 2. express 앱 만들기
const app = express();
const port = 3000;

// 3. API 키들을 .env 파일에서 안전하게 불러오기
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const Maps_API_KEY = process.env.Maps_API_KEY;

app.use(express.static('public'));

// 5. 기본 페이지('/') 요청 처리
app.get('/', (req, res) => {
  // 여러 줄 문자열은 반드시 백틱(`)으로 감싸야 합니다!
  res.send(`
    <h1>나의 멋진 웹사이트! 🌦️🗺️</h1>
    <p><a href="/weather">오늘 날씨 보기</a></p>
    <p><a href="/map">지도 보기 (준비중)</a></p>
    <hr>
    <p><strong>API 키 상태 (Node.js 서버가 인식하는 값):</strong></p>
    <p>OpenWeather API 키: ${OPENWEATHER_API_KEY ? '✔️ 로드됨' : '❌ 로드 안됨 (.env 확인!)'}</p>
    <p>Google Maps API 키: ${Maps_API_KEY ? '✔️ 로드됨' : '❌ 로드 안됨 (.env 확인!)'}</p>
  `); // 백틱으로 끝납니다.
});

// 6. 날씨 정보 보여주는 페이지 ('/weather')
app.get('/weather', async (req, res) => {
  if (!OPENWEATHER_API_KEY) {
    console.error('🔴 OpenWeatherMap API 키가 .env 에서 로드되지 않았습니다!');
    return res.status(500).send('서버에 OpenWeatherMap API 키가 설정되지 않았어요. 😥 관리자에게 문의하세요.');
  }

  const city = 'Seoul';
  // 여기도 백틱(`)으로 감싸고, 변수는 ${변수명} 형태로 사용해야 합니다.
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=kr`;

  try {
    console.log(`날씨 API 요청 보낼 URL (실제 값 확인!): ${weatherUrl}`);
    const response = await axios.get(weatherUrl);
    const weatherData = response.data;

    const weatherDescription = weatherData.weather[0].description;
    const temperature = weatherData.main.temp;
    const feelsLike = weatherData.main.feels_like;
    const humidity = weatherData.main.humidity;
    const cityName = weatherData.name;

    // 여러 줄 HTML은 백틱(`)으로!
    res.send(`
      <h2>${cityName}의 현재 날씨 🌞</h2>
      <p>상태: ${weatherDescription}</p>
      <p>온도: ${temperature}°C</p>
      <p>체감 온도: ${feelsLike}°C</p>
      <p>습도: ${humidity}%</p>
      <p><a href="/">홈으로 돌아가기</a></p>
    `); // 백틱으로 끝납니다.
  } catch (error) {
    console.error('날씨 정보를 가져오는 데 실패했어요:', error.message);
    if (error.response) {
      console.error('API 응답 데이터:', error.response.data);
      console.error('API 응답 상태:', error.response.status);
      res.status(error.response.status).send(`날씨 정보를 가져올 수 없어요. 😥 (에러 코드: ${error.response.status}) API 키나 요청을 확인해주세요.`);
    } else if (error.request) {
      console.error('API 요청 정보 (응답 못 받음):', error.request);
      res.status(500).send('날씨 API 서버에서 응답이 없어요. 😥 네트워크나 API 서버 상태를 확인해주세요.');
    } else {
      console.error('Axios 요청 설정 오류:', error.message);
      res.status(500).send('날씨 정보를 요청하는 중 알 수 없는 오류가 발생했어요. 😥');
    }
  }
});

// 7. 지도 보여주는 페이지 ('/map') - 아직 준비 중
app.get('/map', (req, res) => {
  // 여러 줄 HTML은 백틱(`)으로!
  res.send(`
    <h2>지도 보기 🗺️ (준비 중)</h2>
    <p>Google 지도를 표시하려면 클라이언트 사이드 JavaScript와 Google Maps API 키가 필요해요.</p>
    <p>지금은 OpenWeather API 연동에 집중하고 있어요! 지도는 나중에 멋지게 만들어봐요!</p>
    <p><a href="/">홈으로 돌아가기</a></p>
  `); // 백틱으로 끝납니다.
});

// 8. 서버 시작!
app.listen(port, () => {
  console.log(`와! ${port}번 문에서 웹사이트가 열렸어요! 브라우저에서 http://localhost:${port} 로 접속해보세요!`);
  if (!OPENWEATHER_API_KEY) {
    console.warn('🔴 중요! OpenWeatherMap API 키가 .env 파일에서 로드되지 않았습니다! 날씨 기능이 작동하지 않습니다.');
  } else {
    console.log('🟢 OpenWeatherMap API 키가 성공적으로 로드되었습니다.');
  }
  if (!Maps_API_KEY) {
    console.warn('🟡 참고: Google Maps API 키가 .env 파일에서 로드되지 않았습니다. (지금은 사용 안 함)');
  } else {
    console.log('🔵 Google Maps API 키가 성공적으로 로드되었습니다. (지금은 사용 안 함)');
  }
});

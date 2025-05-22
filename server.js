// 1. 필요한 도구들 가져오기!!
const express = require('express');
const axios = require('axios');
require('dotenv').config(); // .env 파일 내용을 process.env로 로드 (최대한 위쪽에)
const session = require('express-session'); // ✨ NEW: express-session 모듈 가져오기

// 2. express 앱 만들기
const app = express();
const port = 3000;

// ✨ NEW: 사용자 정보를 저장할 배열 (간단한 인메모리 방식, 서버 재시작 시 초기화됨)
const users = [];
let userIdCounter = 1; // 간단한 사용자 ID 생성을 위해

// 3. API 키들을 .env 파일에서 안전하게 불러오기
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const Maps_API_KEY = process.env.Maps_API_KEY;

// 4. 미들웨어 설정
app.use(express.static('public')); // public 폴더를 정적 파일 제공 폴더로 설정

// ✨ NEW: express-session 미들웨어 설정 (라우트 핸들러들보다 위에 위치해야 함)
app.use(session({
  secret: '연습이니까일단아무거나넣는나만의시크릿키!', // ⚠️ 실제 환경에서는 매우 안전한 문자열로 .env에 보관하세요!
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // 로컬 개발시는 false, HTTPS 운영시는 true 권장
}));

// 5. 라우트 핸들러들
// 5.1. 기본 페이지('/') 요청 처리
app.get('/', (req, res) => {
  res.send(`
    <h1>나의 멋진 웹사이트! 🌦️ 🗺️ </h1>
    <p><a href="/weather">기존 서울 날씨 보기</a></p>
    <p><a href="/map.html">이전 지도 페이지 보기</a></p>
    <p><a href="/dashboard.html">✨ 새로운 통합 대시보드 보기 ✨</a></p> <hr>
    <p><strong>API 키 상태 (Node.js 서버가 인식하는 값):</strong></p>
    <p>OpenWeather API 키: ${OPENWEATHERMAP_API_KEY ? '✔️ 로드됨' : '❌ 로드 안됨 (.env 확인!)'}</p>
    <p>Google Maps API 키: ${Maps_API_KEY ? '✔️ 로드됨' : '❌ 로드 안됨 (.env 확인!)'}</p>
    <hr>
    <p><a href="/signup.html">회원가입</a> | <a href="/login.html">로그인</a></p> `);
});

// 5.2. 기존 날씨 정보 보여주는 페이지 ('/weather')
app.get('/weather', async (req, res) => {
  if (!OPENWEATHERMAP_API_KEY) {
    console.error('🔴 OpenWeatherMap API 키가 .env 에서 로드되지 않았습니다!');
    return res.status(500).send('서버에 OpenWeatherMap API 키가 설정되지 않았어요. 😥 관리자에게 문의하세요.');
  }
  const city = 'Seoul';
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

// ✨✨✨ NEW: 특정 좌표의 현재 날씨 정보 반환 API 엔드포인트 - 이 부분이 추가되었습니다! ✨✨✨
app.get('/api/weather-by-coords', async (req, res) => {
  const { lat, lon } = req.query; // 클라이언트에서 lat, lon 쿼리 파라미터로 받음

  if (!lat || !lon) {
    return res.status(400).json({ message: '위도(lat)와 경도(lon) 파라미터가 필요합니다.' });
  }

  if (!OPENWEATHERMAP_API_KEY) {
    console.error('🔴 OpenWeatherMap API 키가 .env 에서 로드되지 않았습니다! (/api/weather-by-coords)');
    return res.status(500).json({ message: '서버에 OpenWeatherMap API 키가 설정되지 않았습니다.' });
  }

  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=kr`;

  try {
    console.log(`좌표 기반 날씨 API 요청 URL: ${weatherUrl}`);
    const response = await axios.get(weatherUrl);
    const weatherData = response.data;

    const requiredData = {
      description: weatherData.weather[0].description,
      temperature: weatherData.main.temp,
      feels_like: weatherData.main.feels_like,
      humidity: weatherData.main.humidity,
      cityName: weatherData.name, // OpenWeatherMap은 좌표로도 도시 이름을 반환해줍니다.
      icon: weatherData.weather[0].icon
    };
    res.json(requiredData);

  } catch (error) {
    console.error('❌ 좌표 기반 날씨 정보 가져오기 실패:', error.message);
    if (error.response) {
      console.error('API 응답 에러 상태:', error.response.status);
      console.error('API 응답 에러 데이터:', error.response.data);
      res.status(error.response.status).json({ message: '날씨 정보를 가져오는 데 실패했습니다.', error: error.response.data });
    } else {
      res.status(500).json({ message: '날씨 정보를 가져오는 데 실패했습니다.' });
    }
  }
});
// ✨✨✨ NEW API 엔드포인트 끝 ✨✨✨

// 6. 서버 실행!
app.listen(port, () => {
  console.log(`와! ${port}번 문에서 웹사이트가 열렸어요! 브라우저에서 http://localhost:${port} 로 접속해보세요!`);
  if (OPENWEATHERMAP_API_KEY) {
    console.log('🟢 OpenWeatherMap API 키가 성공적으로 로드되었습니다.');
  } else {
    console.error('🔴 중요! OpenWeatherMap API 키가 .env 파일에서 로드되지 않았습니다! 날씨 기능이 작동하지 않습니다.');
  }
  if (Maps_API_KEY) {
    console.log('🔵 Google Maps API 키가 성공적으로 로드되었습니다.');
  } else {
    console.warn('🟡 참고: Google Maps API 키가 .env 파일에서 로드되지 않았습니다.');
  }
});

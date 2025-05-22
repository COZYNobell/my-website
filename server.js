// 1. 필요한 도구들 가져오기!!
const express = require('express');
const axios = require('axios');
require('dotenv').config(); // .env 파일 내용을 process.env로 로드 (최대한 위쪽에)
const session = require('express-session'); // express-session 모듈 가져오기
const bcrypt = require('bcrypt'); // ✨ NEW: bcrypt 모듈 가져오기

// 2. express 앱 만들기
const app = express();
const port = 3000;

// 사용자 정보를 저장할 배열 (간단한 인메모리 방식, 서버 재시작 시 초기화됨)
const users = []; // 예: { id: 1, email: 'test@example.com', password: 'hashedPassword' }
let userIdCounter = 1; // 간단한 사용자 ID 생성을 위해

// 3. API 키들을 .env 파일에서 안전하게 불러오기
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const Maps_API_KEY = process.env.Maps_API_KEY;

// 4. 미들웨어 설정
app.use(express.static('public')); // public 폴더를 정적 파일 제공 폴더로 설정
app.use(express.urlencoded({ extended: false })); // ✨ NEW: 폼 데이터 처리를 위한 미들웨어

// express-session 미들웨어 설정 (라우트 핸들러들보다 위에 위치해야 함)
app.use(session({
  secret: '연습이니까일단아무거나넣는나만의시크릿키!', // ⚠️ 실제 환경에서는 매우 안전한 문자열로 .env에 보관하세요!
  resave: false, // 세션 데이터가 변경되지 않았더라도 계속 다시 저장할지 여부
  saveUninitialized: true, // 초기화되지 않은 세션을 저장소에 강제로 저장할지 여부
  cookie: { secure: false } // 로컬 개발시는 false, HTTPS 운영시는 true 권장
}));

// 5. 라우트 핸들러들
// 5.1. 기본 페이지('/') 요청 처리
app.get('/', (req, res) => {
  res.send(`
    <h1>나의 멋진 웹사이트! 🌦️ 🗺️ </h1>
    <p><a href="/weather">기존 서울 날씨 보기</a></p>
    <p><a href="/map.html">이전 지도 페이지 보기</a></p>
    <p><a href="/dashboard.html">✨ 새로운 통합 대시보드 보기 ✨</a></p>
    <hr>
    <p><strong>API 키 상태 (Node.js 서버가 인식하는 값):</strong></p>
    <p>OpenWeather API 키: ${OPENWEATHERMAP_API_KEY ? '✔️ 로드됨' : '❌ 로드 안됨 (.env 확인!)'}</p>
    <p>Google Maps API 키: ${Maps_API_KEY ? '✔️ 로드됨' : '❌ 로드 안됨 (.env 확인!)'}</p>
    <hr>
    <p><a href="/signup.html">회원가입</a> | <a href="/login.html">로그인</a></p>
  `);
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

// 5.3. 특정 좌표의 현재 날씨 정보 반환 API 엔드포인트
app.get('/api/weather-by-coords', async (req, res) => {
  const { lat, lon } = req.query; 

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
      cityName: weatherData.name,
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

// 5.4. 특정 좌표의 며칠간 날씨 예보 반환 API 엔드포인트
app.get('/api/weather-forecast', async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ message: '위도(lat)와 경도(lon) 파라미터가 필요합니다.' });
  }

  if (!OPENWEATHERMAP_API_KEY) {
    console.error('🔴 OpenWeatherMap API 키가 .env 에서 로드되지 않았습니다! (/api/weather-forecast)');
    return res.status(500).json({ message: '서버에 OpenWeatherMap API 키가 설정되지 않았습니다.' });
  }

  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=kr`;

  try {
    console.log(`날씨 예보 API 요청 URL: ${forecastUrl}`);
    const response = await axios.get(forecastUrl);
    const forecastData = response.data;
    const dailyForecasts = {}; 
    forecastData.list.forEach(item => {
      const date = item.dt_txt.split(' ')[0]; 
      if (!dailyForecasts[date]) {
        dailyForecasts[date] = {
          temps: [], weather_descriptions: [], icons: [], dt_txts: []
        };
      }
      dailyForecasts[date].temps.push(item.main.temp);
      dailyForecasts[date].weather_descriptions.push(item.weather[0].description);
      dailyForecasts[date].icons.push(item.weather[0].icon);
      dailyForecasts[date].dt_txts.push(item.dt_txt);
    });
    const processedForecast = [];
    const today = new Date();
    let addedDays = 0;
    const datesProcessed = new Set(); 
    for (const item of forecastData.list) {
        const itemDateStr = item.dt_txt.split(' ')[0]; 
        const itemDate = new Date(itemDateStr);
        itemDate.setHours(0,0,0,0); 
        const todayDateOnly = new Date();
        todayDateOnly.setHours(0,0,0,0);
        if (itemDate > todayDateOnly && !datesProcessed.has(itemDateStr) && addedDays < 2) {
            const dayData = dailyForecasts[itemDateStr];
            let representativeIndex = Math.floor(dayData.dt_txts.length / 2); 
            const specificTimeIndex = dayData.dt_txts.findIndex(dt_txt => dt_txt.includes("15:00:00"));
            if (specificTimeIndex !== -1) {
                representativeIndex = specificTimeIndex;
            }
            processedForecast.push({
              date: itemDateStr,
              temp_min: Math.min(...dayData.temps).toFixed(1),
              temp_max: Math.max(...dayData.temps).toFixed(1),
              description: dayData.weather_descriptions[representativeIndex] || dayData.weather_descriptions[0],
              icon: (dayData.icons[representativeIndex] || dayData.icons[0]).replace('n', 'd')
            });
            datesProcessed.add(itemDateStr);
            addedDays++;
        }
        if (addedDays >= 2) break;
    }
    res.json({
        cityName: forecastData.city.name,
        forecast: processedForecast 
    });
  } catch (error) {
    console.error('❌ 날씨 예보 정보 가져오기 실패:', error.message);
    if (error.response) {
      console.error('API 응답 에러 상태:', error.response.status);
      console.error('API 응답 에러 데이터:', error.response.data);
      res.status(error.response.status).json({ message: '날씨 예보 정보를 가져오는 데 실패했습니다.', error: error.response.data });
    } else {
      res.status(500).json({ message: '날씨 예보 정보를 가져오는 데 실패했습니다.' });
    }
  }
});

// ✨✨✨ NEW: 사용자 회원가입 처리 라우트 (/signup) - POST 방식 - 이 부분이 추가되었습니다! ✨✨✨
app.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. 간단한 유효성 검사
    if (!email || !password) {
      return res.status(400).send('이메일과 비밀번호를 모두 입력해주세요. <a href="/signup.html">다시 시도</a>');
    }

    // 2. 이미 가입된 이메일인지 확인
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      return res.status(409).send('이미 가입된 이메일입니다. <a href="/login.html">로그인</a> 하시거나 다른 이메일로 가입해주세요. <a href="/signup.html">다시 시도</a>');
    }

    // 3. 비밀번호 암호화
    const saltRounds = 10; 
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4. 새 사용자 정보 저장
    const newUser = {
      id: userIdCounter++,
      email: email,
      password: hashedPassword 
    };
    users.push(newUser);

    console.log('새로운 사용자 가입됨:', { id: newUser.id, email: newUser.email }); 
    console.log('현재 가입된 사용자 목록 (개발용):', users.map(u => ({id: u.id, email: u.email})));

    // 5. 회원가입 성공 후 로그인 페이지로 리다이렉트
    res.redirect('/login.html?signup=success'); 

  } catch (error) {
    console.error("회원가입 처리 중 오류 발생:", error);
    res.status(500).send('회원가입 중 오류가 발생했습니다. <a href="/signup.html">다시 시도</a>');
  }
});
// ✨✨✨ NEW /signup 라우트 끝 ✨✨✨


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

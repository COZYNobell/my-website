// 1. 필요한 도구들 가져오기!!
const express = require('express');
const axios = require('axios');
require('dotenv').config(); // .env 파일 내용을 process.env로 로드 (최대한 위쪽에)
const session = require('express-session'); // express-session 모듈 가져오기

// 2. express 앱 만들기
const app = express();
const port = 3000;

// 사용자 정보를 저장할 배열 (간단한 인메모리 방식, 서버 재시작 시 초기화됨)
const users = [];
let userIdCounter = 1; // 간단한 사용자 ID 생성을 위해

// 3. API 키들을 .env 파일에서 안전하게 불러오기
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const Maps_API_KEY = process.env.Maps_API_KEY;

// 4. 미들웨어 설정
app.use(express.static('public')); // public 폴더를 정적 파일 제공 폴더로 설정

// express-session 미들웨어 설정 (라우트 핸들러들보다 위에 위치해야 함)
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

// ✨✨✨ NEW: 특정 좌표의 며칠간 날씨 예보 반환 API 엔드포인트 - 이 부분이 추가되었습니다! ✨✨✨
app.get('/api/weather-forecast', async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ message: '위도(lat)와 경도(lon) 파라미터가 필요합니다.' });
  }

  if (!OPENWEATHERMAP_API_KEY) {
    console.error('🔴 OpenWeatherMap API 키가 .env 에서 로드되지 않았습니다! (/api/weather-forecast)');
    return res.status(500).json({ message: '서버에 OpenWeatherMap API 키가 설정되지 않았습니다.' });
  }

  // OpenWeatherMap 5일/3시간 예보 API URL
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
          temps: [],
          weather_descriptions: [], // 다양한 설명을 담을 배열
          icons: [], // 다양한 아이콘을 담을 배열
          dt_txts: [] // 시간 정보도 함께 저장
        };
      }
      dailyForecasts[date].temps.push(item.main.temp);
      dailyForecasts[date].weather_descriptions.push(item.weather[0].description);
      dailyForecasts[date].icons.push(item.weather[0].icon);
      dailyForecasts[date].dt_txts.push(item.dt_txt);
    });
    
    const processedForecast = [];
    const today = new Date();
    // today.setHours(0, 0, 0, 0); // 오늘 날짜의 시작으로 설정 (필요시)

    let addedDays = 0;
    const datesProcessed = new Set(); // 이미 처리한 날짜를 추적

    // API 응답의 날짜 순서대로 처리 (API가 보통 시간순으로 정렬해서 줌)
    for (const item of forecastData.list) {
        const itemDateStr = item.dt_txt.split(' ')[0]; // 'YYYY-MM-DD'
        const itemDate = new Date(itemDateStr);
        itemDate.setHours(0,0,0,0); // 날짜 비교를 위해 시간은 0으로 설정

        const todayDateOnly = new Date();
        todayDateOnly.setHours(0,0,0,0);
        
        // 오늘보다 크고, 아직 처리 안 한 날짜이며, 2일치까지만
        if (itemDate > todayDateOnly && !datesProcessed.has(itemDateStr) && addedDays < 2) {
            const dayData = dailyForecasts[itemDateStr];
            // 대표 아이콘 및 설명: 하루 중 특정 시간(예: 오후 3시) 또는 가장 빈번한 것으로 선택
            // 여기서는 간단히 중간 시간대의 데이터를 사용하려고 시도하거나, 첫번째 데이터 사용
            let representativeIndex = Math.floor(dayData.dt_txts.length / 2); 
            // 만약 dt_txts에 "15:00:00"이 포함된 시간을 찾으면 더 좋음
            const specificTimeIndex = dayData.dt_txts.findIndex(dt_txt => dt_txt.includes("15:00:00"));
            if (specificTimeIndex !== -1) {
                representativeIndex = specificTimeIndex;
            }

            processedForecast.push({
              date: itemDateStr,
              temp_min: Math.min(...dayData.temps).toFixed(1),
              temp_max: Math.max(...dayData.temps).toFixed(1),
              description: dayData.weather_descriptions[representativeIndex] || dayData.weather_descriptions[0],
              icon: (dayData.icons[representativeIndex] || dayData.icons[0]).replace('n', 'd') // 밤 아이콘(n)을 낮 아이콘(d)으로 (예시)
            });
            datesProcessed.add(itemDateStr);
            addedDays++;
        }
        if (addedDays >= 2) break; // 2일치 예보를 다 모았으면 종료
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

// 1. 필요한 모듈 가져오기
const express = require('express');
const axios = require('axios');
require('dotenv').config(); // .env 파일 내용을 process.env로 로드 (최상단 권장)
const session = require('express-session'); // Express 세션 모듈
const bcrypt = require('bcrypt'); // 비밀번호 암호화 모듈

// 2. Express 앱 생성 및 포트 설정
const app = express();
const port = 3000;

// 3. 인메모리 사용자 데이터 저장소 (서버 재시작 시 초기화됨 - 테스트용)
const users = []; // 예: { id: 1, email: 'test@example.com', password: 'hashedPassword' }
let userIdCounter = 1; // 사용자 ID 자동 증가용

// 4. API 키 환경변수에서 로드
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const Maps_API_KEY = process.env.Maps_API_KEY; // Google Maps API 키 (현재는 dashboard.html에 직접 입력)

// 5. 미들웨어 설정
app.use(express.static('public')); // 'public' 폴더의 정적 파일 제공 (html, css, js 등)
app.use(express.urlencoded({ extended: false })); // URL 인코딩된 form 데이터 파싱

// Express 세션 미들웨어 설정 (다른 라우트들보다 먼저 설정)
app.use(session({
  secret: '나중에 .env 로 옮길 매우 안전한 시크릿 키!', // ⚠️ 실제 운영 시 .env 파일로 옮기고 복잡하게 설정하세요!
  resave: false, // 세션이 변경되지 않아도 강제로 다시 저장할지 여부
  saveUninitialized: true, // 초기화되지 않은 세션을 저장소에 저장할지 여부
  cookie: { 
    secure: false, // HTTPS 환경이 아니므로 false. HTTPS 사용 시 true로 변경
    // httpOnly: true, // JavaScript에서 쿠키 접근 방지 (보안 강화) - 필요시 활성화
    // maxAge: 1000 * 60 * 60 * 24 // 쿠키 유효 기간 (예: 하루) - 필요시 활성화
  }
}));

// 6. 라우트 핸들러 (웹 페이지 경로 및 API 엔드포인트)

// 6.1. 메인 홈페이지 (루트 경로: /)
app.get('/', (req, res) => {
  // 현재 로그인된 사용자 정보 확인 (세션에서)
  const loggedInUserEmail = req.session.user ? req.session.user.email : '방문자';

  res.send(`
    <h1>나의 멋진 웹사이트! 🌦️ 🗺️ </h1>
    <p>안녕하세요, ${loggedInUserEmail}님!</p> 
    <p><a href="/dashboard.html">✨ 통합 대시보드 보기 ✨</a></p>
    <hr>
    <p><strong>API 키 상태 (Node.js 서버가 인식하는 값):</strong></p>
    <p>OpenWeather API 키: ${OPENWEATHERMAP_API_KEY ? '✔️ 로드됨' : '❌ 로드 안됨 (.env 확인!)'}</p>
    <p>Google Maps API 키 (서버): ${Maps_API_KEY ? '✔️ 로드됨' : '❌ 로드 안됨 (.env 확인!)'}</p>
    <hr>
    <p>
      ${req.session.user 
        ? `<a href="/logout">로그아웃</a> | <span>${req.session.user.email}님 환영합니다!</span>`
        : '<a href="/signup.html">회원가입</a> | <a href="/login.html">로그인</a>'
      }
    </p>
  `);
});

// 6.2. 이전 스타일 서울 날씨 페이지 (/weather) - 필요시 유지 또는 제거
app.get('/weather', async (req, res) => {
  if (!OPENWEATHERMAP_API_KEY) {
    console.error('🔴 OpenWeatherMap API 키가 .env 에서 로드되지 않았습니다!');
    return res.status(500).send('서버에 OpenWeatherMap API 키가 설정되지 않았어요. 😥 관리자에게 문의하세요.');
  }
  const city = 'Seoul';
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=kr`;
  try {
    const response = await axios.get(weatherUrl);
    const weatherData = response.data;
    res.send(`
      <h2>${weatherData.name}의 현재 날씨 🌞</h2>
      <p><strong>상태:</strong> ${weatherData.weather[0].description}</p>
      <p><strong>온도:</strong> ${weatherData.main.temp}°C</p>
      <p><strong>체감 온도:</strong> ${weatherData.main.feels_like}°C</p>
      <p><strong>습도:</strong> ${weatherData.main.humidity}%</p>
      <br>
      <p><a href="/">홈으로 돌아가기</a></p>
    `);
  } catch (error) {
    console.error('❌ 날씨 정보 가져오기 실패:', error.message);
    res.status(500).send('날씨 정보를 가져오는 데 실패했어요. 😥 나중에 다시 시도해주세요.');
  }
});

// 6.3. API: 좌표 기반 현재 날씨 정보 (/api/weather-by-coords)
app.get('/api/weather-by-coords', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ message: '위도(lat)와 경도(lon) 파라미터가 필요합니다.' });
  if (!OPENWEATHERMAP_API_KEY) return res.status(500).json({ message: '서버에 OpenWeatherMap API 키가 설정되지 않았습니다.' });
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=kr`;
  try {
    const response = await axios.get(weatherUrl);
    const weatherData = response.data;
    res.json({
      description: weatherData.weather[0].description,
      temperature: weatherData.main.temp,
      feels_like: weatherData.main.feels_like,
      humidity: weatherData.main.humidity,
      cityName: weatherData.name,
      icon: weatherData.weather[0].icon
    });
  } catch (error) {
    console.error('❌ 좌표 기반 날씨 정보 가져오기 실패:', error.message);
    res.status(500).json({ message: '날씨 정보를 가져오는 데 실패했습니다.' });
  }
});

// 6.4. API: 좌표 기반 날씨 예보 정보 (/api/weather-forecast)
app.get('/api/weather-forecast', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ message: '위도(lat)와 경도(lon) 파라미터가 필요합니다.' });
  if (!OPENWEATHERMAP_API_KEY) return res.status(500).json({ message: '서버에 OpenWeatherMap API 키가 설정되지 않았습니다.' });
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=kr`;
  try {
    const response = await axios.get(forecastUrl);
    const forecastData = response.data;
    const dailyForecasts = {};
    forecastData.list.forEach(item => {
      const date = item.dt_txt.split(' ')[0];
      if (!dailyForecasts[date]) {
        dailyForecasts[date] = { temps: [], weather_descriptions: [], icons: [], dt_txts: [] };
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
      const itemDate = new Date(itemDateStr); itemDate.setHours(0,0,0,0);
      const todayDateOnly = new Date(); todayDateOnly.setHours(0,0,0,0);
      if (itemDate > todayDateOnly && !datesProcessed.has(itemDateStr) && addedDays < 2) {
        const dayData = dailyForecasts[itemDateStr];
        let representativeIndex = Math.floor(dayData.dt_txts.length / 2);
        const specificTimeIndex = dayData.dt_txts.findIndex(dt_txt => dt_txt.includes("15:00:00"));
        if (specificTimeIndex !== -1) representativeIndex = specificTimeIndex;
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
    res.json({ cityName: forecastData.city.name, forecast: processedForecast });
  } catch (error) {
    console.error('❌ 날씨 예보 정보 가져오기 실패:', error.message);
    res.status(500).json({ message: '날씨 예보 정보를 가져오는 데 실패했습니다.' });
  }
});

// 6.5. 사용자 회원가입 처리 라우트 (/signup) - POST 방식
app.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).send('이메일과 비밀번호를 모두 입력해주세요. <a href="/signup.html">다시 시도</a>');
    }
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      return res.status(409).send('이미 가입된 이메일입니다. <a href="/login.html">로그인</a> 하시거나 다른 이메일로 가입해주세요. <a href="/signup.html">다시 시도</a>');
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newUser = { id: userIdCounter++, email: email, password: hashedPassword };
    users.push(newUser);
    console.log('새로운 사용자 가입됨:', { id: newUser.id, email: newUser.email });
    console.log('현재 가입된 사용자 목록 (개발용):', users.map(u => ({id: u.id, email: u.email})));
    res.redirect('/login.html?signup=success');
  } catch (error) {
    console.error("회원가입 처리 중 오류 발생:", error);
    res.status(500).send('회원가입 중 오류가 발생했습니다. <a href="/signup.html">다시 시도</a>');
  }
});

// 6.6. 사용자 로그인 처리 라우트 (/login) - POST 방식
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).send('이메일과 비밀번호를 모두 입력해주세요. <a href="/login.html">다시 시도</a>');
    }
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).send('가입되지 않은 이메일이거나 비밀번호가 일치하지 않습니다. <a href="/login.html">다시 시도</a>');
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).send('가입되지 않은 이메일이거나 비밀번호가 일치하지 않습니다. <a href="/login.html">다시 시도</a>');
    }
    req.session.user = {
      id: user.id,
      email: user.email
    };
    console.log('사용자 로그인 성공:', req.session.user);
    res.redirect('/dashboard.html');
  } catch (error) {
    console.error("로그인 처리 중 오류 발생:", error);
    res.status(500).send('로그인 중 오류가 발생했습니다. <a href="/login.html">다시 시도</a>');
  }
});

// ✨✨✨ NEW: 사용자 로그아웃 처리 라우트 (/logout) - GET 방식 - 이 부분이 추가되었습니다! ✨✨✨
app.get('/logout', (req, res) => {
  if (req.session.user) { // 로그인된 사용자가 있을 경우
    const userEmail = req.session.user.email; // 로그를 위해 이메일 임시 저장
    req.session.destroy(err => { // 세션 파기
      if (err) {
        console.error('세션 파기 중 오류 발생:', err);
        return res.status(500).send('로그아웃 중 오류가 발생했습니다. <a href="/">홈으로</a>');
      }
      // 세션 쿠키를 명시적으로 삭제하고 싶다면 (선택 사항)
      // res.clearCookie('connect.sid'); // 'connect.sid'는 express-session의 기본 세션 쿠키 이름
      
      console.log(`사용자 (${userEmail}) 로그아웃 성공 및 세션 파기 완료`);
      res.redirect('/?logout=success'); // 로그아웃 후 홈페이지로 리다이렉트
    });
  } else { // 로그인된 사용자가 없을 경우
    res.redirect('/'); // 그냥 홈페이지로 리다이렉트
  }
});
// ✨✨✨ NEW /logout 라우트 끝 ✨✨✨


// 7. 서버 실행
app.listen(port, () => {
  console.log(`와! ${port}번 포트에서 웹사이트가 열렸어요! 브라우저에서 http://localhost:${port} 로 접속해보세요!`);
  if (OPENWEATHERMAP_API_KEY) console.log('🟢 OpenWeatherMap API 키 로드됨.');
  else console.error('🔴 중요! OpenWeatherMap API 키 로드 실패!');
  if (Maps_API_KEY) console.log('🔵 Google Maps API 키 (서버용) 로드됨.');
  else console.warn('🟡 참고: Google Maps API 키 (서버용) 로드 실패.');
});

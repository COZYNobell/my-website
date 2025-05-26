// 1. 필요한 모듈 가져오기
const express = require('express');
const axios = require('axios');
require('dotenv').config(); // .env 파일 내용을 process.env로 로드 (최상단 권장)
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

// 2. Express 앱 생성 및 포트 설정
const app = express();
const port = 3000;

// ✨ ---- DB 연결 정보 디버깅 로그 추가 시작 ---- ✨
console.log("애플리케이션 시작 - .env 파일 로드 시점 이후");
console.log("DB_HOST 환경 변수:", process.env.DB_HOST);
console.log("DB_USER 환경 변수:", process.env.DB_USER);
console.log("DB_PASSWORD 환경 변수 (존재 여부만):", process.env.DB_PASSWORD ? "설정됨" : "설정 안됨 또는 비어있음");
console.log("DB_NAME 환경 변수:", process.env.DB_NAME); // ✨ 이 값이 'seoul-free-db'로 정확히 나오는지 확인!
console.log("SESSION_SECRET 환경 변수 (존재 여부만):", process.env.SESSION_SECRET ? "설정됨" : "설정 안됨 또는 비어있음");
console.log("OPENWEATHERMAP_API_KEY 환경 변수 (존재 여부만):", process.env.OPENWEATHERMAP_API_KEY ? "설정됨" : "설정 안됨 또는 비어있음");
console.log("Maps_API_KEY 환경 변수 (존재 여부만):", process.env.Maps_API_KEY ? "설정됨" : "설정 안됨 또는 비어있음");
// ✨ ---- DB 연결 정보 디버깅 로그 추가 끝 ---- ✨

// MySQL Connection Pool 설정
const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME, // 여기가 중요!
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 데이터베이스 연결 테스트 및 테이블 생성 함수
async function initializeDatabase() {
  let connection; // ✨ connection 변수 선언 위치 변경
  try {
    connection = await dbPool.getConnection();
    // ✨ 연결 시도 직후 DB_NAME 실제 사용값 로깅
    console.log(`MySQL 연결 시도 중... DB_NAME: '${connection.config.database}' (풀 설정값) vs '${process.env.DB_NAME}' (.env 값)`);
    console.log(`${connection.config.database || process.env.DB_NAME} (MySQL) 데이터베이스에 성공적으로 연결되었습니다.`);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("users 테이블이 성공적으로 준비되었거나 이미 존재합니다.");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER NOT NULL,
        location_name TEXT NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log("favorites 테이블이 성공적으로 준비되었거나 이미 존재합니다.");

  } catch (error) {
    console.error("데이터베이스 초기화 중 오류 발생:", error.message);
    // ✨ 오류 발생 시 사용된 DB_NAME도 로깅
    console.error("오류 발생 시 DB_NAME 환경 변수 값:", process.env.DB_NAME);
    // process.exit(1); // 심각한 오류 시 프로세스 종료 고려
  } finally {
    if (connection) {
      connection.release();
      console.log("DB 연결이 풀로 반환되었습니다.");
    }
  }
}

initializeDatabase();

// API 키 환경변수에서 로드 (이미 위에서 로깅됨)
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const Maps_API_KEY = process.env.Maps_API_KEY;

// 미들웨어 설정
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || '임시_시크릿_키_입니다_반드시_변경하세요!',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// 라우트 핸들러 (이하 동일)
// ... (app.get('/'), app.get('/weather'), app.get('/api/weather-by-coords'), app.get('/api/weather-forecast') 코드는 이전과 동일) ...
// 메인 홈페이지 (루트 경로: /)
app.get('/', (req, res) => {
  const loggedInUserEmail = req.session.user ? req.session.user.email : '방문자';
  res.send(`
    <h1>나의 멋진 웹사이트! 🌦️ 🗺️ </h1>
    <p>안녕하세요, ${loggedInUserEmail}님!</p> 
    <p><a href="/dashboard.html">✨ 통합 대시보드 보기 ✨</a></p>
    <p><a href="/subscribe.html">📧 날씨 정보 이메일 구독하기</a></p>
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

// 이전 스타일 서울 날씨 페이지 (/weather) 
app.get('/weather', async (req, res) => {
  if (!OPENWEATHERMAP_API_KEY) return res.status(500).send('서버에 OpenWeatherMap API 키가 설정되지 않았어요.');
  const city = 'Seoul';
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=kr`;
  try {
    const response = await axios.get(weatherUrl); const weatherData = response.data;
    res.send(`<h2>${weatherData.name}의 현재 날씨 🌞</h2><p><strong>상태:</strong> ${weatherData.weather[0].description}</p><p><strong>온도:</strong> ${weatherData.main.temp}°C</p><p><strong>체감 온도:</strong> ${weatherData.main.feels_like}°C</p><p><strong>습도:</strong> ${weatherData.main.humidity}%</p><br><p><a href="/">홈으로 돌아가기</a></p>`);
  } catch (error) { console.error('❌ 날씨 정보 가져오기 실패:', error.message); res.status(500).send('날씨 정보를 가져오는 데 실패했어요.'); }
});

// API: 좌표 기반 현재 날씨 정보 (/api/weather-by-coords)
app.get('/api/weather-by-coords', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ message: '위도(lat)와 경도(lon) 파라미터가 필요합니다.' });
  if (!OPENWEATHERMAP_API_KEY) return res.status(500).json({ message: '서버에 OpenWeatherMap API 키가 설정되지 않았습니다.' });
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=kr`;
  try {
    const response = await axios.get(weatherUrl); const weatherData = response.data;
    res.json({ description: weatherData.weather[0].description, temperature: weatherData.main.temp, feels_like: weatherData.main.feels_like, humidity: weatherData.main.humidity, cityName: weatherData.name, icon: weatherData.weather[0].icon });
  } catch (error) { console.error('❌ 좌표 기반 날씨 정보 가져오기 실패:', error.message); res.status(500).json({ message: '날씨 정보를 가져오는 데 실패했습니다.' }); }
});

// API: 좌표 기반 날씨 예보 정보 (/api/weather-forecast)
app.get('/api/weather-forecast', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ message: '위도(lat)와 경도(lon) 파라미터가 필요합니다.' });
  if (!OPENWEATHERMAP_API_KEY) return res.status(500).json({ message: '서버에 OpenWeatherMap API 키가 설정되지 않았습니다.' });
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=kr`;
  try {
    const response = await axios.get(forecastUrl); const forecastData = response.data; const dailyForecasts = {};
    forecastData.list.forEach(item => { const date = item.dt_txt.split(' ')[0]; if (!dailyForecasts[date]) { dailyForecasts[date] = { temps: [], weather_descriptions: [], icons: [], dt_txts: [] }; } dailyForecasts[date].temps.push(item.main.temp); dailyForecasts[date].weather_descriptions.push(item.weather[0].description); dailyForecasts[date].icons.push(item.weather[0].icon); dailyForecasts[date].dt_txts.push(item.dt_txt); });
    const processedForecast = []; const today = new Date(); let addedDays = 0; const datesProcessed = new Set();
    for (const item of forecastData.list) {
      const itemDateStr = item.dt_txt.split(' ')[0]; const itemDate = new Date(itemDateStr); itemDate.setHours(0,0,0,0); const todayDateOnly = new Date(); todayDateOnly.setHours(0,0,0,0);
      if (itemDate > todayDateOnly && !datesProcessed.has(itemDateStr) && addedDays < 2) {
        const dayData = dailyForecasts[itemDateStr]; let representativeIndex = Math.floor(dayData.dt_txts.length / 2); const specificTimeIndex = dayData.dt_txts.findIndex(dt_txt => dt_txt.includes("15:00:00")); if (specificTimeIndex !== -1) representativeIndex = specificTimeIndex;
        processedForecast.push({ date: itemDateStr, temp_min: Math.min(...dayData.temps).toFixed(1), temp_max: Math.max(...dayData.temps).toFixed(1), description: dayData.weather_descriptions[representativeIndex] || dayData.weather_descriptions[0], icon: (dayData.icons[representativeIndex] || dayData.icons[0]).replace('n', 'd') });
        datesProcessed.add(itemDateStr); addedDays++;
      } if (addedDays >= 2) break;
    } res.json({ cityName: forecastData.city.name, forecast: processedForecast });
  } catch (error) { console.error('❌ 날씨 예보 정보 가져오기 실패:', error.message); res.status(500).json({ message: '날씨 예보 정보를 가져오는 데 실패했습니다.' }); }
});

// 사용자 회원가입 처리 라우트 (/signup) - POST 방식
app.post('/signup', async (req, res) => {
  const connection = await dbPool.getConnection();
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send('이메일과 비밀번호를 모두 입력해주세요. <a href="/signup.html">다시 시도</a>');
    const [rows] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length > 0) return res.status(409).send('이미 가입된 이메일입니다. <a href="/login.html">로그인</a> 하시거나 다른 이메일로 가입해주세요. <a href="/signup.html">다시 시도</a>');
    const saltRounds = 10; const hashedPassword = await bcrypt.hash(password, saltRounds);
    const [result] = await connection.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hashedPassword]);
    console.log(`새로운 사용자 가입됨 (DB ID: ${result.insertId}, email: ${email})`);
    res.redirect('/login.html?signup=success');
  } catch (error) { console.error("회원가입 처리 중 오류 발생:", error); res.status(500).send('회원가입 처리 중 오류가 발생했습니다. <a href="/signup.html">다시 시도</a>');
  } finally { if (connection) connection.release(); }
});

// 사용자 로그인 처리 라우트 (/login) - POST 방식
app.post('/login', async (req, res) => { // ✨ async로 변경 (bcrypt.compare가 await 사용하므로)
  const connection = await dbPool.getConnection();
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send('이메일과 비밀번호를 모두 입력해주세요. <a href="/login.html">다시 시도</a>');
    const [rows] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) return res.status(401).send('가입되지 않은 이메일이거나 비밀번호가 일치하지 않습니다. <a href="/login.html">다시 시도</a>');
    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).send('가입되지 않은 이메일이거나 비밀번호가 일치하지 않습니다. <a href="/login.html">다시 시도</a>');
    req.session.user = { id: user.id, email: user.email };
    console.log('사용자 로그인 성공:', req.session.user);
    res.redirect('/dashboard.html');
  } catch (error) { console.error("로그인 처리 중 오류 발생:", error); res.status(500).send('로그인 중 오류가 발생했습니다. <a href="/login.html">다시 시도</a>');
  } finally { if (connection) connection.release(); }
});

// 사용자 로그아웃 처리 라우트 (/logout) - GET 방식
app.get('/logout', (req, res) => { /* ... (이전 코드와 동일) ... */ });

// API: 현재 로그인된 사용자 정보 (/api/current-user)
app.get('/api/current-user', (req, res) => { /* ... (이전 코드와 동일) ... */ });

// 즐겨찾기 관련 API 엔드포인트들
function ensureAuthenticated(req, res, next) { /* ... (이전 코드와 동일) ... */ }
app.post('/api/favorites', ensureAuthenticated, async (req, res) => { /* ... (이전 코드와 동일) ... */ });
app.get('/api/favorites', ensureAuthenticated, async (req, res) => { /* ... (이전 코드와 동일) ... */ });
app.delete('/api/favorites/:id', ensureAuthenticated, async (req, res) => { /* ... (이전 코드와 동일) ... */ });


// 서버 실행
app.listen(port, () => {
  console.log(`와! ${port}번 포트에서 웹사이트가 열렸어요! 브라우저에서 http://localhost:${port} 로 접속해보세요!`);
  // ✨ API 키 로드 확인 로그는 위쪽 디버깅 로그에서 이미 확인하므로 여기서는 생략하거나 유지해도 됩니다.
  if (OPENWEATHERMAP_API_KEY) console.log('🟢 OpenWeatherMap API 키 로드됨.');
  else console.error('🔴 중요! OpenWeatherMap API 키 로드 실패!');
  if (Maps_API_KEY) console.log('🔵 Google Maps API 키 (서버용) 로드됨.');
  else console.warn('🟡 참고: Google Maps API 키 (서버용) 로드 실패.');
});

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

// 디버깅 로그 (환경 변수 로드 확인)
console.log("애플리케이션 시작 - .env 파일 로드 시점 이후");
console.log("DB_HOST 환경 변수:", process.env.DB_HOST);
console.log("DB_USER 환경 변수:", process.env.DB_USER);
console.log("DB_PASSWORD 환경 변수 (존재 여부만):", process.env.DB_PASSWORD ? "설정됨" : "설정 안됨 또는 비어있음");
console.log("DB_NAME 환경 변수:", process.env.DB_NAME);
console.log("SESSION_SECRET 환경 변수 (존재 여부만):", process.env.SESSION_SECRET ? "설정됨" : "설정 안됨 또는 비어있음");
console.log("OPENWEATHERMAP_API_KEY 환경 변수 (존재 여부만):", process.env.OPENWEATHERMAP_API_KEY ? "설정됨" : "설정 안됨 또는 비어있음");
console.log("Maps_API_KEY 환경 변수 (존재 여부만):", process.env.Maps_API_KEY ? "설정됨" : "설정 안됨 또는 비어있음");

// ✨ MySQL Connection Pool 설정 (database 옵션 제거) ✨
const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // database: process.env.DB_NAME, // <--- ✨ 이 라인을 주석 처리 또는 삭제!
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 데이터베이스 연결 테스트 및 테이블 생성 함수
async function initializeDatabase() {
  let connection;
  try {
    connection = await dbPool.getConnection();
    console.log(`MySQL 서버 (${process.env.DB_HOST})에 성공적으로 연결되었습니다. (DB 선택 전)`);
    
    const dbNameToUse = process.env.DB_NAME;
    if (!dbNameToUse) {
        console.error("DB_NAME 환경 변수가 설정되지 않았습니다! 초기화를 중단합니다.");
        throw new Error("DB_NAME is not set in environment variables");
    }

    // ✨ 수동으로 데이터베이스 선택 ✨
    console.log(`'USE \`${dbNameToUse}\`' 실행 시도...`);
    await connection.query(`USE \`${dbNameToUse}\``); // ``(백틱)으로 DB 이름 감싸기
    console.log(`'${dbNameToUse}' 데이터베이스 선택 성공!`);

    // users 테이블 생성
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("users 테이블이 성공적으로 준비되었거나 이미 존재합니다.");

    // favorites 테이블 생성
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
    console.error("오류 발생 시 DB_NAME 환경 변수 값:", process.env.DB_NAME);
    // 애플리케이션 시작에 치명적인 오류일 수 있으므로, 필요시 프로세스 종료
    // process.exit(1); 
  } finally {
    if (connection) {
      connection.release();
      console.log("DB 연결이 풀로 반환되었습니다.");
    }
  }
}

initializeDatabase();

// API 키 (이미 위에서 로깅됨)
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

// 라우트 핸들러 (이하 동일 - 이전 버전의 전체 코드를 참고하여 여기에 붙여넣으시면 됩니다)
// ... (app.get('/'), app.get('/weather'), app.get('/api/weather-by-coords'), app.get('/api/weather-forecast') ...)
// ... (app.post('/signup'), app.post('/login'), app.get('/logout') ...)
// ... (app.get('/api/current-user'), 즐겨찾기 API들: app.post/get/delete('/api/favorites') ...)

// --- 라우트 핸들러 부분 (이전 전체 코드에서 복사) ---
// 6.1. 메인 홈페이지 (루트 경로: /)
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

// 6.2. 이전 스타일 서울 날씨 페이지 (/weather) 
app.get('/weather', async (req, res) => {
  if (!OPENWEATHERMAP_API_KEY) return res.status(500).send('서버에 OpenWeatherMap API 키가 설정되지 않았어요.');
  const city = 'Seoul';
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=kr`;
  try {
    const response = await axios.get(weatherUrl); const weatherData = response.data;
    res.send(`<h2>${weatherData.name}의 현재 날씨 🌞</h2><p><strong>상태:</strong> ${weatherData.weather[0].description}</p><p><strong>온도:</strong> ${weatherData.main.temp}°C</p><p><strong>체감 온도:</strong> ${weatherData.main.feels_like}°C</p><p><strong>습도:</strong> ${weatherData.main.humidity}%</p><br><p><a href="/">홈으로 돌아가기</a></p>`);
  } catch (error) { console.error('❌ 날씨 정보 가져오기 실패:', error.message); res.status(500).send('날씨 정보를 가져오는 데 실패했어요.'); }
});

// 6.3. API: 좌표 기반 현재 날씨 정보 (/api/weather-by-coords)
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

// 6.4. API: 좌표 기반 날씨 예보 정보 (/api/weather-forecast)
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
  let connection; // ✨
  try {
    connection = await dbPool.getConnection(); // ✨
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send('이메일과 비밀번호를 모두 입력해주세요. <a href="/signup.html">다시 시도</a>');
    // ✨ DB 선택은 initializeDatabase에서 이미 처리되었거나, 풀 생성 시 database 옵션으로 처리됨
    // await connection.query(`USE \`${process.env.DB_NAME}\``); 
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
app.post('/login', async (req, res) => {
  let connection; // ✨
  try {
    connection = await dbPool.getConnection(); // ✨
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send('이메일과 비밀번호를 모두 입력해주세요. <a href="/login.html">다시 시도</a>');
    // ✨ DB 선택은 initializeDatabase에서 이미 처리되었거나, 풀 생성 시 database 옵션으로 처리됨
    // await connection.query(`USE \`${process.env.DB_NAME}\``);
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
app.get('/logout', (req, res) => {
  if (req.session.user) {
    const userEmail = req.session.user.email; 
    req.session.destroy(err => { 
      if (err) { console.error('세션 파기 중 오류 발생:', err); return res.status(500).send('로그아웃 중 오류. <a href="/">홈으로</a>'); }
      console.log(`사용자 (${userEmail}) 로그아웃 성공 및 세션 파기 완료`);
      res.redirect('/?logout=success'); 
    });
  } else { res.redirect('/'); }
});

// API: 현재 로그인된 사용자 정보 (/api/current-user)
app.get('/api/current-user', (req, res) => {
  if (req.session.user) res.json({ loggedIn: true, user: req.session.user });
  else res.json({ loggedIn: false });
});

// 즐겨찾기 관련 API 엔드포인트들
function ensureAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.status(401).json({ message: '로그인이 필요합니다. 먼저 로그인해주세요.' }); 
}
app.post('/api/favorites', ensureAuthenticated, async (req, res) => {
  let connection; // ✨
  try {
    connection = await dbPool.getConnection(); // ✨
    const { location_name, latitude, longitude } = req.body; 
    const userId = req.session.user.id;
    if (!location_name || latitude === undefined || longitude === undefined) return res.status(400).json({ message: '장소 이름, 위도, 경도가 모두 필요합니다.' });
    // ✨ DB 선택은 initializeDatabase에서 이미 처리되었거나, 풀 생성 시 database 옵션으로 처리됨
    // await connection.query(`USE \`${process.env.DB_NAME}\``);
    const sql = `INSERT INTO favorites (user_id, location_name, latitude, longitude) VALUES (?, ?, ?, ?)`;
    const [result] = await connection.query(sql, [userId, location_name, latitude, longitude]);
    res.status(201).json({ message: '즐겨찾기에 추가되었습니다.', favorite: { id: result.insertId, user_id: userId, location_name, latitude, longitude } });
    console.log(`사용자 ID ${userId}가 즐겨찾기 추가: ${location_name} (Fav ID: ${result.insertId})`);
  } catch (error) { console.error("즐겨찾기 추가 중 DB 오류:", error.message); if (error.code === 'ER_DUP_ENTRY' || error.message.includes('UNIQUE constraint failed')) return res.status(409).json({ message: '이미 즐겨찾기에 추가된 장소일 수 있습니다.' }); return res.status(500).json({ message: '즐겨찾기 추가 중 서버 오류가 발생했습니다.' });
  } finally { if (connection) connection.release(); }
});
app.get('/api/favorites', ensureAuthenticated, async (req, res) => {
  let connection; // ✨
  try {
    connection = await dbPool.getConnection(); // ✨
    const userId = req.session.user.id;
    // ✨ DB 선택은 initializeDatabase에서 이미 처리되었거나, 풀 생성 시 database 옵션으로 처리됨
    // await connection.query(`USE \`${process.env.DB_NAME}\``);
    const sql = `SELECT id, location_name, latitude, longitude, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC`;
    const [rows] = await connection.query(sql, [userId]);
    res.json(rows);
  } catch (error) { console.error("즐겨찾기 조회 중 DB 오류:", error.message); return res.status(500).json({ message: '즐겨찾기 목록을 불러오는 중 오류가 발생했습니다.' });
  } finally { if (connection) connection.release(); }
});
app.delete('/api/favorites/:id', ensureAuthenticated, async (req, res) => {
  let connection; // ✨
  try {
    connection = await dbPool.getConnection(); // ✨
    const favoriteId = req.params.id; 
    const userId = req.session.user.id;
    // ✨ DB 선택은 initializeDatabase에서 이미 처리되었거나, 풀 생성 시 database 옵션으로 처리됨
    // await connection.query(`USE \`${process.env.DB_NAME}\``);
    const sql = `DELETE FROM favorites WHERE id = ? AND user_id = ?`;
    const [result] = await connection.query(sql, [favoriteId, userId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: '해당 즐겨찾기를 찾을 수 없거나 삭제할 권한이 없습니다.' });
    res.json({ message: '즐겨찾기에서 삭제되었습니다.', favoriteId: favoriteId });
    console.log(`사용자 ID ${userId}가 즐겨찾기 삭제: Fav ID ${favoriteId}`);
  } catch (error) { console.error("즐겨찾기 삭제 중 DB 오류:", error.message); return res.status(500).json({ message: '즐겨찾기 삭제 중 오류가 발생했습니다.' });
  } finally { if (connection) connection.release(); }
});
// --- 라우트 핸들러 부분 끝 ---


// 서버 실행
app.listen(port, () => {
  console.log(`와! ${port}번 포트에서 웹사이트가 열렸어요! 브라우저에서 http://localhost:${port} 로 접속해보세요!`);
  if (OPENWEATHERMAP_API_KEY) console.log('🟢 OpenWeatherMap API 키 로드됨.');
  else console.error('🔴 중요! OpenWeatherMap API 키 로드 실패!');
  if (Maps_API_KEY) console.log('🔵 Google Maps API 키 (서버용) 로드됨.');
  else console.warn('🟡 참고: Google Maps API 키 (서버용) 로드 실패.');
});

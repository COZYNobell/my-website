// 1. 필요한 모듈 가져오기
const express = require('express');
const axios = require('axios');
require('dotenv').config();
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

// 2. Express 앱 생성 및 포트 설정
const app = express();
const port = 3000;

// 3. SQLite 데이터베이스 설정 및 테이블 생성
const dbFile = './my_website.db';
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error("데이터베이스 연결 실패:", err.message);
  } else {
    console.log(`${dbFile} 에 성공적으로 연결되었습니다.`);
    db.serialize(() => { // 여러 DB 작업을 순차적으로 실행
        // users 테이블 생성
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error("users 테이블 생성 실패:", err.message);
            else console.log("users 테이블이 성공적으로 준비되었거나 이미 존재합니다.");
        });

        // favorites 테이블 생성
        db.run(`CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            location_name TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`, (err) => {
            if (err) console.error("favorites 테이블 생성 실패:", err.message);
            else console.log("favorites 테이블이 성공적으로 준비되었거나 이미 존재합니다.");
        });
    });
  }
});

// 4. API 키 환경변수에서 로드
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const Maps_API_KEY = process.env.Maps_API_KEY;

// 5. 미들웨어 설정
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false })); // 폼 데이터 파싱
app.use(express.json()); // ✨ NEW: JSON 요청 본문 파싱을 위해 추가 (즐겨찾기 추가 시 사용)

app.use(session({
  secret: '나중에 .env 로 옮길 매우 안전한 시크릿 키!',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// 6. 라우트 핸들러

// 6.1. 메인 홈페이지 (루트 경로: /)
app.get('/', (req, res) => {
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

// ... (기존 /weather, /api/weather-by-coords, /api/weather-forecast 라우트는 이전과 동일하게 유지) ...
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

// 6.5. 사용자 인증 라우트
// 6.5.1. 회원가입 (/signup) - POST
app.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send('이메일과 비밀번호를 모두 입력해주세요. <a href="/signup.html">다시 시도</a>');
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, row) => {
      if (err) { console.error("회원가입 중 DB 조회 오류:", err.message); return res.status(500).send('회원가입 처리 중 오류. <a href="/signup.html">다시 시도</a>'); }
      if (row) return res.status(409).send('이미 가입된 이메일입니다. <a href="/login.html">로그인</a> 또는 <a href="/signup.html">다른 이메일로 가입</a>');
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      db.run("INSERT INTO users (email, password) VALUES (?, ?)", [email, hashedPassword], function(err) {
        if (err) { console.error("회원가입 중 DB 삽입 오류:", err.message); return res.status(500).send('회원가입 처리 중 오류. <a href="/signup.html">다시 시도</a>'); }
        console.log(`새로운 사용자 가입됨 (DB ID: ${this.lastID}, email: ${email})`);
        res.redirect('/login.html?signup=success');
      });
    });
  } catch (error) { console.error("회원가입 처리 중 예기치 않은 오류:", error); res.status(500).send('회원가입 처리 중 오류. <a href="/signup.html">다시 시도</a>'); }
});

// 6.5.2. 로그인 (/login) - POST
app.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send('이메일과 비밀번호를 모두 입력해주세요. <a href="/login.html">다시 시도</a>');
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
      if (err) { console.error("로그인 중 DB 조회 오류:", err.message); return res.status(500).send('로그인 처리 중 오류. <a href="/login.html">다시 시도</a>'); }
      if (!user) return res.status(401).send('가입되지 않은 이메일이거나 비밀번호가 일치하지 않습니다. <a href="/login.html">다시 시도</a>');
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(401).send('가입되지 않은 이메일이거나 비밀번호가 일치하지 않습니다. <a href="/login.html">다시 시도</a>');
      req.session.user = { id: user.id, email: user.email };
      console.log('사용자 로그인 성공:', req.session.user);
      res.redirect('/dashboard.html');
    });
  } catch (error) { console.error("로그인 처리 중 예기치 않은 오류:", error); res.status(500).send('로그인 처리 중 오류. <a href="/login.html">다시 시도</a>'); }
});

// 6.5.3. 로그아웃 (/logout) - GET
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

// 6.5.4. API: 현재 로그인된 사용자 정보 (/api/current-user)
app.get('/api/current-user', (req, res) => {
  if (req.session.user) res.json({ loggedIn: true, user: req.session.user });
  else res.json({ loggedIn: false });
});


// ✨✨✨ NEW: 즐겨찾기 관련 API 엔드포인트들 - 이 부분이 추가되었습니다! ✨✨✨

// 미들웨어: 요청이 로그인된 사용자에 의해서만 처리되도록 보장
function ensureAuthenticated(req, res, next) {
  if (req.session.user) {
    return next(); // 로그인 되어 있으면 다음 핸들러로 진행
  }
  // 로그인 안 되어 있으면 401 Unauthorized 응답 (JSON 형태로)
  res.status(401).json({ message: '로그인이 필요합니다. 먼저 로그인해주세요.' }); 
}

// 1. 즐겨찾기 추가 API (POST /api/favorites)
app.post('/api/favorites', ensureAuthenticated, (req, res) => {
  // 요청 본문에서 즐겨찾기 정보 추출 (클라이언트에서 JSON 형태로 보낼 것을 가정)
  const { location_name, latitude, longitude } = req.body; 
  const userId = req.session.user.id; // 현재 로그인한 사용자의 ID

  if (!location_name || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ message: '장소 이름, 위도, 경도가 모두 필요합니다.' });
  }

  const sql = `INSERT INTO favorites (user_id, location_name, latitude, longitude) VALUES (?, ?, ?, ?)`;
  db.run(sql, [userId, location_name, latitude, longitude], function(err) {
    if (err) {
      console.error("즐겨찾기 추가 중 DB 오류:", err.message);
      // UNIQUE 제약 조건 위반 (이미 같은 장소를 즐겨찾기 했을 경우) 등 다양한 오류 가능성
      if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ message: '이미 즐겨찾기에 추가된 장소일 수 있습니다.' });
      }
      return res.status(500).json({ message: '즐겨찾기 추가 중 서버 오류가 발생했습니다.' });
    }
    // this.lastID는 방금 INSERT된 행의 ID
    res.status(201).json({ 
        message: '즐겨찾기에 추가되었습니다.', 
        favorite: {
            id: this.lastID,
            user_id: userId,
            location_name,
            latitude,
            longitude
        }
    });
    console.log(`사용자 ID ${userId}가 즐겨찾기 추가: ${location_name} (Fav ID: ${this.lastID})`);
  });
});

// 2. 현재 사용자의 즐겨찾기 목록 조회 API (GET /api/favorites)
app.get('/api/favorites', ensureAuthenticated, (req, res) => {
  const userId = req.session.user.id;

  const sql = `SELECT id, location_name, latitude, longitude, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC`;
  db.all(sql, [userId], (err, rows) => {
    if (err) {
      console.error("즐겨찾기 조회 중 DB 오류:", err.message);
      return res.status(500).json({ message: '즐겨찾기 목록을 불러오는 중 오류가 발생했습니다.' });
    }
    res.json(rows); // 조회된 즐겨찾기 목록 (배열) 반환
  });
});

// 3. 특정 즐겨찾기 삭제 API (DELETE /api/favorites/:id)
app.delete('/api/favorites/:id', ensureAuthenticated, (req, res) => {
  const favoriteId = req.params.id; 
  const userId = req.session.user.id;

  const sql = `DELETE FROM favorites WHERE id = ? AND user_id = ?`;
  db.run(sql, [favoriteId, userId], function(err) {
    if (err) {
      console.error("즐겨찾기 삭제 중 DB 오류:", err.message);
      return res.status(500).json({ message: '즐겨찾기 삭제 중 오류가 발생했습니다.' });
    }
    if (this.changes === 0) { 
      return res.status(404).json({ message: '해당 즐겨찾기를 찾을 수 없거나 삭제할 권한이 없습니다.' });
    }
    res.json({ message: '즐겨찾기에서 삭제되었습니다.', favoriteId: favoriteId });
    console.log(`사용자 ID ${userId}가 즐겨찾기 삭제: Fav ID ${favoriteId}`);
  });
});
// ✨✨✨ NEW 즐겨찾기 API 엔드포인트 끝 ✨✨✨


// 7. 서버 실행
app.listen(port, () => {
  console.log(`와! ${port}번 포트에서 웹사이트가 열렸어요! 브라우저에서 http://localhost:${port} 로 접속해보세요!`);
  if (OPENWEATHERMAP_API_KEY) console.log('🟢 OpenWeatherMap API 키 로드됨.');
  else console.error('🔴 중요! OpenWeatherMap API 키 로드 실패!');
  if (Maps_API_KEY) console.log('🔵 Google Maps API 키 (서버용) 로드됨.');
  else console.warn('🟡 참고: Google Maps API 키 (서버용) 로드 실패.');
});
// 배포 해보자 

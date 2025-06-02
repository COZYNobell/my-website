// 1. 필요한 모듈 가져오기
const express = require('express');
const axios = require('axios');
require('dotenv').config(); 
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const path = require('path');

// 2. Express 앱 생성 및 포트 설정
const app = express();
const port = process.env.PORT || 3000;
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production'; // 개발 환경 여부

// 환경 변수 로드 확인 로그
console.log("애플리케이션 시작 - .env 파일 로드");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASSWORD (존재 여부만):", process.env.DB_PASSWORD ? "설정됨" : "설정 안됨");
console.log("DB_NAME:", process.env.DB_NAME);
console.log("SESSION_SECRET (존재 여부만):", process.env.SESSION_SECRET ? "설정됨" : "설정 안됨");
console.log("OPENWEATHERMAP_API_KEY (존재 여부만):", process.env.OPENWEATHERMAP_API_KEY ? "설정됨" : "설정 안됨");
console.log("Maps_API_KEY (존재 여부만):", process.env.Maps_API_KEY ? "설정됨" : "설정 안됨");
console.log("NODE_ENV:", process.env.NODE_ENV);

// MySQL Connection Pool 설정 (✨ 'database' 옵션 제거! ✨)
const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 데이터베이스 스키마 및 테이블 생성/확인 함수 (강화된 버전)
async function initializeDatabase() {
  let connection;
  try {
    connection = await dbPool.getConnection(); 
    console.log(`MySQL 서버 (${process.env.DB_HOST})에 성공적으로 연결되었습니다. (스키마/테이블 생성 시작)`);

    const dbNameToUse = process.env.DB_NAME;
    if (!dbNameToUse) {
      console.error("🔴 DB_NAME 환경 변수가 설정되지 않았습니다! 초기화를 중단합니다.");
      throw new Error("DB_NAME is not set in environment variables");
    }

    console.log(`'CREATE DATABASE IF NOT EXISTS \`${dbNameToUse}\`' 실행 시도...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbNameToUse}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log(`🟢 '${dbNameToUse}' 데이터베이스 생성 또는 이미 존재함.`);

    console.log(`'USE \`${dbNameToUse}\`' 실행 시도...`);
    await connection.query(`USE \`${dbNameToUse}\`;`);
    console.log(`🟢 '${dbNameToUse}' 데이터베이스 사용 준비 완료 (테이블 생성 시작).`);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("🟢 users 테이블 준비 완료.");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER NOT NULL, 
        location_name TEXT NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("🟢 favorites 테이블 준비 완료.");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS weather_subscriptions (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER NOT NULL,
        location_name VARCHAR(255) NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        condition_type VARCHAR(50) NOT NULL, 
        condition_value VARCHAR(50) NULL,    
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("🟢 weather_subscriptions 테이블 준비 완료.");
    
    console.log(`✅ 데이터베이스 '${dbNameToUse}' 및 모든 테이블이 성공적으로 준비되었습니다.`);

  } catch (error) {
    console.error("🔴 데이터베이스 초기화 중 심각한 오류 발생:", error.message);
    console.error("🔴 오류 스택:", error.stack);
  } finally {
    if (connection) {
      connection.release();
      console.log("DB 연결(초기화용)이 풀로 반환되었습니다.");
    }
  }
}

initializeDatabase();

const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const Maps_API_KEY = process.env.Maps_API_KEY;

app.use(express.static(path.join(__dirname, 'public'))); 
app.use(express.urlencoded({ extended: true })); 
app.use(express.json()); 

// 세션 미들웨어 설정
// 참고: 프로덕션 환경에서는 MemoryStore 대신 Redis나 다른 세션 스토어를 사용하는 것이 좋습니다.
app.use(session({
  secret: process.env.SESSION_SECRET || '6845ee0aea14277c760ae82669b03d5b65454f3515573c4bb84fd4f159df3a4c', 
  resave: false,
  saveUninitialized: false, 
  cookie: { 
    secure: false, // HTTP 환경 테스트를 위해 false. HTTPS 적용 후 true로 변경 필요!
    httpOnly: true, 
    maxAge: 24 * 60 * 60 * 1000 
  } 
}));

// 인증 확인 미들웨어
function ensureAuthenticated(req, res, next) {
    if (IS_DEVELOPMENT) { // 개발 환경에서만 상세 로그 출력
        console.log(`[DEBUG] ensureAuthenticated: Path: ${req.path}, Method: ${req.method}, Authenticated: ${req.session.isAuthenticated}, User: ${JSON.stringify(req.session.user)}, AcceptHeader: ${req.headers.accept}`);
    }
    if (req.session.isAuthenticated && req.session.user) {
        return next(); 
    }
    if (req.path.startsWith('/api/')) { 
        res.status(401).json({ 
            message: '로그인이 필요합니다. API 접근 권한이 없습니다.', 
            redirectTo: '/login', 
            status: 401 
        });
    } else { 
        res.redirect(`/login?message=${encodeURIComponent('로그인이 필요합니다.')}`); 
    }
}

// --- HTML 페이지 제공 라우트 ---
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/dashboard.html', ensureAuthenticated, (req, res) => { 
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.get('/subscribe', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'subscribe.html'));
});

// --- 직접 인증 라우트 ---
app.post('/signup', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).send(`이메일과 비밀번호를 모두 입력해주세요. <a href="/signup">회원가입으로 돌아가기</a>`);
    }
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.query(`USE \`${process.env.DB_NAME}\``); // ✨ DB 사용 명시 ✨

        const [existingUsers] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
        if (existingUsers.length > 0) {
            return res.status(409).send(`이미 가입된 이메일입니다. <a href="/login">로그인</a> 하시거나 <a href="/signup">다른 이메일로 가입</a>해주세요.`);
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const [result] = await connection.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hashedPassword]);
        console.log(`새 사용자 가입됨 (DB ID: ${result.insertId}, email: ${email})`);
        res.redirect(`/login?signup=success&email=${encodeURIComponent(email)}`); 
    } catch (error) {
        console.error("회원가입 처리 중 오류 발생:", error.message, error.stack);
        res.status(500).send(`회원가입 처리 중 오류가 발생했습니다: ${error.message} <a href="/signup">다시 시도</a>`);
    } finally {
        if (connection) connection.release();
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).send(`이메일과 비밀번호를 모두 입력해주세요. <a href="/login">다시 시도</a>`);
    }
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.query(`USE \`${process.env.DB_NAME}\``); // ✨ DB 사용 명시 ✨

        const [users] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
        if (users.length === 0) {
            return res.status(401).send(`가입되지 않은 이메일이거나 비밀번호가 일치하지 않습니다. <a href="/login">다시 시도</a>`);
        }
        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            req.session.user = { id: user.id, email: user.email };
            req.session.isAuthenticated = true; 
            console.log('사용자 로그인 성공:', req.session.user);
            res.redirect('/dashboard.html'); 
        } else {
            return res.status(401).send(`가입되지 않은 이메일이거나 비밀번호가 일치하지 않습니다. <a href="/login">다시 시도</a>`);
        }
    } catch (error) {
        console.error("로그인 처리 중 오류 발생:", error.message, error.stack);
        res.status(500).send(`로그인 중 오류가 발생했습니다: ${error.message} <a href="/login">다시 시도</a>`);
    } finally {
        if (connection) connection.release();
    }
});

app.get('/logout', (req, res, next) => {
    if (req.session.user) {
        const userEmail = req.session.user.email; 
        req.session.destroy(err => { 
            if (err) { 
                console.error('세션 파기 중 오류 발생:', err);
                return next(err); 
            }
            console.log(`사용자 (${userEmail}) 로그아웃 성공 및 세션 파기 완료`);
            res.redirect('/?logout=success'); 
        });
    } else {
        res.redirect('/');
    }
});

// API: 현재 로그인된 사용자 정보
app.get('/api/current-user', ensureAuthenticated, (req, res) => {
    res.json({ loggedIn: true, user: req.session.user });
});


// --- 즐겨찾기 관련 API 엔드포인트들 ---
app.post('/api/favorites', ensureAuthenticated, async (req, res) => {
  let connection; 
  try {
    connection = await dbPool.getConnection(); 
    await connection.query(`USE \`${process.env.DB_NAME}\``); // ✨ DB 사용 명시 ✨
    const { location_name, latitude, longitude } = req.body;  
    const userId = req.session.user.id; 
    if (!location_name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: '장소 이름, 위도, 경도가 모두 필요합니다.' });
    }
    const sql = `INSERT INTO favorites (user_id, location_name, latitude, longitude) VALUES (?, ?, ?, ?)`;
    const params = [userId, location_name, latitude, longitude];
    if (IS_DEVELOPMENT) {
        console.log('✨ [DEBUG] Executing SQL for POST /api/favorites:', sql, params);
    }
    const [result] = await connection.query(sql, params);
    res.status(201).json({ 
      message: '즐겨찾기에 추가되었습니다.', 
      favorite: { id: result.insertId, user_id: userId, location_name, latitude, longitude } 
    });
    console.log(`사용자 ID ${userId}가 즐겨찾기 추가: ${location_name} (Fav ID: ${result.insertId})`);
  } catch (error) { 
    console.error("즐겨찾기 추가 중 DB 오류:", error.message, error.stack); 
    if (error.code === 'ER_DUP_ENTRY' || (error.message && error.message.includes('UNIQUE constraint failed'))) {
      return res.status(409).json({ message: '이미 즐겨찾기에 추가된 장소일 수 있습니다.' }); 
    }
    return res.status(500).json({ message: `즐겨찾기 추가 중 서버 오류가 발생했습니다: ${error.message}` });
  } finally { 
    if (connection) connection.release(); 
  }
});

app.get('/api/favorites', ensureAuthenticated, async (req, res) => {
  let connection; 
  try {
    connection = await dbPool.getConnection(); 
    await connection.query(`USE \`${process.env.DB_NAME}\``); // ✨ DB 사용 명시 ✨
    const userId = req.session.user.id;
    const sql = `SELECT id, location_name, latitude, longitude, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC`;
    const params = [userId];
    if (IS_DEVELOPMENT) {
        console.log('✨ [DEBUG] Executing SQL for GET /api/favorites:', sql, params);
    }
    const [rows] = await connection.query(sql, params);
    res.json(rows);
  } catch (error) { 
    console.error("즐겨찾기 조회 중 DB 오류:", error.message, error.stack); 
    return res.status(500).json({ message: `즐겨찾기 목록을 불러오는 중 오류가 발생했습니다: ${error.message}` });
  } finally { 
    if (connection) connection.release(); 
  }
});

app.delete('/api/favorites/:id', ensureAuthenticated, async (req, res) => {
  let connection; 
  try {
    connection = await dbPool.getConnection(); 
    await connection.query(`USE \`${process.env.DB_NAME}\``); // ✨ DB 사용 명시 ✨
    const favoriteId = req.params.id;  
    const userId = req.session.user.id; 
    const sql = `DELETE FROM favorites WHERE id = ? AND user_id = ?`;
    const params = [favoriteId, userId];
    if (IS_DEVELOPMENT) {
        console.log('✨ [DEBUG] Executing SQL for DELETE /api/favorites/:id:', sql, params);
    }
    const [result] = await connection.query(sql, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '해당 즐겨찾기를 찾을 수 없거나 삭제할 권한이 없습니다.' });
    }
    res.json({ message: '즐겨찾기에서 삭제되었습니다.', favoriteId: favoriteId });
    console.log(`사용자 ID ${userId}가 즐겨찾기 삭제: Fav ID ${favoriteId}`);
  } catch (error) { 
    console.error("즐겨찾기 삭제 중 DB 오류:", error.message, error.stack); 
    return res.status(500).json({ message: `즐겨찾기 삭제 중 오류가 발생했습니다: ${error.message}` });
  } finally { 
    if (connection) connection.release(); 
  }
});


// --- 새로운 날씨 구독 관련 API 엔드포인트 ---
app.post('/api/weather-subscriptions', ensureAuthenticated, async (req, res) => {
  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.query(`USE \`${process.env.DB_NAME}\``); // ✨ DB 사용 명시 ✨

    const { location_name, latitude, longitude, condition_type, condition_value } = req.body;
    const userId = req.session.user.id;

    if (!location_name || latitude === undefined || longitude === undefined || !condition_type) {
      return res.status(400).json({ message: '지역명, 위도, 경도, 날씨 조건 종류는 필수입니다.' });
    }
    
    const sql = `
      INSERT INTO weather_subscriptions 
        (user_id, location_name, latitude, longitude, condition_type, condition_value) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const params = [userId, location_name, latitude, longitude, condition_type, condition_value || null];

    if (IS_DEVELOPMENT) {
        console.log('✨ [DEBUG] Executing SQL for POST /api/weather-subscriptions:', sql, params);
    }
    const [result] = await connection.query(sql, params);

    res.status(201).json({
      message: '날씨 구독 정보가 성공적으로 저장되었습니다.',
      subscription: {
        id: result.insertId,
        user_id: userId,
        location_name,
        latitude,
        longitude,
        condition_type,
        condition_value: condition_value || null,
        is_active: true
      }
    });
    console.log(`사용자 ID ${userId}가 날씨 구독 추가: ${location_name} - ${condition_type}`);

  } catch (error) {
    console.error("날씨 구독 추가 중 DB 오류:", error.message, error.stack);
    return res.status(500).json({ message: `날씨 구독 추가 중 서버 오류가 발생했습니다: ${error.message}` });
  } finally {
    if (connection) connection.release();
  }
});


// --- 루트 경로 ('/') 핸들러 - UI 정리된 최종 버전 ---
app.get('/', (req, res) => {
  const loggedInUserEmail = req.session.user ? req.session.user.email : '방문자';
  let authLinks = '<a href="/signup">회원가입</a> | <a href="/login">로그인</a>';
  let contextualLinks = `
    <p><a href="/dashboard.html">✨ 통합 대시보드 보기 ✨</a> (로그인 필요)</p>
    <p><a href="/subscribe">🌦️ 날씨 구독 설정하기</a> (로그인 필요)</p> 
  `; 
  if (req.session.user && req.session.isAuthenticated) {
      authLinks = `<a href="/logout">로그아웃</a> | <span>${req.session.user.email}님 환영합니다!</span>`;
      contextualLinks = `
          <p><a href="/dashboard.html">✨ 나의 통합 대시보드 바로가기 ✨</a></p>
          <p><a href="/subscribe">🌦️ 나의 날씨 구독 관리</a></p>
      `; 
  }
  res.send(`
    <h1>나의 멋진 웹사이트! 🌦️ 🗺️</h1>
    <p>안녕하세요, ${loggedInUserEmail}님!</p> 
    ${contextualLinks}
    <hr>
    <p>${authLinks}</p>
  `);
});


// --- 기존 날씨, 지도 API 라우트들 ---
app.get('/weather', async (req, res) => {
  if (!OPENWEATHERMAP_API_KEY) return res.status(500).send('서버에 OpenWeatherMap API 키가 설정되지 않았어요.');
  const city = 'Seoul';
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=kr`;
  try {
    const response = await axios.get(weatherUrl); const weatherData = response.data;
    res.send(`<h2>${weatherData.name}의 현재 날씨 🌞</h2><p><strong>상태:</strong> ${weatherData.weather[0].description}</p><p><strong>온도:</strong> ${weatherData.main.temp}°C</p><p><strong>체감 온도:</strong> ${weatherData.main.feels_like}°C</p><p><strong>습도:</strong> ${weatherData.main.humidity}%</p><br><p><a href="/">홈으로 돌아가기</a></p>`);
  } catch (error) { console.error('❌ 날씨 정보 가져오기 실패:', error.message); res.status(500).send('날씨 정보를 가져오는 데 실패했어요.'); }
});

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

// 서버 실행
app.listen(port, () => {
  console.log(`와! ${port}번 포트에서 웹사이트가 열렸어요! 브라우저에서 http://localhost:${port} 로 접속해보세요!`);
  if (OPENWEATHERMAP_API_KEY) console.log('🟢 OpenWeatherMap API 키 로드됨.');
  else console.error('🔴 중요! OpenWeatherMap API 키 로드 실패! .env 파일을 확인하세요.');
  if (Maps_API_KEY) console.log('🔵 Google Maps API 키 (서버용) 로드됨.');
  else console.warn('🟡 참고: Google Maps API 키 (서버용) 로드 실패. .env 파일을 확인하세요.');
});

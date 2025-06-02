// ✅ 개선된 server.js 최종본

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

// MySQL Pool 설정
const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// DB 초기화
async function initializeDatabase() {
  let connection;
  try {
    connection = await dbPool.getConnection();
    const dbNameToUse = process.env.DB_NAME;
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbNameToUse}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${dbNameToUse}\`;`);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER NOT NULL,
        location_name TEXT NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL,
        longitude DECIMAL(11, 8) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("✅ DB 및 테이블 초기화 완료");
  } catch (error) {
    console.error("❌ DB 초기화 중 오류:", error.message);
  } finally {
    if (connection) connection.release();
  }
}
initializeDatabase();

const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;

// 📁 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 🔐 세션 설정
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ✅ 인증 미들웨어
function ensureAuthenticated(req, res, next) {
  if (req.session.isAuthenticated && req.session.user) return next();
  if (req.path.startsWith('/api/')) {
    res.status(401).json({ message: '로그인이 필요합니다.' });
  } else {
    res.redirect(`/login?message=${encodeURIComponent('로그인이 필요합니다.')}`);
  }
}

// ✅ HTML 라우트
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

// ✅ 로그인 상태 JSON 응답
app.get('/api/current-user', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// ✅ 날씨 API 라우트
app.get('/api/weather-by-coords', async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const result = await axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=kr`);
    const weather = result.data;
    res.json({
      cityName: weather.name,
      temperature: weather.main.temp,
      feels_like: weather.main.feels_like,
      humidity: weather.main.humidity,
      description: weather.weather[0].description,
      icon: weather.weather[0].icon
    });
  } catch (e) {
    res.status(500).json({ message: '날씨 정보를 가져오는 중 오류 발생' });
  }
});

app.get('/api/weather-forecast', async (req, res) => {
  const { lat, lon } = req.query;
  try {
    const result = await axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHERMAP_API_KEY}&units=metric&lang=kr`);
    const forecastList = result.data.list;
    const summarized = forecastList.filter((_, idx) => idx % 8 === 0).slice(0, 3).map(entry => ({
      date: entry.dt_txt.split(' ')[0],
      description: entry.weather[0].description,
      temp_min: entry.main.temp_min,
      temp_max: entry.main.temp_max,
      icon: entry.weather[0].icon
    }));
    res.json({ cityName: result.data.city.name, forecast: summarized });
  } catch (e) {
    res.status(500).json({ message: '예보 정보를 가져오는 중 오류 발생' });
  }
});

// ✅ 회원가입 & 로그인 API
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).send('이메일과 비밀번호를 입력해주세요.');
  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.query(`USE \`${process.env.DB_NAME}\`;`);
    const [existing] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existing.length > 0) return res.status(409).send('이미 가입된 이메일입니다.');
    const hash = await bcrypt.hash(password, 10);
    await connection.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hash]);
    res.redirect('/login');
  } catch (e) {
    res.status(500).send(`회원가입 오류: ${e.message}`);
  } finally {
    if (connection) connection.release();
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.query(`USE \`${process.env.DB_NAME}\`;`);
    const [users] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
    if (!users.length || !(await bcrypt.compare(password, users[0].password))) {
      return res.status(401).send('이메일 또는 비밀번호가 틀립니다.');
    }
    req.session.user = { id: users[0].id, email: users[0].email };
    req.session.isAuthenticated = true;
    res.redirect('/dashboard.html');
  } catch (e) {
    res.status(500).send(`로그인 오류: ${e.message}`);
  } finally {
    if (connection) connection.release();
  }
});

// ✅ 즐겨찾기 API
app.get('/api/favorites', ensureAuthenticated, async (req, res) => {
  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.query(`USE \`${process.env.DB_NAME}\`;`);
    const [rows] = await connection.query("SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC", [req.session.user.id]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: '즐겨찾기 로드 오류' });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/api/favorites', ensureAuthenticated, async (req, res) => {
  const { location_name, latitude, longitude } = req.body;
  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.query(`USE \`${process.env.DB_NAME}\`;`);
    await connection.query("INSERT INTO favorites (user_id, location_name, latitude, longitude) VALUES (?, ?, ?, ?)", [req.session.user.id, location_name, latitude, longitude]);
    res.json({ message: '즐겨찾기에 추가되었습니다.' });
  } catch (e) {
    res.status(500).json({ message: '추가 중 오류 발생' });
  } finally {
    if (connection) connection.release();
  }
});

app.delete('/api/favorites/:id', ensureAuthenticated, async (req, res) => {
  const favoriteId = req.params.id;
  let connection;
  try {
    connection = await dbPool.getConnection();
    await connection.query(`USE \`${process.env.DB_NAME}\`;`);
    await connection.query("DELETE FROM favorites WHERE id = ? AND user_id = ?", [favoriteId, req.session.user.id]);
    res.json({ message: '즐겨찾기가 삭제되었습니다.' });
  } catch (e) {
    res.status(500).json({ message: '삭제 중 오류 발생' });
  } finally {
    if (connection) connection.release();
  }
});

// ✅ 로그아웃
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ✅ 홈 페이지
app.get('/', (req, res) => {
  const email = req.session.user ? req.session.user.email : '방문자';
  const authLinks = req.session.user ? `<a href="/logout">로그아웃</a>` : `<a href="/login">로그인</a> | <a href="/signup">회원가입</a>`;
  const dashboard = req.session.user ? `<p><a href="/dashboard.html">내 대시보드 보기</a></p>` : `<p><a href="/login">로그인 후 대시보드를 볼 수 있습니다.</a></p>`;
  res.send(`
    <h1>나의 멋진 웹사이트 🌤️</h1>
    <p>${email}님, 환영합니다!</p>
    ${dashboard}
    <p>${authLinks}</p>
  `);
});

// ✅ 서버 시작
app.listen(port, () => {
  console.log(`🌐 http://localhost:${port} 에서 서버 실행 중`);
});

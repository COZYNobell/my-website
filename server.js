// 1. 필요한 모듈 가져오기
const express = require('express');
const axios = require('axios');
require('dotenv').config(); // .env 파일 내용을 process.env로 로드 (최상단 권장)
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise'); // ✨ NEW: mysql2/promise 사용 (async/await 지원)

// 2. Express 앱 생성 및 포트 설정
const app = express();
const port = 3000;

// ✨ NEW: MySQL Connection Pool 설정 ✨
// .env 파일에서 DB 접속 정보를 가져옵니다.
const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, // 동시에 유지할 수 있는 최대 연결 수
  queueLimit: 0 // 연결 한도 도달 시 대기열 한도 (0은 무제한)
});

// ✨ NEW: 데이터베이스 연결 테스트 및 테이블 생성 함수 ✨
async function initializeDatabase() {
  try {
    const connection = await dbPool.getConnection(); // 풀에서 연결 가져오기
    console.log(`${process.env.DB_NAME} (MySQL) 데이터베이스에 성공적으로 연결되었습니다.`);

    // users 테이블 생성 (MySQL 문법에 맞게 수정)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("users 테이블이 성공적으로 준비되었거나 이미 존재합니다.");

    // favorites 테이블 생성 (MySQL 문법에 맞게 수정)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER NOT NULL,
        location_name TEXT NOT NULL,
        latitude DECIMAL(10, 8) NOT NULL, -- 위도, 경도 타입 변경
        longitude DECIMAL(11, 8) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log("favorites 테이블이 성공적으로 준비되었거나 이미 존재합니다.");

    connection.release(); // 사용한 연결은 풀에 반환
  } catch (error) {
    console.error("데이터베이스 초기화 중 오류 발생:", error.message);
    // 심각한 오류이므로 애플리케이션을 시작하지 못하게 할 수 있습니다.
    // process.exit(1); // 또는 다른 오류 처리 방식
  }
}

// 애플리케이션 시작 전에 데이터베이스 초기화 함수 호출
initializeDatabase();


// 3. API 키 환경변수에서 로드 (변경 없음)
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const Maps_API_KEY = process.env.Maps_API_KEY; // 클라이언트용 Google Maps API 키

// 4. 미들웨어 설정 (변경 없음)
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || '임시_시크릿_키_입니다_반드시_변경하세요!', // ✨ .env에서 SESSION_SECRET 가져오도록 수정
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// 5. 라우트 핸들러

// 5.1. 메인 홈페이지 (루트 경로: /) - 변경 없음
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

// ... (기존 /weather, /api/weather-by-coords, /api/weather-forecast 라우트는 DB와 직접적인 관련 없으므로 일단 유지) ...
// 5.2. 이전 스타일 서울 날씨 페이지 (/weather)
app.get('/weather', async (req, res) => { /* ... (이전 코드와 동일) ... */ });
// 5.3. API: 좌표 기반 현재 날씨 정보 (/api/weather-by-coords)
app.get('/api/weather-by-coords', async (req, res) => { /* ... (이전 코드와 동일) ... */ });
// 5.4. API: 좌표 기반 날씨 예보 정보 (/api/weather-forecast)
app.get('/api/weather-forecast', async (req, res) => { /* ... (이전 코드와 동일) ... */ });


// ✨✨✨ [수정됨] 사용자 회원가입 처리 라우트 (/signup) - MySQL 사용 ✨✨✨
app.post('/signup', async (req, res) => {
  const connection = await dbPool.getConnection(); // 풀에서 연결 가져오기
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).send('이메일과 비밀번호를 모두 입력해주세요. <a href="/signup.html">다시 시도</a>');
    }

    // 이메일 중복 확인
    const [rows] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length > 0) {
      return res.status(409).send('이미 가입된 이메일입니다. <a href="/login.html">로그인</a> 하시거나 다른 이메일로 가입해주세요. <a href="/signup.html">다시 시도</a>');
    }

    // 비밀번호 암호화
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 새 사용자 정보 삽입
    const [result] = await connection.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hashedPassword]);
    
    console.log(`새로운 사용자 가입됨 (DB ID: ${result.insertId}, email: ${email})`);
    // 개발용 로그: 현재 가입된 사용자 목록 (비밀번호 제외)
    // const [allUsers] = await connection.query("SELECT id, email, created_at FROM users");
    // console.log('현재 가입된 사용자 목록 (DB):', allUsers);

    res.redirect('/login.html?signup=success');

  } catch (error) {
    console.error("회원가입 처리 중 오류 발생:", error);
    res.status(500).send('회원가입 처리 중 오류가 발생했습니다. <a href="/signup.html">다시 시도</a>');
  } finally {
    if (connection) connection.release(); // 사용한 연결은 반드시 풀에 반환
  }
});

// ✨✨✨ [수정됨] 사용자 로그인 처리 라우트 (/login) - MySQL 사용 ✨✨✨
app.post('/login', async (req, res) => {
  const connection = await dbPool.getConnection();
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).send('이메일과 비밀번호를 모두 입력해주세요. <a href="/login.html">다시 시도</a>');
    }

    // 사용자 찾기
    const [rows] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) {
      return res.status(401).send('가입되지 않은 이메일이거나 비밀번호가 일치하지 않습니다. <a href="/login.html">다시 시도</a>');
    }
    const user = rows[0];

    // 비밀번호 비교
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).send('가입되지 않은 이메일이거나 비밀번호가 일치하지 않습니다. <a href="/login.html">다시 시도</a>');
    }

    // 로그인 성공: 세션에 사용자 정보 저장
    req.session.user = {
      id: user.id,
      email: user.email
    };
    console.log('사용자 로그인 성공:', req.session.user);
    res.redirect('/dashboard.html');

  } catch (error) {
    console.error("로그인 처리 중 오류 발생:", error);
    res.status(500).send('로그인 중 오류가 발생했습니다. <a href="/login.html">다시 시도</a>');
  } finally {
    if (connection) connection.release();
  }
});

// 6.5.3. 로그아웃 (/logout) - GET (변경 없음)
app.get('/logout', (req, res) => { /* ... (이전 코드와 동일) ... */ });

// 6.5.4. API: 현재 로그인된 사용자 정보 (/api/current-user) - 변경 없음
app.get('/api/current-user', (req, res) => { /* ... (이전 코드와 동일) ... */ });


// ✨✨✨ [수정됨] 즐겨찾기 관련 API 엔드포인트들 - MySQL 사용 ✨✨✨

// 미들웨어: 요청이 로그인된 사용자에 의해서만 처리되도록 보장 (변경 없음)
function ensureAuthenticated(req, res, next) { /* ... (이전 코드와 동일) ... */ }

// 1. 즐겨찾기 추가 API (POST /api/favorites)
app.post('/api/favorites', ensureAuthenticated, async (req, res) => { // ✨ async 추가
  const connection = await dbPool.getConnection();
  try {
    const { location_name, latitude, longitude } = req.body; 
    const userId = req.session.user.id;

    if (!location_name || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: '장소 이름, 위도, 경도가 모두 필요합니다.' });
    }

    const sql = `INSERT INTO favorites (user_id, location_name, latitude, longitude) VALUES (?, ?, ?, ?)`;
    // ✨ MySQL에서는 insertId를 결과 객체에서 바로 가져옵니다.
    const [result] = await connection.query(sql, [userId, location_name, latitude, longitude]);
    
    res.status(201).json({ 
        message: '즐겨찾기에 추가되었습니다.', 
        favorite: {
            id: result.insertId, // ✨ MySQL의 insertId 사용
            user_id: userId,
            location_name,
            latitude,
            longitude
        }
    });
    console.log(`사용자 ID ${userId}가 즐겨찾기 추가: ${location_name} (Fav ID: ${result.insertId})`);
  } catch (error) {
    console.error("즐겨찾기 추가 중 DB 오류:", error.message);
    if (error.code === 'ER_DUP_ENTRY' || error.message.includes('UNIQUE constraint failed')) { // MySQL과 SQLite의 UNIQUE 오류 메시지가 다를 수 있음
        return res.status(409).json({ message: '이미 즐겨찾기에 추가된 장소일 수 있습니다.' });
    }
    return res.status(500).json({ message: '즐겨찾기 추가 중 서버 오류가 발생했습니다.' });
  } finally {
    if (connection) connection.release();
  }
});

// 2. 현재 사용자의 즐겨찾기 목록 조회 API (GET /api/favorites)
app.get('/api/favorites', ensureAuthenticated, async (req, res) => { // ✨ async 추가
  const connection = await dbPool.getConnection();
  try {
    const userId = req.session.user.id;
    const sql = `SELECT id, location_name, latitude, longitude, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC`;
    const [rows] = await connection.query(sql, [userId]); // ✨ 결과는 배열의 첫 번째 요소에 실제 행들이 담겨있음
    res.json(rows);
  } catch (error) {
    console.error("즐겨찾기 조회 중 DB 오류:", error.message);
    return res.status(500).json({ message: '즐겨찾기 목록을 불러오는 중 오류가 발생했습니다.' });
  } finally {
    if (connection) connection.release();
  }
});

// 3. 특정 즐겨찾기 삭제 API (DELETE /api/favorites/:id)
app.delete('/api/favorites/:id', ensureAuthenticated, async (req, res) => { // ✨ async 추가
  const connection = await dbPool.getConnection();
  try {
    const favoriteId = req.params.id; 
    const userId = req.session.user.id;
    const sql = `DELETE FROM favorites WHERE id = ? AND user_id = ?`;
    const [result] = await connection.query(sql, [favoriteId, userId]); // ✨ 결과는 OkPacket 또는 유사 객체
    
    if (result.affectedRows === 0) { // ✨ MySQL에서는 affectedRows로 변경된 행 수 확인
      return res.status(404).json({ message: '해당 즐겨찾기를 찾을 수 없거나 삭제할 권한이 없습니다.' });
    }
    res.json({ message: '즐겨찾기에서 삭제되었습니다.', favoriteId: favoriteId });
    console.log(`사용자 ID ${userId}가 즐겨찾기 삭제: Fav ID ${favoriteId}`);
  } catch (error) {
    console.error("즐겨찾기 삭제 중 DB 오류:", error.message);
    return res.status(500).json({ message: '즐겨찾기 삭제 중 오류가 발생했습니다.' });
  } finally {
    if (connection) connection.release();
  }
});

// 7. 서버 실행
app.listen(port, () => {
  console.log(`와! ${port}번 포트에서 웹사이트가 열렸어요! 브라우저에서 http://localhost:${port} 로 접속해보세요!`);
  if (OPENWEATHERMAP_API_KEY) console.log('🟢 OpenWeatherMap API 키 로드됨.');
  else console.error('🔴 중요! OpenWeatherMap API 키 로드 실패!');
  if (Maps_API_KEY) console.log('🔵 Google Maps API 키 (서버용) 로드됨.');
  else console.warn('🟡 참고: Google Maps API 키 (서버용) 로드 실패.');
});

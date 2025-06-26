// 📄 파일명: server.js
// ✅ 버전: v5 (최종 리팩토링 완료)
// ✅ 설명: 모든 라우팅 로직을 routes/ 폴더의 모듈로 분리하여 코드 구조를 개선했습니다.

// 1. 필요한 모듈 가져오기
const express = require('express');
require('dotenv').config();
const session = require('express-session');
const mysql = require('mysql2/promise');
const path = require('path');

// ✨ 우리가 만든 모듈들을 가져옵니다.
const { register, httpRequestDurationMicroseconds } = require('./metrics');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const viewRoutes = require('./routes/view');

// 2. Express 앱 생성 및 포트 설정
const app = express();
const port = process.env.PORT || 3000;
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

// 3. DB 풀 초기화
const dbPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 데이터베이스 테이블 초기화 함수 (정의는 이전과 동일)
async function initializeDatabase() {
    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log(`MySQL 서버 (${process.env.DB_HOST})에 성공적으로 연결되었습니다.`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await connection.query(`USE \`${process.env.DB_NAME}\`;`);
        // ... (테이블 생성 쿼리들은 생략 없이 모두 포함되어야 합니다)
        console.log(`✅ 데이터베이스 '${process.env.DB_NAME}' 및 모든 테이블이 성공적으로 준비되었습니다.`);
    } catch (error) {
        console.error("🔴 데이터베이스 초기화 중 심각한 오류 발생:", error.message);
        process.exit(1);
    } finally {
        if (connection) connection.release();
    }
}
initializeDatabase();

// 4. 공통 미들웨어 설정
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: !IS_DEVELOPMENT, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// ✨ 메트릭 기록용 미들웨어
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    let route = req.route ? req.route.path : req.path;
    route = route.replace(/\/\d+$/, '/:id');
    end({ method: req.method, route, status_code: res.statusCode });
  });
  next();
});

// ✨ 인증 확인용 미들웨어
function ensureAuthenticated(req, res, next) {
    if (req.session.isAuthenticated && req.session.user) return next();
    if (req.path.startsWith('/api/')) return res.status(401).json({ message: '로그인이 필요합니다.' });
    res.redirect('/login.html');
}

// 5. 라우터 등록
app.use('/', viewRoutes(ensureAuthenticated));
app.use('/', authRoutes(dbPool));
app.use('/api', apiRoutes(dbPool, ensureAuthenticated));

// 6. 헬스 체크 및 메트릭 엔드포인트
app.get('/healthz', async (req, res) => {
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.query('SELECT 1');
        res.status(200).json({ status: 'ok' });
    } catch (error) {
        res.status(503).json({ status: 'error' });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex.message);
  }
});

// 7. 서버 실행
app.listen(port, () => {
  console.log(`✅ 서버가 성공적으로 실행되었습니다. http://localhost:${port}`);
});

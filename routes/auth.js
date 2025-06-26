// 📄 파일명: routes/auth.js
// ✅ 버전: v2 (디버깅)
// ✅ 설명: '/signup', '/login', '/logout' 등 모든 인증 관련 라우트 핸들러에 상세한 단계별 로그를 추가하여, 문제의 원인을 추적합니다.
// 🕒 날짜: 2025-06-25

const express = require('express');
const bcrypt = require('bcrypt');
const { SNSClient, SubscribeCommand } = require("@aws-sdk/client-sns");
const { usersRegisteredCounter } = require('../metrics');

const router = express.Router();
const snsClient = new SNSClient({ region: process.env.AWS_REGION || "ap-northeast-2" });

module.exports = function(dbPool) {

    // --- 회원가입 API 라우트 ---
    router.post('/signup', async (req, res) => {
        console.log('--- [Debug Signup] /signup 요청 수신 ---');
        const { email, password } = req.body;

        if (!email || !password) {
            console.log('[Debug Signup] 오류: 이메일 또는 비밀번호 누락.');
            return res.redirect(`/signup.html?error=${encodeURIComponent('이메일과 비밀번호를 모두 입력해주세요.')}`);
        }
        
        let connection;
        try {
            console.log('[Debug Signup] 1. DB 커넥션 가져오기 시도...');
            connection = await dbPool.getConnection();
            console.log('[Debug Signup] 2. DB 커넥션 성공. DB 사용 설정 시도...');
            await connection.query(`USE \`${process.env.DB_NAME}\``);
            console.log(`[Debug Signup] 3. DB '${process.env.DB_NAME}' 사용 설정 완료.`);

            console.log(`[Debug Signup] 4. 중복 이메일 확인 쿼리 실행: ${email}`);
            const [existingUsers] = await connection.query("SELECT id FROM users WHERE email = ?", [email]);
            
            if (existingUsers.length > 0) {
                console.log('[Debug Signup] 오류: 이미 가입된 이메일입니다.');
                return res.redirect(`/signup.html?error=${encodeURIComponent('이미 가입된 이메일입니다.')}`);
            }
            console.log('[Debug Signup] 5. 중복 이메일 없음 확인.');

            console.log('[Debug Signup] 6. 비밀번호 해싱 시작...');
            const hashedPassword = await bcrypt.hash(password, 10);
            console.log('[Debug Signup] 7. 비밀번호 해싱 완료.');
            
            console.log('[Debug Signup] 8. 사용자 정보 DB에 저장 시도...');
            await connection.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hashedPassword]);
            console.log('[Debug Signup] 9. 사용자 정보 저장 성공.');
            
            console.log('[Debug Signup] 10. 메트릭 카운터 증가 시도...');
            usersRegisteredCounter.inc(); 
            console.log('[Debug Signup] 11. 메트릭 카운터 증가 완료.');
            
            console.log(`새 사용자 가입됨: ${email}`);
            
            if (process.env.SNS_TOPIC_ARN) {
                console.log('[Debug Signup] 12. SNS 구독 요청 시도...');
                await snsClient.send(new SubscribeCommand({ Protocol: "email", TopicArn: process.env.SNS_TOPIC_ARN, Endpoint: email }));
                console.log("📧 SNS 구독 요청 완료:", email);
            }
            
            console.log('[Debug Signup] 13. 로그인 페이지로 리디렉션.');
            res.redirect(`/login.html?signup=success&email=${encodeURIComponent(email)}`);

        } catch (error) {
            console.error("🔴 [Debug Signup] 회원가입 처리 중 심각한 오류 발생:", error.message, error.stack);
            res.redirect(`/signup.html?error=${encodeURIComponent('서버 오류가 발생했습니다. 로그를 확인해주세요.')}`);
        } finally {
            if (connection) {
                console.log('[Debug Signup] 14. DB 커넥션 반환.');
                connection.release();
            }
        }
    });

    // --- 로그인 API 라우트 ---
    router.post('/login', async (req, res) => {
        console.log('--- [Debug Login] /login 요청 수신 ---');
        const { email, password } = req.body;
        if (!email || !password) return res.redirect(`/login.html?error=${encodeURIComponent('이메일과 비밀번호를 모두 입력해주세요.')}`);
        let connection;
        try {
            console.log('[Debug Login] 1. DB 커넥션 가져오기 시도...');
            connection = await dbPool.getConnection();
            console.log('[Debug Login] 2. DB 사용 설정 완료.');
            await connection.query(`USE \`${process.env.DB_NAME}\``);
            
            console.log(`[Debug Login] 3. 사용자 정보 조회 쿼리 실행: ${email}`);
            const [users] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
            if (users.length === 0) {
                console.log('[Debug Login] 오류: 사용자를 찾을 수 없음.');
                return res.redirect(`/login.html?error=${encodeURIComponent('이메일 또는 비밀번호가 일치하지 않습니다.')}`);
            }
            
            const user = users[0];
            console.log('[Debug Login] 4. 비밀번호 비교 시작...');
            const isMatch = await bcrypt.compare(password, user.password);
            
            if (isMatch) {
                console.log('[Debug Login] 5. 비밀번호 일치. 세션 생성 및 대시보드로 리디렉션.');
                req.session.user = { id: user.id, email: user.email };
                req.session.isAuthenticated = true;
                res.redirect('/dashboard.html');
            } else {
                console.log('[Debug Login] 오류: 비밀번호 불일치.');
                return res.redirect(`/login.html?error=${encodeURIComponent('이메일 또는 비밀번호가 일치하지 않습니다.')}`);
            }
        } catch (error) {
            console.error("🔴 [Debug Login] 로그인 처리 중 심각한 오류 발생:", error.message, error.stack);
            res.redirect(`/login.html?error=${encodeURIComponent('서버 오류가 발생했습니다.')}`);
        } finally {
            if (connection) {
                console.log('[Debug Login] 6. DB 커넥션 반환.');
                connection.release();
            }
        }
    });

    // --- 로그아웃 라우트 ---
    router.get('/logout', (req, res) => {
        console.log('--- [Debug Logout] /logout 요청 수신 ---');
        if (req.session.user) {
            const userEmail = req.session.user.email;
            req.session.destroy(err => {
                if (err) {
                    console.error('🔴 [Debug Logout] 세션 파기 오류:', err);
                }
                console.log(`[Debug Logout] 사용자 (${userEmail}) 로그아웃 성공.`);
                res.redirect('/?logout=success');
            });
        } else {
            console.log('[Debug Logout] 로그인된 세션 없음. 루트로 리디렉션.');
            res.redirect('/');
        }
    });

    return router;
};
